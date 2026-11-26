-- STATUS: NOT APPLIED anywhere. Walter pastes live SQL himself; run it on a test project first, then
-- supabase/checks/media_uploads_tests.sql, then the security advisors.
-- Order: after 20261123000000_business_chat.sql (and the reservations files before it). It does not
-- depend on 20261126000000_feature_switch_admin.sql (S1).
--
-- Slice S4: one upload system (design docs/team/design-2026-11-24.md, section 9.2).
-- The per-field rules are in packages/shared/src/uploads.ts; uploads.test.ts compares them with this file.
--
-- What this does:
--   1. Enums media_field, media_subject_kind, media_state and small rule functions per field
--      (count, size, bucket, finished state).
--   2. public.media: one row per stored photo (avatar, cover, gallery, product) with its width, height
--      and placeholder colour, so pages keep their shape while photos load. Row level security on.
--   3. private.guard_media(): owners only add photos to subjects they own, counts per field, a rate
--      limit, paths {owner}/{id}.(webp|jpg) and {owner}/{id}-thumb.(same), and the only state changes a
--      client may make (finish an upload, remove a photo). Finishing calls private.media_object_ok(),
--      which reads storage.objects (size, type, owner) and refuses a wrong or missing file. Admin-only:
--      checked and removed by Kwetuly.
--   4. Functions: start_media_upload, finish_media_upload, reorder_media, remove_my_media (security
--      invoker, so the guard and policies apply), admin_check_media (admins, two-step sign-in).
--   5. Buckets `media` (public) and `media-pending` (private), 2 MB, WebP and JPEG only, with storage
--      policies: insert only for a row of yours that is still uploading, never overwrite, delete only
--      when no shown row uses the file (or by an admin).
--   6. my_uploaded_files() also lists both buckets, so "Delete my account" removes these files.
--   7. Sweep: private.media_sweep() (hourly, pg_cron) marks unfinished uploads after 24 hours and photos
--      whose guide or business is gone, then calls the `media-sweep` Edge Function, which deletes the
--      files through the Storage API (SQL may not delete storage objects). Without its Vault secrets the
--      file part does nothing.
--
-- Not here (later slices): public display, reports and the admin photo queue (S6), copying approved
-- product photos to `media` (S12), documents (S9 keeps person_documents and the `verification` bucket).
--
-- Undo (only before real data exists; dropping the table deletes its rows, files stay until removed by hand):
--   select cron.unschedule('kwetuly-media-sweep');
--   drop policy "Media: upload to an open slot" on storage.objects;
--   drop policy "Media: owners delete unused files" on storage.objects;
--   drop policy "Media: admins delete files" on storage.objects;
--   drop policy "Media: owners and admins read pending files" on storage.objects;
--   re-create public.my_uploaded_files() as in 20261016000000_delete_my_account.sql;
--   drop function public.svc_media_sweep_list(int), public.svc_media_bucket_count(), private.media_sweep(),
--     public.admin_check_media(uuid, text, text), public.remove_my_media(uuid),
--     public.reorder_media(public.media_subject_kind, uuid, public.media_field, uuid[]),
--     public.finish_media_upload(uuid, int, int, text),
--     public.start_media_upload(public.media_field, public.media_subject_kind, uuid, text, text),
--     private.guard_media(), private.media_upload_slot(text, text), private.media_path_deletable(text, text),
--     private.media_object_ok(uuid), private.media_object_check(uuid), private.media_subject_public(public.media_subject_kind, uuid),
--     private.media_subject_owner(public.media_subject_kind, uuid), private.media_finish_state(public.media_field),
--     private.media_field_bucket(public.media_field), private.media_thumb_max_bytes(),
--     private.media_field_max_bytes(public.media_field), private.media_field_max(public.media_field);
--   drop table public.media; drop type public.media_state, public.media_subject_kind, public.media_field;
--   delete from storage.buckets where id in ('media', 'media-pending'); (only when empty)

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
  -- Object names (no bucket prefix). The bucket follows from the field (private.media_field_bucket).
  path text not null unique,
  thumb_path text not null unique,
  -- Set by the guard from storage when the upload is finished; never by the client.
  mime text check (mime in ('image/webp', 'image/jpeg')),
  bytes bigint check (bytes > 0),
  -- Client-reported, bounded, used only for layout.
  width int check (width between 1 and 4000),
  height int check (height between 1 and 4000),
  placeholder text check (placeholder ~ '^#[0-9a-f]{6}$'),
  sort int not null default 0 check (sort between 0 and 1000),
  is_main boolean not null default false,
  state public.media_state not null default 'uploading',
  -- "The people in this photo agreed to it being shown.": which wording the uploader ticked, and when.
  consent_version text check (consent_version ~ '^[A-Za-z0-9._-]{1,40}$'),
  consented_at timestamptz,
  removed_reason text check (removed_reason in ('owner', 'replaced', 'not_finished', 'subject_gone', 'admin', 'report')),
  removed_at timestamptz,
  checked_at timestamptz,
  checked_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
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
  'Photos of guides, businesses and products (avatar, cover, gallery, product). Rules in packages/shared/src/uploads.ts. Owners write through start/finish/reorder/remove; admins check.';

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
revoke all on public.media from public, anon, authenticated;
grant select on public.media to anon, authenticated;
grant insert (id, owner_id, subject_kind, subject_id, field, path, thumb_path, consent_version) on public.media to authenticated;
grant update (state, width, height, placeholder, sort, is_main, removed_reason) on public.media to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Server check of the stored files, and the guard
-- ---------------------------------------------------------------------------
-- Reads the stored objects of one media row: both must exist in the field's bucket, belong to the
-- row's owner, have the type the path says, and be within the field's size. Callers other than the
-- owner (and trusted server roles) only get 'not_yours'. Security definer: storage.objects is not
-- readable by clients; it answers with a reason, a size and a type only.
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
  v_main_size bigint;
  v_main_type text;
  v_main_owner text;
  v_thumb_size bigint;
  v_thumb_type text;
  v_thumb_owner text;
begin
  select * into r from public.media m where m.id = p_id;
  if not found then
    return query select false, 'file_missing', null::bigint, null::text;
    return;
  end if;
  -- Inside security definer current_user is the function owner, so test the signed-in person: a
  -- signed-in caller must own the row. Server-side SQL (no auth.uid()) passes; anon has no execute.
  if (select auth.uid()) is not null and (select auth.uid()) <> r.owner_id then
    return query select false, 'not_yours', null::bigint, null::text;
    return;
  end if;
  v_bucket := private.media_field_bucket(r.field);
  v_mime := case when r.path like '%.webp' then 'image/webp' else 'image/jpeg' end;
  select (o.metadata ->> 'size')::bigint, o.metadata ->> 'mimetype', o.owner_id
    into v_main_size, v_main_type, v_main_owner
  from storage.objects o where o.bucket_id = v_bucket and o.name = r.path;
  select (o.metadata ->> 'size')::bigint, o.metadata ->> 'mimetype', o.owner_id
    into v_thumb_size, v_thumb_type, v_thumb_owner
  from storage.objects o where o.bucket_id = v_bucket and o.name = r.thumb_path;
  if v_main_owner is null or v_thumb_owner is null then
    return query select false, 'file_missing', null::bigint, null::text;
  elsif v_main_owner <> r.owner_id::text or v_thumb_owner <> r.owner_id::text then
    return query select false, 'not_yours', null::bigint, null::text;
  elsif v_main_type is distinct from v_mime or v_thumb_type is distinct from v_mime then
    return query select false, 'file_type', null::bigint, null::text;
  elsif coalesce(v_main_size, 0) not between 1 and private.media_field_max_bytes(r.field)
     or coalesce(v_thumb_size, 0) not between 1 and private.media_thumb_max_bytes() then
    return query select false, 'file_too_big', null::bigint, null::text;
  else
    return query select true, null::text, v_main_size, v_mime;
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

-- Guard. NOT security definer. Like private.guard_person_document (MA1) it tests the database role, so
-- an admin writing from the website or app gets every client rule too; only security definer
-- functions (role postgres) and service_role pass. Errors carry 'media:<code>' for the screens.
create or replace function private.guard_media()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_client boolean := current_user in ('anon', 'authenticated');
  v_count int;
  v_check record;
begin
  if tg_op = 'INSERT' then
    if v_client then
      if new.owner_id is distinct from (select auth.uid()) then
        raise exception 'media:not_yours' using errcode = '42501';
      end if;
      if private.media_subject_owner(new.subject_kind, new.subject_id) is distinct from new.owner_id then
        raise exception 'media:not_yours' using errcode = '42501';
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
      new.created_at := now();
      new.consented_at := case when new.consent_version is null then null else now() end;
      -- Rate limit: 60 uploads started per hour per person.
      select count(*) into v_count from public.media m
      where m.owner_id = new.owner_id and m.created_at > now() - interval '1 hour';
      if v_count >= 60 then
        raise exception 'media:rate_limited' using errcode = '23514';
      end if;
    end if;
    -- Counts per subject and field, also for trusted callers. One field at a time per subject.
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
    if new.state <> 'removed' or new.removed_reason is distinct from old.removed_reason then
      raise exception 'This photo was removed' using errcode = '23514';
    end if;
    return new;
  end if;

  if new.state = 'removed' and old.state <> 'removed' then
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
    -- Admin-only columns.
    if new.checked_at is distinct from old.checked_at or new.checked_by is distinct from old.checked_by
       or new.removed_reason is distinct from old.removed_reason then
      raise exception 'media:not_yours' using errcode = '42501';
    end if;
    if new.state <> old.state then
      -- The only state change a client makes: finishing its own upload, after the server check.
      if old.state <> 'uploading' or new.state <> private.media_finish_state(old.field) then
        raise exception 'media:not_yours' using errcode = '42501';
      end if;
    elsif new.width is distinct from old.width or new.height is distinct from old.height
          or new.placeholder is distinct from old.placeholder then
      raise exception 'Photo details cannot be changed' using errcode = '42501';
    end if;
    if new.state = 'uploading' and (new.sort <> old.sort or new.is_main <> old.is_main) then
      raise exception 'media:busy' using errcode = '23514';
    end if;
    -- Server-set columns.
    new.mime := old.mime;
    new.bytes := old.bytes;
    new.finished_at := old.finished_at;
  end if;

  if old.state = 'uploading' and new.state <> 'uploading' then
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
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_media() from public, anon, authenticated;

create trigger media_guard
  before insert or update on public.media
  for each row execute function private.guard_media();

-- ---------------------------------------------------------------------------
-- 4. Owner and admin functions
-- ---------------------------------------------------------------------------
-- Starts an upload: makes the row (state uploading) and returns where the two files go. The website
-- and app then ask Storage for signed upload URLs for exactly these names (the insert policy below
-- allows only these). p_ext is 'webp' or 'jpg' (what the device could write).
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
  -- A cover or avatar upload that never finished is given up when a new one starts.
  if private.media_field_max(p_field) = 1 then
    update public.media m
    set state = 'removed', removed_reason = 'replaced'
    where m.subject_kind = p_subject_kind and m.subject_id = p_subject_id and m.field = p_field
      and m.state = 'uploading' and m.owner_id = v_uid;
  end if;
  insert into public.media (id, owner_id, subject_kind, subject_id, field, path, thumb_path, consent_version)
  values (v_id, v_uid, p_subject_kind, p_subject_id, p_field,
          v_uid::text || '/' || v_id::text || '.' || v_ext,
          v_uid::text || '/' || v_id::text || '-thumb.' || v_ext,
          nullif(btrim(coalesce(p_consent_version, '')), ''));
  return query select v_id, private.media_field_bucket(p_field), v_uid::text || '/' || v_id::text || '.' || v_ext,
                      v_uid::text || '/' || v_id::text || '-thumb.' || v_ext;
end;
$$;

-- Finishes an upload after both files are stored. The guard runs the server check of the files. A new
-- cover or avatar replaces the old one; the old files' names come back so the caller deletes them (the
-- sweep does it otherwise). The first photo of a field becomes the main photo.
create or replace function public.finish_media_upload(p_id uuid, p_width int, p_height int, p_placeholder text default null)
returns table (state public.media_state, replaced_bucket text, replaced_paths text[])
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.media;
  v_paths text[] := '{}';
begin
  select * into r from public.media m where m.id = p_id and m.owner_id = (select auth.uid());
  if not found then
    raise exception 'media:not_yours' using errcode = '42501';
  end if;
  if r.state <> 'uploading' then
    -- Already finished (for example a retry after a lost answer): nothing to do.
    return query select r.state, private.media_field_bucket(r.field), v_paths;
    return;
  end if;
  update public.media m
  set state = private.media_finish_state(r.field),
      width = least(greatest(coalesce(p_width, 0), 1), 4000),
      height = least(greatest(coalesce(p_height, 0), 1), 4000),
      placeholder = case when p_placeholder ~ '^#[0-9a-f]{6}$' then p_placeholder end
  where m.id = p_id;
  if private.media_field_max(r.field) = 1 then
    with old as (
      update public.media m
      set state = 'removed', removed_reason = 'replaced'
      where m.subject_kind = r.subject_kind and m.subject_id = r.subject_id and m.field = r.field
        and m.id <> p_id and m.state <> 'removed' and m.owner_id = r.owner_id
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
  select coalesce(array_agg(m.id order by m.id), '{}') into v_have from public.media m
  where m.subject_kind = p_subject_kind and m.subject_id = p_subject_id and m.field = p_field
    and m.state not in ('uploading', 'removed') and m.owner_id = (select auth.uid());
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

-- Removes one of your photos: the row stays as 'removed'; returns the bucket and the two file names so
-- the caller deletes them right away (the sweep does it otherwise). The next photo becomes main.
create or replace function public.remove_my_media(p_id uuid)
returns table (bucket text, paths text[])
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.media;
begin
  select * into r from public.media m where m.id = p_id and m.owner_id = (select auth.uid());
  if not found then
    raise exception 'media:not_yours' using errcode = '42501';
  end if;
  if r.state <> 'removed' then
    update public.media m set state = 'removed', removed_reason = 'owner' where m.id = p_id;
    if r.is_main then
      update public.media m set is_main = true
      where m.id = (select n.id from public.media n
                    where n.subject_kind = r.subject_kind and n.subject_id = r.subject_id and n.field = r.field
                      and n.state not in ('uploading', 'removed')
                    order by n.sort, n.created_at limit 1);
    end if;
  end if;
  return query select private.media_field_bucket(r.field), array[r.path, r.thumb_path];
end;
$$;

revoke all on function public.start_media_upload(public.media_field, public.media_subject_kind, uuid, text, text) from public, anon;
revoke all on function public.finish_media_upload(uuid, int, int, text) from public, anon;
revoke all on function public.reorder_media(public.media_subject_kind, uuid, public.media_field, uuid[]) from public, anon;
revoke all on function public.remove_my_media(uuid) from public, anon;
grant execute on function public.start_media_upload(public.media_field, public.media_subject_kind, uuid, text, text) to authenticated;
grant execute on function public.finish_media_upload(uuid, int, int, text) to authenticated;
grant execute on function public.reorder_media(public.media_subject_kind, uuid, public.media_field, uuid[]) to authenticated;
grant execute on function public.remove_my_media(uuid) to authenticated;

-- Admins (two-step sign-in): mark a shown photo as checked, or remove it ('admin' or 'report').
-- Product approval (copy to the public bucket) is S12 and is refused here. Returns the files to delete
-- when removing. The admin photo queue screen is S6.
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

revoke all on function public.admin_check_media(uuid, text, text) from public, anon;
grant execute on function public.admin_check_media(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Buckets and storage policies
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 2097152, array['image/webp', 'image/jpeg']),
       ('media-pending', 'media-pending', false, 2097152, array['image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- An object name is an open slot when a row of the caller, still uploading and under 24 hours old,
-- names it (main file or thumbnail) in the field's bucket.
create or replace function private.media_upload_slot(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.media m
    where (m.path = p_name or m.thumb_path = p_name)
      and m.owner_id = (select auth.uid())
      and m.state = 'uploading'
      and m.created_at > now() - interval '24 hours'
      and private.media_field_bucket(m.field) = p_bucket);
$$;

-- A file may be deleted by its owner when no row uses it, or its row is still uploading or removed.
create or replace function private.media_path_deletable(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.media m
    where (m.path = p_name or m.thumb_path = p_name)
      and private.media_field_bucket(m.field) = p_bucket
      and m.state not in ('uploading', 'removed'));
$$;

revoke execute on function private.media_upload_slot(text, text) from public, anon;
revoke execute on function private.media_path_deletable(text, text) from public, anon;
grant execute on function private.media_upload_slot(text, text) to authenticated;
grant execute on function private.media_path_deletable(text, text) to authenticated;

drop policy if exists "Media: upload to an open slot" on storage.objects;
create policy "Media: upload to an open slot" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('media', 'media-pending')
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select private.is_onboarded())
              and private.media_upload_slot(bucket_id, name));

-- No update policy: a stored photo is never overwritten (upsert stays off).

drop policy if exists "Media: owners delete unused files" on storage.objects;
create policy "Media: owners delete unused files" on storage.objects
  for delete to authenticated
  using (bucket_id in ('media', 'media-pending')
         and owner_id = (select auth.uid())::text
         and private.media_path_deletable(bucket_id, name));

drop policy if exists "Media: admins delete files" on storage.objects;
create policy "Media: admins delete files" on storage.objects
  for delete to authenticated
  using (bucket_id in ('media', 'media-pending') and (select private.is_admin()));

-- The public bucket needs no read policy for public URLs. Pending product photos: owner and admins
-- (signed URLs for previews).
drop policy if exists "Media: owners and admins read pending files" on storage.objects;
create policy "Media: owners and admins read pending files" on storage.objects
  for select to authenticated
  using (bucket_id = 'media-pending'
         and (owner_id = (select auth.uid())::text or (select private.is_admin())));

-- ---------------------------------------------------------------------------
-- 6. Account deletion: list these files too (the website and app delete them before the account)
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
  where o.owner_id = (select auth.uid())::text
    and o.bucket_id in ('avatars', 'verification', 'chat-media', 'media', 'media-pending');
$$;

revoke all on function public.my_uploaded_files() from public, anon;
grant execute on function public.my_uploaded_files() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Sweep. URL and key live in Vault, never in this file:
--   select vault.create_secret('https://<project>.supabase.co/functions/v1/media-sweep', 'media_sweep_url');
--   select vault.create_secret('<MEDIA_SWEEP_SECRET>', 'media_sweep_key');
-- ---------------------------------------------------------------------------
-- Files to delete (service role only, used by the media-sweep Edge Function):
--   removed: the row is removed (by the owner, a replacement, the sweep or an admin);
--   no_row: no row names the file and it is over 24 hours old (for example an upload whose row is gone);
--   no_account: the owner folder has no account.
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
    where o.bucket_id in ('media', 'media-pending')
  ),
  named as (
    select private.media_field_bucket(m.field) as bucket_id, m.path as name, m.state from public.media m
    union all
    select private.media_field_bucket(m.field), m.thumb_path, m.state from public.media m
  ),
  hits as (
    select o.bucket_id, o.name, 'no_account'::text as reason
    from objs o
    where not exists (select 1 from public.profiles p where p.id::text = o.folder)
    union all
    select o.bucket_id, o.name, 'removed'
    from objs o
    where exists (select 1 from named n where n.bucket_id = o.bucket_id and n.name = o.name and n.state = 'removed')
      and not exists (select 1 from named n where n.bucket_id = o.bucket_id and n.name = o.name and n.state <> 'removed')
    union all
    select o.bucket_id, o.name, 'no_row'
    from objs o
    where o.created_at < now() - interval '24 hours'
      and not exists (select 1 from named n where n.bucket_id = o.bucket_id and n.name = o.name)
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
  select count(*) from storage.objects o where o.bucket_id in ('media', 'media-pending');
$$;

revoke all on function public.svc_media_sweep_list(int) from public, anon, authenticated;
revoke all on function public.svc_media_bucket_count() from public, anon, authenticated;
grant execute on function public.svc_media_sweep_list(int) to service_role;
grant execute on function public.svc_media_bucket_count() to service_role;

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
