-- =============================================================================
-- VYBZ notification tests: who gets notified, no duplicates, and privacy.
-- Same approach as rls_tests.sql: ONE transaction, rolled back at the end, so
-- the fake users and data never stay. Every row should say passed = true.
-- 'ok' = must touch/return rows, 'none' = must return zero rows, 'error' = must be refused.
-- =============================================================================
begin;

create schema tests;
grant usage on schema tests to authenticated, anon;
create table tests.results (n serial primary key, test text, passed boolean, detail text);
grant select, insert on tests.results to authenticated, anon;
grant usage on sequence tests.results_n_seq to authenticated, anon;

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

-- alice = ...1, bob = ...2, eve = ...5
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-4000-8000-000000000001', 'alice@test.vybz', 'authenticated', 'authenticated'),
  ('a0000000-0000-4000-8000-000000000002', 'bob@test.vybz', 'authenticated', 'authenticated'),
  ('a0000000-0000-4000-8000-000000000005', 'eve@test.vybz', 'authenticated', 'authenticated');
insert into public.profiles (id, username, display_name) values
  ('a0000000-0000-4000-8000-000000000001', 'alice', 'Alice A'),
  ('a0000000-0000-4000-8000-000000000002', 'bob', 'Bob B'),
  ('a0000000-0000-4000-8000-000000000005', 'eve', 'Eve E');

-- ------------------------------------------------------------- friends ---
select tests.login('a0000000-0000-4000-8000-000000000001');
select tests.check('setup: alice sends bob a friend request',
  $q$insert into public.friendships (addressee_id) values ('a0000000-0000-4000-8000-000000000002')$q$, 'ok');
select tests.check('privacy: alice cannot see bob''s notifications',
  $q$select * from public.notifications$q$, 'none');
select tests.check('security: users cannot create notifications',
  $q$insert into public.notifications (user_id, type, dedupe_key) values ('a0000000-0000-4000-8000-000000000002', 'comment', 'fake')$q$, 'error');
select tests.check('security: users cannot call the notify helper',
  $q$select private.notify('a0000000-0000-4000-8000-000000000002', null, 'comment', 'fake')$q$, 'error');
select tests.check('privacy: alice cannot mark bob''s notifications as read',
  $q$update public.notifications set read_at = now()$q$, 'none');
select tests.check('privacy: alice cannot delete bob''s notifications',
  $q$delete from public.notifications$q$, 'none');

select tests.login('a0000000-0000-4000-8000-000000000002');
select tests.check('friend request: bob is notified, from alice, unread',
  $q$select * from public.notifications where type = 'friend_request' and actor_id = 'a0000000-0000-4000-8000-000000000001' and read_at is null$q$, 'ok');
select tests.check('security: bob cannot rewrite his notification (only read_at)',
  $q$update public.notifications set type = 'comment'$q$, 'error');
select tests.check('security: bob cannot hand his notification to someone else',
  $q$update public.notifications set user_id = 'a0000000-0000-4000-8000-000000000005'$q$, 'error');
select tests.check('friend request: bob accepts',
  $q$update public.friendships set status = 'accepted' where requester_id = 'a0000000-0000-4000-8000-000000000001'$q$, 'ok');
select tests.check('friend request: answered request is marked read',
  $q$select * from public.notifications where type = 'friend_request' and read_at is not null$q$, 'ok');

select tests.login('a0000000-0000-4000-8000-000000000001');
select tests.check('friend accepted: alice is notified',
  $q$select * from public.notifications where type = 'friend_accepted' and actor_id = 'a0000000-0000-4000-8000-000000000002'$q$, 'ok');

-- ------------------------------------------------------------- circles ---
select tests.check('setup: alice creates a circle (no notification for herself)',
  $q$insert into public.circles (id, name) values ('c0000000-0000-4000-8000-000000000001', 'The Squad')$q$, 'ok');
select tests.check('circles: creating a circle notifies nobody',
  $q$select * from public.notifications where type = 'circle_joined'$q$, 'none');
select tests.check('setup: alice invites bob',
  $q$insert into public.circle_invites (circle_id, invitee_id) values ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002')$q$, 'ok');

select tests.login('a0000000-0000-4000-8000-000000000002');
select tests.check('circle invite: bob is notified',
  $q$select * from public.notifications where type = 'circle_invite' and circle_id = 'c0000000-0000-4000-8000-000000000001'$q$, 'ok');
select tests.check('setup: bob accepts the invite',
  $q$select public.accept_circle_invite('c0000000-0000-4000-8000-000000000001')$q$, 'ok');
select tests.check('circle invite: accepted invite disappears from bob''s list',
  $q$select * from public.notifications where type = 'circle_invite'$q$, 'none');

select tests.login('a0000000-0000-4000-8000-000000000001');
select tests.check('circle joined: alice (owner) is notified that bob joined',
  $q$select * from public.notifications where type = 'circle_joined' and actor_id = 'a0000000-0000-4000-8000-000000000002'$q$, 'ok');

-- ---------------------------------------------------- reactions/comments ---
select tests.check('setup: alice posts',
  $q$insert into public.posts (id, circle_id, content) values ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'hello squad')$q$, 'ok');
select tests.check('setup: alice reacts to her own post',
  $q$insert into public.reactions (post_id, reaction_type) values ('d0000000-0000-4000-8000-000000000001', 'fire')$q$, 'ok');
select tests.check('reactions: no notification for reacting to your own post',
  $q$select * from public.notifications where type = 'reaction'$q$, 'none');

select tests.login('a0000000-0000-4000-8000-000000000002');
select tests.check('setup: bob reacts 🔥',
  $q$insert into public.reactions (post_id, reaction_type) values ('d0000000-0000-4000-8000-000000000001', 'fire')$q$, 'ok');
select tests.check('setup: bob switches to 😍',
  $q$update public.reactions set reaction_type = 'love' where post_id = 'd0000000-0000-4000-8000-000000000001'$q$, 'ok');
select tests.check('setup: bob comments',
  $q$insert into public.comments (post_id, content) values ('d0000000-0000-4000-8000-000000000001', 'love this')$q$, 'ok');

select tests.login('a0000000-0000-4000-8000-000000000001');
select tests.check('reactions: alice has exactly one reaction notification from bob, showing 😍',
  $q$select 1 from public.notifications where type = 'reaction' group by 1 having count(*) = 1 and bool_and(detail = 'love')$q$, 'ok');
select tests.check('comments: alice is notified about bob''s comment',
  $q$select * from public.notifications where type = 'comment' and comment_id is not null$q$, 'ok');

select tests.login('a0000000-0000-4000-8000-000000000002');
select tests.check('setup: bob removes his reaction and deletes his comment',
  $q$with r as (delete from public.reactions where post_id = 'd0000000-0000-4000-8000-000000000001' returning 1),
         c as (delete from public.comments where content = 'love this' returning 1)
     select * from r union all select * from c$q$, 'ok');
select tests.login('a0000000-0000-4000-8000-000000000001');
select tests.check('cleanup: removed reaction and deleted comment take their notifications with them',
  $q$select * from public.notifications where type in ('reaction', 'comment')$q$, 'none');

-- ---------------------------------------------------------------- plans ---
select tests.check('setup: alice makes a plan',
  $q$select public.create_poll('c0000000-0000-4000-8000-000000000001', 'Thursday?', 'Thu 8 PM', null, '[{"text":"Cafe","category":"cafe"},{"text":"Gaming","category":"gaming"}]')$q$, 'ok');
select tests.check('plans: alice is not notified about her own plan',
  $q$select * from public.notifications where type = 'plan_created'$q$, 'none');

select tests.login('a0000000-0000-4000-8000-000000000002');
select tests.check('plans: bob is notified about the new plan',
  $q$select * from public.notifications where type = 'plan_created'$q$, 'ok');
select tests.check('setup: bob votes Gaming, then changes to Cafe',
  $q$with v as (insert into public.poll_votes (poll_id, option_id)
       select o.poll_id, o.id from public.poll_options o join public.polls p on p.id = o.poll_id
       where p.question = 'Thursday?' and o.option_text = 'Gaming' returning poll_id)
     select * from v$q$, 'ok');
select tests.check('setup: bob changes his vote',
  $q$update public.poll_votes set option_id = (select o.id from public.poll_options o join public.polls p on p.id = o.poll_id where p.question = 'Thursday?' and o.option_text = 'Cafe')$q$, 'ok');

select tests.login('a0000000-0000-4000-8000-000000000001');
select tests.check('votes: alice has ONE vote notification for the plan (1 vote)',
  $q$select 1 from public.notifications where type = 'plan_vote' group by 1 having count(*) = 1 and bool_and(detail = '1')$q$, 'ok');
select tests.check('setup: alice locks in the plan',
  $q$update public.polls set closed_at = now() where question = 'Thursday?'$q$, 'ok');

select tests.login('a0000000-0000-4000-8000-000000000002');
select tests.check('plan locked: bob is notified with the winner (Cafe)',
  $q$select * from public.notifications where type = 'plan_locked' and detail = 'Cafe'$q$, 'ok');
select tests.check('read: bob marks all as read',
  $q$update public.notifications set read_at = now() where read_at is null$q$, 'ok');
select tests.check('read: bob has no unread notifications left',
  $q$select * from public.notifications where read_at is null$q$, 'none');
select tests.check('leaving: bob leaves the circle',
  $q$delete from public.circle_members where user_id = 'a0000000-0000-4000-8000-000000000002'$q$, 'ok');
select tests.check('leaving: bob''s notifications about that circle are gone',
  $q$select * from public.notifications where circle_id = 'c0000000-0000-4000-8000-000000000001'$q$, 'none');
select tests.check('leaving: bob keeps his other notifications (friend request)',
  $q$select * from public.notifications where type = 'friend_request'$q$, 'ok');

select tests.login('a0000000-0000-4000-8000-000000000005');
select tests.check('privacy: eve (a stranger) sees no notifications at all',
  $q$select * from public.notifications$q$, 'none');

reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select tests.check('anon: logged-out visitors cannot read notifications',
  $q$select * from public.notifications$q$, 'error');

reset role;
select n, passed, test, detail from tests.results order by n;
rollback;
