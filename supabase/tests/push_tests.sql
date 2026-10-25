-- =============================================================================
-- VYBZ push notification tests: devices, preferences, queueing and reminders.
-- Same approach as rls_tests.sql: ONE transaction, rolled back at the end.
-- 'ok' = must touch/return rows, 'none' = zero rows, 'error' = must be refused.
-- =============================================================================
begin;

create schema tests;
grant usage on schema tests to authenticated, anon, service_role;
create table tests.results (n serial primary key, test text, passed boolean, detail text);
create table tests.vals (key text primary key, val bigint);
grant select, insert on tests.results to authenticated, anon, service_role;
grant usage on sequence tests.results_n_seq to authenticated, anon, service_role;

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
-- Records how many push requests are waiting to be sent (to check the trigger queues them).
create function tests.queue_size() returns bigint language sql as $$ select count(*) from net.http_request_queue $$;
create function tests.expect_queue(p_name text, p_growth bigint) returns void language plpgsql as $$
declare v_now bigint := tests.queue_size(); v_before bigint;
begin
  select val into v_before from tests.vals where key = 'queue';
  insert into tests.results (test, passed, detail) values (p_name, v_now - v_before = p_growth, 'queued: ' || (v_now - v_before));
  update tests.vals set val = v_now where key = 'queue';
end;
$$;
grant execute on all functions in schema tests to authenticated, anon, service_role;

insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-4000-8000-000000000001', 'alice@test.vybz', 'authenticated', 'authenticated'),
  ('a0000000-0000-4000-8000-000000000002', 'bob@test.vybz', 'authenticated', 'authenticated'),
  ('a0000000-0000-4000-8000-000000000003', 'carol@test.vybz', 'authenticated', 'authenticated');
insert into public.profiles (id, username, display_name) values
  ('a0000000-0000-4000-8000-000000000001', 'alice', 'Alice A'),
  ('a0000000-0000-4000-8000-000000000002', 'bob', 'Bob B'),
  ('a0000000-0000-4000-8000-000000000003', 'carol', 'Carol C');

-- -------------------------------------------------------------- devices ---
select tests.login('a0000000-0000-4000-8000-000000000001');
select tests.check('devices: alice turns on notifications on her phone',
  $q$select public.save_push_subscription('https://push.example/phone-1', 'BPhone1KeyAAAAAAAAAAAAAAAAAAAAAAAA', 'authPhone1')$q$, 'ok');
select tests.check('devices: alice sees her device',
  $q$select * from public.push_subscriptions$q$, 'ok');
select tests.check('security: devices can only be added through save_push_subscription',
  $q$insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://push.example/x', 'BxxxxxxxxxxxxxxxxxxxxxxxxxxxX', 'authxxxxx')$q$, 'error');
select tests.check('security: push addresses must be https',
  $q$select public.save_push_subscription('http://evil.example/x', 'BxxxxxxxxxxxxxxxxxxxxxxxxxxxX', 'authxxxxx')$q$, 'error');

select tests.login('a0000000-0000-4000-8000-000000000002');
select tests.check('privacy: bob cannot see alice''s devices',
  $q$select * from public.push_subscriptions$q$, 'none');
select tests.check('privacy: bob cannot delete alice''s devices',
  $q$delete from public.push_subscriptions$q$, 'none');
select tests.check('devices: bob logs in on the same phone and turns notifications on',
  $q$select public.save_push_subscription('https://push.example/phone-1', 'BPhone1KeyAAAAAAAAAAAAAAAAAAAAAAAA', 'authPhone1')$q$, 'ok');
select tests.check('devices: the phone now belongs to bob',
  $q$select * from public.push_subscriptions where endpoint = 'https://push.example/phone-1'$q$, 'ok');
select tests.login('a0000000-0000-4000-8000-000000000001');
select tests.check('devices: so alice no longer gets alerts on bob''s phone',
  $q$select * from public.push_subscriptions$q$, 'none');
select tests.check('devices: alice turns on notifications on her laptop',
  $q$select public.save_push_subscription('https://push.example/laptop-1', 'BLaptop1KeyAAAAAAAAAAAAAAAAAAAAAAA', 'authLaptop1')$q$, 'ok');

-- ---------------------------------------------------------- preferences ---
select tests.check('preferences: alice turns off plan alerts',
  $q$insert into public.notification_preferences (push_plans, reminder_time) values (false, 'evening')$q$, 'ok');
select tests.check('security: alice cannot fake her reminder history',
  $q$update public.notification_preferences set last_reminded_on = current_date$q$, 'error');
select tests.check('security: alice cannot create preferences for bob',
  $q$insert into public.notification_preferences (user_id, push_plans) values ('a0000000-0000-4000-8000-000000000002', false)$q$, 'error');
select tests.check('security: reminder time must be a real option',
  $q$update public.notification_preferences set reminder_time = 'midnight'$q$, 'error');
select tests.login('a0000000-0000-4000-8000-000000000002');
select tests.check('privacy: bob cannot see alice''s preferences',
  $q$select * from public.notification_preferences$q$, 'none');
select tests.check('privacy: bob cannot change alice''s preferences',
  $q$update public.notification_preferences set push_plans = true$q$, 'none');
select tests.check('preferences: bob turns his daily reminder off',
  $q$insert into public.notification_preferences (daily_reminder) values (false)$q$, 'ok');
select tests.check('security: signed-in users cannot run the reminder picker',
  $q$select * from public.claim_daily_reminders()$q$, 'error');

-- ------------------------------------------------------------- queueing ---
reset role;
insert into tests.vals values ('queue', tests.queue_size());
select tests.login('a0000000-0000-4000-8000-000000000003');
select tests.check('setup: carol (no devices) sends bob a friend request',
  $q$insert into public.friendships (addressee_id) values ('a0000000-0000-4000-8000-000000000002')$q$, 'ok');
reset role;
select tests.expect_queue('queue: bob has a device, so one push is queued', 1);
select tests.login('a0000000-0000-4000-8000-000000000002');
select tests.check('setup: bob sends alice a friend request',
  $q$insert into public.friendships (addressee_id) values ('a0000000-0000-4000-8000-000000000001')$q$, 'ok');
reset role;
select tests.expect_queue('queue: alice has a device too, one more push', 1);
select tests.login('a0000000-0000-4000-8000-000000000001');
select tests.check('setup: alice accepts bob (bob gets an accepted notification)',
  $q$update public.friendships set status = 'accepted' where requester_id = 'a0000000-0000-4000-8000-000000000002'$q$, 'ok');
reset role;
select tests.expect_queue('queue: accepted → bob''s device', 1);
select tests.login('a0000000-0000-4000-8000-000000000002');
select tests.check('setup: bob accepts carol (carol gets an accepted notification)',
  $q$update public.friendships set status = 'accepted' where requester_id = 'a0000000-0000-4000-8000-000000000003'$q$, 'ok');
reset role;
select tests.expect_queue('queue: carol has no devices, so nothing is queued', 0);
update public.notifications set pushed_at = now() where user_id = 'a0000000-0000-4000-8000-000000000002' and type = 'friend_request';
select private.notify('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003', 'friend_request', 'friend_request:a0000000-0000-4000-8000-000000000003');
select tests.check('repeat: the same thing happening again can be pushed again',
  $q$select * from public.notifications where user_id = 'a0000000-0000-4000-8000-000000000002' and type = 'friend_request' and pushed_at is null$q$, 'ok');
select tests.expect_queue('repeat: and it is queued again', 1);
select tests.login('a0000000-0000-4000-8000-000000000001');
select tests.check('security: alice cannot mark her notifications as pushed',
  $q$update public.notifications set pushed_at = now()$q$, 'error');

-- ------------------------------------------------------------ reminders ---
reset role;
set local role service_role;
-- Pretend it's 20:30 in Cairo today (alice chose "evening").
select tests.check('reminders: at 20:30 alice (evening, has a device) is picked',
  $q$select * from public.claim_daily_reminders((((now() at time zone 'Africa/Cairo')::date + time '20:30') at time zone 'Africa/Cairo')) where user_id = 'a0000000-0000-4000-8000-000000000001'$q$, 'ok');
select tests.check('reminders: only once a day (second run picks nobody)',
  $q$select * from public.claim_daily_reminders((((now() at time zone 'Africa/Cairo')::date + time '20:30') at time zone 'Africa/Cairo'))$q$, 'none');
select tests.check('reminders: not at 9:30 for an evening person',
  $q$select * from public.claim_daily_reminders((((now() at time zone 'Africa/Cairo')::date + time '09:30') at time zone 'Africa/Cairo')) where user_id = 'a0000000-0000-4000-8000-000000000001'$q$, 'none');
reset role;
update public.notification_preferences set last_reminded_on = null where user_id = 'a0000000-0000-4000-8000-000000000001';
insert into public.circles (id, name, creator_id) values ('c0000000-0000-4000-8000-000000000009', 'Test', 'a0000000-0000-4000-8000-000000000001');
insert into public.posts (circle_id, author_id, content) values ('c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001', 'posted today');
set local role service_role;
select tests.check('reminders: nobody is reminded after they already posted today',
  $q$select * from public.claim_daily_reminders((((now() at time zone 'Africa/Cairo')::date + time '20:30') at time zone 'Africa/Cairo')) where user_id = 'a0000000-0000-4000-8000-000000000001'$q$, 'none');
select tests.check('reminders: bob (reminder off) is never picked, at any hour',
  $q$select * from generate_series(9, 20) h, public.claim_daily_reminders((((now() at time zone 'Africa/Cairo')::date + make_time(h, 30, 0)) at time zone 'Africa/Cairo')) r where r.user_id = 'a0000000-0000-4000-8000-000000000002'$q$, 'none');
reset role;
select tests.check('reminders: the "surprise" hour is always between 10:00 and 20:00',
  $q$select 1 from (select 10 + ((hashtext(gen_random_uuid()::text || current_date::text)::bigint % 11) + 11) % 11 as h from generate_series(1, 5000)) x having min(h) >= 10 and max(h) <= 20$q$, 'ok');

-- ------------------------------------------------------------------ anon ---
select set_config('request.jwt.claims', '', true);
set local role anon;
select tests.check('anon: logged-out visitors cannot save devices',
  $q$select public.save_push_subscription('https://push.example/anon', 'BxxxxxxxxxxxxxxxxxxxxxxxxxxxX', 'authxxxxx')$q$, 'error');
select tests.check('anon: logged-out visitors cannot read devices',
  $q$select * from public.push_subscriptions$q$, 'error');
select tests.check('anon: logged-out visitors cannot run the reminder picker',
  $q$select * from public.claim_daily_reminders()$q$, 'error');

reset role;
select n, passed, test, detail from tests.results order by n;
rollback;
