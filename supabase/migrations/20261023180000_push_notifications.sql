-- =============================================================================
-- VYBZ phone notifications (Web Push) + daily reminders.
--
-- How it fits together:
--  1. A device turns on notifications: the app saves its push "address"
--     (push_subscriptions) with save_push_subscription().
--  2. When a notification row is created (by the triggers in
--     20261023160000_notifications.sql), the trigger below asks the Edge
--     Function `send-push` to deliver it, using pg_net (an async web request,
--     sent only after the change is saved).
--  3. The Edge Function checks the person's preferences, writes the message
--     and sends it with the PRIVATE VAPID key, which lives only in the Edge
--     Function's secrets.
--  4. Every hour, pg_cron asks the same function to send Daily Vibe reminders.
--
-- No shared password is needed between the database and the function: a
-- notification can be pushed only once (pushed_at), only within 10 minutes of
-- being created, and a reminder at most once a day per person, so calling the
-- function yourself can't spam anyone.
-- =============================================================================

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- --------------------------------------------------------------- devices ---
-- One row per device/browser that turned notifications on.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint text not null unique
    constraint push_endpoint_valid check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh text not null constraint push_p256dh_length check (char_length(p256dh) between 20 and 200),
  auth text not null constraint push_auth_length check (char_length(auth) between 8 and 100),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;
alter table public.push_subscriptions enable row level security;
create policy "See your own devices" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Remove your own devices" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- Saves this device for the signed-in person. A device delivers to ONE account:
-- if someone else used this browser before, it moves to you (only the device
-- itself knows its endpoint, so nobody can take over someone else's device).
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'You need to be signed in.' using errcode = '42501';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id <> v_uid;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (v_uid, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;
revoke all on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- ----------------------------------------------------------- preferences ---
-- What may buzz your phone. No row = everything on (the defaults below).
-- In-app notifications (the bell) always show regardless.
create table public.notification_preferences (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  push_friends boolean not null default true,
  push_reactions boolean not null default true,
  push_circles boolean not null default true,
  push_plans boolean not null default true,
  daily_reminder boolean not null default true,
  reminder_time text not null default 'surprise'
    constraint reminder_time_valid check (reminder_time in ('morning', 'afternoon', 'evening', 'surprise')),
  -- Set by the reminder job only (one reminder per day).
  last_reminded_on date,
  updated_at timestamptz not null default now()
);

revoke all on public.notification_preferences from anon, authenticated;
grant select on public.notification_preferences to authenticated;
grant insert (push_friends, push_reactions, push_circles, push_plans, daily_reminder, reminder_time)
  on public.notification_preferences to authenticated;
grant update (push_friends, push_reactions, push_circles, push_plans, daily_reminder, reminder_time, updated_at)
  on public.notification_preferences to authenticated;
alter table public.notification_preferences enable row level security;
create policy "See your own preferences" on public.notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Create your own preferences" on public.notification_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Change your own preferences" on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ------------------------------------------------------ sending pushes ---
-- When each notification was pushed to phones (null = not yet).
alter table public.notifications add column pushed_at timestamptz;

-- A refreshed notification (same thing happening again) may be pushed again.
create or replace function private.notify(
  p_user uuid, p_actor uuid, p_type text, p_key text,
  p_post uuid default null, p_comment uuid default null, p_circle uuid default null,
  p_poll uuid default null, p_invite uuid default null, p_detail text default null
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null or p_user = p_actor then
    return;
  end if;
  insert into public.notifications (user_id, actor_id, type, dedupe_key, post_id, comment_id, circle_id, poll_id, invite_id, detail)
  values (p_user, p_actor, p_type, p_key, p_post, p_comment, p_circle, p_poll, p_invite, p_detail)
  on conflict (user_id, dedupe_key) do update
    set actor_id = excluded.actor_id,
        detail = excluded.detail,
        created_at = now(),
        read_at = null,
        pushed_at = null;
end;
$$;
revoke all on function private.notify(uuid, uuid, text, text, uuid, uuid, uuid, uuid, uuid, text) from public, anon, authenticated;

-- The Edge Function's address (not a secret).
create function private.push_function_url()
returns text language sql immutable set search_path = '' as $$
  select 'https://kpybkxjjqxhfnjogismr.supabase.co/functions/v1/send-push';
$$;

-- Ask the Edge Function to push a new notification, if that person has any device on.
create function private.push_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.pushed_at is not null then
    return null;
  end if;
  if exists (select 1 from public.push_subscriptions s where s.user_id = new.user_id) then
    perform net.http_post(
      url := private.push_function_url(),
      body := jsonb_build_object('notification_id', new.id),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 10000
    );
  end if;
  return null;
end;
$$;
create trigger notifications_push
  after insert or update of created_at on public.notifications
  for each row execute function private.push_notification();

-- ------------------------------------------------------ daily reminders ---
-- Picks who gets the Daily Vibe reminder this hour (Cairo time) and marks them
-- as reminded, all at once, so nobody gets two in a day. Only for people with
-- a device on, the reminder switched on, and no post yet today.
-- Times: morning 9:00, afternoon 14:00, evening 20:00, surprise = a different
-- hour between 10:00 and 20:00 each day.
-- p_now is only there so tests can pretend it's a certain time.
create function public.claim_daily_reminders(p_now timestamptz default now())
returns table (user_id uuid, prompt_id uuid, prompt_emoji text, prompt_text text)
language plpgsql security definer set search_path = '' as $$
-- "user_id" is both a result column and a table column: always mean the table column.
#variable_conflict use_column
declare
  v_now timestamp := p_now at time zone 'Africa/Cairo';
  v_today date := v_now::date;
  v_hour int := extract(hour from v_now)::int;
  v_day_start timestamptz := (v_today::timestamp at time zone 'Africa/Cairo');
begin
  return query
  with candidates as (
    select distinct s.user_id
    from public.push_subscriptions s
    left join public.notification_preferences p on p.user_id = s.user_id
    where coalesce(p.daily_reminder, true)
      and p.last_reminded_on is distinct from v_today
      and v_hour = case coalesce(p.reminder_time, 'surprise')
        when 'morning' then 9
        when 'afternoon' then 14
        when 'evening' then 20
        else 10 + ((hashtext(s.user_id::text || v_today::text)::bigint % 11) + 11) % 11
      end
      and not exists (
        select 1 from public.posts po where po.author_id = s.user_id and po.created_at >= v_day_start
      )
  ),
  marked as (
    insert into public.notification_preferences as np (user_id, last_reminded_on)
    select c.user_id, v_today from candidates c
    on conflict (user_id) do update set last_reminded_on = v_today
      where np.last_reminded_on is distinct from v_today
    returning np.user_id
  )
  select m.user_id, d.id, d.emoji, d.prompt_text
  from marked m
  left join public.daily_prompts d on d.active_date = v_today;
end;
$$;
-- Only the Edge Function (service role) may run this.
revoke all on function public.claim_daily_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.claim_daily_reminders(timestamptz) to service_role;

-- Every hour on the hour.
select cron.schedule(
  'vybz-daily-reminders',
  '0 * * * *',
  $$select net.http_post(
      url := private.push_function_url(),
      body := '{"reminders": true}'::jsonb,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 30000
    )$$
);

revoke all on function private.push_function_url() from public, anon, authenticated;
revoke all on function private.push_notification() from public, anon, authenticated;
