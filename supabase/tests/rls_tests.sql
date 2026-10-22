-- =============================================================================
-- VYBZ security tests: Row Level Security, privileges, constraints, storage.
--
-- How it works: everything runs inside ONE transaction that is rolled back at
-- the end, so the fake users and data below never stay in the database.
-- `tests.login(user)` makes the following statements run as that signed-in
-- user (exactly like a request from the app), `tests.check(...)` runs a
-- statement and records whether it behaved as expected:
--   'ok'    must succeed and touch/return at least one row
--   'none'  must succeed but touch/return zero rows (RLS silently filtered it)
--   'error' must be refused with an error
--
-- Run it in the Supabase SQL editor (or via the MCP execute_sql tool).
-- Every row of the final result should say passed = true.
-- =============================================================================
begin;

create schema tests;
grant usage on schema tests to authenticated, anon;
create table tests.results (n serial primary key, test text, passed boolean, detail text);
create table tests.ids (key text primary key, id uuid);
grant select, insert on tests.results to authenticated, anon;
grant usage on sequence tests.results_n_seq to authenticated, anon;
grant select on tests.ids to authenticated, anon;

create function tests.login(p_user uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create function tests.check(p_name text, p_sql text, p_expect text) returns void language plpgsql as $$
declare
  v_rows bigint;
begin
  begin
    execute p_sql;
    get diagnostics v_rows = row_count;
  exception when others then
    insert into tests.results (test, passed, detail) values (p_name, p_expect = 'error', sqlerrm);
    return;
  end;
  insert into tests.results (test, passed, detail)
  values (p_name, case p_expect when 'ok' then v_rows > 0 when 'none' then v_rows = 0 else false end, 'rows: ' || v_rows);
end;
$$;
grant execute on all functions in schema tests to authenticated, anon;

-- Fake accounts (as if they signed up). alice, bob and carol are friends-to-be; eve is the attacker.
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-4000-8000-000000000001', 'alice@test.vybz', 'authenticated', 'authenticated'),
  ('a0000000-0000-4000-8000-000000000002', 'bob@test.vybz', 'authenticated', 'authenticated'),
  ('a0000000-0000-4000-8000-000000000003', 'carol@test.vybz', 'authenticated', 'authenticated'),
  ('a0000000-0000-4000-8000-000000000005', 'eve@test.vybz', 'authenticated', 'authenticated');

-- ---------------------------------------------------------------- profiles ---
select tests.login('a0000000-0000-4000-8000-000000000001');
select tests.check('profile: alice creates her own profile',
  $q$insert into public.profiles (id, username, display_name) values ('a0000000-0000-4000-8000-000000000001', 'alice', 'Alice A')$q$, 'ok');
select tests.check('profile: alice cannot create a profile for bob',
  $q$insert into public.profiles (id, username, display_name) values ('a0000000-0000-4000-8000-000000000002', 'fakebob', 'Bob')$q$, 'error');
select tests.check('profile: alice updates her own display name',
  $q$update public.profiles set display_name = 'Alice Adel' where id = 'a0000000-0000-4000-8000-000000000001'$q$, 'ok');
select tests.check('profile: alice cannot change created_at (no column privilege)',
  $q$update public.profiles set created_at = now() - interval '5 years' where id = 'a0000000-0000-4000-8000-000000000001'$q$, 'error');
select tests.check('profile: avatar must live in your own folder',
  $q$update public.profiles set avatar_path = 'a0000000-0000-4000-8000-000000000002/x.jpg' where id = 'a0000000-0000-4000-8000-000000000001'$q$, 'error');

select tests.login('a0000000-0000-4000-8000-000000000002');
select tests.check('profile: bob creates his profile',
  $q$insert into public.profiles (id, username, display_name) values ('a0000000-0000-4000-8000-000000000002', 'bob', 'Bob B')$q$, 'ok');
select tests.login('a0000000-0000-4000-8000-000000000003');
select tests.check('constraint: invalid username rejected',
  $q$insert into public.profiles (id, username, display_name) values ('a0000000-0000-4000-8000-000000000003', 'Carol!', 'Carol')$q$, 'error');
select tests.check('constraint: duplicate username rejected',
  $q$insert into public.profiles (id, username, display_name) values ('a0000000-0000-4000-8000-000000000003', 'alice', 'Carol')$q$, 'error');
select tests.check('profile: carol creates her profile',
  $q$insert into public.profiles (id, username, display_name) values ('a0000000-0000-4000-8000-000000000003', 'carol', 'Carol C')$q$, 'ok');
select tests.login('a0000000-0000-4000-8000-000000000005');
select tests.check('profile: eve creates her profile',
  $q$insert into public.profiles (id, username, display_name) values ('a0000000-0000-4000-8000-000000000005', 'eve', 'Eve E')$q$, 'ok');

select tests.check('privacy: eve cannot list other people''s profiles',
  $q$select * from public.profiles where id <> 'a0000000-0000-4000-8000-000000000005'$q$, 'none');
select tests.check('privacy: eve can look up an exact username (to add a friend)',
  $q$select * from public.find_profile_by_username('alice')$q$, 'ok');
select tests.check('privacy: eve cannot edit alice''s profile',
  $q$update public.profiles set bio = 'hacked' where id = 'a0000000-0000-4000-8000-000000000001'$q$, 'none');

-- ------------------------------------------------------------- friendships ---
select tests.login('a0000000-0000-4000-8000-000000000001');
select tests.check('friends: alice sends bob a request',
  $q$insert into public.friendships (addressee_id) values ('a0000000-0000-4000-8000-000000000002')$q$, 'ok');
select tests.check('friends: alice sends carol a request',
  $q$insert into public.friendships (addressee_id) values ('a0000000-0000-4000-8000-000000000003')$q$, 'ok');
select tests.check('constraint: no friend request to yourself',
  $q$insert into public.friendships (addressee_id) values ('a0000000-0000-4000-8000-000000000001')$q$, 'error');
select tests.check('impersonation: alice cannot send a request as bob',
  $q$insert into public.friendships (requester_id, addressee_id) values ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000005')$q$, 'error');
select tests.check('friends: alice cannot accept her own request',
  $q$update public.friendships set status = 'accepted' where addressee_id = 'a0000000-0000-4000-8000-000000000002'$q$, 'none');

select tests.login('a0000000-0000-4000-8000-000000000002');
select tests.check('constraint: no duplicate request in the other direction',
  $q$insert into public.friendships (addressee_id) values ('a0000000-0000-4000-8000-000000000001')$q$, 'error');
select tests.check('friends: bob accepts alice',
  $q$update public.friendships set status = 'accepted' where requester_id = 'a0000000-0000-4000-8000-000000000001'$q$, 'ok');
select tests.check('privacy: bob can now see alice''s profile',
  $q$select * from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'$q$, 'ok');
select tests.login('a0000000-0000-4000-8000-000000000003');
select tests.check('friends: carol accepts alice',
  $q$update public.friendships set status = 'accepted' where requester_id = 'a0000000-0000-4000-8000-000000000001'$q$, 'ok');
select tests.check('privacy: carol (not connected to bob) cannot see bob',
  $q$select * from public.profiles where id = 'a0000000-0000-4000-8000-000000000002'$q$, 'none');
select tests.login('a0000000-0000-4000-8000-000000000005');
select tests.check('privacy: eve cannot see alice''s friendships',
  $q$select * from public.friendships$q$, 'none');

-- ----------------------------------------------------------------- circles ---
select tests.login('a0000000-0000-4000-8000-000000000001');
select tests.check('circles: alice creates a circle',
  $q$insert into public.circles (id, name) values ('c0000000-0000-4000-8000-000000000001', 'The Squad')$q$, 'ok');
select tests.check('circles: alice became owner automatically',
  $q$select * from public.circle_members where circle_id = 'c0000000-0000-4000-8000-000000000001' and role = 'owner'$q$, 'ok');
select tests.check('impersonation: cannot create a circle as someone else',
  $q$insert into public.circles (name, creator_id) values ('Fake', 'a0000000-0000-4000-8000-000000000002')$q$, 'error');
select tests.check('invites: alice cannot invite eve (not friends)',
  $q$insert into public.circle_invites (circle_id, invitee_id) values ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005')$q$, 'error');
select tests.check('invites: alice invites bob',
  $q$insert into public.circle_invites (circle_id, invitee_id) values ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002')$q$, 'ok');
select tests.check('invites: alice invites carol',
  $q$insert into public.circle_invites (circle_id, invitee_id) values ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003')$q$, 'ok');
select tests.check('posts: alice posts in her circle',
  $q$insert into public.posts (id, circle_id, content) values ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'hello squad')$q$, 'ok');

select tests.login('a0000000-0000-4000-8000-000000000005');
select tests.check('circles: eve creates her own circle',
  $q$insert into public.circles (id, name) values ('c0000000-0000-4000-8000-000000000002', 'Eve Zone')$q$, 'ok');
select tests.check('privacy: eve cannot see alice''s circle',
  $q$select * from public.circles where id = 'c0000000-0000-4000-8000-000000000001'$q$, 'none');
select tests.check('privacy: eve cannot read alice''s circle posts',
  $q$select * from public.posts where circle_id = 'c0000000-0000-4000-8000-000000000001'$q$, 'none');
select tests.check('privacy: eve cannot see alice''s circle members',
  $q$select * from public.circle_members where circle_id = 'c0000000-0000-4000-8000-000000000001'$q$, 'none');
select tests.check('join: eve cannot add herself to a circle by id',
  $q$insert into public.circle_members (circle_id, user_id) values ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005')$q$, 'error');
select tests.check('join: eve cannot accept an invite she never got',
  $q$select public.accept_circle_invite('c0000000-0000-4000-8000-000000000001')$q$, 'error');
select tests.check('join: eve cannot invite herself',
  $q$insert into public.circle_invites (circle_id, invitee_id) values ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005')$q$, 'error');
select tests.check('posts: eve cannot post into alice''s circle',
  $q$insert into public.posts (circle_id, content) values ('c0000000-0000-4000-8000-000000000001', 'spam')$q$, 'error');
select tests.check('helpers: membership check says no for eve',
  $q$select 1 where private.is_circle_member('c0000000-0000-4000-8000-000000000001')$q$, 'none');

select tests.login('a0000000-0000-4000-8000-000000000002');
select tests.check('invites: bob (invited) can see the circle before joining',
  $q$select * from public.circles where id = 'c0000000-0000-4000-8000-000000000001'$q$, 'ok');
select tests.check('privacy: bob (invited, not joined) cannot read posts yet',
  $q$select * from public.posts where circle_id = 'c0000000-0000-4000-8000-000000000001'$q$, 'none');
select tests.check('join: bob accepts his invite',
  $q$select public.accept_circle_invite('c0000000-0000-4000-8000-000000000001')$q$, 'ok');
select tests.check('posts: bob (member) reads circle posts',
  $q$select * from public.posts where circle_id = 'c0000000-0000-4000-8000-000000000001'$q$, 'ok');
select tests.check('impersonation: bob cannot post as alice',
  $q$insert into public.posts (circle_id, content, author_id) values ('c0000000-0000-4000-8000-000000000001', 'fake', 'a0000000-0000-4000-8000-000000000001')$q$, 'error');
select tests.check('constraint: empty post rejected',
  $q$insert into public.posts (circle_id, content) values ('c0000000-0000-4000-8000-000000000001', '   ')$q$, 'error');
select tests.check('storage path: bob cannot attach a photo from alice''s folder',
  $q$insert into public.posts (circle_id, image_path) values ('c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001/a0000000-0000-4000-8000-000000000001/x.jpg')$q$, 'error');
select tests.check('circles: bob (member) cannot rename the circle',
  $q$update public.circles set name = 'Bob''s now' where id = 'c0000000-0000-4000-8000-000000000001'$q$, 'none');
select tests.check('circles: bob (member) cannot delete the circle',
  $q$delete from public.circles where id = 'c0000000-0000-4000-8000-000000000001'$q$, 'none');
select tests.check('members: bob cannot remove the owner',
  $q$delete from public.circle_members where user_id = 'a0000000-0000-4000-8000-000000000001'$q$, 'none');
select tests.check('members: bob cannot promote himself',
  $q$update public.circle_members set role = 'admin' where user_id = 'a0000000-0000-4000-8000-000000000002'$q$, 'none');
select tests.check('posts: bob cannot delete alice''s post',
  $q$delete from public.posts where id = 'd0000000-0000-4000-8000-000000000001'$q$, 'none');

-- ------------------------------------------------------ reactions/comments ---
select tests.check('reactions: bob reacts to alice''s post',
  $q$insert into public.reactions (post_id, reaction_type) values ('d0000000-0000-4000-8000-000000000001', 'fire')$q$, 'ok');
select tests.check('constraint: only one reaction per person per post',
  $q$insert into public.reactions (post_id, reaction_type) values ('d0000000-0000-4000-8000-000000000001', 'love')$q$, 'error');
select tests.check('reactions: bob switches his reaction',
  $q$update public.reactions set reaction_type = 'love' where post_id = 'd0000000-0000-4000-8000-000000000001'$q$, 'ok');
select tests.check('comments: bob comments',
  $q$insert into public.comments (post_id, content) values ('d0000000-0000-4000-8000-000000000001', 'love this')$q$, 'ok');
select tests.check('impersonation: bob cannot comment as alice',
  $q$insert into public.comments (post_id, content, author_id) values ('d0000000-0000-4000-8000-000000000001', 'x', 'a0000000-0000-4000-8000-000000000001')$q$, 'error');

select tests.login('a0000000-0000-4000-8000-000000000001');
select tests.check('reactions: alice cannot delete bob''s reaction',
  $q$delete from public.reactions where user_id = 'a0000000-0000-4000-8000-000000000002'$q$, 'none');
select tests.check('comments: alice (post author) can delete a comment on her post',
  $q$delete from public.comments where post_id = 'd0000000-0000-4000-8000-000000000001'$q$, 'ok');

select tests.login('a0000000-0000-4000-8000-000000000005');
select tests.check('reactions: eve cannot react in alice''s circle',
  $q$insert into public.reactions (post_id, reaction_type) values ('d0000000-0000-4000-8000-000000000001', 'wow')$q$, 'error');
select tests.check('comments: eve cannot comment in alice''s circle',
  $q$insert into public.comments (post_id, content) values ('d0000000-0000-4000-8000-000000000001', 'hi')$q$, 'error');
select tests.check('privacy: eve cannot read reactions in alice''s circle',
  $q$select * from public.reactions$q$, 'none');

-- ------------------------------------------------------------------- polls ---
select tests.login('a0000000-0000-4000-8000-000000000001');
select tests.check('polls: alice creates a poll with 2 options',
  $q$select public.create_poll('c0000000-0000-4000-8000-000000000001', 'Thursday?', 'Thu 8 PM', null, '[{"text":"Cafe","category":"cafe"},{"text":"Gaming","category":"gaming"}]')$q$, 'ok');
select tests.check('polls: a poll needs at least 2 options',
  $q$select public.create_poll('c0000000-0000-4000-8000-000000000001', 'One?', null, null, '[{"text":"Only"}]')$q$, 'error');
reset role;
insert into tests.ids select 'poll', id from public.polls where question = 'Thursday?';
insert into tests.ids select 'opt_cafe', o.id from public.poll_options o join public.polls p on p.id = o.poll_id where p.question = 'Thursday?' and o.option_text = 'Cafe';
insert into tests.ids select 'opt_gaming', o.id from public.poll_options o join public.polls p on p.id = o.poll_id where p.question = 'Thursday?' and o.option_text = 'Gaming';

select tests.login('a0000000-0000-4000-8000-000000000005');
select tests.check('polls: eve cannot create a poll in alice''s circle',
  $q$select public.create_poll('c0000000-0000-4000-8000-000000000001', 'Spam?', null, null, '[{"text":"a"},{"text":"b"}]')$q$, 'error');
select tests.check('polls: eve creates a poll in her own circle',
  $q$select public.create_poll('c0000000-0000-4000-8000-000000000002', 'Eve poll', null, null, '[{"text":"x"},{"text":"y"}]')$q$, 'ok');
select tests.check('polls: eve cannot vote in alice''s poll',
  $q$insert into public.poll_votes (poll_id, option_id) select (select id from tests.ids where key = 'poll'), (select id from tests.ids where key = 'opt_cafe')$q$, 'error');
select tests.check('privacy: eve cannot see alice''s poll',
  $q$select * from public.polls where id = (select id from tests.ids where key = 'poll')$q$, 'none');
select tests.check('polls: eve cannot add options to alice''s poll',
  $q$insert into public.poll_options (poll_id, option_text) select (select id from tests.ids where key = 'poll'), 'Eve option'$q$, 'error');
reset role;
insert into tests.ids select 'eve_opt', o.id from public.poll_options o join public.polls p on p.id = o.poll_id where p.question = 'Eve poll' and o.option_text = 'x';

select tests.login('a0000000-0000-4000-8000-000000000002');
select tests.check('polls: bob votes',
  $q$insert into public.poll_votes (poll_id, option_id) select (select id from tests.ids where key = 'poll'), (select id from tests.ids where key = 'opt_cafe')$q$, 'ok');
select tests.check('constraint: bob cannot vote twice in one poll',
  $q$insert into public.poll_votes (poll_id, option_id) select (select id from tests.ids where key = 'poll'), (select id from tests.ids where key = 'opt_gaming')$q$, 'error');
select tests.check('polls: bob changes his vote',
  $q$update public.poll_votes set option_id = (select id from tests.ids where key = 'opt_gaming') where poll_id = (select id from tests.ids where key = 'poll')$q$, 'ok');
select tests.check('constraint: cannot vote for an option from another poll',
  $q$update public.poll_votes set option_id = (select id from tests.ids where key = 'eve_opt') where poll_id = (select id from tests.ids where key = 'poll')$q$, 'error');
select tests.check('polls: bob cannot lock alice''s poll',
  $q$update public.polls set closed_at = now() where id = (select id from tests.ids where key = 'poll')$q$, 'none');
select tests.check('impersonation: bob cannot vote as alice',
  $q$insert into public.poll_votes (poll_id, option_id, user_id) select (select id from tests.ids where key = 'poll'), (select id from tests.ids where key = 'opt_cafe'), 'a0000000-0000-4000-8000-000000000001'$q$, 'error');

select tests.login('a0000000-0000-4000-8000-000000000001');
select tests.check('polls: alice cannot add options after votes exist',
  $q$insert into public.poll_options (poll_id, option_text) select (select id from tests.ids where key = 'poll'), 'Late option'$q$, 'error');
select tests.check('polls: alice locks in her poll',
  $q$update public.polls set closed_at = now() where id = (select id from tests.ids where key = 'poll')$q$, 'ok');

select tests.login('a0000000-0000-4000-8000-000000000002');
select tests.check('polls: bob cannot change his vote after lock-in',
  $q$update public.poll_votes set option_id = (select id from tests.ids where key = 'opt_cafe') where poll_id = (select id from tests.ids where key = 'poll')$q$, 'none');
select tests.check('polls: bob cannot remove his vote after lock-in',
  $q$delete from public.poll_votes where poll_id = (select id from tests.ids where key = 'poll')$q$, 'none');

-- ----------------------------------------------------------------- storage ---
select tests.login('a0000000-0000-4000-8000-000000000001');
select tests.check('storage: alice uploads a post photo to her circle',
  $q$insert into storage.objects (bucket_id, name) values ('post-images', 'c0000000-0000-4000-8000-000000000001/a0000000-0000-4000-8000-000000000001/p1.jpg')$q$, 'ok');
select tests.check('storage: alice uploads her avatar',
  $q$insert into storage.objects (bucket_id, name) values ('avatars', 'a0000000-0000-4000-8000-000000000001/me.jpg')$q$, 'ok');
select tests.check('storage: alice cannot upload into bob''s avatar folder',
  $q$insert into storage.objects (bucket_id, name) values ('avatars', 'a0000000-0000-4000-8000-000000000002/me.jpg')$q$, 'error');
select tests.check('storage: alice cannot overwrite files (no update policy)',
  $q$update storage.objects set name = 'a0000000-0000-4000-8000-000000000001/renamed.jpg' where name = 'a0000000-0000-4000-8000-000000000001/me.jpg'$q$, 'none');

select tests.login('a0000000-0000-4000-8000-000000000002');
select tests.check('storage: bob (member) can read the circle photo',
  $q$select * from storage.objects where bucket_id = 'post-images'$q$, 'ok');
select tests.check('storage: bob cannot upload into alice''s folder',
  $q$insert into storage.objects (bucket_id, name) values ('post-images', 'c0000000-0000-4000-8000-000000000001/a0000000-0000-4000-8000-000000000001/fake.jpg')$q$, 'error');
-- Supabase blocks ALL direct SQL deletes on storage.objects ("use the Storage API"),
-- so the "Delete your own post photos" policy can't be exercised from SQL. This
-- only proves SQL deletes are impossible; the API-level delete rule is NOT covered here.
select tests.check('storage: direct SQL deletes of files are blocked entirely',
  $q$delete from storage.objects where bucket_id = 'post-images'$q$, 'error');

select tests.login('a0000000-0000-4000-8000-000000000005');
select tests.check('storage: eve cannot read alice''s circle photos',
  $q$select * from storage.objects where bucket_id = 'post-images'$q$, 'none');
select tests.check('storage: eve cannot upload into alice''s circle',
  $q$insert into storage.objects (bucket_id, name) values ('post-images', 'c0000000-0000-4000-8000-000000000001/a0000000-0000-4000-8000-000000000005/x.jpg')$q$, 'error');
select tests.check('storage: garbage folder names are refused, not crashed',
  $q$insert into storage.objects (bucket_id, name) values ('post-images', 'not-a-uuid/a0000000-0000-4000-8000-000000000005/x.jpg')$q$, 'error');

-- ----------------------------------------------------------- daily prompts ---
select tests.check('prompts: today''s prompt is readable',
  $q$select * from public.daily_prompts where active_date = (now() at time zone 'Africa/Cairo')::date$q$, 'ok');
select tests.check('prompts: future prompts are hidden',
  $q$select * from public.daily_prompts where active_date > (now() at time zone 'Africa/Cairo')::date$q$, 'none');
select tests.check('prompts: users cannot add prompts',
  $q$insert into public.daily_prompts (prompt_text, active_date) values ('hacked', '2030-01-01')$q$, 'error');

-- ----------------------------------------------------- leaving and anon ---
select tests.login('a0000000-0000-4000-8000-000000000001');
select tests.check('members: owner cannot leave (would orphan the circle)',
  $q$delete from public.circle_members where user_id = 'a0000000-0000-4000-8000-000000000001'$q$, 'none');
select tests.login('a0000000-0000-4000-8000-000000000002');
select tests.check('members: bob leaves the circle',
  $q$delete from public.circle_members where user_id = 'a0000000-0000-4000-8000-000000000002'$q$, 'ok');
select tests.check('privacy: after leaving, bob can no longer read posts',
  $q$select * from public.posts where circle_id = 'c0000000-0000-4000-8000-000000000001'$q$, 'none');

reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select tests.check('anon: logged-out visitors cannot read profiles',
  $q$select * from public.profiles$q$, 'error');
select tests.check('anon: logged-out visitors cannot read posts',
  $q$select * from public.posts$q$, 'error');
select tests.check('anon: logged-out visitors cannot call find_profile_by_username',
  $q$select * from public.find_profile_by_username('alice')$q$, 'error');

reset role;
select n, passed, test, detail from tests.results order by n;
rollback;
