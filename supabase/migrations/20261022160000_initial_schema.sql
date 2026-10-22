-- =============================================================================
-- VYBZ: initial database schema, helper functions and Row Level Security.
--
-- Everything that protects private data lives in this file, in the same
-- migration as the tables, so a table never exists without its RLS rules.
--
-- Conventions
--   * `(select auth.uid())` is the id of the signed-in user. Wrapping it in a
--     sub-select lets Postgres evaluate it once per query instead of per row.
--   * Helper functions that look at other tables live in the `private` schema.
--     That schema is NOT exposed through the Supabase API, so users can't call
--     them directly. They are SECURITY DEFINER so policies can use them without
--     triggering each other's policies (which would cause infinite recursion).
--   * The `anon` role (not signed in) gets no access to any table.
--   * The `authenticated` role gets column-level privileges: columns such as
--     author_id or created_at are filled by defaults and can't be set or changed
--     by users, which prevents impersonation and back-dating.
-- =============================================================================

create schema if not exists private;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
create type public.friendship_status as enum ('pending', 'accepted', 'rejected');
create type public.circle_role as enum ('owner', 'admin', 'member');
create type public.reaction_type as enum ('fire', 'lol', 'love', 'care', 'wow');

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- One row per person who finished onboarding. A signed-up user without a row
-- here is sent to /onboarding by the app.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    constraint username_format check (username ~ '^[a-z0-9._]{3,20}$'),
  display_name text not null
    constraint display_name_length check (char_length(btrim(display_name)) between 2 and 40),
  -- Path inside the public `avatars` bucket. Must be in the user's own folder.
  avatar_path text
    constraint avatar_path_owned check (avatar_path is null or avatar_path like (id::text || '/%')),
  -- Colour of the generated initials avatar used when there is no photo.
  avatar_hue smallint not null default floor(random() * 360)
    constraint avatar_hue_range check (avatar_hue between 0 and 359),
  bio text constraint bio_length check (char_length(bio) <= 120),
  area text constraint area_length check (char_length(area) <= 40),
  created_at timestamptz not null default now()
);

create table public.friendships (
  requester_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  constraint no_self_friendship check (requester_id <> addressee_id)
);
-- Only one friendship row per pair of people, whichever direction it was sent.
create unique index friendships_pair_unique
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id);

create table public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null
    constraint circle_name_length check (char_length(btrim(name)) between 2 and 30),
  description text
    constraint circle_description_length check (char_length(description) <= 120),
  emoji text not null default '🫶'
    constraint circle_emoji_length check (char_length(emoji) between 1 and 8),
  color text not null default 'violet'
    constraint circle_color_valid check (color in ('violet', 'midnight', 'sunset', 'ocean', 'lime')),
  creator_id uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index circles_creator_idx on public.circles (creator_id);

create table public.circle_members (
  circle_id uuid not null references public.circles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.circle_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);
create index circle_members_user_idx on public.circle_members (user_id);
create unique index circle_members_one_owner on public.circle_members (circle_id) where role = 'owner';

-- Pending invitations. Accepting one (via accept_circle_invite) is the ONLY way
-- to join a circle, so knowing a circle's id is not enough to get in.
create table public.circle_invites (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  invitee_id uuid not null references public.profiles (id) on delete cascade,
  inviter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint one_invite_per_person unique (circle_id, invitee_id),
  constraint no_self_invite check (invitee_id <> inviter_id)
);
create index circle_invites_invitee_idx on public.circle_invites (invitee_id);
create index circle_invites_inviter_idx on public.circle_invites (inviter_id);

-- One prompt per day (Egypt time). Managed by the VYBZ team, read-only for users.
create table public.daily_prompts (
  id uuid primary key default gen_random_uuid(),
  emoji text not null default '✨',
  prompt_text text not null
    constraint prompt_text_length check (char_length(btrim(prompt_text)) between 3 and 120),
  active_date date not null unique,
  created_at timestamptz not null default now()
);

-- Every post belongs to exactly one circle (no public or "all friends" posts in v1).
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  circle_id uuid not null references public.circles (id) on delete cascade,
  content text
    constraint post_content_length check (char_length(content) <= 280),
  -- Path inside the private `post-images` bucket: <circle_id>/<author_id>/<file>.
  image_path text,
  prompt_id uuid references public.daily_prompts (id) on delete set null,
  -- Gradient behind text-only posts.
  background text
    constraint post_background_valid check (background in ('violet', 'midnight', 'sunset', 'ocean', 'lime')),
  location text
    constraint post_location_length check (char_length(location) <= 40),
  created_at timestamptz not null default now(),
  constraint post_not_empty check (image_path is not null or char_length(btrim(coalesce(content, ''))) > 0),
  constraint post_image_path_owned check (
    image_path is null or image_path like (circle_id::text || '/' || author_id::text || '/%')
  )
);
create index posts_circle_created_idx on public.posts (circle_id, created_at desc);
create index posts_author_idx on public.posts (author_id);
create index posts_prompt_idx on public.posts (prompt_id);

-- One reaction per person per post (tap another emoji to switch).
create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reaction_type public.reaction_type not null,
  created_at timestamptz not null default now(),
  constraint one_reaction_per_post unique (post_id, user_id)
);
create index reactions_user_idx on public.reactions (user_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  content text not null
    constraint comment_length check (char_length(btrim(content)) between 1 and 300),
  created_at timestamptz not null default now()
);
create index comments_post_created_idx on public.comments (post_id, created_at);
create index comments_author_idx on public.comments (author_id);

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  creator_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  question text not null
    constraint poll_question_length check (char_length(btrim(question)) between 1 and 80),
  -- Free text like "This weekend" or "Thu · 8 PM".
  when_label text
    constraint poll_when_length check (char_length(when_label) <= 30),
  created_at timestamptz not null default now(),
  -- Optional automatic deadline.
  closes_at timestamptz,
  -- Set when the creator locks in the plan. Voting stops either way.
  closed_at timestamptz,
  constraint poll_closes_in_future check (closes_at is null or closes_at > created_at)
);
create index polls_circle_created_idx on public.polls (circle_id, created_at desc);
create index polls_creator_idx on public.polls (creator_id);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  option_text text not null
    constraint option_text_length check (char_length(btrim(option_text)) between 1 and 40),
  category text not null default 'outing'
    constraint option_category_valid check (
      category in ('cafe', 'football', 'padel', 'gaming', 'outing', 'food', 'cinema', 'beach')
    ),
  detail text
    constraint option_detail_length check (char_length(detail) <= 40),
  position smallint not null default 0,
  -- Lets poll_votes check that the chosen option belongs to the same poll.
  constraint poll_options_id_poll_unique unique (id, poll_id)
);
create index poll_options_poll_idx on public.poll_options (poll_id, position);

-- One vote per person per poll. Changing your vote updates the row.
create table public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  option_id uuid not null,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint one_vote_per_poll unique (poll_id, user_id),
  constraint vote_option_in_poll foreign key (option_id, poll_id)
    references public.poll_options (id, poll_id) on delete cascade
);
create index poll_votes_option_idx on public.poll_votes (option_id, poll_id);
create index poll_votes_user_idx on public.poll_votes (user_id);

-- -----------------------------------------------------------------------------
-- Private helper functions (used by policies; not callable through the API)
-- -----------------------------------------------------------------------------

create function private.is_circle_member(p_circle_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.circle_members m
    where m.circle_id = p_circle_id and m.user_id = (select auth.uid())
  );
$$;

create function private.is_user_in_circle(p_circle_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.circle_members m
    where m.circle_id = p_circle_id and m.user_id = p_user_id
  );
$$;

create function private.circle_role_of(p_circle_id uuid)
returns public.circle_role language sql stable security definer set search_path = '' as $$
  select m.role from public.circle_members m
  where m.circle_id = p_circle_id and m.user_id = (select auth.uid());
$$;

create function private.is_circle_admin(p_circle_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.circle_role_of(p_circle_id) in ('owner', 'admin'), false);
$$;

create function private.has_circle_invite(p_circle_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.circle_invites i
    where i.circle_id = p_circle_id and i.invitee_id = (select auth.uid())
  );
$$;

create function private.are_friends(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = p_a and f.addressee_id = p_b) or (f.requester_id = p_b and f.addressee_id = p_a))
  );
$$;

-- Who may see a profile: yourself, anyone you have a friendship row with
-- (pending, accepted or rejected), anyone you share a circle with, people
-- invited to your circles, and the person who invited you somewhere.
create function private.can_see_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    p_profile_id = (select auth.uid())
    or exists (
      select 1 from public.friendships f
      where (f.requester_id = (select auth.uid()) and f.addressee_id = p_profile_id)
         or (f.addressee_id = (select auth.uid()) and f.requester_id = p_profile_id)
    )
    or exists (
      select 1
      from public.circle_members mine
      join public.circle_members theirs on theirs.circle_id = mine.circle_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = p_profile_id
    )
    or exists (
      select 1
      from public.circle_invites i
      join public.circle_members mine on mine.circle_id = i.circle_id and mine.user_id = (select auth.uid())
      where i.invitee_id = p_profile_id
    )
    or exists (
      select 1 from public.circle_invites i
      where i.invitee_id = (select auth.uid()) and i.inviter_id = p_profile_id
    );
$$;

create function private.can_view_post(p_post_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.posts p
    join public.circle_members m on m.circle_id = p.circle_id and m.user_id = (select auth.uid())
    where p.id = p_post_id
  );
$$;

create function private.is_post_author(p_post_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.posts p where p.id = p_post_id and p.author_id = (select auth.uid())
  );
$$;

create function private.can_view_poll(p_poll_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.polls p
    join public.circle_members m on m.circle_id = p.circle_id and m.user_id = (select auth.uid())
    where p.id = p_poll_id
  );
$$;

create function private.is_poll_creator(p_poll_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.polls p where p.id = p_poll_id and p.creator_id = (select auth.uid())
  );
$$;

create function private.poll_is_open(p_poll_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.polls p
    where p.id = p_poll_id and p.closed_at is null and (p.closes_at is null or p.closes_at > now())
  );
$$;

create function private.poll_has_votes(p_poll_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.poll_votes v where v.poll_id = p_poll_id);
$$;

-- Lock helpers down: only signed-in users (and the policies they trigger) may run them.
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- Whoever creates a circle automatically becomes its owner.
create function private.add_circle_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.circle_members (circle_id, user_id, role) values (new.id, new.creator_id, 'owner');
  return new;
end;
$$;
revoke all on function private.add_circle_owner() from public, anon, authenticated;

create trigger circles_add_owner
  after insert on public.circles
  for each row execute function private.add_circle_owner();

-- -----------------------------------------------------------------------------
-- Public functions (callable from the app with supabase.rpc)
-- -----------------------------------------------------------------------------

-- Exact-username lookup, used for "add friend" and to check if a username is
-- free during onboarding. Returns only public basics and never lists everyone.
create function public.find_profile_by_username(p_username text)
returns table (id uuid, username text, display_name text, avatar_path text, avatar_hue smallint)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.display_name, p.avatar_path, p.avatar_hue
  from public.profiles p
  where (select auth.uid()) is not null
    and p.username = lower(btrim(p_username));
$$;

-- Accept an invite: the only way to join a circle.
create function public.accept_circle_invite(p_circle_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'You need to be signed in.' using errcode = '42501';
  end if;

  delete from public.circle_invites where circle_id = p_circle_id and invitee_id = v_uid;
  if not found then
    raise exception 'This invite no longer exists.' using errcode = '42501';
  end if;

  insert into public.circle_members (circle_id, user_id, role)
  values (p_circle_id, v_uid, 'member')
  on conflict (circle_id, user_id) do nothing;
end;
$$;

-- Create a poll and its options in one go (all or nothing).
-- SECURITY INVOKER: runs as the user, so every RLS policy below still applies.
create function public.create_poll(
  p_circle_id uuid,
  p_question text,
  p_when_label text,
  p_closes_at timestamptz,
  p_options jsonb
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_poll_id uuid;
begin
  if jsonb_typeof(p_options) <> 'array' or jsonb_array_length(p_options) not between 2 and 6 then
    raise exception 'A plan needs between 2 and 6 options.' using errcode = '22023';
  end if;

  insert into public.polls (circle_id, question, when_label, closes_at)
  values (p_circle_id, btrim(p_question), nullif(btrim(p_when_label), ''), p_closes_at)
  returning id into v_poll_id;

  insert into public.poll_options (poll_id, option_text, category, detail, position)
  select
    v_poll_id,
    btrim(o ->> 'text'),
    coalesce(o ->> 'category', 'outing'),
    nullif(btrim(o ->> 'detail'), ''),
    (ord - 1)::smallint
  from jsonb_array_elements(p_options) with ordinality as t(o, ord);

  return v_poll_id;
end;
$$;

revoke all on function public.find_profile_by_username(text) from public, anon;
revoke all on function public.accept_circle_invite(uuid) from public, anon;
revoke all on function public.create_poll(uuid, text, text, timestamptz, jsonb) from public, anon;
grant execute on function public.find_profile_by_username(text) to authenticated;
grant execute on function public.accept_circle_invite(uuid) to authenticated;
grant execute on function public.create_poll(uuid, text, text, timestamptz, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Table privileges (what each role may touch at all; RLS then filters rows)
-- -----------------------------------------------------------------------------
revoke all on
  public.profiles, public.friendships, public.circles, public.circle_members, public.circle_invites,
  public.daily_prompts, public.posts, public.reactions, public.comments,
  public.polls, public.poll_options, public.poll_votes
from anon, authenticated;

grant select on public.profiles to authenticated;
grant insert (id, username, display_name, avatar_path, bio, area) on public.profiles to authenticated;
grant update (username, display_name, avatar_path, bio, area) on public.profiles to authenticated;

grant select, delete on public.friendships to authenticated;
grant insert (addressee_id) on public.friendships to authenticated;
grant update (status) on public.friendships to authenticated;

grant select, delete on public.circles to authenticated;
grant insert (id, name, description, emoji, color) on public.circles to authenticated;
grant update (name, description, emoji, color) on public.circles to authenticated;

grant select, delete on public.circle_members to authenticated;
grant update (role) on public.circle_members to authenticated;

grant select, delete on public.circle_invites to authenticated;
grant insert (circle_id, invitee_id) on public.circle_invites to authenticated;

grant select on public.daily_prompts to authenticated;

grant select, delete on public.posts to authenticated;
grant insert (id, circle_id, content, image_path, prompt_id, background, location) on public.posts to authenticated;

grant select, delete on public.reactions to authenticated;
grant insert (post_id, reaction_type) on public.reactions to authenticated;
grant update (reaction_type) on public.reactions to authenticated;

grant select, delete on public.comments to authenticated;
grant insert (post_id, content) on public.comments to authenticated;

grant select, delete on public.polls to authenticated;
grant insert (circle_id, question, when_label, closes_at) on public.polls to authenticated;
grant update (closed_at) on public.polls to authenticated;

grant select on public.poll_options to authenticated;
grant insert (poll_id, option_text, category, detail, position) on public.poll_options to authenticated;

grant select, delete on public.poll_votes to authenticated;
grant insert (poll_id, option_id) on public.poll_votes to authenticated;
grant update (option_id) on public.poll_votes to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.circle_invites enable row level security;
alter table public.daily_prompts enable row level security;
alter table public.posts enable row level security;
alter table public.reactions enable row level security;
alter table public.comments enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

-- profiles ---------------------------------------------------------------------
create policy "See profiles of people you are connected to" on public.profiles
  for select to authenticated using (private.can_see_profile(id));
create policy "Create your own profile" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "Edit your own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- friendships ------------------------------------------------------------------
create policy "See your own friendships" on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));
create policy "Send friend requests as yourself" on public.friendships
  for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'pending');
create policy "Answer requests sent to you" on public.friendships
  for update to authenticated
  using (addressee_id = (select auth.uid()) and status = 'pending')
  with check (addressee_id = (select auth.uid()) and status in ('accepted', 'rejected'));
create policy "Cancel or remove your friendships" on public.friendships
  for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- circles ----------------------------------------------------------------------
create policy "Members and invitees see a circle" on public.circles
  for select to authenticated
  using (private.is_circle_member(id) or private.has_circle_invite(id));
create policy "Create circles as yourself" on public.circles
  for insert to authenticated with check (creator_id = (select auth.uid()));
create policy "Admins edit circle details" on public.circles
  for update to authenticated
  using (private.is_circle_admin(id)) with check (private.is_circle_admin(id));
create policy "Owner deletes the circle" on public.circles
  for delete to authenticated using (private.circle_role_of(id) = 'owner');

-- circle_members (no insert policy: rows come only from the owner trigger
-- and accept_circle_invite) ------------------------------------------------------
create policy "Members see who is in their circle" on public.circle_members
  for select to authenticated using (private.is_circle_member(circle_id));
create policy "Owner changes member roles" on public.circle_members
  for update to authenticated
  using (private.circle_role_of(circle_id) = 'owner' and role <> 'owner')
  with check (role in ('admin', 'member'));
create policy "Leave a circle or remove members" on public.circle_members
  for delete to authenticated
  using (
    (user_id = (select auth.uid()) and role <> 'owner')
    or (role = 'member' and private.is_circle_admin(circle_id))
    or (role = 'admin' and private.circle_role_of(circle_id) = 'owner')
  );

-- circle_invites ---------------------------------------------------------------
create policy "See invites you sent, received, or in your circles" on public.circle_invites
  for select to authenticated
  using (
    invitee_id = (select auth.uid())
    or inviter_id = (select auth.uid())
    or private.is_circle_member(circle_id)
  );
create policy "Members invite their friends" on public.circle_invites
  for insert to authenticated
  with check (
    inviter_id = (select auth.uid())
    and private.is_circle_member(circle_id)
    and private.are_friends((select auth.uid()), invitee_id)
    and not private.is_user_in_circle(circle_id, invitee_id)
  );
create policy "Decline, cancel or revoke invites" on public.circle_invites
  for delete to authenticated
  using (
    invitee_id = (select auth.uid())
    or inviter_id = (select auth.uid())
    or private.is_circle_admin(circle_id)
  );

-- daily_prompts (no prompts from the future) ------------------------------------
create policy "Signed-in users read released prompts" on public.daily_prompts
  for select to authenticated
  using (active_date <= (now() at time zone 'Africa/Cairo')::date);

-- posts ------------------------------------------------------------------------
create policy "Members read circle posts" on public.posts
  for select to authenticated using (private.is_circle_member(circle_id));
create policy "Members post as themselves" on public.posts
  for insert to authenticated
  with check (author_id = (select auth.uid()) and private.is_circle_member(circle_id));
create policy "Authors and circle admins delete posts" on public.posts
  for delete to authenticated
  using (author_id = (select auth.uid()) or private.is_circle_admin(circle_id));

-- reactions --------------------------------------------------------------------
create policy "See reactions on posts you can see" on public.reactions
  for select to authenticated using (private.can_view_post(post_id));
create policy "React as yourself on posts you can see" on public.reactions
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_view_post(post_id));
create policy "Change your own reaction" on public.reactions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.can_view_post(post_id));
create policy "Remove your own reaction" on public.reactions
  for delete to authenticated using (user_id = (select auth.uid()));

-- comments ---------------------------------------------------------------------
create policy "See comments on posts you can see" on public.comments
  for select to authenticated using (private.can_view_post(post_id));
create policy "Comment as yourself on posts you can see" on public.comments
  for insert to authenticated
  with check (author_id = (select auth.uid()) and private.can_view_post(post_id));
create policy "Comment authors and post authors delete comments" on public.comments
  for delete to authenticated
  using (author_id = (select auth.uid()) or private.is_post_author(post_id));

-- polls ------------------------------------------------------------------------
create policy "Members see circle polls" on public.polls
  for select to authenticated using (private.is_circle_member(circle_id));
create policy "Members create polls as themselves" on public.polls
  for insert to authenticated
  with check (creator_id = (select auth.uid()) and private.is_circle_member(circle_id));
create policy "Creators lock in their open polls" on public.polls
  for update to authenticated
  using (creator_id = (select auth.uid()) and closed_at is null)
  with check (creator_id = (select auth.uid()) and closed_at is not null);
create policy "Creators and circle admins delete polls" on public.polls
  for delete to authenticated
  using (creator_id = (select auth.uid()) or private.is_circle_admin(circle_id));

-- poll_options -----------------------------------------------------------------
create policy "See options of polls you can see" on public.poll_options
  for select to authenticated using (private.can_view_poll(poll_id));
create policy "Creators add options before anyone votes" on public.poll_options
  for insert to authenticated
  with check (
    private.is_poll_creator(poll_id)
    and private.poll_is_open(poll_id)
    and not private.poll_has_votes(poll_id)
  );

-- poll_votes -------------------------------------------------------------------
create policy "See votes on polls you can see" on public.poll_votes
  for select to authenticated using (private.can_view_poll(poll_id));
create policy "Vote as yourself on open polls you can see" on public.poll_votes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and private.can_view_poll(poll_id)
    and private.poll_is_open(poll_id)
  );
create policy "Change your vote while the poll is open" on public.poll_votes
  for update to authenticated
  using (user_id = (select auth.uid()) and private.poll_is_open(poll_id))
  with check (user_id = (select auth.uid()) and private.poll_is_open(poll_id));
create policy "Take back your vote while the poll is open" on public.poll_votes
  for delete to authenticated
  using (user_id = (select auth.uid()) and private.poll_is_open(poll_id));
