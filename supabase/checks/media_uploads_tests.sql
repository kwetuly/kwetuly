-- Tests for migration 20261126000100_media_uploads.sql (slice S4, one upload system, with the
-- security review changes M1-M4, L1, L3, L5, L6).
-- Run ONLY on a local or test project, after the migration, in the SQL editor or psql as postgres.
-- Everything runs in one transaction that ends with ROLLBACK: the made-up users, files and rows below
-- never stay. Any failure stops the script with "FAIL: ...". The last line prints "all passed".
-- No real photo is used; storage objects are rows with made-up sizes. The byte check of the
-- media-finish Edge Function is tested in packages/shared/src/image-bytes.test.ts.

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

-- Stores a made-up object as postgres (the test stands in for Storage and the media-finish function).
create function pg_temp.put(p_bucket text, p_name text, p_size bigint, p_type text, p_cache text default 'max-age=3600') returns void
language sql as $$
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values (p_bucket, p_name, null, jsonb_build_object('size', p_size, 'mimetype', p_type, 'cacheControl', p_cache));
$$;

grant execute on function pg_temp.expect_error(text, text) to anon, authenticated, service_role;
grant execute on function pg_temp.check(boolean, text) to anon, authenticated, service_role;

create temp table t_ids (k text primary key, id uuid, path text, thumb text) on commit drop;
grant all on t_ids to anon, authenticated, service_role;
create temp table t_claims (id uuid primary key, claim uuid) on commit drop;
grant all on t_claims to service_role;

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

-- Cover photos and galleries on for the test (QA M1; rolled back with everything else).
insert into public.site_settings (key, value) values ('feature.cover_gallery', '{"on": true}')
on conflict (key) do update set value = excluded.value;

-- Buckets
select pg_temp.check((select public and file_size_limit = 2097152 and allowed_mime_types = array['image/webp', 'image/jpeg']
                      from storage.buckets where id = 'media'), 'media bucket public, 2 MB, webp and jpeg');
select pg_temp.check((select not public from storage.buckets where id = 'media-pending'), 'media-pending private');
select pg_temp.check((select not public and file_size_limit = 2097152 from storage.buckets where id = 'media-staging'), 'media-staging private, 2 MB');

-- 1. Owner: start ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-4000-8000-0000000000a1","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;

insert into t_ids (k, id, path, thumb)
select 'cover1', s.id, s.path, s.thumb_path
from public.start_media_upload('cover', 'guide', '97979797-0000-4000-8000-000000000097', 'webp', 'photo-consent-2026-11') s;
select pg_temp.check((select bucket = 'media-staging' from public.start_media_upload('gallery', 'guide', '97979797-0000-4000-8000-000000000097', 'webp', 'photo-consent-2026-11')),
                     'uploads go to the private staging bucket (M1)');
select pg_temp.check((select state = 'uploading' and consented_at is not null from public.media m join t_ids t on t.id = m.id where t.k = 'cover1'),
                     'new row is uploading, consent time set');

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

-- Clients cannot finish, check or rewrite rows.
select pg_temp.expect_error($q$update public.media set state = 'live' where id = (select id from t_ids where k = 'cover2')$q$, 'owner sets live');
select pg_temp.expect_error($q$update public.media set state = 'checked' where id = (select id from t_ids where k = 'cover2')$q$, 'owner sets checked');
select pg_temp.expect_error($q$update public.media set path = 'x' where id = (select id from t_ids where k = 'cover2')$q$, 'owner changes path (no grant)');
select pg_temp.expect_error($q$delete from public.media where id = (select id from t_ids where k = 'cover2')$q$, 'owner deletes a row (no grant)');
select pg_temp.expect_error($q$select * from public.svc_finish_media((select id from t_ids where k = 'cover2'), 'a1a1a1a1-0000-4000-8000-0000000000a1', gen_random_uuid(), 2000, 667)$q$,
  'client calls svc_finish_media');
-- L5: removed rows stay as they are.
select pg_temp.expect_error($q$update public.media set sort = 5 where id = (select id from t_ids where k = 'cover1')$q$, 'owner changes a removed row');
-- L1: admin columns are not readable by clients.
select pg_temp.expect_error($q$select checked_by from public.media limit 1$q$, 'owner reads checked_by');
select pg_temp.expect_error($q$select removed_reason from public.media limit 1$q$, 'owner reads removed_reason');

-- Storage insert policy: only staging, only the open slot's names.
select pg_temp.check((select private.media_upload_slot('media-staging', path) from t_ids where k = 'cover2'), 'open slot in staging');
select pg_temp.check((select not private.media_upload_slot('media', path) from t_ids where k = 'cover2'), 'never straight into the public bucket');
select pg_temp.check((select not private.media_upload_slot('media-staging', path) from t_ids where k = 'cover1'), 'no slot for a replaced row');
select pg_temp.check(not private.media_upload_slot('media-staging', 'a1a1a1a1-0000-4000-8000-0000000000a1/anything.webp'), 'no slot for a free name');

reset role;

-- 1b. Switch feature.cover_gallery (QA M1) ---------------------------------------------
-- Off: no new cover or gallery photo (start function or direct insert); the open cover upload stays;
-- avatar photos are not switched. Then on again for the rest of the script.
select set_config('request.jwt.claims', '', true);
update public.site_settings set value = '{"on": false}' where key = 'feature.cover_gallery';
select pg_temp.check((select value = '{"on": false}'::jsonb from public.site_settings where key = 'feature.cover_gallery'), 'cover_gallery switched off for the test');
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-4000-8000-0000000000a1","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
do $$
declare
  v_sql text;
begin
  foreach v_sql in array array[
    $q$select * from public.start_media_upload('cover', 'guide', '97979797-0000-4000-8000-000000000097', 'webp', 'photo-consent-2026-11')$q$,
    $q$select * from public.start_media_upload('gallery', 'guide', '97979797-0000-4000-8000-000000000097', 'webp', 'photo-consent-2026-11')$q$,
    $q$insert into public.media (id, owner_id, subject_kind, subject_id, field, path, thumb_path, consent_version)
       values ('a1a1a1a1-0000-4000-8000-00000000f001', 'a1a1a1a1-0000-4000-8000-0000000000a1', 'guide', '97979797-0000-4000-8000-000000000097', 'gallery',
               'a1a1a1a1-0000-4000-8000-0000000000a1/a1a1a1a1-0000-4000-8000-00000000f001.webp',
               'a1a1a1a1-0000-4000-8000-0000000000a1/a1a1a1a1-0000-4000-8000-00000000f001-thumb.webp', 'x')$q$
  ] loop
    begin
      execute v_sql;
      raise exception 'FAIL: cover or gallery upload while feature.cover_gallery is off (should have been refused): %', v_sql;
    exception when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      if sqlerrm not like '%media:switched_off%' then
        raise exception 'FAIL: switched-off upload refused with the wrong error: %', sqlerrm;
      end if;
    end;
  end loop;
end $$;
select pg_temp.check((select state = 'uploading' from public.media m join t_ids t on t.id = m.id where t.k = 'cover2'),
                     'a refused cover start leaves the open cover upload alone');
insert into t_ids (k, id, path, thumb)
select 'avatar_off', s.id, s.path, s.thumb_path
from public.start_media_upload('avatar', 'guide', '97979797-0000-4000-8000-000000000097', 'webp', null) s;
select pg_temp.check((select count(*) = 1 from t_ids where k = 'avatar_off'), 'avatar upload still works while cover_gallery is off');
select pg_temp.check((select count(*) = 1 from public.remove_my_media((select id from t_ids where k = 'avatar_off'))), 'test avatar removed again');
reset role;
-- An upload started while the switch was on (cover2) cannot be claimed, so it is not published.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
begin
  begin
    perform * from public.svc_claim_media((select id from t_ids where k = 'cover2'), 'a1a1a1a1-0000-4000-8000-0000000000a1');
    raise exception 'FAIL: claim of a cover upload while feature.cover_gallery is off (should have been refused)';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like '%media:switched_off%' then
      raise exception 'FAIL: switched-off claim refused with the wrong error: %', sqlerrm;
    end if;
  end;
end $$;
reset role;
select pg_temp.check((select state = 'uploading' and finishing_claim is null and finishing_until is null
                      from public.media m join t_ids t on t.id = m.id where t.k = 'cover2'),
                     'a refused claim leaves the upload unclaimed');
select set_config('request.jwt.claims', '', true);
update public.site_settings set value = '{"on": true}' where key = 'feature.cover_gallery';

-- 2. Finish (service role, as the media-finish function does) ------------------
-- Staging copies, and the cleaned files in the public bucket: one with a wrong cache header first.
select pg_temp.put('media-staging', path, 900000, 'image/webp', 'no-cache') from t_ids where k = 'cover2';
select pg_temp.put('media', path, 900000, 'image/webp', 'no-cache') from t_ids where k = 'cover2';
select pg_temp.put('media', thumb, 90000, 'image/webp') from t_ids where k = 'cover2';

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select pg_temp.expect_error($q$select * from public.svc_finish_media((select id from t_ids where k = 'cover2'), 'a1a1a1a1-0000-4000-8000-0000000000a1', gen_random_uuid(), 2000, 667)$q$,
  'finish without a claim (N3)');
select pg_temp.expect_error($q$select * from public.svc_claim_media((select id from t_ids where k = 'cover2'), 'b2b2b2b2-0000-4000-8000-0000000000b2')$q$,
  'claim for another person');
insert into t_claims (id, claim)
select (select id from t_ids where k = 'cover2'), c.claim_id from public.svc_claim_media((select id from t_ids where k = 'cover2'), 'a1a1a1a1-0000-4000-8000-0000000000a1') c where c.claimed;
select pg_temp.check((select count(*) = 1 and bool_and(claim is not null) from t_claims), 'first claim returns a claim id (L-c)');
select pg_temp.expect_error($q$select * from public.svc_finish_media((select id from t_ids where k = 'cover2'), 'a1a1a1a1-0000-4000-8000-0000000000a1', gen_random_uuid(), 2000, 667)$q$,
  'finish with another claim id (L-c)');
select public.svc_release_media((select id from t_ids where k = 'cover2'), 'a1a1a1a1-0000-4000-8000-0000000000a1', gen_random_uuid());
select pg_temp.check((select finishing_claim is not null from public.media where id = (select id from t_ids where k = 'cover2')), 'release with another claim id does nothing (L-c)');
select pg_temp.expect_error($q$select * from public.svc_claim_media((select id from t_ids where k = 'cover2'), 'a1a1a1a1-0000-4000-8000-0000000000a1')$q$,
  'second claim within 5 minutes (N3)');
select pg_temp.check((select not private.media_path_deletable('media-staging', path) from t_ids where k = 'cover2'), 'staging file kept while claimed (N3)');
select pg_temp.check((select not private.media_upload_slot('media-staging', path) from t_ids where k = 'cover2'), 'no upload while claimed (N3)');
select pg_temp.expect_error($q$select * from public.svc_finish_media((select id from t_ids where k = 'cover2'), 'a1a1a1a1-0000-4000-8000-0000000000a1', (select claim from t_claims where id = (select id from t_ids where k = 'cover2')), 2000, 667)$q$,
  'finish with a cache header other than max-age=3600 (M4)');
select pg_temp.expect_error($q$select * from public.svc_finish_media((select id from t_ids where k = 'cover2'), 'b2b2b2b2-0000-4000-8000-0000000000b2', (select claim from t_claims where id = (select id from t_ids where k = 'cover2')), 2000, 667)$q$,
  'finish for another person');
reset role;
update storage.objects set metadata = metadata || '{"cacheControl":"max-age=3600"}'
where bucket_id = 'media' and name = (select path from t_ids where k = 'cover2');
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select pg_temp.expect_error($q$select * from public.svc_finish_media((select id from t_ids where k = 'cover2'), 'a1a1a1a1-0000-4000-8000-0000000000a1', (select claim from t_claims where id = (select id from t_ids where k = 'cover2')), 9000, 667)$q$,
  'finish with a width over 4000');
select pg_temp.check((select state = 'live' from public.svc_finish_media((select id from t_ids where k = 'cover2'), 'a1a1a1a1-0000-4000-8000-0000000000a1', (select claim from t_claims where id = (select id from t_ids where k = 'cover2')), 2000, 667, '#aabbcc')),
                     'finish makes the cover live');
select pg_temp.check((select width = 2000 and mime = 'image/webp' and bytes = 900000 and is_main and placeholder = '#aabbcc'
                      from public.media m join t_ids t on t.id = m.id where t.k = 'cover2'), 'size from the file, type and bytes from storage, main');
-- The staging copy of a finished row is listed for the sweep, never the public file.
select pg_temp.check((select count(*) = 1 from public.svc_media_sweep_list(100) l join t_ids t on l.name = t.path
                      where t.k = 'cover2' and l.bucket_id = 'media-staging' and l.reason = 'staged'), 'staging copy listed as staged');
select pg_temp.check((select count(*) = 0 from public.svc_media_sweep_list(100) l join t_ids t on l.name = t.path
                      where t.k = 'cover2' and l.bucket_id = 'media'), 'shown photo never listed');
reset role;

-- 3. Owner: limits, reorder, remove -----------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-4000-8000-0000000000a1","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select pg_temp.expect_error($q$update public.media set width = 10 where id = (select id from t_ids where k = 'cover2')$q$, 'owner changes width (no grant)');
do $$
declare i int;
begin
  for i in 1..11 loop
    perform * from public.start_media_upload('gallery', 'guide', '97979797-0000-4000-8000-000000000097', 'webp', 'photo-consent-2026-11');
  end loop;
end $$;
select pg_temp.expect_error($q$select * from public.start_media_upload('gallery', 'guide', '97979797-0000-4000-8000-000000000097', 'webp', 'photo-consent-2026-11')$q$,
  'thirteenth gallery photo');
select pg_temp.check((select paths[1] like 'a1a1a1a1-0000-4000-8000-0000000000a1/%' and staging = 'media-staging'
                      from public.remove_my_media((select id from public.media where field = 'gallery' and state = 'uploading' order by sort desc limit 1))),
                     'remove returns both buckets and the file names');
insert into t_ids (k, id, path, thumb)
select 'g1', s.id, s.path, s.thumb_path
from public.start_media_upload('gallery', 'guide', '97979797-0000-4000-8000-000000000097', 'jpg', 'photo-consent-2026-11') s;
select pg_temp.check((select private.media_path_deletable('media-staging', path) from t_ids where k = 'g1'), 'staging copies deletable');
select pg_temp.check((select not private.media_path_deletable('media', path) from t_ids where k = 'cover2'), 'shown cover not deletable (owners and admins, L6)');
reset role;

-- Finish two gallery photos, then reorder as the owner.
update public.media set state = 'removed', removed_reason = 'owner' where field = 'gallery' and state = 'uploading'
  and id <> (select id from t_ids where k = 'g1')
  and id not in (select id from public.media where field = 'gallery' and state = 'uploading' order by sort limit 2);
select pg_temp.put('media', m.path, 400000, 'image/webp'), pg_temp.put('media', m.thumb_path, 40000, 'image/webp')
from public.media m where m.field = 'gallery' and m.state = 'uploading' and m.path like '%.webp';
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
insert into t_claims (id, claim)
select m.id, (select c.claim_id from public.svc_claim_media(m.id, m.owner_id) c) from public.media m
where m.field = 'gallery' and m.state = 'uploading' and m.path like '%.webp';
select public.svc_finish_media(m.id, m.owner_id, t.claim, 1600, 1067) from public.media m join t_claims t on t.id = m.id
where m.field = 'gallery' and m.state = 'uploading' and m.path like '%.webp';
reset role;
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-4000-8000-0000000000a1","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select pg_temp.check((select count(*) = 2 and count(*) filter (where is_main) = 1 from public.media where field = 'gallery' and state = 'live'),
                     'two live gallery photos, one main');
select public.reorder_media('guide', '97979797-0000-4000-8000-000000000097', 'gallery',
  (select array_agg(id order by sort desc) from public.media where field = 'gallery' and state = 'live'));
select pg_temp.check((select is_main and sort = 0 from public.media where field = 'gallery' and state = 'live' order by sort limit 1),
                     'first after reorder is main');
select pg_temp.expect_error($q$select public.reorder_media('guide', '97979797-0000-4000-8000-000000000097', 'gallery',
  (select array_agg(id) from public.media where field = 'gallery' and state = 'live') || array[gen_random_uuid()])$q$,
  'reorder with an unknown id');

-- 4. Other user and anonymous visitor ------------------------------------------
select set_config('request.jwt.claims', '{"sub":"b2b2b2b2-0000-4000-8000-0000000000b2","role":"authenticated","aal":"aal1"}', true);
select pg_temp.check((select count(*) = 3 from public.media where state in ('live', 'checked')), 'others see the shown photos only');
select pg_temp.check((select count(*) = 0 from public.media where state = 'uploading'), 'others do not see unfinished uploads');
select pg_temp.expect_error($q$select * from public.remove_my_media((select id from t_ids where k = 'cover2'))$q$, 'other removes the cover');
select pg_temp.expect_error($q$select consent_version from public.media limit 1$q$, 'signed-in non-owner reads consent (N6)');
select pg_temp.expect_error($q$select owner_id from public.media limit 1$q$, 'signed-in non-owner reads owner_id (N6)');
select pg_temp.check((select count(*) = 0 from public.my_media('guide', '97979797-0000-4000-8000-000000000097')), 'my_media shows nothing of other people');
select pg_temp.check(public.remove_all_my_media() = 0, 'remove_all_my_media touches nobody else''s photos');
select pg_temp.expect_error($q$select * from public.admin_check_media((select id from t_ids where k = 'cover2'), 'checked')$q$, 'non-admin checks');
select pg_temp.expect_error($q$select * from public.admin_media_list('live', 10)$q$, 'non-admin lists');
select pg_temp.expect_error($q$select * from public.svc_media_sweep_list(10)$q$, 'client calls the sweep list');
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select pg_temp.check((select count(*) = 3 from public.media), 'anon sees the shown photos of an approved guide');
select pg_temp.expect_error($q$select owner_id from public.media limit 1$q$, 'anon reads owner_id (L1)');
select pg_temp.expect_error($q$select consent_version from public.media limit 1$q$, 'anon reads consent (L1)');
select pg_temp.expect_error($q$select * from public.start_media_upload('gallery', 'guide', '97979797-0000-4000-8000-000000000097', 'webp', 'x')$q$, 'anon starts an upload');
reset role;

-- 5. Admin (two-step) ---------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"c3c3c3c3-0000-4000-8000-0000000000c3","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select pg_temp.expect_error($q$select * from public.admin_check_media((select id from t_ids where k = 'cover2'), 'checked')$q$, 'admin without two-step');
select set_config('request.jwt.claims', '{"sub":"c3c3c3c3-0000-4000-8000-0000000000c3","role":"authenticated","aal":"aal2"}', true);
select public.admin_check_media((select id from t_ids where k = 'cover2'), 'checked');
select pg_temp.check((select count(*) >= 1 from public.admin_media_list('checked', 10) where checked_by = 'c3c3c3c3-0000-4000-8000-0000000000c3'),
                     'admin marks checked and reads admin columns through admin_media_list');
select pg_temp.expect_error($q$select * from public.admin_check_media((select id from t_ids where k = 'cover2'), 'delete')$q$, 'unknown decision');
reset role;

-- 6. Sweep --------------------------------------------------------------------
-- created_at never changes through the guard; switch it off for this one line (rolled back).
alter table public.media disable trigger media_guard;
update public.media set created_at = now() - interval '25 hours' where id = (select id from t_ids where k = 'g1');
alter table public.media enable trigger media_guard;
select pg_temp.put('media-staging', path, 300000, 'image/jpeg') from t_ids where k = 'g1';
select private.media_sweep();
select pg_temp.check((select state = 'removed' from public.media m join t_ids t on t.id = m.id where t.k = 'g1'),
                     'sweep gives up an upload after 24 hours');
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select pg_temp.check((select count(*) = 1 from public.svc_media_sweep_list(100) l join t_ids t on l.name = t.path where t.k = 'g1' and l.reason = 'removed'),
                     'sweep list has the given-up staging file');
reset role;

-- 7. Account deletion (M2) ------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-4000-8000-0000000000a1","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select pg_temp.check((select count(*) > 0 from public.my_uploaded_files() where bucket_id = 'media'), 'account deletion lists public photo files by folder');
select pg_temp.check((select count(*) >= 3 and bool_and(consent_version is not null) from public.my_media('guide', '97979797-0000-4000-8000-000000000097')),
                     'owner reads consent through my_media (N6)');
select pg_temp.check(public.remove_all_my_media() >= 3, 'remove_all_my_media removes every shown photo');
select pg_temp.check((select count(*) = 0 from public.media where state <> 'removed'), 'nothing of the owner is left shown');
select pg_temp.check((select bool_and(private.media_path_deletable(bucket_id, name)) from public.my_uploaded_files()
                      where bucket_id in ('media', 'media-pending', 'media-staging')), 'every photo file is now deletable');
reset role;

select 'all passed';
rollback;
