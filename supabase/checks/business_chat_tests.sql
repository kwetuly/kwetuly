-- Tests for migration 20261123000000_business_chat.sql (chat between a traveller and a business).
-- Run ONLY on a local or test project, after 20261122200000, 20261122300000 and 20261123000000, in the
-- SQL editor or psql as postgres. One transaction that ends with ROLLBACK: nothing below stays.
-- Any failure stops the script with "FAIL: ...". The last line prints "all passed".
-- Part A proves guide threads behave exactly as before; part B covers business threads.
-- Every name and number here is invented.

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

grant execute on function pg_temp.expect_error(text, text) to authenticated;
grant execute on function pg_temp.check(boolean, text) to authenticated;

-- Accounts: t1 traveller, go guide owner, bo business owner, b2 another business owner, ad admin.
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('d1d1d1d1-0000-4000-8000-0000000000d1', 'bc-trav@example.test', 'authenticated', 'authenticated', '{}'),
  ('f4f4f4f4-0000-4000-8000-0000000000f4', 'bc-guide@example.test', 'authenticated', 'authenticated', '{}'),
  ('a1a1a1a1-0000-4000-8000-0000000000a1', 'bc-owner@example.test', 'authenticated', 'authenticated', '{}'),
  ('b2b2b2b2-0000-4000-8000-0000000000b2', 'bc-other@example.test', 'authenticated', 'authenticated', '{}');
update public.profiles set onboarded_at = now()
where id in ('d1d1d1d1-0000-4000-8000-0000000000d1', 'f4f4f4f4-0000-4000-8000-0000000000f4',
             'a1a1a1a1-0000-4000-8000-0000000000a1', 'b2b2b2b2-0000-4000-8000-0000000000b2');
update public.profiles set full_name = 'Asha Mrefu' where id = 'd1d1d1d1-0000-4000-8000-0000000000d1';

insert into public.guides (id, owner_id, slug, display_name, base_region, verification_status)
values ('97979797-0000-4000-8000-000000000097', 'f4f4f4f4-0000-4000-8000-0000000000f4', 'bc-test-guide', 'BC Test Guide', 'Arusha', 'approved');
insert into public.providers (id, owner_id, business_name, base_region, business_type, verification_status)
values ('e1e1e1e1-0000-4000-8000-0000000000e1', 'a1a1a1a1-0000-4000-8000-0000000000a1', 'BC test kitchen', 'Arusha', 'restaurant', 'approved'),
       ('e3e3e3e3-0000-4000-8000-0000000000e3', 'b2b2b2b2-0000-4000-8000-0000000000b2', 'BC other cafe', 'Moshi', 'restaurant', 'approved');

-- ===========================================================================
-- A. Guide threads: exactly as before
-- ===========================================================================
select pg_temp.as_user('d1d1d1d1-0000-4000-8000-0000000000d1');
set local role authenticated;
insert into public.conversations (id, traveler_id, guide_id)
values ('c0000000-0000-4000-8000-000000000001', 'd1d1d1d1-0000-4000-8000-0000000000d1', '97979797-0000-4000-8000-000000000097');
select pg_temp.check((select traveler_name = 'Asha Mrefu' and not contact_unlocked
                      from public.conversations where id = 'c0000000-0000-4000-8000-000000000001'),
                     'A: guide thread keeps the full name and starts locked');
select pg_temp.expect_error($q$insert into public.conversations (traveler_id, guide_id)
  values ('d1d1d1d1-0000-4000-8000-0000000000d1', '97979797-0000-4000-8000-000000000097')$q$, 'A: one thread per traveller and guide');
select pg_temp.expect_error($q$insert into public.conversations (traveler_id, guide_id, contact_unlocked)
  values ('d1d1d1d1-0000-4000-8000-0000000000d1', '97979797-0000-4000-8000-000000000097', true)$q$, 'A: traveller cannot start unlocked');
insert into public.messages (conversation_id, sender_id, body)
values ('c0000000-0000-4000-8000-000000000001', 'd1d1d1d1-0000-4000-8000-0000000000d1', 'Hello, call me on 0712 345 678');
select pg_temp.check((select masked and body like '%[contact hidden]%' from public.messages
                      where conversation_id = 'c0000000-0000-4000-8000-000000000001'),
                     'A: phone number hidden in a locked guide thread');
update public.conversations set contact_unlocked = true, traveler_last_read_at = now(), guide_last_read_at = now()
where id = 'c0000000-0000-4000-8000-000000000001';
select pg_temp.check((select not contact_unlocked and traveler_last_read_at is not null and guide_last_read_at is null
                      from public.conversations where id = 'c0000000-0000-4000-8000-000000000001'),
                     'A: traveller sets only their own read time, cannot unlock');
reset role;
select pg_temp.check((select count(*) = 1 from public.notification_outbox
                      where event = 'message_new' and recipient_user_id = 'f4f4f4f4-0000-4000-8000-0000000000f4'
                        and payload ->> 'conversation' = 'c0000000-0000-4000-8000-000000000001'
                        and payload ->> 'sender' = 'Asha Mrefu'),
                     'A: guide owner alerted, sender shown by full name as before');

select pg_temp.as_user('f4f4f4f4-0000-4000-8000-0000000000f4');
set local role authenticated;
select pg_temp.check((select count(*) = 1 from public.conversations), 'A: guide owner sees the thread');
update public.conversations set guide_last_read_at = now(), traveler_last_read_at = null
where id = 'c0000000-0000-4000-8000-000000000001';
select pg_temp.check((select guide_last_read_at is not null and traveler_last_read_at is not null
                      from public.conversations where id = 'c0000000-0000-4000-8000-000000000001'),
                     'A: guide owner sets only the guide read time');
insert into public.messages (conversation_id, sender_id, body)
values ('c0000000-0000-4000-8000-000000000001', 'f4f4f4f4-0000-4000-8000-0000000000f4', 'Karibu!');
reset role;
select pg_temp.check((select count(*) = 1 from public.notification_outbox
                      where event = 'message_new' and recipient_user_id = 'd1d1d1d1-0000-4000-8000-0000000000d1'
                        and payload ->> 'sender' = 'BC Test Guide'),
                     'A: traveller alerted, sender shown by guide name as before');

select pg_temp.as_user('b2b2b2b2-0000-4000-8000-0000000000b2');
set local role authenticated;
select pg_temp.check((select count(*) = 0 from public.conversations) and (select count(*) = 0 from public.messages),
                     'A: outsiders see nothing');
reset role;

-- Unlocking by the server (as after an accepted call) still works for guide threads.
update public.conversations set contact_unlocked = true where id = 'c0000000-0000-4000-8000-000000000001';
select pg_temp.as_user('d1d1d1d1-0000-4000-8000-0000000000d1');
set local role authenticated;
insert into public.messages (conversation_id, sender_id, body)
values ('c0000000-0000-4000-8000-000000000001', 'd1d1d1d1-0000-4000-8000-0000000000d1', 'My number is 0712 345 678');
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
select pg_temp.expect_error($q$insert into public.conversations (traveler_id, guide_id, provider_id)
  values ('d1d1d1d1-0000-4000-8000-0000000000d1', '97979797-0000-4000-8000-000000000097', 'e1e1e1e1-0000-4000-8000-0000000000e1')$q$,
  'B: a thread cannot have both a guide and a business');
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
grant select on bc to authenticated;
select pg_temp.check((select r.chat_id is not null from public.reservations r where r.id = 'aaaaaaaa-0000-4000-8000-000000000001')
                     and (select count(distinct chat_id) = 1 from public.reservations
                          where id in ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002')),
                     'B: reservations link to one thread per traveller and business');
select pg_temp.check((select provider_id = 'e1e1e1e1-0000-4000-8000-0000000000e1' and guide_id is null
                        and traveler_name = 'Asha' and not contact_unlocked
                      from public.conversations where id = (select chat_id from bc)),
                     'B: business thread shows the traveller''s first name only, locked');
select pg_temp.expect_error($q$update public.conversations set contact_unlocked = true where id = (select chat_id from bc)$q$,
  'B: a business thread can never be unlocked, not even by server code or an admin');

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

-- The business owner reads, marks read, replies (masked too), cannot move the thread.
select pg_temp.as_user('a1a1a1a1-0000-4000-8000-0000000000a1');
set local role authenticated;
select pg_temp.check((select count(*) = 1 from public.conversations) and (select count(*) = 1 from public.messages),
                     'B: business owner sees the thread and its messages');
update public.conversations set guide_last_read_at = now(), provider_id = 'e3e3e3e3-0000-4000-8000-0000000000e3',
  guide_id = '97979797-0000-4000-8000-000000000097'
where id = (select chat_id from bc);
select pg_temp.check((select guide_last_read_at is not null and provider_id = 'e1e1e1e1-0000-4000-8000-0000000000e1' and guide_id is null
                      from public.conversations where id = (select chat_id from bc)),
                     'B: owner sets the read time only');
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

select 'all passed';
rollback;
