-- Tests for migration 20261126000100_media_uploads.sql (slice S4, one upload system).
-- Run ONLY on a local or test project, after the migration, in the SQL editor or psql as postgres.
-- Everything runs in one transaction that ends with ROLLBACK: the made-up users, files and rows below
-- never stay. Any failure stops the script with "FAIL: ...". The last line prints "all passed".
-- No real photo is used; storage objects are rows with made-up sizes.

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

grant execute on function pg_temp.expect_error(text, text) to anon, authenticated, service_role;
grant execute on function pg_temp.check(boolean, text) to anon, authenticated, service_role;

-- Made-up accounts: guide owner (a1), other user (b2), admin (c3) ----------------
insert into auth.users (id, email, aud, role, raw_user_meta_data)
values ('a1a1a1a1-0000-4000-8000-0000000000a1', 'mu-owner@example.test', 'authenticated', 'authenticated', '{}'),
       ('b2b2b2b2-0000-4000-8000-0000000000b2', 'mu-other@example.test', 'authenticated', 'authenticated', '{}'),
       ('c3c3c3c3-0000-4000-8000-0000000000c3', 'mu-admin@example.test', 'authenticated', 'authenticated', '{}');
update public.profiles set onboarded_at = now()
where id in ('a1a1a1a1-0000-4000-8000-0000000000a1', 'b2b2b2b2-0000-4000-8000-0000000000b2', 'c3c3c3c3-0000-4000-8000-0000000000c3');
update public.profiles set role = 'admin' where id = 'c3c3c3c3-0000-4000-8000-0000000000c3';

insert into public.guides (id, owner_id, slug, display_name, base_region, verification_status)
values ('97979797-0000-4000-8000-000000000097', 'a1a1a1a1-0000-4000-8000-0000000000a1', 'mu-test-guide', 'MU Test Guide', 'Arusha', 'approved'),
       ('98989898-0000-4000-8000-000000000098', 'b2b2b2b2-0000-4000-8000-0000000000b2', 'mu-other-guide', 'MU Other Guide', 'Moshi', 'pending');

-- Buckets
select pg_temp.check((select public and file_size_limit = 2097152 and allowed_mime_types = array['image/webp', 'image/jpeg']
                      from storage.buckets where id = 'media'), 'media bucket public, 2 MB, webp and jpeg');
select pg_temp.check((select not public and file_size_limit = 2097152 from storage.buckets where id = 'media-pending'),
                     'media-pending bucket private, 2 MB');

-- A function that stores a made-up object as postgres (the test stands in for Storage).
create function pg_temp.put(p_bucket text, p_name text, p_owner text, p_size bigint, p_type text) returns void
language sql as $$
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values (p_bucket, p_name, p_owner, jsonb_build_object('size', p_size, 'mimetype', p_type));
$$;

-- 1. Owner session ------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-4000-8000-0000000000a1","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;

create temp table t_ids (k text primary key, id uuid, path text, thumb text) on commit drop;
grant all on t_ids to authenticated, service_role;

insert into t_ids (k, id, path, thumb)
select 'cover1', s.id, s.path, s.thumb_path
from public.start_media_upload('cover', 'guide', '97979797-0000-4000-8000-000000000097', 'webp', 'photo-consent-2026-11') s;

select pg_temp.check((select bucket = 'media' from public.start_media_upload('gallery', 'guide', '97979797-0000-4000-8000-000000000097', 'webp', 'photo-consent-2026-11')),
                     'gallery goes to the public bucket');
select pg_temp.check((select state = 'uploading' and consented_at is not null and path ~ '^a1a1a1a1-0000-4000-8000-0000000000a1/'
                      from public.media m join t_ids t on t.id = m.id where t.k = 'cover1'), 'new row is uploading, consent time set');

select pg_temp.expect_error($q$select * from public.start_media_upload('cover', 'guide', '98989898-0000-4000-8000-000000000098', 'webp', 'photo-consent-2026-11')$q$,
  'upload to another person''s guide');
select pg_temp.expect_error($q$select * from public.start_media_upload('gallery', 'guide', '97979797-0000-4000-8000-000000000097', 'webp', null)$q$,
  'gallery without consent');
select pg_temp.expect_error($q$select * from public.start_media_upload('gallery', 'guide', '97979797-0000-4000-8000-000000000097', 'png', 'photo-consent-2026-11')$q$,
  'png output');
select pg_temp.expect_error($q$select * from public.start_media_upload('product', 'guide', '97979797-0000-4000-8000-000000000097', 'webp', 'photo-consent-2026-11')$q$,
  'product photo on a guide');
select pg_temp.expect_error($q$insert into public.media (owner_id, subject_kind, subject_id, field, path, thumb_path, consent_version)
  values ('a1a1a1a1-0000-4000-8000-0000000000a1', 'guide', '97979797-0000-4000-8000-000000000097', 'gallery',
  'a1a1a1a1-0000-4000-8000-0000000000a1/elsewhere.webp', 'a1a1a1a1-0000-4000-8000-0000000000a1/elsewhere-thumb.webp', 'x')$q$,
  'path not {owner}/{id}.webp');
-- A second cover start gives up the unfinished first one.
insert into t_ids (k, id, path, thumb)
select 'cover2', s.id, s.path, s.thumb_path
from public.start_media_upload('cover', 'guide', '97979797-0000-4000-8000-000000000097', 'webp', 'photo-consent-2026-11') s;
select pg_temp.check((select state = 'removed' and removed_reason = 'replaced' from public.media m join t_ids t on t.id = m.id where t.k = 'cover1'),
                     'a new cover start gives up the unfinished one');

-- Finishing without files is refused.
select pg_temp.expect_error($q$select * from public.finish_media_upload((select id from t_ids where k = 'cover2'), 2000, 667, '#aabbcc')$q$,
  'finish without files');
-- The owner may not set state directly to checked.
select pg_temp.expect_error($q$update public.media set state = 'checked' where id = (select id from t_ids where k = 'cover2')$q$,
  'owner sets checked');
select pg_temp.expect_error($q$update public.media set path = 'x' where id = (select id from t_ids where k = 'cover2')$q$,
  'owner changes path (no grant)');
select pg_temp.expect_error($q$delete from public.media where id = (select id from t_ids where k = 'cover2')$q$,
  'owner deletes a row (no grant)');

-- Storage insert policy: only the open slot's names.
select pg_temp.check((select private.media_upload_slot('media', path) from t_ids where k = 'cover2'), 'open slot for cover2');
select pg_temp.check((select not private.media_upload_slot('media-pending', path) from t_ids where k = 'cover2'), 'not in the other bucket');
select pg_temp.check((select not private.media_upload_slot('media', path) from t_ids where k = 'cover1'), 'no slot for a replaced row');
select pg_temp.check(not private.media_upload_slot('media', 'a1a1a1a1-0000-4000-8000-0000000000a1/anything.webp'), 'no slot for a free name');

reset role;

-- Files "uploaded" (as postgres, standing in for Storage). One too big, one wrong type.
select pg_temp.put('media', path, 'a1a1a1a1-0000-4000-8000-0000000000a1', 900000, 'image/webp') from t_ids where k = 'cover2';
select pg_temp.put('media', thumb, 'a1a1a1a1-0000-4000-8000-0000000000a1', 90000, 'image/webp') from t_ids where k = 'cover2';

select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-4000-8000-0000000000a1","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;

select pg_temp.check((select state = 'live' from public.finish_media_upload((select id from t_ids where k = 'cover2'), 9999, 0, 'not-a-colour')),
                     'finish makes the cover live');
select pg_temp.check((select width = 4000 and height = 1 and placeholder is null and mime = 'image/webp' and bytes = 900000 and is_main
                      from public.media m join t_ids t on t.id = m.id where t.k = 'cover2'),
                     'sizes bounded, bad colour dropped, type and size from storage, main');
select pg_temp.expect_error($q$update public.media set width = 10 where id = (select id from t_ids where k = 'cover2')$q$,
  'owner changes width after finishing');

-- Gallery: 12 at most (one already started above).
do $$
declare i int;
begin
  for i in 1..11 loop
    perform * from public.start_media_upload('gallery', 'guide', '97979797-0000-4000-8000-000000000097', 'webp', 'photo-consent-2026-11');
  end loop;
end $$;
select pg_temp.expect_error($q$select * from public.start_media_upload('gallery', 'guide', '97979797-0000-4000-8000-000000000097', 'webp', 'photo-consent-2026-11')$q$,
  'thirteenth gallery photo');
select pg_temp.check((select count(*) = 12 and count(distinct sort) = 12 from public.media
                      where field = 'gallery' and state <> 'removed'), 'twelve gallery rows with their own order');

-- Remove an unfinished one frees a slot.
select pg_temp.check((select paths[1] like 'a1a1a1a1-0000-4000-8000-0000000000a1/%' from public.remove_my_media(
                        (select id from public.media where field = 'gallery' and state = 'uploading' order by sort desc limit 1))),
                     'remove returns the file names');
insert into t_ids (k, id, path, thumb)
select 'g1', s.id, s.path, s.thumb_path
from public.start_media_upload('gallery', 'guide', '97979797-0000-4000-8000-000000000097', 'jpg', 'photo-consent-2026-11') s;

reset role;
-- Wrong type for g1 (path says jpg, storage says webp), and a second file over the size for g1's thumb.
select pg_temp.put('media', path, 'a1a1a1a1-0000-4000-8000-0000000000a1', 500000, 'image/webp') from t_ids where k = 'g1';
select pg_temp.put('media', thumb, 'a1a1a1a1-0000-4000-8000-0000000000a1', 900000, 'image/jpeg') from t_ids where k = 'g1';
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-4000-8000-0000000000a1","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select pg_temp.expect_error($q$select * from public.finish_media_upload((select id from t_ids where k = 'g1'), 1600, 1200)$q$,
  'finish with the wrong type');
select pg_temp.check((select reason = 'file_type' from private.media_object_check((select id from t_ids where k = 'g1'))), 'reason file_type');

-- Owner may delete the unused files of an unfinished row, never those of a shown row.
select pg_temp.check((select private.media_path_deletable('media', path) from t_ids where k = 'g1'), 'unfinished file deletable');
select pg_temp.check((select not private.media_path_deletable('media', path) from t_ids where k = 'cover2'), 'shown cover not deletable');

-- 2. Other user ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"b2b2b2b2-0000-4000-8000-0000000000b2","role":"authenticated","aal":"aal1"}', true);
select pg_temp.check((select count(*) = 1 from public.media where state in ('live', 'checked')), 'others see the shown cover only');
select pg_temp.check((select count(*) = 0 from public.media where state = 'uploading'), 'others do not see unfinished uploads');
select pg_temp.expect_error($q$select * from public.remove_my_media((select id from t_ids where k = 'cover2'))$q$, 'other removes the cover');
select pg_temp.check((select reason = 'not_yours' from private.media_object_check((select id from t_ids where k = 'cover2'))), 'object check refuses others');
select pg_temp.expect_error($q$select * from public.admin_check_media((select id from t_ids where k = 'cover2'), 'checked')$q$, 'non-admin checks');
select pg_temp.expect_error($q$select * from public.svc_media_sweep_list(10)$q$, 'client calls the sweep list');

-- 3. Anonymous visitor --------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select pg_temp.check((select count(*) = 1 from public.media), 'anon sees the shown cover of an approved guide');
select pg_temp.expect_error($q$select * from public.start_media_upload('gallery', 'guide', '97979797-0000-4000-8000-000000000097', 'webp', 'x')$q$, 'anon starts an upload');

-- 4. Admin (two-step) ---------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"c3c3c3c3-0000-4000-8000-0000000000c3","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select pg_temp.expect_error($q$select * from public.admin_check_media((select id from t_ids where k = 'cover2'), 'checked')$q$, 'admin without two-step');
select set_config('request.jwt.claims', '{"sub":"c3c3c3c3-0000-4000-8000-0000000000c3","role":"authenticated","aal":"aal2"}', true);
select public.admin_check_media((select id from t_ids where k = 'cover2'), 'checked');
select pg_temp.check((select state = 'checked' and checked_by = 'c3c3c3c3-0000-4000-8000-0000000000c3' from public.media m join t_ids t on t.id = m.id where t.k = 'cover2'),
                     'admin marks checked');
select pg_temp.expect_error($q$select * from public.admin_check_media((select id from t_ids where k = 'cover2'), 'delete')$q$, 'unknown decision');

-- 5. Owner: reorder and replace ----------------------------------------------
reset role;
-- Finish two gallery photos (files as postgres), then reorder.
update public.media set state = 'removed', removed_reason = 'owner' where field = 'gallery' and state = 'uploading'
  and id <> (select id from t_ids where k = 'g1')
  and id not in (select id from public.media where field = 'gallery' and state = 'uploading' order by sort limit 2);
select pg_temp.put('media', m.path, m.owner_id::text, 400000, 'image/webp'), pg_temp.put('media', m.thumb_path, m.owner_id::text, 40000, 'image/webp')
from public.media m where m.field = 'gallery' and m.state = 'uploading' and m.path like '%.webp';
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-4000-8000-0000000000a1","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select public.finish_media_upload(m.id, 1600, 1067, '#334455') from public.media m
where m.field = 'gallery' and m.state = 'uploading' and m.path like '%.webp';
select pg_temp.check((select count(*) = 2 and count(*) filter (where is_main) = 1 from public.media where field = 'gallery' and state = 'live'),
                     'two live gallery photos, one main');
select public.reorder_media('guide', '97979797-0000-4000-8000-000000000097', 'gallery',
  (select array_agg(id order by sort desc) from public.media where field = 'gallery' and state = 'live'));
select pg_temp.check((select is_main and sort = 0 from public.media where field = 'gallery' and state = 'live' order by sort limit 1),
                     'first after reorder is main');
select pg_temp.expect_error($q$select public.reorder_media('guide', '97979797-0000-4000-8000-000000000097', 'gallery',
  (select array_agg(id) from public.media where field = 'gallery' and state = 'live' limit 1) || array[gen_random_uuid()])$q$,
  'reorder with an unknown id');

-- 6. Sweep --------------------------------------------------------------------
reset role;
-- created_at never changes through the guard; switch it off for this one line (rolled back).
alter table public.media disable trigger media_guard;
update public.media set created_at = now() - interval '25 hours' where id = (select id from t_ids where k = 'g1');
alter table public.media enable trigger media_guard;
select private.media_sweep();
select pg_temp.check((select state = 'removed' and removed_reason = 'not_finished' from public.media m join t_ids t on t.id = m.id where t.k = 'g1'),
                     'sweep gives up an upload after 24 hours');
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select pg_temp.check((select count(*) >= 2 from public.svc_media_sweep_list(100) l join t_ids t on l.name in (t.path, t.thumb) where t.k = 'g1' and l.reason = 'removed'),
                     'sweep list has the given-up files');
select pg_temp.check((select count(*) = 0 from public.svc_media_sweep_list(100) l join t_ids t on l.name = t.path where t.k = 'cover2'),
                     'sweep list never has a shown photo');
reset role;

-- my_uploaded_files lists the media files
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-4000-8000-0000000000a1","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select pg_temp.check((select count(*) > 0 from public.my_uploaded_files() where bucket_id = 'media'), 'account deletion lists media files');
reset role;

select 'all passed';
rollback;
