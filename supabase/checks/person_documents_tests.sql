-- Tests for migration 20261122000000_person_documents_identifiers.sql (paid verification, A).
-- Run ONLY on a local or test project, after the migration, in the SQL editor or psql as postgres.
-- Everything runs in one transaction that ends with ROLLBACK: the made-up users, files and rows
-- below never stay. Any failure stops the script with "FAIL: ...". The last line prints "all passed".
-- No real document or number is used; every id and number here is invented.

begin;

-- Helpers -------------------------------------------------------------------
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

grant execute on function pg_temp.expect_error(text, text) to authenticated, service_role;
grant execute on function pg_temp.check(boolean, text) to authenticated, service_role;

-- Made-up accounts: owner (a1), other user (b2), admin (c3) ---------------------
insert into auth.users (id, email, aud, role, raw_user_meta_data)
values ('a1a1a1a1-0000-4000-8000-000000000001', 'pv-owner@example.test', 'authenticated', 'authenticated', '{}'),
       ('b2b2b2b2-0000-4000-8000-000000000002', 'pv-other@example.test', 'authenticated', 'authenticated', '{}'),
       ('c3c3c3c3-0000-4000-8000-000000000003', 'pv-admin@example.test', 'authenticated', 'authenticated', '{}');
update public.profiles set onboarded_at = now()
where id in ('a1a1a1a1-0000-4000-8000-000000000001', 'b2b2b2b2-0000-4000-8000-000000000002', 'c3c3c3c3-0000-4000-8000-000000000003');
update public.profiles set role = 'admin' where id = 'c3c3c3c3-0000-4000-8000-000000000003';

-- A business owned by b2 (for MA1 and business_tin tests)
insert into public.providers (id, owner_id, business_name, base_region)
values ('e5e5e5e5-0000-4000-8000-000000000005', 'b2b2b2b2-0000-4000-8000-000000000002', 'PV test lodge', 'Arusha');

-- Files the owner "uploaded"; one file of the admin's own (MA1)
insert into storage.objects (bucket_id, name, owner_id) values
  ('verification', 'a1a1a1a1-0000-4000-8000-000000000001/d0000000-0000-4000-8000-000000000001.jpg', 'a1a1a1a1-0000-4000-8000-000000000001'),
  ('verification', 'a1a1a1a1-0000-4000-8000-000000000001/d0000000-0000-4000-8000-000000000002.pdf', 'a1a1a1a1-0000-4000-8000-000000000001'),
  ('verification', 'a1a1a1a1-0000-4000-8000-000000000001/d0000000-0000-4000-8000-000000000003.png', 'a1a1a1a1-0000-4000-8000-000000000001'),
  ('verification', 'a1a1a1a1-0000-4000-8000-000000000001/d0000000-0000-4000-8000-000000000004.jpg', 'a1a1a1a1-0000-4000-8000-000000000001'),
  ('verification', 'c3c3c3c3-0000-4000-8000-000000000003/d0000000-0000-4000-8000-000000000010.pdf', 'c3c3c3c3-0000-4000-8000-000000000003');
-- 27 more owner files for the cap test (L5)
insert into storage.objects (bucket_id, name, owner_id)
select 'verification',
       format('a1a1a1a1-0000-4000-8000-000000000001/d1000000-0000-4000-8000-%s.jpg', lpad(i::text, 12, '0')),
       'a1a1a1a1-0000-4000-8000-000000000001'
from generate_series(1, 27) i;

-- 1. Owner session ------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;

insert into public.person_documents (id, user_id, kind, path, notice_version)
values ('d0000000-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000001', 'identity',
        'a1a1a1a1-0000-4000-8000-000000000001/d0000000-0000-4000-8000-000000000001.jpg', 'privacy-2026-11');
insert into public.person_documents (id, user_id, kind, path, stated_valid_until, notice_version)
values ('d0000000-0000-4000-8000-000000000002', 'a1a1a1a1-0000-4000-8000-000000000001', 'first_aid',
        'a1a1a1a1-0000-4000-8000-000000000001/d0000000-0000-4000-8000-000000000002.pdf', current_date + 400, 'privacy-2026-11');
insert into public.person_documents (id, user_id, kind, path, notice_version)
values ('d0000000-0000-4000-8000-000000000003', 'a1a1a1a1-0000-4000-8000-000000000001', 'driving_licence',
        'a1a1a1a1-0000-4000-8000-000000000001/d0000000-0000-4000-8000-000000000003.png', 'privacy-2026-11');
insert into public.person_documents (id, user_id, kind, path, notice_version)
values ('d0000000-0000-4000-8000-000000000004', 'a1a1a1a1-0000-4000-8000-000000000001', 'identity',
        'a1a1a1a1-0000-4000-8000-000000000001/d0000000-0000-4000-8000-000000000004.jpg', 'privacy-2026-11');

select pg_temp.check((select review_state = 'waiting' and reviewed_at is null
                      from public.person_documents where id = 'd0000000-0000-4000-8000-000000000001'),
                     'new document is waiting');

select pg_temp.expect_error($q$insert into public.person_documents (id, user_id, kind, path, notice_version, review_state)
  values ('d0000000-0000-4000-8000-000000000009', 'a1a1a1a1-0000-4000-8000-000000000001', 'identity',
  'a1a1a1a1-0000-4000-8000-000000000001/d0000000-0000-4000-8000-000000000009.jpg', 'x', 'accepted')$q$,
  'owner sets review_state on insert');
select pg_temp.expect_error($q$insert into public.person_documents (id, user_id, kind, path, notice_version)
  values ('d0000000-0000-4000-8000-000000000008', 'a1a1a1a1-0000-4000-8000-000000000001', 'identity',
  'a1a1a1a1-0000-4000-8000-000000000001/d0000000-0000-4000-8000-000000000008.jpg', 'x')$q$,
  'insert without an uploaded file');
select pg_temp.expect_error($q$insert into public.person_documents (id, user_id, kind, path, notice_version)
  values ('d0000000-0000-4000-8000-000000000007', 'b2b2b2b2-0000-4000-8000-000000000002', 'identity',
  'b2b2b2b2-0000-4000-8000-000000000002/d0000000-0000-4000-8000-000000000007.jpg', 'x')$q$,
  'insert for another user');
select pg_temp.expect_error($q$insert into public.person_documents (id, user_id, kind, path, notice_version)
  values ('d0000000-0000-4000-8000-000000000006', 'a1a1a1a1-0000-4000-8000-000000000001', 'identity',
  'a1a1a1a1-0000-4000-8000-000000000001/somewhere-else.jpg', 'x')$q$,
  'path not {user}/{id}.{ext}');
select pg_temp.expect_error($q$insert into public.person_documents (id, user_id, kind, path, notice_version)
  values ('d0000000-0000-4000-8000-000000000005', 'a1a1a1a1-0000-4000-8000-000000000001', 'passport',
  'a1a1a1a1-0000-4000-8000-000000000001/d0000000-0000-4000-8000-000000000005.jpg', 'x')$q$,
  'passport image (M11)');
select pg_temp.expect_error($q$update public.person_documents set review_state = 'accepted'
  where id = 'd0000000-0000-4000-8000-000000000001'$q$, 'owner update');
select pg_temp.expect_error($q$delete from public.person_documents where id = 'd0000000-0000-4000-8000-000000000001'$q$,
  'owner delete (no grant)');
select pg_temp.check((select count(*) = 0 from public.person_documents
                      where id = 'd0000000-0000-4000-8000-000000000001' and review_state <> 'waiting'), 'still waiting after update attempt');
select pg_temp.expect_error($q$insert into public.person_document_checks (user_id, kind, method)
  values ('a1a1a1a1-0000-4000-8000-000000000001', 'identity', 'nida_card')$q$, 'owner writes a check');
select pg_temp.expect_error($q$insert into public.person_check_log (user_id, action) values
  ('a1a1a1a1-0000-4000-8000-000000000001', 'accepted')$q$, 'owner writes the log');
select pg_temp.check((select count(*) = 0 from public.person_check_log), 'owner cannot read the log');
select pg_temp.expect_error($q$select * from public.person_identifiers$q$, 'owner reads identifiers table');
select pg_temp.expect_error($q$insert into public.person_identifiers (user_id, key_version, notice_version)
  values ('a1a1a1a1-0000-4000-8000-000000000001', 1, 'x')$q$, 'owner writes identifiers table');
select pg_temp.expect_error($q$select public.svc_identifier_cipher_for_read('a1a1a1a1-0000-4000-8000-000000000001', 'aal2',
  'a1a1a1a1-0000-4000-8000-000000000001', null, 'nida', 'looking')$q$, 'client calls a service function');
select pg_temp.expect_error($q$select * from public.svc_verification_sweep_list(10)$q$, 'client calls the sweep list');
select pg_temp.expect_error($q$select public.svc_expire_stale_waiting(false)$q$, 'client expires documents');
select pg_temp.expect_error($q$select public.admin_review_document('d0000000-0000-4000-8000-000000000001', 'accept', null, 'nida_card')$q$,
  'non-admin review');

-- the title of an "other" paper is masked too (LA2)
insert into public.person_documents (id, user_id, kind, title, path, notice_version)
values ('d1000000-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000001', 'other', 'Card 1234-5678',
        'a1a1a1a1-0000-4000-8000-000000000001/d1000000-0000-4000-8000-000000000001.jpg', 'privacy-2026-11');
select pg_temp.check((select title = 'Card [number hidden]' from public.person_documents
                      where id = 'd1000000-0000-4000-8000-000000000001'), 'title masked');

-- L5 cap: 30 documents with a file kept. 5 exist now; 25 more fit, the 31st is refused.
do $$
begin
  for i in 2..26 loop
    insert into public.person_documents (id, user_id, kind, title, path, notice_version)
    values (format('d1000000-0000-4000-8000-%s', lpad(i::text, 12, '0'))::uuid, 'a1a1a1a1-0000-4000-8000-000000000001',
            'other', 'Paper ' || chr(64 + i),
            format('a1a1a1a1-0000-4000-8000-000000000001/d1000000-0000-4000-8000-%s.jpg', lpad(i::text, 12, '0')), 'privacy-2026-11');
  end loop;
end $$;
select pg_temp.expect_error($q$insert into public.person_documents (id, user_id, kind, title, path, notice_version)
  values ('d1000000-0000-4000-8000-000000000027', 'a1a1a1a1-0000-4000-8000-000000000001', 'other', 'One too many',
  'a1a1a1a1-0000-4000-8000-000000000001/d1000000-0000-4000-8000-000000000027.jpg', 'privacy-2026-11')$q$,
  '31st document (cap)');

-- withdraw (M2), once only
select public.withdraw_my_document('d0000000-0000-4000-8000-000000000003');
select pg_temp.check((select review_state = 'withdrawn' from public.person_documents
                      where id = 'd0000000-0000-4000-8000-000000000003'), 'withdrawn');
select pg_temp.expect_error($q$select public.withdraw_my_document('d0000000-0000-4000-8000-000000000003')$q$, 'withdraw twice');

-- storage (M1): delete allowed only for a withdrawn row or no row; no re-upload over a row's path
select pg_temp.check(not private.verification_path_deletable('a1a1a1a1-0000-4000-8000-000000000001/d0000000-0000-4000-8000-000000000001.jpg'),
                     'waiting file not deletable');
select pg_temp.check(private.verification_path_deletable('a1a1a1a1-0000-4000-8000-000000000001/d0000000-0000-4000-8000-000000000003.png'),
                     'withdrawn file deletable');
select pg_temp.check(private.verification_path_has_row('a1a1a1a1-0000-4000-8000-000000000001/d0000000-0000-4000-8000-000000000001.jpg'),
                     'upload over an existing row is blocked');

reset role;

-- 2. Other user sees nothing --------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"b2b2b2b2-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select pg_temp.check((select count(*) = 0 from public.person_documents), 'other user reads no documents');
select pg_temp.expect_error($q$select public.withdraw_my_document('d0000000-0000-4000-8000-000000000001')$q$, 'withdraw someone else''s');
reset role;

-- 3. Admin without two-step is not an admin ------------------------------------
select set_config('request.jwt.claims', '{"sub":"c3c3c3c3-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select pg_temp.expect_error($q$select public.admin_review_document('d0000000-0000-4000-8000-000000000001', 'accept', null, 'nida_card')$q$,
  'admin review with aal1');
reset role;

-- 4. Admin with two-step ------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"c3c3c3c3-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select pg_temp.check((select count(*) = 30 from public.person_documents), 'admin reads all documents');

-- MA1: an admin writing directly gets the client checks
select pg_temp.expect_error($q$insert into public.person_documents (id, user_id, provider_id, kind, path, stated_valid_until, notice_version)
  values ('d0000000-0000-4000-8000-000000000010', 'c3c3c3c3-0000-4000-8000-000000000003', 'e5e5e5e5-0000-4000-8000-000000000005',
  'business_licence', 'c3c3c3c3-0000-4000-8000-000000000003/d0000000-0000-4000-8000-000000000010.pdf', current_date + 300, 'x')$q$,
  'MA1: admin attaches a paper to a business they do not own');
select pg_temp.expect_error($q$insert into public.person_documents (id, user_id, kind, path, notice_version)
  values ('d0000000-0000-4000-8000-000000000011', 'c3c3c3c3-0000-4000-8000-000000000003', 'identity',
  'c3c3c3c3-0000-4000-8000-000000000003/d0000000-0000-4000-8000-000000000011.jpg', 'x')$q$,
  'MA1: admin inserts a document with no file');
select pg_temp.expect_error($q$update public.person_documents set review_note = 'x'
  where id = 'd0000000-0000-4000-8000-000000000001'$q$, 'MA1: admin updates a document directly');

select pg_temp.expect_error($q$select public.admin_review_document('d0000000-0000-4000-8000-000000000001', 'accept', null, null)$q$,
  'identity accepted without nida_card method');
select pg_temp.expect_error($q$select public.admin_review_document('d0000000-0000-4000-8000-000000000002', 'accept', current_date - 1)$q$,
  'accept an expired certificate');
select pg_temp.expect_error($q$select public.admin_review_document('d0000000-0000-4000-8000-000000000002', 'accept', null)$q$,
  'dated kind without valid_until');
select pg_temp.expect_error($q$select public.admin_review_document('d0000000-0000-4000-8000-000000000002', 'reject')$q$,
  'reject without a reason');
select public.admin_review_document('d0000000-0000-4000-8000-000000000001', 'accept', null, 'nida_card', null,
                                    'Card number 1990 0101 1234 read fine');
select pg_temp.check((select review_state = 'accepted' and review_note like '%[number hidden]%'
                      from public.person_documents where id = 'd0000000-0000-4000-8000-000000000001'),
                     'accepted, digits in the note hidden');
select pg_temp.check((select count(*) = 1 from public.person_document_checks
                      where user_id = 'a1a1a1a1-0000-4000-8000-000000000001' and kind = 'identity' and ended_at is null),
                     'one current identity check');
select pg_temp.expect_error($q$select public.admin_review_document('d0000000-0000-4000-8000-000000000001', 'reject', null, null, 'other')$q$,
  'decide twice');
-- LA1: a 296-character note grows past 300 when masked; it is cut, not refused
select public.admin_review_document('d0000000-0000-4000-8000-000000000002', 'reject', null, null, 'unreadable',
                                    repeat('x', 290) || ' 12345');
select pg_temp.check((select char_length(review_note) = 300 from public.person_documents
                      where id = 'd0000000-0000-4000-8000-000000000002'), 'LA1: masked note cut to 300');
select pg_temp.check((select string_agg(action, ',' order by id) from public.person_check_log
                      where user_id = 'a1a1a1a1-0000-4000-8000-000000000001' and action <> 'uploaded')
                     = 'withdrawn,checked,accepted,rejected', 'log rows in order');
select pg_temp.check((select bool_and(actor = 'c3c3c3c3-0000-4000-8000-000000000003') from public.person_check_log
                      where action in ('checked', 'accepted', 'rejected')), 'admin is the logged actor');

-- renewal: accepting a second identity card ends the first check as 'renewed'
select public.admin_review_document('d0000000-0000-4000-8000-000000000004', 'accept', null, 'nida_card');
select pg_temp.check((select count(*) = 1 from public.person_document_checks
                      where kind = 'identity' and ended_at is null and document_id = 'd0000000-0000-4000-8000-000000000004'),
                     'new check is current');
select pg_temp.check((select end_reason = 'renewed' from public.person_document_checks
                      where document_id = 'd0000000-0000-4000-8000-000000000001'), 'old check ended as renewed');

select public.admin_log_document_opened('d0000000-0000-4000-8000-000000000001');
select pg_temp.check(exists (select 1 from public.person_check_log where action = 'document_opened'), 'document_opened logged');
select public.admin_end_check((select id from public.person_document_checks where kind = 'identity' and ended_at is null),
                              'Card reported stolen');
select pg_temp.check((select end_reason = 'withdrawn' from public.person_document_checks
                      where document_id = 'd0000000-0000-4000-8000-000000000004'), 'check ended');
select pg_temp.expect_error($q$update public.person_document_checks set valid_until = '2099-01-01'$q$, 'admin edits a check directly');
reset role;

-- 5. Service role: identifiers and sweep --------------------------------------
set local role service_role;
select public.svc_identifier_set('a1a1a1a1-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000001', null, 'nida',
  encode('\x01'::bytea || extensions.gen_random_bytes(40), 'base64'), '112', encode(extensions.gen_random_bytes(32), 'base64'),
  1::smallint, 1::smallint, null, null, 'privacy-2026-11');
select pg_temp.check((select nida_last3 = '112' from public.person_identifiers
                      where user_id = 'a1a1a1a1-0000-4000-8000-000000000001'), 'nida stored');
select pg_temp.expect_error($q$select public.svc_identifier_set('a1a1a1a1-0000-4000-8000-000000000001', 'b2b2b2b2-0000-4000-8000-000000000002',
  null, 'nida', encode('\x01'::bytea || extensions.gen_random_bytes(40), 'base64'), '112', encode(extensions.gen_random_bytes(32), 'base64'),
  1::smallint, 1::smallint, null, null, 'x')$q$, 'write someone else''s number');
select pg_temp.expect_error($q$select public.svc_identifier_set('a1a1a1a1-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000001',
  'e5e5e5e5-0000-4000-8000-000000000005', 'business_tin', encode('\x01'::bytea || extensions.gen_random_bytes(40), 'base64'), '789',
  null, null, 1::smallint, null, null, 'x')$q$, 'business TIN for a business the caller does not own');
select pg_temp.expect_error($q$select public.svc_identifier_set('a1a1a1a1-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000001',
  null, 'nida', encode('\x02'::bytea || extensions.gen_random_bytes(40), 'base64'), '112', encode(extensions.gen_random_bytes(32), 'base64'),
  1::smallint, 1::smallint, null, null, 'x')$q$, 'cipher version byte differs from key version');
-- write limit: 10 per 24 hours (1 used above)
do $$
begin
  for i in 1..9 loop
    perform public.svc_identifier_set('a1a1a1a1-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000001', null, 'tin',
      encode('\x01'::bytea || extensions.gen_random_bytes(40), 'base64'), '789', null, null, 1::smallint, null, null, 'privacy-2026-11');
  end loop;
end $$;
select pg_temp.expect_error($q$select public.svc_identifier_set('a1a1a1a1-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000001',
  null, 'tin', encode('\x01'::bytea || extensions.gen_random_bytes(40), 'base64'), '789', null, null, 1::smallint, null, null, 'x')$q$,
  '11th write in 24 hours');

select pg_temp.expect_error($q$select public.svc_identifier_cipher_for_read('a1a1a1a1-0000-4000-8000-000000000001', 'aal2',
  'a1a1a1a1-0000-4000-8000-000000000001', null, 'nida', 'curious')$q$, 'non-admin full read');
select pg_temp.expect_error($q$select public.svc_identifier_cipher_for_read('c3c3c3c3-0000-4000-8000-000000000003', 'aal1',
  'a1a1a1a1-0000-4000-8000-000000000001', null, 'nida', 'duplicate check')$q$, 'admin full read without aal2');
select pg_temp.expect_error($q$select public.svc_identifier_cipher_for_read('c3c3c3c3-0000-4000-8000-000000000003', 'aal2',
  'a1a1a1a1-0000-4000-8000-000000000001', null, 'nida', '')$q$, 'full read without a reason');
select pg_temp.check(public.svc_identifier_cipher_for_read('c3c3c3c3-0000-4000-8000-000000000003', 'aal2',
  'a1a1a1a1-0000-4000-8000-000000000001', null, 'nida', 'duplicate flag on two accounts') ? 'cipher', 'admin full read');
select pg_temp.check((select count(*) = 1 from public.person_check_log
                      where action = 'identifier_viewed' and actor = 'c3c3c3c3-0000-4000-8000-000000000003' and field = 'nida'),
                     'identifier_viewed logged with the real actor');
reset role;

-- MA2: the 21st read in an hour is refused, logged, and alerts each admin once
insert into public.person_check_log (user_id, action, actor, field)
select 'a1a1a1a1-0000-4000-8000-000000000001', 'identifier_viewed', 'c3c3c3c3-0000-4000-8000-000000000003', 'nida'
from generate_series(1, 19);
set local role service_role;
select pg_temp.check(public.svc_identifier_cipher_for_read('c3c3c3c3-0000-4000-8000-000000000003', 'aal2',
  'a1a1a1a1-0000-4000-8000-000000000001', null, 'nida', 'one read too many') ->> 'error' = 'rate_limited', 'MA2: refused');
select pg_temp.check(public.svc_identifier_cipher_for_read('c3c3c3c3-0000-4000-8000-000000000003', 'aal2',
  'a1a1a1a1-0000-4000-8000-000000000001', null, 'nida', 'and another one') ->> 'error' = 'rate_limited', 'MA2: refused again');
reset role;
select pg_temp.check((select count(*) = 2 from public.person_check_log where action = 'identifier_read_refused'),
                     'MA2: refused reads logged');
select pg_temp.check((select count(*) = 1 from public.notification_outbox
                      where event = 'identifier_read_limit' and channel = 'email'
                        and recipient_user_id = 'c3c3c3c3-0000-4000-8000-000000000003'),
                     'MA2: exactly one alert email for the admin');

-- LA4: a document nobody reviewed for over 60 days expires (inserted as postgres with an old date)
insert into storage.objects (bucket_id, name, owner_id) values
  ('verification', 'b2b2b2b2-0000-4000-8000-000000000002/d2000000-0000-4000-8000-000000000001.jpg', 'b2b2b2b2-0000-4000-8000-000000000002');
insert into public.person_documents (id, user_id, kind, path, notice_version, uploaded_at)
values ('d2000000-0000-4000-8000-000000000001', 'b2b2b2b2-0000-4000-8000-000000000002', 'identity',
        'b2b2b2b2-0000-4000-8000-000000000002/d2000000-0000-4000-8000-000000000001.jpg', 'privacy-2026-11', now() - interval '61 days');
set local role service_role;
select pg_temp.check(public.svc_expire_stale_waiting(true) >= 1, 'LA4: dry run counts the stale document');
select pg_temp.check((select review_state = 'waiting' from public.person_documents
                      where id = 'd2000000-0000-4000-8000-000000000001'), 'LA4: dry run changes nothing');
select public.svc_expire_stale_waiting(false);
select pg_temp.check((select review_state = 'expired' from public.person_documents
                      where id = 'd2000000-0000-4000-8000-000000000001'), 'LA4: expired');
select pg_temp.check(exists (select 1 from public.svc_verification_sweep_list(1000)
                             where name like '%d2000000-0000-4000-8000-000000000001.jpg' and reason = 'retention_expired'),
                     'LA4: sweep lists the expired file');

select pg_temp.check(exists (select 1 from public.svc_verification_sweep_list(1000)
                             where name like '%d0000000-0000-4000-8000-000000000003.png' and reason = 'retention_withdrawn'),
                     'sweep lists the withdrawn file');
select pg_temp.check(not exists (select 1 from public.svc_verification_sweep_list(1000)
                                 where name like '%d0000000-0000-4000-8000-000000000001.jpg'),
                     'sweep keeps the accepted file inside 90 days');
select pg_temp.check(not exists (select 1 from public.svc_verification_sweep_list(1000)
                                 where name like '%d1000000-0000-4000-8000-000000000002.jpg'),
                     'sweep keeps waiting files');
select pg_temp.check(public.svc_verification_sweep_mark(array['a1a1a1a1-0000-4000-8000-000000000001/d0000000-0000-4000-8000-000000000003.png']) = 0,
                     'LA7: a file still in storage is not marked removed');
select pg_temp.check(public.svc_verification_bucket_count() >= 33, 'bucket count');
reset role;

-- 6. Owner view of their identifiers ------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select pg_temp.check((select nida_last3 = '112' and tin_last3 = '789' from public.my_identifiers()), 'my_identifiers shows last 3');
reset role;

-- 7. Deleting the account keeps the audit rows without the person (L6) ----------
delete from auth.users where id = 'a1a1a1a1-0000-4000-8000-000000000001';
select pg_temp.check((select count(*) > 0 from public.person_check_log where user_id is null and action = 'identifier_viewed'),
                     'audit row kept after deletion');
select pg_temp.check(not exists (select 1 from public.person_identifiers where user_id = 'a1a1a1a1-0000-4000-8000-000000000001'),
                     'identifiers removed with the account');
set local role service_role;
select pg_temp.check((select count(*) = 31 from public.svc_verification_sweep_list(1000) where reason = 'no_account'
                      and name like 'a1a1a1a1-0000-4000-8000-000000000001/%'),
                     'sweep lists every file of the deleted account (H2)');
reset role;

select 'all passed' as result;
rollback;
