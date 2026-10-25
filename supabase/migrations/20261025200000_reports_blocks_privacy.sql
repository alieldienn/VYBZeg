-- =============================================================================
-- VYBZ: blocking, reporting and privacy settings.
--
-- Blocks
--   Blocking someone ends your friendship and pending requests and invites,
--   hides each other's posts, comments and chat messages (in both
--   directions), and stops them sending you friend requests, circle invites
--   or notifications. You can still both be in a circle you already share.
--
-- Reports
--   Anyone can report a person, post, comment or chat message they can see.
--   A copy of the reported text is saved with the report, so it can still be
--   reviewed after the original is deleted. Reports are read by the VYBZ team
--   in the Supabase dashboard; users can only see their own.
--
-- Privacy settings (on profiles)
--   friend_requests_from  everyone | friends_of_friends | nobody
--   circle_invites_from   friends | nobody
-- =============================================================================

-- ------------------------------------------------------------------ blocks ---
create table public.user_blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);
create index user_blocks_blocked_idx on public.user_blocks (blocked_id);

revoke all on public.user_blocks from anon, authenticated;
grant select, delete on public.user_blocks to authenticated;
grant insert (blocked_id) on public.user_blocks to authenticated;

alter table public.user_blocks enable row level security;
-- Only the blocker knows: the blocked person can't see who blocked them.
create policy "See the people you blocked" on public.user_blocks
  for select to authenticated using (blocker_id = (select auth.uid()));
create policy "Block as yourself" on public.user_blocks
  for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy "Unblock people you blocked" on public.user_blocks
  for delete to authenticated using (blocker_id = (select auth.uid()));

-- True when either person blocked the other.
create function private.is_blocked_between(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = p_a and b.blocked_id = p_b) or (b.blocker_id = p_b and b.blocked_id = p_a)
  );
$$;
revoke all on function private.is_blocked_between(uuid, uuid) from public, anon;
grant execute on function private.is_blocked_between(uuid, uuid) to authenticated;

-- A block ends the friendship, pending requests, invites between the two of
-- them, and notifications they caused each other.
create function private.apply_block()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.friendships
  where (requester_id = new.blocker_id and addressee_id = new.blocked_id)
     or (requester_id = new.blocked_id and addressee_id = new.blocker_id);
  delete from public.circle_invites
  where (inviter_id = new.blocker_id and invitee_id = new.blocked_id)
     or (inviter_id = new.blocked_id and invitee_id = new.blocker_id);
  delete from public.notifications
  where (user_id = new.blocker_id and actor_id = new.blocked_id)
     or (user_id = new.blocked_id and actor_id = new.blocker_id);
  return new;
end;
$$;
revoke all on function private.apply_block() from public, anon, authenticated;

create trigger user_blocks_apply
  after insert on public.user_blocks
  for each row execute function private.apply_block();

-- Hide posts both ways. Reactions and comments use can_view_post, which
-- calls this, so they disappear with the post.
create or replace function private.can_view_post_of(p_circle_id uuid, p_author_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    not private.is_blocked_between(p_author_id, (select auth.uid()))
    and case
      when p_circle_id is not null then private.is_circle_member(p_circle_id)
      else p_author_id = (select auth.uid()) or private.are_friends(p_author_id, (select auth.uid()))
    end;
$$;

drop policy "See comments on posts you can see" on public.comments;
create policy "See comments on posts you can see, except from blocked people" on public.comments
  for select to authenticated
  using (private.can_view_post(post_id) and not private.is_blocked_between(author_id, (select auth.uid())));

drop policy "Members read their circle chat" on public.circle_messages;
create policy "Members read their circle chat, except blocked people" on public.circle_messages
  for select to authenticated
  using (private.is_circle_member(circle_id) and not private.is_blocked_between(author_id, (select auth.uid())));

-- No notifications between blocked people.
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
  if p_actor is not null and private.is_blocked_between(p_user, p_actor) then
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

-- ------------------------------------------------------- privacy settings ---
alter table public.profiles
  add column friend_requests_from text not null default 'everyone'
    constraint friend_requests_from_valid check (friend_requests_from in ('everyone', 'friends_of_friends', 'nobody')),
  add column circle_invites_from text not null default 'friends'
    constraint circle_invites_from_valid check (circle_invites_from in ('friends', 'nobody'));
grant update (friend_requests_from, circle_invites_from) on public.profiles to authenticated;

-- True when you and this person have at least one friend in common.
create function private.have_mutual_friend(p_other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.friendships mine
    join public.friendships theirs
      on (case when theirs.requester_id = p_other then theirs.addressee_id else theirs.requester_id end)
       = (case when mine.requester_id = (select auth.uid()) then mine.addressee_id else mine.requester_id end)
    where mine.status = 'accepted' and theirs.status = 'accepted'
      and (select auth.uid()) in (mine.requester_id, mine.addressee_id)
      and p_other in (theirs.requester_id, theirs.addressee_id)
  );
$$;

-- May the signed-in user send this person a friend request?
create function private.accepts_friend_request(p_addressee uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not private.is_blocked_between(p_addressee, (select auth.uid()))
    and coalesce((
      select case p.friend_requests_from
        when 'everyone' then true
        when 'friends_of_friends' then private.have_mutual_friend(p_addressee)
        else false
      end
      from public.profiles p where p.id = p_addressee
    ), false);
$$;

-- May the signed-in user invite this person to a circle?
create function private.accepts_circle_invite(p_invitee uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not private.is_blocked_between(p_invitee, (select auth.uid()))
    and coalesce((select p.circle_invites_from = 'friends' from public.profiles p where p.id = p_invitee), false);
$$;

revoke all on function private.have_mutual_friend(uuid), private.accepts_friend_request(uuid), private.accepts_circle_invite(uuid)
  from public, anon;
grant execute on function private.have_mutual_friend(uuid), private.accepts_friend_request(uuid), private.accepts_circle_invite(uuid)
  to authenticated;

drop policy "Send friend requests as yourself" on public.friendships;
create policy "Send friend requests as yourself, if they accept them" on public.friendships
  for insert to authenticated
  with check (
    requester_id = (select auth.uid())
    and status = 'pending'
    and private.accepts_friend_request(addressee_id)
  );

drop policy "Members invite their friends" on public.circle_invites;
create policy "Members invite their friends, if they accept invites" on public.circle_invites
  for insert to authenticated
  with check (
    inviter_id = (select auth.uid())
    and private.is_circle_member(circle_id)
    and private.are_friends((select auth.uid()), invitee_id)
    and not private.is_user_in_circle(circle_id, invitee_id)
    and private.accepts_circle_invite(invitee_id)
  );

-- ----------------------------------------------------------------- reports ---
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null
    constraint report_kind_valid check (kind in ('user', 'post', 'comment', 'message')),
  -- The person being reported (for content: its author, filled in by the database).
  reported_user_id uuid references public.profiles (id) on delete set null,
  post_id uuid references public.posts (id) on delete set null,
  comment_id uuid references public.comments (id) on delete set null,
  message_id uuid references public.circle_messages (id) on delete set null,
  reason text not null
    constraint report_reason_valid check (
      reason in ('spam', 'harassment', 'hate', 'sexual', 'violence', 'self_harm', 'impersonation', 'other')
    ),
  details text constraint report_details_length check (char_length(details) <= 500),
  -- Copy of the reported text when the report was made.
  content_snapshot text,
  status text not null default 'open'
    constraint report_status_valid check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz not null default now()
);
create index reports_status_created_idx on public.reports (status, created_at desc);
create index reports_reporter_idx on public.reports (reporter_id);
create index reports_reported_user_idx on public.reports (reported_user_id);
create index reports_post_idx on public.reports (post_id);
create index reports_comment_idx on public.reports (comment_id);
create index reports_message_idx on public.reports (message_id);

revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;
grant insert (kind, reported_user_id, post_id, comment_id, message_id, reason, details) on public.reports to authenticated;

alter table public.reports enable row level security;
create policy "See your own reports" on public.reports
  for select to authenticated using (reporter_id = (select auth.uid()));
-- The trigger below checks that you can actually see what you report.
create policy "Report as yourself" on public.reports
  for insert to authenticated with check (reporter_id = (select auth.uid()));

-- Fills in who is reported and a copy of the content from the database itself
-- (never trusting the app), and refuses reports of things you can't see.
create function private.prepare_report()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_author uuid;
  v_text text;
begin
  new.details := nullif(btrim(new.details), '');
  case new.kind
    when 'post' then
      select p.author_id, concat_ws(' ', p.content, '[photo: post-images/' || p.image_path || ']') into v_author, v_text
      from public.posts p
      where p.id = new.post_id and private.can_view_post_of(p.circle_id, p.author_id);
      new.comment_id := null;
      new.message_id := null;
    when 'comment' then
      select c.author_id, c.content into v_author, v_text from public.comments c
      where c.id = new.comment_id and private.can_view_post(c.post_id);
      new.post_id := null;
      new.message_id := null;
    when 'message' then
      select m.author_id, m.content into v_author, v_text from public.circle_messages m
      where m.id = new.message_id and private.is_circle_member(m.circle_id);
      new.post_id := null;
      new.comment_id := null;
    else -- 'user'
      select p.id, p.display_name || ' (@' || p.username || ')' || coalesce(': ' || p.bio, '') into v_author, v_text
      from public.profiles p where p.id = new.reported_user_id and private.can_see_profile(p.id);
      new.post_id := null;
      new.comment_id := null;
      new.message_id := null;
  end case;

  if v_author is null then
    raise exception 'You can only report things you can see.' using errcode = '42501';
  end if;
  if v_author = new.reporter_id then
    raise exception 'You can''t report yourself.' using errcode = '22023';
  end if;
  new.reported_user_id := v_author;
  new.content_snapshot := v_text;
  new.status := 'open';
  return new;
end;
$$;
revoke all on function private.prepare_report() from public, anon, authenticated;

create trigger reports_prepare
  before insert on public.reports
  for each row execute function private.prepare_report();
