-- =============================================================================
-- VYBZ notifications (in-app).
--
-- Notifications are created ONLY by the database, by triggers on things that
-- really happen (friend requests, reactions, comments, invites, joins, plans,
-- votes). Users can't create them, so nobody can fake one or spam someone.
-- Each person can only read, mark as read and delete their OWN notifications.
--
-- `dedupe_key` keeps one row per "thing" (e.g. one notification per person
-- reacting to a post, one per plan for votes), so changing a reaction or a
-- vote never piles up duplicates.
-- =============================================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  -- Who sees it.
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Who did the thing (null if their account is gone).
  actor_id uuid references public.profiles (id) on delete cascade,
  type text not null
    constraint notification_type_valid check (type in (
      'friend_request', 'friend_accepted',
      'reaction', 'comment',
      'circle_invite', 'circle_joined',
      'plan_created', 'plan_vote', 'plan_locked'
    )),
  -- What it's about. Deleting that thing deletes the notification too.
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  circle_id uuid references public.circles (id) on delete cascade,
  poll_id uuid references public.polls (id) on delete cascade,
  invite_id uuid references public.circle_invites (id) on delete cascade,
  -- Small extra info: the reaction emoji key, a vote count, or the winning plan option.
  detail text constraint notification_detail_length check (char_length(detail) <= 80),
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint one_notification_per_thing unique (user_id, dedupe_key)
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_actor_idx on public.notifications (actor_id);
create index notifications_post_idx on public.notifications (post_id);
create index notifications_comment_idx on public.notifications (comment_id);
create index notifications_circle_idx on public.notifications (circle_id);
create index notifications_poll_idx on public.notifications (poll_id);
create index notifications_invite_idx on public.notifications (invite_id);

-- What signed-in users may touch at all; RLS then limits it to their own rows.
revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

alter table public.notifications enable row level security;

create policy "See your own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Mark your own notifications as read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Clear your own notifications" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Creating notifications (private: only the triggers below use this)
-- -----------------------------------------------------------------------------

-- Adds (or refreshes) one notification. Never notifies you about your own actions.
create function private.notify(
  p_user uuid,
  p_actor uuid,
  p_type text,
  p_key text,
  p_post uuid default null,
  p_comment uuid default null,
  p_circle uuid default null,
  p_poll uuid default null,
  p_invite uuid default null,
  p_detail text default null
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
        read_at = null;
end;
$$;

-- Friend requests: new request → the other person; accepted → the sender.
-- A declined request stays quiet for the sender (as in the app).
create function private.notify_friendship()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform private.notify(new.addressee_id, new.requester_id, 'friend_request', 'friend_request:' || new.requester_id);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'accepted' then
      perform private.notify(new.requester_id, new.addressee_id, 'friend_accepted', 'friend_accepted:' || new.addressee_id);
    end if;
    -- The request has been answered: its notification is done.
    update public.notifications set read_at = coalesce(read_at, now())
    where user_id = new.addressee_id and dedupe_key = 'friend_request:' || new.requester_id;
  elsif tg_op = 'DELETE' then
    -- Request cancelled or friendship removed.
    delete from public.notifications
    where (user_id = old.addressee_id and dedupe_key = 'friend_request:' || old.requester_id)
       or (user_id = old.requester_id and dedupe_key = 'friend_accepted:' || old.addressee_id);
  end if;
  return null;
end;
$$;
create trigger friendships_notify
  after insert or update of status or delete on public.friendships
  for each row execute function private.notify_friendship();

-- Reactions → the post's author. Switching emoji updates it; removing deletes it.
create function private.notify_reaction()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_author uuid;
  v_circle uuid;
begin
  if tg_op = 'DELETE' then
    delete from public.notifications
    where post_id = old.post_id and type = 'reaction' and actor_id = old.user_id;
    return null;
  end if;
  if tg_op = 'UPDATE' then
    update public.notifications set detail = new.reaction_type::text
    where post_id = new.post_id and type = 'reaction' and actor_id = new.user_id;
    return null;
  end if;
  select author_id, circle_id into v_author, v_circle from public.posts where id = new.post_id;
  perform private.notify(v_author, new.user_id, 'reaction', 'reaction:' || new.post_id || ':' || new.user_id,
    p_post => new.post_id, p_circle => v_circle, p_detail => new.reaction_type::text);
  return null;
end;
$$;
create trigger reactions_notify
  after insert or update of reaction_type or delete on public.reactions
  for each row execute function private.notify_reaction();

-- Comments → the post's author. Deleting the comment deletes it (foreign key).
create function private.notify_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_author uuid;
  v_circle uuid;
begin
  select author_id, circle_id into v_author, v_circle from public.posts where id = new.post_id;
  perform private.notify(v_author, new.author_id, 'comment', 'comment:' || new.id,
    p_post => new.post_id, p_comment => new.id, p_circle => v_circle);
  return null;
end;
$$;
create trigger comments_notify
  after insert on public.comments
  for each row execute function private.notify_comment();

-- Circle invites → the invited person. Accepting or cancelling the invite removes it (foreign key).
create function private.notify_circle_invite()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify(new.invitee_id, new.inviter_id, 'circle_invite', 'circle_invite:' || new.circle_id,
    p_circle => new.circle_id, p_invite => new.id);
  return null;
end;
$$;
create trigger circle_invites_notify
  after insert on public.circle_invites
  for each row execute function private.notify_circle_invite();

-- Someone joined a circle → its owner and admins.
-- Leaving a circle clears your notifications about it.
create function private.notify_circle_member()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid;
begin
  if tg_op = 'DELETE' then
    delete from public.notifications where user_id = old.user_id and circle_id = old.circle_id;
    return null;
  end if;
  if new.role <> 'member' then
    return null; -- The owner being added when a circle is created.
  end if;
  for v_admin in
    select user_id from public.circle_members where circle_id = new.circle_id and role in ('owner', 'admin')
  loop
    perform private.notify(v_admin, new.user_id, 'circle_joined', 'circle_joined:' || new.circle_id || ':' || new.user_id,
      p_circle => new.circle_id);
  end loop;
  return null;
end;
$$;
create trigger circle_members_notify
  after insert or delete on public.circle_members
  for each row execute function private.notify_circle_member();

-- Plans: a new plan → everyone else in the circle; locked in → everyone else, with the winner.
create function private.notify_poll()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_member uuid;
  v_winner text;
begin
  if tg_op = 'INSERT' then
    for v_member in select user_id from public.circle_members where circle_id = new.circle_id loop
      perform private.notify(v_member, new.creator_id, 'plan_created', 'plan_created:' || new.id,
        p_circle => new.circle_id, p_poll => new.id);
    end loop;
  elsif old.closed_at is null and new.closed_at is not null then
    -- Same rule as the app: most votes wins, the first option wins a tie.
    select o.option_text into v_winner
    from public.poll_options o
    left join public.poll_votes v on v.option_id = o.id
    where o.poll_id = new.id
    group by o.id, o.option_text, o.position
    having count(v.id) > 0
    order by count(v.id) desc, o.position
    limit 1;
    for v_member in select user_id from public.circle_members where circle_id = new.circle_id loop
      perform private.notify(v_member, new.creator_id, 'plan_locked', 'plan_locked:' || new.id,
        p_circle => new.circle_id, p_poll => new.id, p_detail => v_winner);
    end loop;
  end if;
  return null;
end;
$$;
create trigger polls_notify
  after insert or update of closed_at on public.polls
  for each row execute function private.notify_poll();

-- Votes → the plan's creator. One notification per plan (latest voter + vote count), not one per vote.
create function private.notify_poll_vote()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_creator uuid;
  v_circle uuid;
  v_votes int;
begin
  select creator_id, circle_id into v_creator, v_circle from public.polls where id = new.poll_id;
  select count(*) into v_votes from public.poll_votes where poll_id = new.poll_id;
  perform private.notify(v_creator, new.user_id, 'plan_vote', 'plan_vote:' || new.poll_id,
    p_circle => v_circle, p_poll => new.poll_id, p_detail => v_votes::text);
  return null;
end;
$$;
create trigger poll_votes_notify
  after insert on public.poll_votes
  for each row execute function private.notify_poll_vote();

-- Nobody may call these directly; they only run as triggers.
revoke all on function private.notify(uuid, uuid, text, text, uuid, uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.notify_friendship() from public, anon, authenticated;
revoke all on function private.notify_reaction() from public, anon, authenticated;
revoke all on function private.notify_comment() from public, anon, authenticated;
revoke all on function private.notify_circle_invite() from public, anon, authenticated;
revoke all on function private.notify_circle_member() from public, anon, authenticated;
revoke all on function private.notify_poll() from public, anon, authenticated;
revoke all on function private.notify_poll_vote() from public, anon, authenticated;
