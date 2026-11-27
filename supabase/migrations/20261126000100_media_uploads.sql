-- STATUS: NOT APPLIED anywhere. Walter pastes live SQL himself; run it on a test project first, then
-- supabase/checks/media_uploads_tests.sql, then the security advisors.
-- Order: after 20261123000000_business_chat.sql (and the reservations files before it). It does not
-- depend on 20261126000000_feature_switch_admin.sql (S1): it seeds feature.cover_gallery itself
-- ({"on": true}, only if the row is missing) and reads it with private.feature_on (20261031214101).
-- QA M1: while feature.cover_gallery is off, start_media_upload() and the insert guard refuse new
-- cover and gallery photos ('media:switched_off'). Avatar and product photos are not switched.
--
-- Slice S4: one upload system (design docs/team/design-2026-11-24.md, section 9.2), with the changes
-- from the S4 security review (M1-M4, L1, L3, L5-L7).
-- The per-field rules are in packages/shared/src/uploads.ts; uploads.test.ts compares them with this file.
--
-- Flow (M1: nothing is public before the server has looked inside the file):
--   1. public.start_media_upload() makes the row (state uploading). The browser or app uploads the
--      photo and its thumbnail to the PRIVATE bucket `media-staging`, only to that row's two names.
--   2. The `media-finish` Edge Function (the person's own token; service role inside) downloads both,
--      checks the first bytes (JPEG FF D8 FF, WebP RIFF....WEBP), removes metadata blocks (EXIF, XMP,
--      IPTC, comments), refuses animated pictures, reads the real width and height, and writes the
--      cleaned files to the field's bucket (`media`, public; `media-pending`, private, for products).
--      Only then public.svc_finish_media() sets the state, after private.media_object_check() has read
--      the stored objects (type, size, cache header). Refused files are deleted at once and the row
--      becomes 'removed' with reason 'refused'. The staging copies are deleted.
--   3. Owners reorder and remove; admins check or remove (admin_check_media, admin_media_list).
--   4. Account deletion: public.remove_all_my_media() first, then the files from my_uploaded_files().
--   5. Hourly sweep: private.media_sweep() marks unfinished uploads (24 hours) and photos whose guide,
--      business or product is gone, then calls the `media-sweep` Edge Function, which deletes files
--      through the Storage API (SQL may not delete storage objects).
--
-- Not here (later slices): public display, reports and the admin photo queue screen (S6), copying
-- approved product photos to `media` (S12), documents (S9 keeps person_documents and `verification`).
--
-- Undo (only before real data exists; dropping the table deletes its rows, files stay until removed by hand):
--   select cron.unschedule('kwetuly-media-sweep');
--   drop policy "Media: upload to an open slot" on storage.objects;
--   drop policy "Media: delete unused files" on storage.objects;
--   drop policy "Media: owners and admins read pending files" on storage.objects;
--   re-create public.my_uploaded_files() as in 20261016000000_delete_my_account.sql;
--   drop function public.svc_media_sweep_halted(), public.svc_media_sweep_list(int), public.svc_media_bucket_count(),
--     private.media_sweep(), public.admin_media_list(public.media_state, int), public.admin_check_media(uuid, text, text),
--     public.remove_all_my_media(), public.remove_my_media(uuid),
--     public.reorder_media(public.media_subject_kind, uuid, public.media_field, uuid[]),
--     public.my_media(public.media_subject_kind, uuid), public.svc_claim_media(uuid, uuid), public.svc_release_media(uuid, uuid, uuid),
--     public.svc_refuse_media(uuid, uuid, uuid), public.svc_finish_media(uuid, uuid, uuid, int, int, text),
--     public.start_media_upload(public.media_field, public.media_subject_kind, uuid, text, text),
--     private.media_recent_starts(uuid), private.media_is_mine(uuid), private.guard_media(), private.media_upload_slot(text, text), private.media_path_deletable(text, text),
--     private.media_object_ok(uuid), private.media_object_check(uuid), private.media_subject_public(public.media_subject_kind, uuid),
--     private.media_subject_owner(public.media_subject_kind, uuid), private.media_finish_state(public.media_field),
--     private.media_field_bucket(public.media_field), private.media_thumb_max_bytes(),
--     private.media_field_max_bytes(public.media_field), private.media_field_max(public.media_field);
--   drop table public.media; drop type public.media_state, public.media_subject_kind, public.media_field;
--   delete from storage.buckets where id in ('media', 'media-pending', 'media-staging'); (only when empty)

-- ---------------------------------------------------------------------------
-- 0. Switch feature.cover_gallery (QA M1). S1 (20261126000000) seeds the same row; whichever runs
-- first wins and the other leaves it. Exactly {"on": ...}, the shape S1's check allows.
-- ---------------------------------------------------------------------------
insert into public.site_settings (key, value)
values ('feature.cover_gallery', '{"on": true}')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 1. Enums and field rules (mirrored in packages/shared/src/uploads.ts)
-- ---------------------------------------------------------------------------
create type public.media_field as enum ('avatar', 'cover', 'gallery', 'product');
create type public.media_subject_kind as enum ('guide', 'provider', 'listing');
create type public.media_state as enum ('uploading', 'live', 'pending', 'checked', 'removed');

create or replace function private.media_field_max(p_field public.media_field)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_field
    when 'avatar' then 1
    when 'cover' then 1
    when 'gallery' then 12
    when 'product' then 10
  end;
$$;

create or replace function private.media_field_max_bytes(p_field public.media_field)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case p_field
    when 'avatar' then 1048576
    when 'cover' then 2097152
    when 'gallery' then 2097152
    when 'product' then 2097152
  end::bigint;
$$;

create or replace function private.media_thumb_max_bytes()
returns bigint
language sql
immutable
set search_path = ''
as $$
  select 307200::bigint;
$$;

-- Where a finished photo lives. Uploads always go to `media-staging` first.
create or replace function private.media_field_bucket(p_field public.media_field)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_field when 'product' then 'media-pending' else 'media' end;
$$;

create or replace function private.media_finish_state(p_field public.media_field)
returns public.media_state
language sql
immutable
set search_path = ''
as $$
  select case p_field when 'product' then 'pending' else 'live' end::public.media_state;
$$;

revoke execute on function private.media_field_max(public.media_field) from public;
revoke execute on function private.media_field_max_bytes(public.media_field) from public;
revoke execute on function private.media_thumb_max_bytes() from public;
revoke execute on function private.media_field_bucket(public.media_field) from public;
revoke execute on function private.media_finish_state(public.media_field) from public;
-- The guard and the storage policies run as the caller; these are pure functions.
grant execute on function private.media_field_max(public.media_field) to authenticated;
grant execute on function private.media_field_max_bytes(public.media_field) to authenticated;
grant execute on function private.media_thumb_max_bytes() to authenticated;
grant execute on function private.media_field_bucket(public.media_field) to authenticated;
grant execute on function private.media_finish_state(public.media_field) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. public.media
-- ---------------------------------------------------------------------------
create table public.media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  subject_kind public.media_subject_kind not null,
  subject_id uuid not null,
  field public.media_field not null,
  -- Object names (no bucket prefix): the same names in `media-staging` while uploading and in the
  -- field's bucket once finished.
  path text not null unique,
  thumb_path text not null unique,
  -- Set from storage when the upload is finished; never by a client.
  mime text check (mime in ('image/webp', 'image/jpeg')),
  bytes bigint check (bytes > 0),
  -- Read from the file by the media-finish function; used for layout.
  width int check (width between 1 and 4000),
  height int check (height between 1 and 4000),
  placeholder text check (placeholder ~ '^#[0-9a-f]{6}$'),
  sort int not null default 0 check (sort between 0 and 1000),
  is_main boolean not null default false,
  state public.media_state not null default 'uploading',
  -- "The people in these photos agreed to them being shown.": which wording was ticked, and when.
  consent_version text check (consent_version ~ '^[A-Za-z0-9._-]{1,40}$'),
  consented_at timestamptz,
  removed_reason text check (removed_reason in ('owner', 'replaced', 'not_finished', 'subject_gone', 'refused', 'admin', 'report')),
  removed_at timestamptz,
  checked_at timestamptz,
  checked_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  -- N3: the media-finish function claims a row before writing; a second claim is refused until then.
  finishing_until timestamptz,
  -- L-c: which claim is open; finish, refuse and release must give it back.
  finishing_claim uuid,
  constraint media_path_shape check (
    path ~ ('^' || owner_id::text || '/' || id::text || '\.(webp|jpg)$')),
  constraint media_thumb_shape check (
    thumb_path = regexp_replace(path, '\.(webp|jpg)$', '-thumb.\1')),
  constraint media_subject_field check (
    (field in ('avatar', 'cover', 'gallery') and subject_kind in ('guide', 'provider'))
    or (field = 'product' and subject_kind = 'listing')),
  constraint media_consent check (field = 'avatar' or consent_version is not null),
  constraint media_consent_time check ((consent_version is null) = (consented_at is null)),
  constraint media_removed check ((state = 'removed') = (removed_reason is not null and removed_at is not null)),
  constraint media_finished check (
    state in ('uploading', 'removed')
    or (mime is not null and bytes is not null and width is not null and height is not null and finished_at is not null)),
  constraint media_checked check ((checked_at is null) or state in ('checked', 'removed'))
);

comment on table public.media is
  'Photos of guides, businesses and products. Rules in packages/shared/src/uploads.ts. Uploads go to media-staging; the media-finish Edge Function checks and copies them. S12: every approved product photo in `media` must have a media row (L7).';

create index media_subject_idx on public.media (subject_kind, subject_id, field, sort) where state <> 'removed';
create index media_owner_created_idx on public.media (owner_id, created_at);
create index media_state_idx on public.media (state, created_at);
-- One main photo per subject and field.
create unique index media_one_main on public.media (subject_kind, subject_id, field) where is_main and state <> 'removed';

-- Who owns a subject (guide, business, product). Security definer: answers with an id only.
create or replace function private.media_subject_owner(p_kind public.media_subject_kind, p_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case p_kind
    when 'guide' then (select g.owner_id from public.guides g where g.id = p_id)
    when 'provider' then (select p.owner_id from public.providers p where p.id = p_id)
    -- S12 adds guide sellers (listings.guide_id) and must extend this.
    when 'listing' then (select p.owner_id from public.listings l join public.providers p on p.id = l.provider_id where l.id = p_id)
  end;
$$;

-- Whether a subject's page is public (approved guide or business; published product of an approved business).
create or replace function private.media_subject_public(p_kind public.media_subject_kind, p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(case p_kind
    when 'guide' then (select g.verification_status = 'approved' from public.guides g where g.id = p_id)
    when 'provider' then (select p.verification_status = 'approved' from public.providers p where p.id = p_id)
    when 'listing' then (select l.is_published and p.verification_status = 'approved'
                         from public.listings l join public.providers p on p.id = l.provider_id where l.id = p_id)
  end, false);
$$;

revoke execute on function private.media_subject_owner(public.media_subject_kind, uuid) from public, anon;
revoke execute on function private.media_subject_public(public.media_subject_kind, uuid) from public;
grant execute on function private.media_subject_owner(public.media_subject_kind, uuid) to authenticated;
grant execute on function private.media_subject_public(public.media_subject_kind, uuid) to anon, authenticated;

alter table public.media enable row level security;

create policy "Anyone reads shown media" on public.media
  for select to anon, authenticated
  using (state in ('live', 'checked') and (select private.media_subject_public(subject_kind, subject_id)));

create policy "Owners read their media" on public.media
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "Admins read all media" on public.media
  for select to authenticated
  using ((select private.is_admin()));

create policy "Owners add media" on public.media
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.is_onboarded()));

create policy "Owners change their media" on public.media
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- No delete for anyone: a removed photo keeps its row (audit trail); rows go with the account.
-- L1, N6: everyone (anon and signed-in) reads only what pages need. Owners get consent and times
-- through public.my_media(); admin columns (who checked, why removed) only through admin functions.
-- Owner functions below therefore never read owner_id themselves: row level security and the small
-- security definer helpers (media_is_mine, media_recent_starts) do.
revoke all on public.media from public, anon, authenticated;
grant select (id, subject_kind, subject_id, field, path, thumb_path, mime, width, height, placeholder, sort, is_main, state)
  on public.media to anon, authenticated;
grant insert (id, owner_id, subject_kind, subject_id, field, path, thumb_path, consent_version) on public.media to authenticated;
grant update (state, sort, is_main, removed_reason) on public.media to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Server check of the stored files, and the guard
-- ---------------------------------------------------------------------------
-- Reads the two stored objects of a row in the field's bucket (written by the media-finish function):
-- type as the path says, within the field's size, and cache header 'max-age=3600' (M4), so a removed
-- photo stops being served from caches within the hour. A signed-in caller must own the row; inside
-- security definer current_user is the function owner, so the signed-in person is tested.
create or replace function private.media_object_check(p_id uuid)
returns table (ok boolean, reason text, bytes bigint, mime text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.media;
  v_bucket text;
  v_mime text;
  v_main record;
  v_thumb record;
begin
  select * into r from public.media m where m.id = p_id;
  if not found then
    return query select false, 'file_missing', null::bigint, null::text;
    return;
  end if;
  if (select auth.uid()) is not null and (select auth.uid()) <> r.owner_id then
    return query select false, 'not_yours', null::bigint, null::text;
    return;
  end if;
  v_bucket := private.media_field_bucket(r.field);
  v_mime := case when r.path like '%.webp' then 'image/webp' else 'image/jpeg' end;
  select (o.metadata ->> 'size')::bigint as size, o.metadata ->> 'mimetype' as type, o.metadata ->> 'cacheControl' as cache
    into v_main from storage.objects o where o.bucket_id = v_bucket and o.name = r.path;
  select (o.metadata ->> 'size')::bigint as size, o.metadata ->> 'mimetype' as type, o.metadata ->> 'cacheControl' as cache
    into v_thumb from storage.objects o where o.bucket_id = v_bucket and o.name = r.thumb_path;
  if v_main.size is null or v_thumb.size is null then
    return query select false, 'file_missing', null::bigint, null::text;
  elsif v_main.type is distinct from v_mime or v_thumb.type is distinct from v_mime then
    return query select false, 'file_type', null::bigint, null::text;
  elsif v_main.size not between 1 and private.media_field_max_bytes(r.field)
     or v_thumb.size not between 1 and private.media_thumb_max_bytes() then
    return query select false, 'file_too_big', null::bigint, null::text;
  elsif v_main.cache is distinct from 'max-age=3600' or v_thumb.cache is distinct from 'max-age=3600' then
    return query select false, 'file_cache', null::bigint, null::text;
  else
    return query select true, null::text, v_main.size, v_mime;
  end if;
end;
$$;

create or replace function private.media_object_ok(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select c.ok from private.media_object_check(p_id) c), false);
$$;

revoke execute on function private.media_object_check(uuid) from public, anon;
revoke execute on function private.media_object_ok(uuid) from public, anon;
grant execute on function private.media_object_check(uuid) to authenticated;
grant execute on function private.media_object_ok(uuid) to authenticated;

-- N6 helpers: clients cannot read owner_id or created_at, so these answer the two questions the
-- owner functions and the guard need. Security definer; yes or no, or two counts, about the caller only.
create or replace function private.media_is_mine(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.media m where m.id = p_id and m.owner_id = (select auth.uid()));
$$;

create or replace function private.media_recent_starts(p_owner uuid, out last_hour int, out last_day int)
language sql
stable
security definer
set search_path = ''
as $$
  select (count(*) filter (where m.created_at > now() - interval '1 hour'))::int, count(*)::int
  from public.media m
  where m.owner_id = p_owner and m.created_at > now() - interval '24 hours';
$$;

revoke execute on function private.media_is_mine(uuid) from public, anon;
revoke execute on function private.media_recent_starts(uuid) from public, anon;
grant execute on function private.media_is_mine(uuid) to authenticated;
grant execute on function private.media_recent_starts(uuid) to authenticated;

-- Guard. NOT security definer. Like private.guard_person_document (MA1) it tests the database role:
-- an admin writing from the website or app gets every client rule; only security definer functions
-- (role postgres) and service_role pass. Errors carry 'media:<code>' for the screens.
create or replace function private.guard_media()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_client boolean := current_user in ('anon', 'authenticated');
  v_count int;
  v_day int;
  v_check record;
begin
  if tg_op = 'INSERT' then
    -- L3: one start at a time per person, so the counts below cannot be raced.
    perform pg_advisory_xact_lock(hashtext('media-owner:' || new.owner_id::text));
    if v_client then
      if new.owner_id is distinct from (select auth.uid()) then
        raise exception 'media:not_yours' using errcode = '42501';
      end if;
      if private.media_subject_owner(new.subject_kind, new.subject_id) is distinct from new.owner_id then
        raise exception 'media:not_yours' using errcode = '42501';
      end if;
      -- QA M1: while feature.cover_gallery is off (or missing), no new cover or gallery photo, also not
      -- by a direct insert. Avatar and product photos are not switched. Photos already there stay.
      if new.field in ('cover', 'gallery') and not private.feature_on('cover_gallery') then
        raise exception 'media:switched_off' using errcode = '42501';
      end if;
      new.state := 'uploading';
      new.mime := null;
      new.bytes := null;
      new.width := null;
      new.height := null;
      new.placeholder := null;
      new.is_main := false;
      new.removed_reason := null;
      new.removed_at := null;
      new.checked_at := null;
      new.checked_by := null;
      new.finished_at := null;
      new.finishing_until := null;
      new.finishing_claim := null;
      new.created_at := now();
      new.consented_at := case when new.consent_version is null then null else now() end;
      -- Rate limits: 60 uploads started per hour and 200 per day per person.
      select s.last_hour, s.last_day into v_count, v_day from private.media_recent_starts(new.owner_id) s;
      if v_count >= 60 or v_day >= 200 then
        raise exception 'media:rate_limited' using errcode = '23514';
      end if;
    end if;
    perform pg_advisory_xact_lock(hashtext('media:' || new.subject_id::text || ':' || new.field::text));
    if private.media_field_max(new.field) = 1 then
      -- One open upload at a time; the finished photo is replaced when the new one is finished.
      if exists (select 1 from public.media m
                 where m.subject_kind = new.subject_kind and m.subject_id = new.subject_id
                   and m.field = new.field and m.state = 'uploading') then
        raise exception 'media:busy' using errcode = '23514';
      end if;
    else
      select count(*) into v_count from public.media m
      where m.subject_kind = new.subject_kind and m.subject_id = new.subject_id
        and m.field = new.field and m.state <> 'removed';
      if v_count >= private.media_field_max(new.field) then
        raise exception 'media:too_many' using errcode = '23514';
      end if;
    end if;
    -- New photos go to the end.
    select least(coalesce(max(m.sort) + 1, 0), 1000) into new.sort from public.media m
    where m.subject_kind = new.subject_kind and m.subject_id = new.subject_id
      and m.field = new.field and m.state <> 'removed';
    return new;
  end if;

  -- UPDATE. These never change, for anyone.
  if new.id <> old.id or new.owner_id <> old.owner_id or new.subject_kind <> old.subject_kind
     or new.subject_id <> old.subject_id or new.field <> old.field or new.path <> old.path
     or new.thumb_path <> old.thumb_path or new.created_at <> old.created_at
     or new.consent_version is distinct from old.consent_version
     or new.consented_at is distinct from old.consented_at then
    raise exception 'Photo details cannot be changed' using errcode = '42501';
  end if;
  if old.state = 'removed' then
    -- L5: a removed photo stays as it is. Trusted callers may only repeat the same values.
    if v_client or new.state <> 'removed' or new.removed_reason is distinct from old.removed_reason then
      raise exception 'This photo was removed' using errcode = '23514';
    end if;
    return new;
  end if;

  if new.state = 'removed' then
    if v_client and new.removed_reason not in ('owner', 'replaced') then
      raise exception 'media:not_yours' using errcode = '42501';
    end if;
    if new.removed_reason is null then
      raise exception 'A reason is needed' using errcode = '23514';
    end if;
    new.removed_at := now();
    new.is_main := false;
    return new;
  end if;

  if v_client then
    -- Clients change only the order and the main photo of a finished photo (state changes other than
    -- removing are made by the media-finish function and admin functions).
    if new.state <> old.state or new.removed_reason is distinct from old.removed_reason
       or new.checked_at is distinct from old.checked_at or new.checked_by is distinct from old.checked_by
       or new.width is distinct from old.width or new.height is distinct from old.height
       or new.placeholder is distinct from old.placeholder or new.mime is distinct from old.mime
       or new.bytes is distinct from old.bytes or new.finished_at is distinct from old.finished_at
       or new.finishing_until is distinct from old.finishing_until
       or new.finishing_claim is distinct from old.finishing_claim then
      raise exception 'media:not_yours' using errcode = '42501';
    end if;
    if old.state = 'uploading' and (new.sort <> old.sort or new.is_main <> old.is_main) then
      raise exception 'media:busy' using errcode = '23514';
    end if;
    return new;
  end if;

  if old.state = 'uploading' and new.state <> 'uploading' then
    if new.state <> private.media_finish_state(old.field) then
      raise exception 'Wrong state for this field' using errcode = '23514';
    end if;
    select * into v_check from private.media_object_check(new.id);
    if not coalesce(v_check.ok, false) then
      raise exception 'media:%', coalesce(v_check.reason, 'file_missing') using errcode = '23514';
    end if;
    if new.width is null or new.height is null then
      raise exception 'media:bad_size' using errcode = '23514';
    end if;
    new.mime := v_check.mime;
    new.bytes := v_check.bytes;
    new.finished_at := now();
    new.finishing_until := null;
    new.finishing_claim := null;
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_media() from public, anon, authenticated;

create trigger media_guard
  before insert or update on public.media
  for each row execute function private.guard_media();

-- ---------------------------------------------------------------------------
-- 4. Owner functions (security invoker: the guard and policies apply)
-- ---------------------------------------------------------------------------
-- Starts an upload and returns where the two files go in `media-staging`. p_ext: 'webp' or 'jpg'.
create or replace function public.start_media_upload(
  p_field public.media_field,
  p_subject_kind public.media_subject_kind,
  p_subject_id uuid,
  p_ext text,
  p_consent_version text default null
)
returns table (id uuid, bucket text, path text, thumb_path text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
  v_uid uuid := (select auth.uid());
  v_ext text := lower(coalesce(p_ext, ''));
begin
  if v_uid is null then
    raise exception 'media:not_yours' using errcode = '42501';
  end if;
  if not (select private.is_onboarded()) then
    raise exception 'media:not_onboarded' using errcode = '42501';
  end if;
  if v_ext not in ('webp', 'jpg') then
    raise exception 'media:file_type' using errcode = '22023';
  end if;
  if private.media_subject_owner(p_subject_kind, p_subject_id) is distinct from v_uid then
    raise exception 'media:not_yours' using errcode = '42501';
  end if;
  -- QA M1: cover and gallery follow feature.cover_gallery (missing row = off). Checked here first so
  -- an open cover upload is not given up below; private.guard_media() checks it again on the insert.
  if p_field in ('cover', 'gallery') and not private.feature_on('cover_gallery') then
    raise exception 'media:switched_off' using errcode = '42501';
  end if;
  -- A cover or avatar upload that never finished is given up when a new one starts (row level
  -- security limits the update to the caller's own rows).
  if private.media_field_max(p_field) = 1 then
    update public.media m
    set state = 'removed', removed_reason = 'replaced'
    where m.subject_kind = p_subject_kind and m.subject_id = p_subject_id and m.field = p_field
      and m.state = 'uploading'
      and private.media_is_mine(m.id); -- L-d: second safeguard next to row level security
  end if;
  insert into public.media (id, owner_id, subject_kind, subject_id, field, path, thumb_path, consent_version)
  values (v_id, v_uid, p_subject_kind, p_subject_id, p_field,
          v_uid::text || '/' || v_id::text || '.' || v_ext,
          v_uid::text || '/' || v_id::text || '-thumb.' || v_ext,
          nullif(btrim(coalesce(p_consent_version, '')), ''));
  return query select v_id, 'media-staging'::text, v_uid::text || '/' || v_id::text || '.' || v_ext,
                      v_uid::text || '/' || v_id::text || '-thumb.' || v_ext;
end;
$$;

-- Saves a new order. p_ids must be exactly the finished, not removed photos of that field; the first
-- one is the main photo ("Make main photo" moves a photo to the front).
create or replace function public.reorder_media(
  p_subject_kind public.media_subject_kind,
  p_subject_id uuid,
  p_field public.media_field,
  p_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_have uuid[];
begin
  if private.media_subject_owner(p_subject_kind, p_subject_id) is distinct from (select auth.uid()) then
    raise exception 'media:not_yours' using errcode = '42501';
  end if;
  select coalesce(array_agg(m.id order by m.id), '{}') into v_have from public.media m
  where m.subject_kind = p_subject_kind and m.subject_id = p_subject_id and m.field = p_field
    and m.state not in ('uploading', 'removed');
  if cardinality(v_have) = 0 or coalesce(cardinality(p_ids), 0) <> cardinality(v_have)
     or (select array_agg(x order by x) from unnest(p_ids) x) <> v_have then
    raise exception 'media:not_yours' using errcode = '22023';
  end if;
  update public.media m set is_main = false
  where m.id = any (v_have) and m.is_main;
  update public.media m
  set sort = o.ord - 1, is_main = (o.ord = 1)
  from unnest(p_ids) with ordinality as o(mid, ord)
  where m.id = o.mid;
end;
$$;

-- Removes one of your photos: the row stays as 'removed'; returns the buckets and file names so the
-- caller deletes them right away (the sweep does it otherwise). The next photo becomes main.
create or replace function public.remove_my_media(p_id uuid)
returns table (bucket text, staging text, paths text[])
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_kind public.media_subject_kind;
  v_subject uuid;
  v_field public.media_field;
  v_state public.media_state;
  v_main boolean;
  v_path text;
  v_thumb text;
begin
  if not private.media_is_mine(p_id) then
    raise exception 'media:not_yours' using errcode = '42501';
  end if;
  select m.subject_kind, m.subject_id, m.field, m.state, m.is_main, m.path, m.thumb_path
    into v_kind, v_subject, v_field, v_state, v_main, v_path, v_thumb
  from public.media m where m.id = p_id;
  if not found then
    raise exception 'media:not_yours' using errcode = '42501';
  end if;
  if v_state <> 'removed' then
    update public.media m set state = 'removed', removed_reason = 'owner' where m.id = p_id;
    if v_main then
      update public.media m set is_main = true
      where m.id = (select n.id from public.media n
                    where n.subject_kind = v_kind and n.subject_id = v_subject and n.field = v_field
                      and n.state not in ('uploading', 'removed')
                    order by n.sort, n.created_at limit 1);
    end if;
  end if;
  return query select private.media_field_bucket(v_field), 'media-staging'::text, array[v_path, v_thumb];
end;
$$;

-- M2: before "Delete my account". Every photo of the caller becomes 'removed' (reason 'owner'), so
-- the storage policies allow deleting all the files. Returns how many rows changed.
create or replace function public.remove_all_my_media()
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count int;
begin
  if (select auth.uid()) is null then
    raise exception 'media:not_yours' using errcode = '42501';
  end if;
  -- Row level security ("Owners change their media") limits this to the caller's own rows.
  update public.media m set state = 'removed', removed_reason = 'owner'
  where m.state <> 'removed'
    and private.media_is_mine(m.id); -- L-d: second safeguard next to row level security
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- N6: the owner's own photos with the consent and time columns other people never see.
create or replace function public.my_media(p_subject_kind public.media_subject_kind, p_subject_id uuid)
returns table (id uuid, field public.media_field, state public.media_state, consent_version text, consented_at timestamptz,
               created_at timestamptz, finished_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.field, m.state, m.consent_version, m.consented_at, m.created_at, m.finished_at
  from public.media m
  where m.owner_id = (select auth.uid()) and m.subject_kind = p_subject_kind and m.subject_id = p_subject_id
  order by m.field, m.sort;
$$;

revoke all on function public.my_media(public.media_subject_kind, uuid) from public, anon;
grant execute on function public.my_media(public.media_subject_kind, uuid) to authenticated;

revoke all on function public.start_media_upload(public.media_field, public.media_subject_kind, uuid, text, text) from public, anon;
revoke all on function public.reorder_media(public.media_subject_kind, uuid, public.media_field, uuid[]) from public, anon;
revoke all on function public.remove_my_media(uuid) from public, anon;
revoke all on function public.remove_all_my_media() from public, anon;
grant execute on function public.start_media_upload(public.media_field, public.media_subject_kind, uuid, text, text) to authenticated;
grant execute on function public.reorder_media(public.media_subject_kind, uuid, public.media_field, uuid[]) to authenticated;
grant execute on function public.remove_my_media(uuid) to authenticated;
grant execute on function public.remove_all_my_media() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Service functions for the media-finish Edge Function (service role only)
-- ---------------------------------------------------------------------------
-- N3, L-c: the function claims the row before it writes anything. The row must be p_user's (whose
-- token the function verified) and still uploading; a second claim is refused for 5 minutes, so two
-- calls never write the same files. The claim id it returns must be passed to finish, refuse and
-- release, so only the claimant can end the claim. 'claimed' false with a finished state means
-- "already done".
create or replace function public.svc_claim_media(p_id uuid, p_user uuid)
returns table (claimed boolean, claim_id uuid, state public.media_state, field public.media_field, path text, thumb_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.media;
  v_claim uuid := gen_random_uuid();
begin
  select * into r from public.media m where m.id = p_id for update;
  if not found or r.owner_id <> p_user then
    raise exception 'media:not_yours' using errcode = '42501';
  end if;
  if r.state <> 'uploading' then
    return query select false, null::uuid, r.state, r.field, r.path, r.thumb_path;
    return;
  end if;
  if r.finishing_until > now() then
    raise exception 'media:busy' using errcode = '23514';
  end if;
  update public.media m set finishing_until = now() + interval '5 minutes', finishing_claim = v_claim where m.id = p_id;
  return query select true, v_claim, r.state, r.field, r.path, r.thumb_path;
end;
$$;

-- Called after the function wrote the cleaned files to the field's bucket. The row must be p_user's,
-- still uploading and claimed with p_claim. The guard runs the object check. A new cover or avatar
-- replaces the old one; the old file names come back for deletion. The first photo of a field
-- becomes the main photo.
create or replace function public.svc_finish_media(p_id uuid, p_user uuid, p_claim uuid, p_width int, p_height int, p_placeholder text default null)
returns table (state public.media_state, replaced_bucket text, replaced_paths text[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.media;
  v_paths text[] := '{}';
begin
  select * into r from public.media m where m.id = p_id for update;
  if not found or r.owner_id <> p_user then
    raise exception 'media:not_yours' using errcode = '42501';
  end if;
  if r.state <> 'uploading' then
    return query select r.state, private.media_field_bucket(r.field), v_paths;
    return;
  end if;
  if r.finishing_until is null or r.finishing_until <= now() or r.finishing_claim is distinct from p_claim then
    raise exception 'media:busy' using errcode = '23514';
  end if;
  if coalesce(p_width, 0) not between 1 and 4000 or coalesce(p_height, 0) not between 1 and 4000 then
    raise exception 'media:bad_size' using errcode = '23514';
  end if;
  update public.media m
  set state = private.media_finish_state(r.field), width = p_width, height = p_height,
      placeholder = case when p_placeholder ~ '^#[0-9a-f]{6}$' then p_placeholder end
  where m.id = p_id;
  if private.media_field_max(r.field) = 1 then
    with old as (
      update public.media m
      set state = 'removed', removed_reason = 'replaced'
      where m.subject_kind = r.subject_kind and m.subject_id = r.subject_id and m.field = r.field
        and m.id <> p_id and m.state <> 'removed'
      returning m.path, m.thumb_path
    )
    select coalesce(array_agg(x), '{}') into v_paths
    from (select o.path as x from old o union all select o.thumb_path from old o) s;
  end if;
  if not exists (select 1 from public.media m
                 where m.subject_kind = r.subject_kind and m.subject_id = r.subject_id
                   and m.field = r.field and m.is_main and m.state <> 'removed') then
    update public.media m set is_main = true where m.id = p_id;
  end if;
  return query select private.media_finish_state(r.field), private.media_field_bucket(r.field), v_paths;
end;
$$;

-- The claimant refused the files (not a still JPEG or WebP, broken, animated, too big, wrong shape).
create or replace function public.svc_refuse_media(p_id uuid, p_user uuid, p_claim uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.media m set state = 'removed', removed_reason = 'refused', finishing_until = null, finishing_claim = null
  where m.id = p_id and m.owner_id = p_user and m.state = 'uploading' and m.finishing_claim = p_claim;
$$;

-- The claimant's write failed: end the claim so "Try again" can claim the row again.
create or replace function public.svc_release_media(p_id uuid, p_user uuid, p_claim uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.media m set finishing_until = null, finishing_claim = null
  where m.id = p_id and m.owner_id = p_user and m.state = 'uploading' and m.finishing_claim = p_claim;
$$;

revoke all on function public.svc_claim_media(uuid, uuid) from public, anon, authenticated;
revoke all on function public.svc_finish_media(uuid, uuid, uuid, int, int, text) from public, anon, authenticated;
revoke all on function public.svc_refuse_media(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.svc_release_media(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.svc_claim_media(uuid, uuid) to service_role;
grant execute on function public.svc_finish_media(uuid, uuid, uuid, int, int, text) to service_role;
grant execute on function public.svc_refuse_media(uuid, uuid, uuid) to service_role;
grant execute on function public.svc_release_media(uuid, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 6. Admin functions (two-step sign-in)
-- ---------------------------------------------------------------------------
-- Mark a shown photo as checked, or remove it ('admin' or 'report'). Product approval (copy to the
-- public bucket) is S12 and refused here; S12 must create the media rows for every product photo it
-- copies to `media` (L7). Returns the files to delete when removing.
create or replace function public.admin_check_media(p_id uuid, p_decision text, p_reason text default 'admin')
returns table (bucket text, paths text[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.media;
begin
  if not (select private.is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into r from public.media m where m.id = p_id for update;
  if not found or r.state in ('uploading', 'removed') then
    raise exception 'This photo cannot be checked now' using errcode = '23514';
  end if;
  if p_decision = 'checked' then
    if r.field = 'product' then
      raise exception 'Product photos are approved with the product' using errcode = '23514';
    end if;
    update public.media m set state = 'checked', checked_at = now(), checked_by = (select auth.uid()) where m.id = p_id;
    return query select private.media_field_bucket(r.field), '{}'::text[];
  elsif p_decision = 'removed' and p_reason in ('admin', 'report') then
    update public.media m set state = 'removed', removed_reason = p_reason, checked_at = now(), checked_by = (select auth.uid())
    where m.id = p_id;
    return query select private.media_field_bucket(r.field), array[r.path, r.thumb_path];
  else
    raise exception 'Unknown decision' using errcode = '22023';
  end if;
end;
$$;

-- L1: the admin columns (who checked, why removed, consent) are read only here. Oldest first.
create or replace function public.admin_media_list(p_state public.media_state default 'live', p_limit int default 100)
returns setof public.media
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from public.media m where m.state = p_state
    order by m.created_at limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

revoke all on function public.admin_check_media(uuid, text, text) from public, anon;
revoke all on function public.admin_media_list(public.media_state, int) from public, anon;
grant execute on function public.admin_check_media(uuid, text, text) to authenticated;
grant execute on function public.admin_media_list(public.media_state, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Buckets and storage policies
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 2097152, array['image/webp', 'image/jpeg']),
       ('media-pending', 'media-pending', false, 2097152, array['image/webp', 'image/jpeg']),
       ('media-staging', 'media-staging', false, 2097152, array['image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- An object name in `media-staging` is an open slot when a row of the caller, still uploading and
-- under 24 hours old, names it (main file or thumbnail).
create or replace function private.media_upload_slot(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_bucket = 'media-staging' and exists (
    select 1 from public.media m
    where (m.path = p_name or m.thumb_path = p_name)
      and m.owner_id = (select auth.uid())
      and m.state = 'uploading'
      and (m.finishing_until is null or m.finishing_until <= now())
      and m.created_at > now() - interval '24 hours');
$$;

-- A file may be deleted when no shown or waiting row uses it in that bucket. Staging copies are
-- deletable except while the media-finish function holds a claim on their row (N3).
create or replace function private.media_path_deletable(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_bucket = 'media-staging' then not exists (
      select 1 from public.media m
      where (m.path = p_name or m.thumb_path = p_name)
        and m.state = 'uploading' and m.finishing_until > now())
    else not exists (
      select 1 from public.media m
      where (m.path = p_name or m.thumb_path = p_name)
        and private.media_field_bucket(m.field) = p_bucket
        and m.state not in ('uploading', 'removed'))
  end;
$$;

revoke execute on function private.media_upload_slot(text, text) from public, anon;
revoke execute on function private.media_path_deletable(text, text) from public, anon;
grant execute on function private.media_upload_slot(text, text) to authenticated;
grant execute on function private.media_path_deletable(text, text) to authenticated;

-- Clients upload only to staging. `media` and `media-pending` are written by the media-finish function.
drop policy if exists "Media: upload to an open slot" on storage.objects;
create policy "Media: upload to an open slot" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media-staging'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select private.is_onboarded())
              and private.media_upload_slot(bucket_id, name));

-- No update policy: a stored photo is never overwritten.

-- Owners (by folder: finished files are written by the service) and admins, only when no shown or
-- waiting photo uses the file (L6).
drop policy if exists "Media: delete unused files" on storage.objects;
create policy "Media: delete unused files" on storage.objects
  for delete to authenticated
  using (bucket_id in ('media', 'media-pending', 'media-staging')
         and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin()))
         and private.media_path_deletable(bucket_id, name));

-- The public bucket needs no read policy for public URLs. Pending product photos: owner and admins.
drop policy if exists "Media: owners and admins read pending files" on storage.objects;
create policy "Media: owners and admins read pending files" on storage.objects
  for select to authenticated
  using (bucket_id = 'media-pending'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin())));

-- ---------------------------------------------------------------------------
-- 8. Account deletion: list these files too (call remove_all_my_media() first, M2)
-- ---------------------------------------------------------------------------
create or replace function public.my_uploaded_files()
returns table (bucket_id text, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.bucket_id, o.name
  from storage.objects o
  where (o.owner_id = (select auth.uid())::text and o.bucket_id in ('avatars', 'verification', 'chat-media'))
     or (o.bucket_id in ('media', 'media-pending', 'media-staging')
         and (storage.foldername(o.name))[1] = (select auth.uid())::text);
$$;

revoke all on function public.my_uploaded_files() from public, anon;
grant execute on function public.my_uploaded_files() to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Sweep. URL and key live in Vault, never in this file:
--   select vault.create_secret('https://<project>.supabase.co/functions/v1/media-sweep', 'media_sweep_url');
--   select vault.create_secret('<MEDIA_SWEEP_SECRET>', 'media_sweep_key');
-- ---------------------------------------------------------------------------
-- Files to delete (service role only, used by the media-sweep Edge Function):
--   removed: a removed row names the file (any of the three buckets);
--   staged: a staging copy whose row is finished (the copy in the field's bucket stays);
--   no_row: no row names the file and it is over 24 hours old;
--   no_account: the folder has no account.
-- The Edge Function's safety stop applies to no_row and no_account only (M3).
create or replace function public.svc_media_sweep_list(p_limit int default 500)
returns table (bucket_id text, name text, reason text)
language sql
stable
security definer
set search_path = ''
as $$
  with objs as (
    select o.bucket_id, o.name, o.created_at, (storage.foldername(o.name))[1] as folder
    from storage.objects o
    where o.bucket_id in ('media', 'media-pending', 'media-staging')
  ),
  named as (
    select m.path as name, m.state, private.media_field_bucket(m.field) as bucket_id from public.media m
    union all
    select m.thumb_path, m.state, private.media_field_bucket(m.field) from public.media m
  ),
  hits as (
    select o.bucket_id, o.name, 'no_account'::text as reason
    from objs o
    where not exists (select 1 from public.profiles p where p.id::text = o.folder)
    union all
    select o.bucket_id, o.name, 'removed'
    from objs o
    join named n on n.name = o.name and n.state = 'removed'
    union all
    select o.bucket_id, o.name, 'staged'
    from objs o
    join named n on n.name = o.name and n.state not in ('uploading', 'removed')
    where o.bucket_id = 'media-staging'
    union all
    select o.bucket_id, o.name, 'no_row'
    from objs o
    where o.created_at < now() - interval '24 hours'
      and not exists (select 1 from named n where n.name = o.name)
  )
  select h.bucket_id, h.name, min(h.reason) from hits h group by h.bucket_id, h.name
  order by 1, 2
  limit greatest(1, least(coalesce(p_limit, 500), 1000));
$$;

create or replace function public.svc_media_bucket_count()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) from storage.objects o where o.bucket_id in ('media', 'media-pending', 'media-staging');
$$;

-- M3: the sweep's safety stop tripped. Alerts every admin by email, at most once per 6 hours.
create or replace function public.svc_media_sweep_halted()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid;
begin
  if exists (select 1 from public.notification_outbox o
             where o.event = 'media_sweep_halted' and o.created_at > now() - interval '6 hours') then
    return;
  end if;
  for v_admin in select p.id from public.profiles p where p.role = 'admin' loop
    perform private.notify_user('media_sweep_halted', v_admin, '{}'::jsonb, null, array['email']);
  end loop;
end;
$$;

revoke all on function public.svc_media_sweep_list(int) from public, anon, authenticated;
revoke all on function public.svc_media_bucket_count() from public, anon, authenticated;
revoke all on function public.svc_media_sweep_halted() from public, anon, authenticated;
grant execute on function public.svc_media_sweep_list(int) to service_role;
grant execute on function public.svc_media_bucket_count() to service_role;
grant execute on function public.svc_media_sweep_halted() to service_role;

-- Hourly: unfinished uploads after 24 hours and photos whose guide, business or product is gone become
-- 'removed'; then the Edge Function deletes the files. Returns the number of rows marked.
create or replace function private.media_sweep()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'media_sweep_url');
  v_key text := (select decrypted_secret from vault.decrypted_secrets where name = 'media_sweep_key');
  v_unfinished int;
  v_gone int;
begin
  update public.media m
  set state = 'removed', removed_reason = 'not_finished'
  where m.state = 'uploading' and m.created_at < now() - interval '24 hours';
  get diagnostics v_unfinished = row_count;

  update public.media m
  set state = 'removed', removed_reason = 'subject_gone'
  where m.state <> 'removed' and private.media_subject_owner(m.subject_kind, m.subject_id) is null;
  get diagnostics v_gone = row_count;

  if v_url is not null and v_key is not null then
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000);
  end if;
  return v_unfinished + v_gone;
end;
$$;

revoke execute on function private.media_sweep() from public, anon, authenticated;

select cron.schedule('kwetuly-media-sweep', '23 * * * *', 'select private.media_sweep()');
