-- Tests for migration 20261123000000_business_chat.sql (chat between a traveller and a business).
-- Run ONLY on a local or test project, after 20261122200000, 20261122300000 and 20261123000000, in the
-- SQL editor or psql as postgres. One transaction that ends with ROLLBACK: nothing below stays.
-- Any failure stops the script with "FAIL: ...". The last line prints "all passed".
-- Part A proves guide threads behave as before (plus the H1 / M1 hardening); part B covers business
-- threads. Every name and number here is invented.

begin;

create function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
declare v_ran boolean := false;
begin
  begin
    execute p_sql;
    v_ran := true;
  exception when others then
    null;
  end;
  if v_ran then
    raise exception 'FAIL: % (should have been refused)', p_label;
  end if;
end $$;

create function pg_temp.expect_code(p_sql text, p_code text, p_label text) returns void language plpgsql as $$
declare v_msg text;
begin
  begin
    execute p_sql;
  exception when others then
    v_msg := sqlerrm;
  end;
  if v_msg is null then
    raise exception 'FAIL: % (should have been refused)', p_label;
  end if;
  if position(p_code in v_msg) = 0 then
    raise exception 'FAIL: % (refused with "%", expected "%")', p_label, v_msg, p_code;
  end if;
end $$;

create function pg_temp.check(p_ok boolean, p_label text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then
    raise exception 'FAIL: %', p_label;
  end if;
end $$;

create function pg_temp.as_user(p_id uuid, p_aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_id, 'role', 'authenticated', 'aal', p_aal)::text, true);
end $$;

grant execute on function pg_temp.expect_error(text, text) to authenticated, service_role;
grant execute on function pg_temp.expect_code(text, text, text) to authenticated, service_role;
grant execute on function pg_temp.check(boolean, text) to authenticated, service_role;

-- Accounts: t1 traveller, go guide owner, a1 business owner, b2 another business owner, c3 admin.
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('d1d1d1d1-0000-4000-8000-0000000000d1', 'bc-trav@example.test', 'authenticated', 'authenticated', '{}'),
  ('f4f4f4f4-0000-4000-8000-0000000000f4', 'bc-guide@example.test', 'authenticated', 'authenticated', '{}'),
  ('a1a1a1a1-0000-4000-8000-0000000000a1', 'bc-owner@example.test', 'authenticated', 'authenticated', '{}'),
  ('b2b2b2b2-0000-4000-8000-0000000000b2', 'bc-other@example.test', 'authenticated', 'authenticated', '{}'),
  ('c3c3c3c3-0000-4000-8000-0000000000c3', 'bc-admin@example.test', 'authenticated', 'authenticated', '{}');
update public.profiles set onboarded_at = now()
where id in ('d1d1d1d1-0000-4000-8000-0000000000d1', 'f4f4f4f4-0000-4000-8000-0000000000f4',
             'a1a1a1a1-0000-4000-8000-0000000000a1', 'b2b2b2b2-0000-4000-8000-0000000000b2',
             'c3c3c3c3-0000-4000-8000-0000000000c3');
update public.profiles set full_name = 'Asha Mrefu' where id = 'd1d1d1d1-0000-4000-8000-0000000000d1';
update public.profiles set role = 'admin' where id = 'c3c3c3c3-0000-4000-8000-0000000000c3';

insert into public.guides (id, owner_id, slug, display_name, base_region, verification_status)
values ('97979797-0000-4000-8000-000000000097', 'f4f4f4f4-0000-4000-8000-0000000000f4', 'bc-test-guide', 'BC Test Guide', 'Arusha', 'approved');
insert into public.providers (id, owner_id, business_name, base_region, business_type, verification_status)
values ('e1e1e1e1-0000-4000-8000-0000000000e1', 'a1a1a1a1-0000-4000-8000-0000000000a1', 'BC test kitchen', 'Arusha', 'restaurant', 'approved'),
       ('e3e3e3e3-0000-4000-8000-0000000000e3', 'b2b2b2b2-0000-4000-8000-0000000000b2', 'BC other cafe', 'Moshi', 'restaurant', 'approved');

-- ===========================================================================
-- A. Guide threads: as before
-- ===========================================================================
select pg_temp.as_user('d1d1d1d1-0000-4000-8000-0000000000d1');
set local role authenticated;
-- The same insert the website and the app send.
insert into public.conversations (traveler_id, guide_id)
values ('d1d1d1d1-0000-4000-8000-0000000000d1', '97979797-0000-4000-8000-000000000097');
create temp table gc on commit drop as
  select id from public.conversations where guide_id = '97979797-0000-4000-8000-000000000097';
select pg_temp.check((select traveler_name = 'Asha Mrefu' and not contact_unlocked and not was_business
                      from public.conversations where id = (select id from gc)),
                     'A: guide thread keeps the full name and starts locked');
select pg_temp.expect_error($q$insert into public.conversations (traveler_id, guide_id)
  values ('d1d1d1d1-0000-4000-8000-0000000000d1', '97979797-0000-4000-8000-000000000097')$q$, 'A: one thread per traveller and guide');
select pg_temp.expect_error($q$insert into public.conversations (traveler_id, guide_id, contact_unlocked)
  values ('d1d1d1d1-0000-4000-8000-0000000000d1', '97979797-0000-4000-8000-000000000097', true)$q$, 'A: traveller cannot start unlocked');
-- H1: only the read times (and contact_unlocked, kept by the guard) can be written by clients.
select pg_temp.expect_error($q$update public.conversations set last_message_preview = 'fake' where id = (select id from gc)$q$,
  'A/H1: traveller rewrites the preview');
select pg_temp.expect_error($q$update public.conversations set traveler_name = 'Someone else' where id = (select id from gc)$q$,
  'A/H1: traveller rewrites the name');
select pg_temp.expect_error($q$update public.conversations set created_at = now() - interval '1 year' where id = (select id from gc)$q$,
  'A/H1: traveller rewrites the creation time');
select pg_temp.expect_error($q$update public.conversations set guide_id = null where id = (select id from gc)$q$,
  'A/M1: traveller changes the guide');
insert into public.messages (conversation_id, sender_id, body)
select id, 'd1d1d1d1-0000-4000-8000-0000000000d1', 'Hello, call me on 0712 345 678' from gc;
select pg_temp.check((select masked and body like '%[contact hidden]%' from public.messages
                      where conversation_id = (select id from gc)),
                     'A: phone number hidden in a locked guide thread');
update public.conversations set contact_unlocked = true, traveler_last_read_at = now(), guide_last_read_at = now()
where id = (select id from gc);
select pg_temp.check((select not contact_unlocked and traveler_last_read_at is not null and guide_last_read_at is null
                      from public.conversations where id = (select id from gc)),
                     'A: traveller sets only their own read time, cannot unlock');
reset role;
select pg_temp.check((select count(*) = 1 from public.notification_outbox
                      where event = 'message_new' and recipient_user_id = 'f4f4f4f4-0000-4000-8000-0000000000f4'
                        and payload ->> 'conversation' = (select id from gc)::text
                        and payload ->> 'sender' = 'Asha Mrefu'),
                     'A: guide owner alerted, sender shown by full name as before');

select pg_temp.as_user('f4f4f4f4-0000-4000-8000-0000000000f4');
set local role authenticated;
select pg_temp.check((select count(*) = 1 from public.conversations), 'A: guide owner sees the thread');
update public.conversations set guide_last_read_at = now(), traveler_last_read_at = null
where id = (select id from gc);
select pg_temp.check((select guide_last_read_at is not null and traveler_last_read_at is not null
                      from public.conversations where id = (select id from gc)),
                     'A: guide owner sets only the guide read time');
select pg_temp.expect_error($q$update public.conversations set last_message_preview = 'fake' where id = (select id from gc)$q$,
  'A/H1: guide owner rewrites the preview');
insert into public.messages (conversation_id, sender_id, body)
select id, 'f4f4f4f4-0000-4000-8000-0000000000f4', 'Karibu!' from gc;
reset role;
select pg_temp.check((select count(*) = 1 from public.notification_outbox
                      where event = 'message_new' and recipient_user_id = 'd1d1d1d1-0000-4000-8000-0000000000d1'
                        and payload ->> 'sender' = 'BC Test Guide'),
                     'A: traveller alerted, sender shown by guide name as before');
select pg_temp.check((select last_message_preview = 'Karibu!' from public.conversations where id = (select id from gc)),
                     'A: the preview is still kept by the server');

select pg_temp.as_user('b2b2b2b2-0000-4000-8000-0000000000b2');
set local role authenticated;
select pg_temp.check((select count(*) = 0 from public.conversations) and (select count(*) = 0 from public.messages),
                     'A: outsiders see nothing');
reset role;

-- Unlocking by an admin or the server (as after an accepted call) still works for guide threads.
select pg_temp.as_user('c3c3c3c3-0000-4000-8000-0000000000c3', 'aal2');
set local role authenticated;
update public.conversations set contact_unlocked = true where id = (select id from gc);
reset role;
select pg_temp.check((select contact_unlocked from public.conversations where id = (select id from gc)),
                     'A: an admin with two-step unlocks a guide thread as before');
select pg_temp.as_user('d1d1d1d1-0000-4000-8000-0000000000d1');
set local role authenticated;
insert into public.messages (conversation_id, sender_id, body)
select id, 'd1d1d1d1-0000-4000-8000-0000000000d1', 'My number is 0712 345 678' from gc;
select pg_temp.check((select not masked from public.messages where body like 'My number%'),
                     'A: an unlocked guide thread shows contact details as before');
reset role;

-- ===========================================================================
-- B. Business threads
-- ===========================================================================
select pg_temp.as_user('d1d1d1d1-0000-4000-8000-0000000000d1');
set local role authenticated;
select pg_temp.expect_error($q$insert into public.conversations (traveler_id, provider_id)
  values ('d1d1d1d1-0000-4000-8000-0000000000d1', 'e1e1e1e1-0000-4000-8000-0000000000e1')$q$,
  'B: a traveller cannot start a business thread');
select pg_temp.expect_error($q$insert into public.conversations (traveler_id, guide_id, was_business)
  values ('d1d1d1d1-0000-4000-8000-0000000000d1', '97979797-0000-4000-8000-000000000097', true)$q$,
  'B: a traveller cannot mark a thread as a business thread');
reset role;

-- A reservation (inserted here as postgres; on live only place_reservation() inserts) links the thread.
insert into public.reservations (id, provider_id, provider_ref, business_name, business_type, traveler_id,
                                 starts_at, party_size, commission_kind, commission_rate_tzs, price_list_id)
select 'aaaaaaaa-0000-4000-8000-000000000001', 'e1e1e1e1-0000-4000-8000-0000000000e1', 'e1e1e1e1-0000-4000-8000-0000000000e1',
       'BC test kitchen', 'restaurant', 'd1d1d1d1-0000-4000-8000-0000000000d1', now() + interval '2 days', 2, 'per_guest', 2000,
       (select id from public.price_list where service_code = 'reservation_commission' and business_type = 'restaurant' limit 1);
insert into public.reservations (id, provider_id, provider_ref, business_name, business_type, traveler_id,
                                 starts_at, party_size, commission_kind, commission_rate_tzs, price_list_id)
select 'aaaaaaaa-0000-4000-8000-000000000002', 'e1e1e1e1-0000-4000-8000-0000000000e1', 'e1e1e1e1-0000-4000-8000-0000000000e1',
       'BC test kitchen', 'restaurant', 'd1d1d1d1-0000-4000-8000-0000000000d1', now() + interval '3 days', 2, 'per_guest', 2000,
       (select id from public.price_list where service_code = 'reservation_commission' and business_type = 'restaurant' limit 1);
create temp table bc on commit drop as
  select chat_id from public.reservations where id = 'aaaaaaaa-0000-4000-8000-000000000001';
grant select on bc to authenticated, service_role;
select pg_temp.check((select r.chat_id is not null from public.reservations r where r.id = 'aaaaaaaa-0000-4000-8000-000000000001')
                     and (select count(distinct chat_id) = 1 from public.reservations
                          where id in ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002')),
                     'B: reservations link to one thread per traveller and business');
select pg_temp.check((select provider_id = 'e1e1e1e1-0000-4000-8000-0000000000e1' and guide_id is null and was_business
                        and traveler_name = 'Asha' and not contact_unlocked
                      from public.conversations where id = (select chat_id from bc)),
                     'B: business thread shows the traveller''s first name only, locked');
select pg_temp.expect_error($q$update public.conversations set contact_unlocked = true where id = (select chat_id from bc)$q$,
  'B: a business thread can never be unlocked, not even by server code');

-- M1: nobody converts a business thread into a guide thread (and then unlocks it).
select pg_temp.as_user('c3c3c3c3-0000-4000-8000-0000000000c3', 'aal2');
set local role authenticated;
select pg_temp.expect_error($q$update public.conversations set provider_id = null, guide_id = '97979797-0000-4000-8000-000000000097',
  was_business = false where id = (select chat_id from bc)$q$, 'B/M1: an admin converts a business thread');
select pg_temp.expect_error($q$update public.conversations set contact_unlocked = true where id = (select chat_id from bc)$q$,
  'B/M1: an admin unlocks a business thread');
reset role;
set local role service_role;
select pg_temp.expect_code($q$update public.conversations set guide_id = '97979797-0000-4000-8000-000000000097', provider_id = null,
  was_business = false where id = (select chat_id from bc)$q$, 'conversation_parties_fixed', 'B/M1: server code converts a business thread');
select pg_temp.expect_code($q$update public.conversations set traveler_id = 'b2b2b2b2-0000-4000-8000-0000000000b2'
  where id = (select chat_id from bc)$q$, 'conversation_parties_fixed', 'B/M1: server code moves a thread to another traveller');
reset role;
select pg_temp.expect_code($q$update public.conversations set provider_id = 'e3e3e3e3-0000-4000-8000-0000000000e3'
  where id = (select chat_id from bc)$q$, 'conversation_parties_fixed', 'B/M1: even postgres cannot move a thread to another business');

-- The traveller writes; the business owner is alerted; contact details are hidden.
select pg_temp.as_user('d1d1d1d1-0000-4000-8000-0000000000d1');
set local role authenticated;
insert into public.messages (conversation_id, sender_id, body)
select chat_id, 'd1d1d1d1-0000-4000-8000-0000000000d1', 'We are 2, email me at asha@example.test or +255 712 345 678' from bc;
reset role;
select pg_temp.check((select bool_and(masked and body not like '%@%' and body not like '%345%')
                      from public.messages where conversation_id = (select chat_id from bc)),
                     'B: the business never sees the traveller''s email or phone');
select pg_temp.check((select count(*) = 1 from public.notification_outbox
                      where event = 'message_new' and recipient_user_id = 'a1a1a1a1-0000-4000-8000-0000000000a1'
                        and payload ->> 'conversation' = (select chat_id from bc)::text
                        and payload ->> 'sender' = 'Asha' and payload::text not like '%345%'),
                     'B: business owner alerted, traveller shown by first name, no contact in the alert');

-- The business owner reads, marks read, replies (masked too), cannot change anything else.
select pg_temp.as_user('a1a1a1a1-0000-4000-8000-0000000000a1');
set local role authenticated;
select pg_temp.check((select count(*) = 1 from public.conversations) and (select count(*) = 1 from public.messages),
                     'B: business owner sees the thread and its messages');
update public.conversations set guide_last_read_at = now() where id = (select chat_id from bc);
select pg_temp.check((select guide_last_read_at is not null from public.conversations where id = (select chat_id from bc)),
                     'B: owner sets the read time');
select pg_temp.expect_error($q$update public.conversations set provider_id = 'e3e3e3e3-0000-4000-8000-0000000000e3' where id = (select chat_id from bc)$q$,
  'B/H1: owner moves the thread');
select pg_temp.expect_error($q$update public.conversations set last_message_preview = 'fake', traveler_name = 'X' where id = (select chat_id from bc)$q$,
  'B/H1: owner rewrites the preview or the name');
insert into public.messages (conversation_id, sender_id, body)
select chat_id, 'a1a1a1a1-0000-4000-8000-0000000000a1', 'Karibu! Our number is 0754 111 222' from bc;
select pg_temp.check((select masked from public.messages where sender_id = 'a1a1a1a1-0000-4000-8000-0000000000a1'),
                     'B: the business''s own contact details are hidden too');
select pg_temp.check((select chat_id = (select chat_id from bc)
                      from public.business_reservations('e1e1e1e1-0000-4000-8000-0000000000e1', private.tz_today(), private.tz_today() + 5)
                      where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
                     'B: business_reservations returns the thread');
reset role;
select pg_temp.check((select count(*) = 1 from public.notification_outbox
                      where event = 'message_new' and recipient_user_id = 'd1d1d1d1-0000-4000-8000-0000000000d1'
                        and payload ->> 'conversation' = (select chat_id from bc)::text
                        and payload ->> 'sender' = 'BC test kitchen'),
                     'B: traveller alerted, sender shown by business name');

select pg_temp.as_user('d1d1d1d1-0000-4000-8000-0000000000d1');
set local role authenticated;
select pg_temp.check((select chat_id = (select chat_id from bc) from public.my_reservations()
                      where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
                     'B: my_reservations returns the thread');
reset role;

-- Another business owner sees nothing.
select pg_temp.as_user('b2b2b2b2-0000-4000-8000-0000000000b2');
set local role authenticated;
select pg_temp.check((select count(*) = 0 from public.conversations) and (select count(*) = 0 from public.messages),
                     'B: another business owner sees no thread');
select pg_temp.expect_error($q$insert into public.messages (conversation_id, sender_id, body)
  select chat_id, 'b2b2b2b2-0000-4000-8000-0000000000b2', 'Hi' from bc$q$, 'B: another business owner cannot write');
reset role;

-- M3: the thread closes 30 days after the latest reservation when none is open.
update public.reservations set status = 'confirmed' where id in ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002');
update public.reservations set starts_at = now() - interval '20 days'
where id in ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002');
update public.reservations set status = 'completed', came_count = 2, completed_by = 'business'
where id in ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002');
select pg_temp.as_user('d1d1d1d1-0000-4000-8000-0000000000d1');
set local role authenticated;
insert into public.messages (conversation_id, sender_id, body)
select chat_id, 'd1d1d1d1-0000-4000-8000-0000000000d1', 'Thank you for dinner' from bc;
reset role;
select pg_temp.check((select count(*) = 3 from public.messages where conversation_id = (select chat_id from bc)),
                     'B/M3: still open 20 days after the visit');
update public.reservations set starts_at = now() - interval '40 days'
where id in ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002');
select pg_temp.as_user('d1d1d1d1-0000-4000-8000-0000000000d1');
set local role authenticated;
select pg_temp.expect_code($q$insert into public.messages (conversation_id, sender_id, body)
  select chat_id, 'd1d1d1d1-0000-4000-8000-0000000000d1', 'Hello again' from bc$q$, 'chat_closed', 'B/M3: traveller after 30 days');
reset role;
select pg_temp.as_user('a1a1a1a1-0000-4000-8000-0000000000a1');
set local role authenticated;
select pg_temp.expect_code($q$insert into public.messages (conversation_id, sender_id, body)
  select chat_id, 'a1a1a1a1-0000-4000-8000-0000000000a1', 'Come back soon' from bc$q$, 'chat_closed', 'B/M3: business after 30 days');
reset role;

-- M2: the texts go 30 days after the latest reservation date; guide threads are untouched.
-- The traveller has reported the business's message: it is kept until the report is resolved.
select pg_temp.as_user('d1d1d1d1-0000-4000-8000-0000000000d1');
set local role authenticated;
insert into public.message_reports (message_id, reporter_id, reason)
select m.id, 'd1d1d1d1-0000-4000-8000-0000000000d1', 'Asked me to pay outside Kwetuly'
from public.messages m where m.conversation_id = (select chat_id from bc) and m.sender_id = 'a1a1a1a1-0000-4000-8000-0000000000a1';
reset role;
select private.run_business_chat_cleanup();
select pg_temp.check((select bool_and(body = '[deleted after 30 days]') from public.messages
                      where conversation_id = (select chat_id from bc) and sender_id = 'd1d1d1d1-0000-4000-8000-0000000000d1')
                     and (select last_message_preview = '[deleted after 30 days]' from public.conversations where id = (select chat_id from bc))
                     and (select count(*) = 0 from public.message_moderation mm join public.messages m on m.id = mm.message_id
                          where m.conversation_id = (select chat_id from bc) and m.sender_id = 'd1d1d1d1-0000-4000-8000-0000000000d1'),
                     'B/M2: messages, preview and moderation copies removed');
select pg_temp.check((select body <> '[deleted after 30 days]' from public.messages
                      where conversation_id = (select chat_id from bc) and sender_id = 'a1a1a1a1-0000-4000-8000-0000000000a1')
                     and (select count(*) = 1 from public.message_moderation mm join public.messages m on m.id = mm.message_id
                          where m.conversation_id = (select chat_id from bc) and m.sender_id = 'a1a1a1a1-0000-4000-8000-0000000000a1')
                     and (select texts_cleared_at is null from public.conversations where id = (select chat_id from bc)),
                     'B/M2: a message under an open report keeps its text and moderation copy; the thread stays on the list');
update public.message_reports set resolved = true
where message_id in (select id from public.messages where conversation_id = (select chat_id from bc));
select private.run_business_chat_cleanup();
select pg_temp.check((select bool_and(body = '[deleted after 30 days]') from public.messages where conversation_id = (select chat_id from bc))
                     and (select texts_cleared_at is not null from public.conversations where id = (select chat_id from bc)),
                     'B/M2: once the report is resolved the rest goes and the thread is marked cleared');
select pg_temp.check((select private.run_business_chat_cleanup() = 0), 'B/M2: a cleared thread is not scanned again');
select pg_temp.check((select count(*) = 3 and bool_and(body <> '[deleted after 30 days]') from public.messages where conversation_id = (select id from gc)),
                     'B/M2: guide thread messages are untouched');

-- L1: a new reservation reopens the thread; then the business is deleted: the thread stays, read-only.
insert into public.reservations (id, provider_id, provider_ref, business_name, business_type, traveler_id,
                                 starts_at, party_size, commission_kind, commission_rate_tzs, price_list_id)
select 'aaaaaaaa-0000-4000-8000-000000000003', 'e1e1e1e1-0000-4000-8000-0000000000e1', 'e1e1e1e1-0000-4000-8000-0000000000e1',
       'BC test kitchen', 'restaurant', 'd1d1d1d1-0000-4000-8000-0000000000d1', now() + interval '5 days', 2, 'per_guest', 2000,
       (select id from public.price_list where service_code = 'reservation_commission' and business_type = 'restaurant' limit 1);
select pg_temp.check((select chat_id = (select chat_id from bc) from public.reservations where id = 'aaaaaaaa-0000-4000-8000-000000000003')
                     and private.chat_open((select chat_id from bc))
                     and (select texts_cleared_at is null from public.conversations where id = (select chat_id from bc)),
                     'B/L1: a new reservation reuses and reopens the thread (and puts it back on the cleanup list)');
-- No foreign key to providers is "restrict" (checked on live 2026-11-23: agreements, identifiers,
-- listings, documents, checks, provider_private, referral_sales cascade; leads and the check log set
-- null; reservations set null; services, hours and closed dates cascade), so this delete is not blocked.
delete from public.providers where id = 'e1e1e1e1-0000-4000-8000-0000000000e1';
select pg_temp.check((select count(*) = 0 from public.providers where id = 'e1e1e1e1-0000-4000-8000-0000000000e1'),
                     'B/L1: the business delete went through');
select pg_temp.check((select provider_id is null and was_business from public.conversations where id = (select chat_id from bc)),
                     'B/L1: deleting the business keeps the thread');
select pg_temp.as_user('d1d1d1d1-0000-4000-8000-0000000000d1');
set local role authenticated;
select pg_temp.check((select count(*) = 2 from public.conversations), 'B/L1: the traveller still sees both threads');
select pg_temp.expect_code($q$insert into public.messages (conversation_id, sender_id, body)
  select chat_id, 'd1d1d1d1-0000-4000-8000-0000000000d1', 'Are you there?' from bc$q$, 'chat_closed', 'B/L1: no messages after the business is gone');
reset role;

select 'all passed';
rollback;
