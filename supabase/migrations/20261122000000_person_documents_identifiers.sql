-- STATUS 2026-11-22 (slice 0 check, read-only): ON LIVE, pasted by hand by Walter, so it is NOT in the live
-- migration history. Every function body, table column, constraint, index, policy, trigger and cron job
-- this file creates was compared with live and matches. Do not paste again. The notes below are as written.
-- Paid verification, migration A: person documents, checks, audit log and encrypted identifiers.
-- Design: docs/team/design-crew-and-trip-management-2026-11.md, "Addendum 2026-11-21", A.1 and A.6.
-- Security review: docs/team/security-review-paid-verification-2026-11-21.md (H2, M1-M5, M11, L1, L5, L6).
--
-- What this does (nothing changes for anyone yet: no listing, feature or badge reads these tables):
--   1. private.tz_today(), private.review_window_days() (A.7).
--   2. Enums person_document_kind, document_review_state.
--   3. public.person_documents: uploads that belong to a PERSON (user_id); provider_id only for
--      business papers. The owner inserts (column grants), never updates or deletes. Withdrawal is
--      public.withdraw_my_document() (M2). Admins review through public.admin_review_document(),
--      which accepts and records the check in one transaction (L4). No passport images (M11).
--   4. public.person_document_checks: what Kwetuly looked at. Only security definer functions write.
--      Methods are nida_card and passport_page only: a typed number is never a check (M11).
--   5. public.person_check_log: audit. Triggers and service functions write; admins read. user_id is
--      ON DELETE SET NULL so the record of who viewed a deleted person's number stays (L6).
--   6. public.person_identifiers, public.business_identifiers: NIDA, passport and TIN as ciphers made
--      by the `identifiers` Edge Function (M3, M4). No client role has any grant on them. The database
--      never sees a number in clear and never decrypts.
--   7. Service functions (execute for service_role only) used by the Edge Functions: write or clear an
--      identifier, fetch a cipher for an admin full read (logged BEFORE the cipher leaves, M5), and the
--      file sweep (H2, M11).
--   8. Storage: the owner delete policy from 20261016000000 is replaced (M1); uploads may not reuse a
--      path that already has a document row (no file swap).
--   9. pg_cron: hourly call of the `verification-sweep` Edge Function, through Vault secrets like
--      flush_notifications(). Without the Vault secrets the job does nothing.
--
-- Retention periods (sweep) are PROPOSALS for legal and the advocate (H3): withdrawn at once,
-- rejected 30 days and accepted 90 days after the decision, files without a row after 24 hours.
-- No real ID document or number may be collected until H3 is cleared.
--
-- Undo (only before real data exists; dropping the tables deletes their rows):
--   select cron.unschedule('verification-sweep');
--   drop policy "Owners delete their unreviewed verification files" on storage.objects;
--   create policy "Owners delete their verification documents" on storage.objects for delete to authenticated
--     using (bucket_id = 'verification' and owner_id = (select auth.uid())::text);
--   drop policy "Users upload own verification docs" on storage.objects; then re-create it as in
--     20261016001800_onboarded_gate_followup.sql;
--   drop function public.svc_verification_sweep_halted(), public.svc_expire_stale_waiting(boolean),
--     public.svc_verification_bucket_count(), public.svc_verification_sweep_mark(text[]), public.svc_verification_sweep_list(int),
--     public.svc_identifier_cipher_for_read(uuid, text, uuid, uuid, text, text),
--     public.svc_identifier_set(uuid, uuid, uuid, text, text, text, text, smallint, smallint, text, date, text),
--     public.admin_identifiers_masked(uuid), public.admin_business_identifiers_masked(uuid),
--     public.my_identifiers(), public.admin_log_document_opened(uuid), public.admin_end_check(uuid, text),
--     public.admin_review_document(uuid, text, date, text, text, text), public.withdraw_my_document(uuid),
--     private.run_verification_sweep(), private.verification_path_deletable(text),
--     private.verification_path_has_row(text), private.verification_object_exists(text, uuid),
--     private.person_doc_log(), private.person_check_log_trigger(), private.guard_person_check(),
--     private.guard_person_document(), private.mask_digit_runs(text), private.retention_days(text),
--     private.waiting_limit_days(), private.review_window_days(), private.tz_today();
--   drop table public.business_identifiers, public.person_identifiers, public.person_check_log,
--     public.person_document_checks, public.person_documents;
--   drop type public.document_review_state, public.person_document_kind;

-- ---------------------------------------------------------------------------
-- 1. Dates
-- ---------------------------------------------------------------------------
create or replace function private.tz_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Africa/Dar_es_Salaam')::date;
$$;

-- One constant for every review window (A.7). Mirrored in shared code when D uses it.
create or replace function private.review_window_days()
returns int
language sql
immutable
set search_path = ''
as $$
  select 30;
$$;

revoke execute on function private.tz_today() from public;
revoke execute on function private.review_window_days() from public;
grant execute on function private.tz_today() to anon, authenticated;
grant execute on function private.review_window_days() to anon, authenticated;

-- Days a document file is kept after the decision (PROPOSAL, legal to confirm; M11, H3).
create or replace function private.retention_days(p_state text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_state
    when 'withdrawn' then 0
    when 'expired' then 0
    when 'rejected' then 30
    when 'accepted' then 90
  end;
$$;

revoke execute on function private.retention_days(text) from public, anon, authenticated;

-- LA4: a document nobody reviewed within this many days becomes 'expired' and its file is swept
-- (PROPOSAL, legal and operations to confirm). The admin queue marks anything past 30 days in red.
create or replace function private.waiting_limit_days()
returns int
language sql
immutable
set search_path = ''
as $$
  select 60;
$$;

revoke execute on function private.waiting_limit_days() from public, anon, authenticated;

-- Hides digit runs (5 or more digits; spaces, dots, commas, colons, underscores, dashes or slashes
-- between them) so no ID number can be typed into an admin note. A convenience, not a control (LA2).
-- The result is cut to 300 characters, so masking never makes a valid note too long (LA1).
create or replace function private.mask_digit_runs(p_text text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_out text := p_text;
  v_match text;
begin
  if p_text is null then
    return null;
  end if;
  for v_match in select (regexp_matches(p_text, '\d[\d\s.,:_/-]*\d', 'g'))[1] loop
    if length(regexp_replace(v_match, '\D', '', 'g')) >= 5 then
      v_out := replace(v_out, v_match, '[number hidden]');
    end if;
  end loop;
  return left(v_out, 300);
end;
$$;

revoke execute on function private.mask_digit_runs(text) from public, anon;
-- The document guard runs as the caller, so signed-in users need execute (a pure function).
grant execute on function private.mask_digit_runs(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Enums
-- ---------------------------------------------------------------------------
create type public.person_document_kind as enum (
  'identity',          -- NIDA card
  'passport',
  'guide_licence',
  'first_aid',
  'wfr',
  'driving_licence',
  'business_licence',
  'tin_certificate',
  'operator_licence',
  'other'
);

-- 'expired': nobody reviewed it within private.waiting_limit_days() (LA4); set only by the sweep.
create type public.document_review_state as enum ('waiting', 'accepted', 'rejected', 'withdrawn', 'expired');

-- ---------------------------------------------------------------------------
-- 3. person_documents
-- ---------------------------------------------------------------------------
create table public.person_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider_id uuid references public.providers (id) on delete cascade,
  kind public.person_document_kind not null,
  title text check (title is null or char_length(btrim(title)) between 2 and 80),
  -- Storage object name in the `verification` bucket (no bucket prefix): {user_id}/{id}.{ext}
  path text not null unique,
  stated_valid_until date,
  uploaded_at timestamptz not null default now(),
  -- Which privacy notice the person saw when uploading (M11), and when they agreed.
  notice_version text not null check (notice_version ~ '^[A-Za-z0-9._-]{1,40}$'),
  consented_at timestamptz not null default now(),
  review_state public.document_review_state not null default 'waiting',
  review_reason text check (review_reason in
    ('unreadable', 'name_mismatch', 'expired', 'wrong_document', 'not_complete', 'other')),
  review_note text check (char_length(review_note) <= 300),
  reviewed_at timestamptz,
  removed_at timestamptz,
  constraint person_documents_path_shape check (
    path ~ ('^' || user_id::text || '/' || id::text || '\.(jpg|jpeg|png|webp|pdf)$')),
  constraint person_documents_title_only_other check ((kind = 'other') = (title is not null)),
  constraint person_documents_business_subject check (
    (kind in ('business_licence', 'tin_certificate', 'operator_licence')) = (provider_id is not null)),
  constraint person_documents_rejected_reason check (
    (review_state = 'rejected') = (review_reason is not null)),
  constraint person_documents_reviewed_at check (
    (review_state in ('accepted', 'rejected')) = (reviewed_at is not null)),
  constraint person_documents_waiting_has_file check (review_state <> 'waiting' or removed_at is null),
  -- M11: no passport photo page images until legal and Walter agree. Lifting this is a new migration.
  constraint person_documents_no_passport_image check (kind <> 'passport')
);

comment on table public.person_documents is
  'ID and role documents of a person (user_id); provider_id only for business papers. Owner inserts; admins review via admin_review_document.';

create index person_documents_user_idx on public.person_documents (user_id);
create index person_documents_provider_idx on public.person_documents (provider_id) where provider_id is not null;
create index person_documents_state_idx on public.person_documents (review_state, reviewed_at);

alter table public.person_documents enable row level security;

create policy "Owners read their documents" on public.person_documents
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Admins read all documents" on public.person_documents
  for select to authenticated
  using ((select private.is_admin()));

create policy "Owners upload their documents" on public.person_documents
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_onboarded()));

-- No update or delete policy for anyone: withdrawal and review go through functions.
revoke all on public.person_documents from public, anon, authenticated;
grant select on public.person_documents to authenticated;
grant insert (id, user_id, provider_id, kind, title, path, stated_valid_until, notice_version)
  on public.person_documents to authenticated;

-- Helpers for the guard and storage policies (security definer so they see every row and object;
-- they only answer yes or no).
create or replace function private.verification_object_exists(p_path text, p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from storage.objects o
    where o.bucket_id = 'verification' and o.name = p_path and o.owner_id = p_owner::text);
$$;

create or replace function private.verification_path_has_row(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.person_documents d where d.path = p_path);
$$;

-- An owner may delete a verification file only when no document row uses it, or its row was
-- withdrawn (M1). Old guide and business papers (guide_private, provider_private) have no row, so
-- they stay deletable for the account deletion flow.
create or replace function private.verification_path_deletable(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.person_documents d
    where d.path = p_path and d.review_state <> 'withdrawn');
$$;

revoke execute on function private.verification_object_exists(text, uuid) from public, anon;
revoke execute on function private.verification_path_has_row(text) from public, anon;
revoke execute on function private.verification_path_deletable(text) from public, anon;
grant execute on function private.verification_object_exists(text, uuid) to authenticated;
grant execute on function private.verification_path_has_row(text) to authenticated;
grant execute on function private.verification_path_deletable(text) to authenticated;

-- Guard. NOT security definer. MA1: it tests the database role, not private.is_trusted(), so an
-- admin writing from the website or app (role authenticated) gets every client check too. Only
-- security definer functions (role postgres) and service_role pass.
create or replace function private.guard_person_document()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_open int;
  v_client boolean := current_user in ('anon', 'authenticated');
begin
  if tg_op = 'INSERT' then
    if v_client then
      if new.user_id is distinct from (select auth.uid()) then
        raise exception 'Documents can only be added to your own account' using errcode = '42501';
      end if;
      new.review_state := 'waiting';
      new.review_reason := null;
      new.review_note := null;
      new.reviewed_at := null;
      new.removed_at := null;
      new.uploaded_at := now();
      new.consented_at := now();
      new.title := private.mask_digit_runs(new.title);
      if new.provider_id is not null and not exists (
           select 1 from public.providers p
           where p.id = new.provider_id and p.owner_id = (select auth.uid())) then
        raise exception 'Business papers can only be added to your own business' using errcode = '42501';
      end if;
      if not private.verification_object_exists(new.path, new.user_id) then
        raise exception 'Upload the file first' using errcode = '23514';
      end if;
      -- L5: a cap on documents with a file still kept.
      select count(*) into v_open from public.person_documents d
      where d.user_id = new.user_id and d.removed_at is null;
      if v_open >= 30 then
        raise exception 'Too many documents waiting or kept. Withdraw some first' using errcode = '23514';
      end if;
    end if;
    new.review_note := private.mask_digit_runs(new.review_note);
    return new;
  end if;

  -- UPDATE: clients have no update grant or policy; this also binds the security definer functions.
  if v_client then
    raise exception 'Documents cannot be changed' using errcode = '42501';
  end if;
  if new.id <> old.id or new.user_id <> old.user_id or new.provider_id is distinct from old.provider_id
     or new.kind <> old.kind or new.title is distinct from old.title or new.path <> old.path
     or new.uploaded_at <> old.uploaded_at or new.notice_version <> old.notice_version
     or new.consented_at <> old.consented_at
     or new.stated_valid_until is distinct from old.stated_valid_until then
    raise exception 'Document details cannot be changed' using errcode = '42501';
  end if;
  if new.review_state <> old.review_state and old.review_state <> 'waiting' then
    raise exception 'This document has already been decided' using errcode = '23514';
  end if;
  if old.removed_at is not null and new.removed_at is distinct from old.removed_at then
    raise exception 'The file was already removed' using errcode = '23514';
  end if;
  new.review_note := private.mask_digit_runs(new.review_note);
  return new;
end;
$$;

revoke execute on function private.guard_person_document() from public, anon, authenticated;

create trigger person_documents_guard
  before insert or update on public.person_documents
  for each row execute function private.guard_person_document();

-- ---------------------------------------------------------------------------
-- 4. person_document_checks
-- ---------------------------------------------------------------------------
create table public.person_document_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider_id uuid references public.providers (id) on delete cascade,
  kind public.person_document_kind not null,
  title text check (title is null or char_length(btrim(title)) between 2 and 80),
  document_id uuid references public.person_documents (id) on delete set null,
  method text check (method in ('nida_card', 'passport_page')),
  checked_at timestamptz not null default now(),
  valid_until date,
  ended_at timestamptz,
  end_reason text check (end_reason in ('renewed', 'withdrawn')),
  reminder_sent_at timestamptz,
  expired_notice_at timestamptz,
  constraint person_checks_title_only_other check ((kind = 'other') = (title is not null)),
  constraint person_checks_business_subject check (
    (kind in ('business_licence', 'tin_certificate', 'operator_licence')) = (provider_id is not null)),
  constraint person_checks_method check (
    (kind = 'identity' and method = 'nida_card')
    or (kind = 'passport' and method = 'passport_page')
    or (kind not in ('identity', 'passport') and method is null)),
  constraint person_checks_dated check (
    kind not in ('passport', 'guide_licence', 'first_aid', 'wfr', 'driving_licence',
                 'business_licence', 'operator_licence')
    or valid_until is not null),
  constraint person_checks_end check ((ended_at is null) = (end_reason is null))
);

comment on table public.person_document_checks is
  'What Kwetuly looked at, per person (business papers also per provider). Written only by admin functions.';

-- One current check per subject and kind (per title for "other").
create unique index person_checks_current_person
  on public.person_document_checks (user_id, kind)
  where ended_at is null and provider_id is null and kind <> 'other';
create unique index person_checks_current_business
  on public.person_document_checks (provider_id, kind)
  where ended_at is null and provider_id is not null;
create unique index person_checks_current_other
  on public.person_document_checks (user_id, lower(title))
  where ended_at is null and kind = 'other';
create index person_checks_valid_until_idx
  on public.person_document_checks (valid_until) where ended_at is null;

alter table public.person_document_checks enable row level security;

create policy "Owners read their checks" on public.person_document_checks
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Admins read all checks" on public.person_document_checks
  for select to authenticated
  using ((select private.is_admin()));

revoke all on public.person_document_checks from public, anon, authenticated;
grant select on public.person_document_checks to authenticated;

create or replace function private.guard_person_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- MA1: the role, not private.is_trusted(), so admins on the website or app are refused too.
  if current_user in ('anon', 'authenticated') then
    raise exception 'Only Kwetuly records checks' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if new.ended_at is not null then
      raise exception 'A new check cannot start ended' using errcode = '23514';
    end if;
    if new.valid_until is not null and new.valid_until < private.tz_today() then
      raise exception 'This document has already expired' using errcode = '23514';
    end if;
    new.checked_at := now();
    -- The previous current check of the same kind ends (renewal).
    update public.person_document_checks c
    set ended_at = now(), end_reason = 'renewed'
    where c.ended_at is null
      and c.kind = new.kind
      and (case
             when new.provider_id is not null then c.provider_id = new.provider_id
             when new.kind = 'other' then c.user_id = new.user_id and lower(c.title) = lower(new.title)
             else c.user_id = new.user_id and c.provider_id is null
           end);
    return new;
  end if;
  -- UPDATE: only ending a check and the reminder dates may change.
  if new.id <> old.id or new.user_id <> old.user_id or new.provider_id is distinct from old.provider_id
     or new.kind <> old.kind or new.title is distinct from old.title
     or new.method is distinct from old.method or new.checked_at <> old.checked_at
     or new.valid_until is distinct from old.valid_until
     or (new.document_id is distinct from old.document_id and new.document_id is not null) then
    raise exception 'Check details cannot be changed' using errcode = '42501';
  end if;
  if old.ended_at is not null and (new.ended_at is distinct from old.ended_at
                                   or new.end_reason is distinct from old.end_reason) then
    raise exception 'This check has already ended' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_person_check() from public, anon, authenticated;

create trigger person_checks_guard
  before insert or update on public.person_document_checks
  for each row execute function private.guard_person_check();

-- ---------------------------------------------------------------------------
-- 5. person_check_log
-- ---------------------------------------------------------------------------
create table public.person_check_log (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,      -- L6
  provider_id uuid references public.providers (id) on delete set null,
  document_id uuid references public.person_documents (id) on delete set null,
  check_id uuid references public.person_document_checks (id) on delete set null,
  action text not null check (action in (
    'uploaded', 'accepted', 'rejected', 'withdrawn', 'checked', 'check_ended', 'file_removed',
    'expired', 'document_opened', 'identifier_set', 'identifier_cleared', 'identifier_viewed',
    'identifier_read_refused', 'sample_set', 'sample_cleared')),
  actor uuid,                -- who did it; null for the sweep. No foreign key, so it survives.
  reason text check (char_length(reason) <= 300),
  field text check (field in ('nida', 'passport', 'tin', 'business_tin')),   -- never the value
  notice_version text check (char_length(notice_version) <= 40),
  created_at timestamptz not null default now()
);

create index person_check_log_user_idx on public.person_check_log (user_id, created_at desc);
create index person_check_log_actor_idx on public.person_check_log (actor, action, created_at desc);

alter table public.person_check_log enable row level security;

create policy "Admins read the check log" on public.person_check_log
  for select to authenticated
  using ((select private.is_admin()));

revoke all on public.person_check_log from public, anon, authenticated;
grant select on public.person_check_log to authenticated;

-- Log triggers (security definer: clients have no insert grant on the log).
create or replace function private.person_doc_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(current_setting('kwetuly.log_reason', true), '');
begin
  if tg_op = 'INSERT' then
    insert into public.person_check_log (user_id, provider_id, document_id, action, actor, notice_version)
    values (new.user_id, new.provider_id, new.id, 'uploaded', (select auth.uid()), new.notice_version);
    return null;
  end if;
  if new.review_state <> old.review_state then
    insert into public.person_check_log (user_id, provider_id, document_id, action, actor, reason)
    values (new.user_id, new.provider_id, new.id, new.review_state::text, (select auth.uid()),
            coalesce(new.review_reason, v_reason));
  end if;
  if new.removed_at is not null and old.removed_at is null then
    insert into public.person_check_log (user_id, provider_id, document_id, action, actor, reason)
    values (new.user_id, new.provider_id, new.id, 'file_removed', (select auth.uid()), 'retention');
  end if;
  return null;
end;
$$;

revoke execute on function private.person_doc_log() from public, anon, authenticated;

create trigger person_documents_log
  after insert or update on public.person_documents
  for each row execute function private.person_doc_log();

create or replace function private.person_check_log_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(current_setting('kwetuly.log_reason', true), '');
begin
  if tg_op = 'INSERT' then
    insert into public.person_check_log (user_id, provider_id, document_id, check_id, action, actor)
    values (new.user_id, new.provider_id, new.document_id, new.id, 'checked', (select auth.uid()));
  elsif new.ended_at is not null and old.ended_at is null then
    insert into public.person_check_log (user_id, provider_id, document_id, check_id, action, actor, reason)
    values (new.user_id, new.provider_id, new.document_id, new.id, 'check_ended', (select auth.uid()),
            coalesce(v_reason, new.end_reason));
  end if;
  return null;
end;
$$;

revoke execute on function private.person_check_log_trigger() from public, anon, authenticated;

create trigger person_checks_log
  after insert or update on public.person_document_checks
  for each row execute function private.person_check_log_trigger();

-- ---------------------------------------------------------------------------
-- 6. Encrypted identifiers
-- Each *_cipher is self-describing (M3): 1 byte key version || 12-byte random nonce || AES-256-GCM
-- ciphertext || 16-byte tag, with associated data "{subject id}|{field}". Each *_hmac is
-- HMAC-SHA256 under the key version stored beside it. Made and opened only in the `identifiers`
-- Edge Function. A plain (non-unique) index on the hashes: duplicates are shown to admins only.
-- ---------------------------------------------------------------------------
create table public.person_identifiers (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  nida_cipher bytea,
  nida_last3 text check (nida_last3 ~ '^[0-9A-Z]{3}$'),
  nida_hmac bytea,
  nida_hmac_version smallint,
  passport_cipher bytea,
  passport_last3 text check (passport_last3 ~ '^[0-9A-Z]{3}$'),
  passport_hmac bytea,
  passport_hmac_version smallint,
  passport_country char(2) check (passport_country ~ '^[A-Z]{2}$'),
  passport_valid_until date,
  tin_cipher bytea,
  tin_last3 text check (tin_last3 ~ '^[0-9A-Z]{3}$'),
  key_version smallint not null check (key_version between 1 and 255),   -- summary; the byte in each value counts
  notice_version text not null check (notice_version ~ '^[A-Za-z0-9._-]{1,40}$'),
  consented_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint person_ids_nida_set check (
    (nida_cipher is null and nida_last3 is null and nida_hmac is null and nida_hmac_version is null)
    or (octet_length(nida_cipher) > 29 and nida_last3 is not null
        and octet_length(nida_hmac) = 32 and nida_hmac_version between 1 and 255)),
  constraint person_ids_passport_set check (
    (passport_cipher is null and passport_last3 is null and passport_hmac is null
     and passport_hmac_version is null and passport_country is null and passport_valid_until is null)
    or (octet_length(passport_cipher) > 29 and passport_last3 is not null
        and octet_length(passport_hmac) = 32 and passport_hmac_version between 1 and 255
        and passport_country is not null)),
  constraint person_ids_tin_set check (
    (tin_cipher is null and tin_last3 is null)
    or (octet_length(tin_cipher) > 29 and tin_last3 is not null))
);

create index person_identifiers_nida_hmac_idx on public.person_identifiers (nida_hmac) where nida_hmac is not null;
create index person_identifiers_passport_hmac_idx on public.person_identifiers (passport_hmac) where passport_hmac is not null;

create table public.business_identifiers (
  provider_id uuid primary key references public.providers (id) on delete cascade,
  tin_cipher bytea not null check (octet_length(tin_cipher) > 29),
  tin_last3 text not null check (tin_last3 ~ '^[0-9A-Z]{3}$'),
  key_version smallint not null check (key_version between 1 and 255),
  notice_version text not null check (notice_version ~ '^[A-Za-z0-9._-]{1,40}$'),
  consented_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.person_identifiers enable row level security;
alter table public.business_identifiers enable row level security;
-- No policies and no grants for client roles: only service_role (the Edge Function) and the
-- security definer functions below touch these tables.
revoke all on public.person_identifiers from public, anon, authenticated;
revoke all on public.business_identifiers from public, anon, authenticated;

-- The owner's own view: last 3 characters, passport country and date. Never a cipher.
create or replace function public.my_identifiers()
returns table (nida_last3 text, passport_last3 text, passport_country text, passport_valid_until date,
               tin_last3 text, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.nida_last3, i.passport_last3, i.passport_country::text, i.passport_valid_until,
         i.tin_last3, i.updated_at
  from public.person_identifiers i
  where i.user_id = (select auth.uid());
$$;

revoke all on function public.my_identifiers() from public, anon;
grant execute on function public.my_identifiers() to authenticated;

-- Admins: masked values and a duplicate flag (same hash and hash version on another account).
create or replace function public.admin_identifiers_masked(p_user uuid)
returns table (nida_last3 text, nida_duplicate boolean, passport_last3 text, passport_country text,
               passport_valid_until date, passport_duplicate boolean, tin_last3 text,
               notice_version text, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
  select i.nida_last3,
         exists (select 1 from public.person_identifiers o
                 where o.user_id <> i.user_id and o.nida_hmac = i.nida_hmac
                   and o.nida_hmac_version = i.nida_hmac_version),
         i.passport_last3, i.passport_country::text, i.passport_valid_until,
         exists (select 1 from public.person_identifiers o
                 where o.user_id <> i.user_id and o.passport_hmac = i.passport_hmac
                   and o.passport_hmac_version = i.passport_hmac_version),
         i.tin_last3, i.notice_version, i.updated_at
  from public.person_identifiers i
  where i.user_id = p_user;
end;
$$;

create or replace function public.admin_business_identifiers_masked(p_provider uuid)
returns table (tin_last3 text, notice_version text, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
  select b.tin_last3, b.notice_version, b.updated_at
  from public.business_identifiers b where b.provider_id = p_provider;
end;
$$;

revoke all on function public.admin_identifiers_masked(uuid) from public, anon;
revoke all on function public.admin_business_identifiers_masked(uuid) from public, anon;
grant execute on function public.admin_identifiers_masked(uuid) to authenticated;
grant execute on function public.admin_business_identifiers_masked(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7a. Owner and admin actions on documents
-- ---------------------------------------------------------------------------

-- M2: the only owner change. Acts on the caller's waiting rows only and sets only the state.
create or replace function public.withdraw_my_document(p_document uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  update public.person_documents
  set review_state = 'withdrawn'
  where id = p_document and user_id = (select auth.uid()) and review_state = 'waiting';
  if not found then
    raise exception 'Only a document that is still waiting can be withdrawn' using errcode = '23514';
  end if;
end;
$$;

revoke all on function public.withdraw_my_document(uuid) from public, anon;
grant execute on function public.withdraw_my_document(uuid) to authenticated;

-- L4: accept (with its check) or reject, in one transaction. Two-step admin session required.
create or replace function public.admin_review_document(
  p_document uuid,
  p_decision text,               -- 'accept' or 'reject'
  p_valid_until date default null,
  p_method text default null,    -- 'nida_card' for identity; null for the others
  p_reason text default null,    -- required for reject
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.person_documents;
  v_check uuid;
begin
  if not private.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  select * into d from public.person_documents where id = p_document for update;
  if not found then
    raise exception 'Document not found' using errcode = 'P0002';
  end if;
  if d.user_id = (select auth.uid()) then
    raise exception 'Another admin must review your own documents' using errcode = '42501';
  end if;
  if d.review_state <> 'waiting' then
    raise exception 'This document has already been decided' using errcode = '23514';
  end if;
  if char_length(p_note) > 300 then
    raise exception 'Note too long' using errcode = '23514';
  end if;
  -- The guard masks digit runs and cuts the result to 300 characters (LA1).

  if p_decision = 'accept' then
    if not private.verification_object_exists(d.path, d.user_id) then
      raise exception 'The file is missing; reject it as unreadable' using errcode = '23514';
    end if;
    insert into public.person_document_checks (user_id, provider_id, kind, title, document_id, method, valid_until)
    values (d.user_id, d.provider_id, d.kind, d.title, d.id, p_method, p_valid_until)
    returning id into v_check;
    update public.person_documents
    set review_state = 'accepted', reviewed_at = now(), review_note = p_note
    where id = d.id;
    return v_check;
  elsif p_decision = 'reject' then
    if p_reason is null then
      raise exception 'Choose a reason' using errcode = '23514';
    end if;
    update public.person_documents
    set review_state = 'rejected', review_reason = p_reason, reviewed_at = now(), review_note = p_note
    where id = d.id;
    return null;
  end if;
  raise exception 'Unknown decision' using errcode = '22023';
end;
$$;

revoke all on function public.admin_review_document(uuid, text, date, text, text, text) from public, anon;
grant execute on function public.admin_review_document(uuid, text, date, text, text, text) to authenticated;

create or replace function public.admin_end_check(p_check uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 5 and 300 then
    raise exception 'Give a reason (5 to 300 characters)' using errcode = '23514';
  end if;
  perform set_config('kwetuly.log_reason', private.mask_digit_runs(p_reason), true);
  update public.person_document_checks
  set ended_at = now(), end_reason = 'withdrawn'
  where id = p_check and ended_at is null;
  if not found then
    raise exception 'No current check with this id' using errcode = 'P0002';
  end if;
  perform set_config('kwetuly.log_reason', '', true);
end;
$$;

revoke all on function public.admin_end_check(uuid, text) from public, anon;
grant execute on function public.admin_end_check(uuid, text) to authenticated;

-- M5 / L1: the admin action that makes a 60-second signed link calls this FIRST, with the admin's
-- own session, then signs the returned path with that same session (the storage select policy and
-- its aal2 check decide). The link is never stored.
create or replace function public.admin_log_document_opened(p_document uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.person_documents;
begin
  if not private.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  select * into d from public.person_documents where id = p_document;
  if not found or d.removed_at is not null then
    raise exception 'No file for this document' using errcode = 'P0002';
  end if;
  insert into public.person_check_log (user_id, provider_id, document_id, action, actor)
  values (d.user_id, d.provider_id, d.id, 'document_opened', (select auth.uid()));
  return d.path;
end;
$$;

revoke all on function public.admin_log_document_opened(uuid) from public, anon;
grant execute on function public.admin_log_document_opened(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7b. Service functions for the Edge Functions (service_role only)
-- The Edge Function verifies the caller's JWT and passes the verified id as p_actor (M5).
-- Errors are short codes; the Edge Function turns them into generic answers.
-- ---------------------------------------------------------------------------

-- Write (p_cipher not null) or clear (p_cipher null) one identifier of the actor themself.
-- Ciphers and hashes arrive base64-encoded. Rate limit: 10 writes per actor per 24 hours.
create or replace function public.svc_identifier_set(
  p_actor uuid,
  p_user uuid,
  p_provider uuid,
  p_field text,                 -- 'nida', 'passport', 'tin', 'business_tin'
  p_cipher text,
  p_last3 text,
  p_hmac text,
  p_hmac_version smallint,
  p_key_version smallint,
  p_country text,
  p_valid_until date,
  p_notice_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cipher bytea := decode(p_cipher, 'base64');
  v_hmac bytea := decode(p_hmac, 'base64');
begin
  if p_actor is null or p_actor is distinct from p_user then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_actor and p.onboarded_at is not null) then
    raise exception 'not_onboarded' using errcode = '42501';
  end if;
  if p_field not in ('nida', 'passport', 'tin', 'business_tin') then
    raise exception 'bad_field' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('identifier_write:' || p_actor::text));   -- LA8
  if (select count(*) from public.person_check_log l
      where l.actor = p_actor and l.action in ('identifier_set', 'identifier_cleared')
        and l.created_at > now() - interval '24 hours') >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  if v_cipher is not null and (p_key_version is null or get_byte(v_cipher, 0) <> p_key_version) then
    raise exception 'bad_cipher' using errcode = '22023';
  end if;

  if p_field = 'business_tin' then
    if p_provider is null or not exists (
         select 1 from public.providers p where p.id = p_provider and p.owner_id = p_actor) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if v_cipher is null then
      delete from public.business_identifiers where provider_id = p_provider;
    else
      insert into public.business_identifiers (provider_id, tin_cipher, tin_last3, key_version, notice_version)
      values (p_provider, v_cipher, p_last3, p_key_version, p_notice_version)
      on conflict (provider_id) do update
        set tin_cipher = excluded.tin_cipher, tin_last3 = excluded.tin_last3,
            key_version = excluded.key_version, notice_version = excluded.notice_version,
            consented_at = now(), updated_at = now();
    end if;
  else
    if p_provider is not null then
      raise exception 'bad_field' using errcode = '22023';
    end if;
    if v_cipher is null and not exists (select 1 from public.person_identifiers where user_id = p_user) then
      return;   -- nothing to clear
    end if;
    insert into public.person_identifiers (user_id, key_version, notice_version)
    values (p_user, coalesce(p_key_version, 1), coalesce(p_notice_version, 'none'))
    on conflict (user_id) do nothing;
    if p_field = 'nida' then
      update public.person_identifiers
      set nida_cipher = v_cipher, nida_last3 = p_last3, nida_hmac = v_hmac,
          nida_hmac_version = case when v_cipher is null then null else p_hmac_version end,
          key_version = coalesce(p_key_version, key_version),
          notice_version = coalesce(p_notice_version, notice_version),
          consented_at = case when v_cipher is null then consented_at else now() end,
          updated_at = now()
      where user_id = p_user;
    elsif p_field = 'passport' then
      update public.person_identifiers
      set passport_cipher = v_cipher, passport_last3 = p_last3, passport_hmac = v_hmac,
          passport_hmac_version = case when v_cipher is null then null else p_hmac_version end,
          passport_country = case when v_cipher is null then null else upper(p_country) end,
          passport_valid_until = case when v_cipher is null then null else p_valid_until end,
          key_version = coalesce(p_key_version, key_version),
          notice_version = coalesce(p_notice_version, notice_version),
          consented_at = case when v_cipher is null then consented_at else now() end,
          updated_at = now()
      where user_id = p_user;
    else
      update public.person_identifiers
      set tin_cipher = v_cipher, tin_last3 = p_last3,
          key_version = coalesce(p_key_version, key_version),
          notice_version = coalesce(p_notice_version, notice_version),
          consented_at = case when v_cipher is null then consented_at else now() end,
          updated_at = now()
      where user_id = p_user;
    end if;
  end if;

  insert into public.person_check_log (user_id, provider_id, action, actor, field, notice_version)
  values (p_user, p_provider, case when v_cipher is null then 'identifier_cleared' else 'identifier_set' end,
          p_actor, p_field, p_notice_version);
end;
$$;

revoke all on function public.svc_identifier_set(uuid, uuid, uuid, text, text, text, text, smallint, smallint, text, date, text)
  from public, anon, authenticated;
grant execute on function public.svc_identifier_set(uuid, uuid, uuid, text, text, text, text, smallint, smallint, text, date, text)
  to service_role;

-- M5: an admin full read. The log row is written in the same transaction that hands out the cipher,
-- so no cipher leaves the database without its identifier_viewed row. The Edge Function decrypts only
-- after this returns.
-- MA2: returns jsonb, {"cipher": "<base64>"} or {"error": "rate_limited" | "not_found"}. A refused
-- read does not raise, so its identifier_read_refused log row and the alert to every admin (once per
-- hour) commit. Rate limit: 20 reads per admin per hour, serialised per admin by an advisory lock (LA8).
create or replace function public.svc_identifier_cipher_for_read(
  p_actor uuid,
  p_actor_aal text,
  p_user uuid,
  p_provider uuid,
  p_field text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cipher bytea;
  v_admin uuid;
  v_alerted boolean;
begin
  if p_actor_aal is distinct from 'aal2'
     or not exists (select 1 from public.profiles p where p.id = p_actor and p.role = 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 5 and 300 then
    raise exception 'reason_required' using errcode = '23514';
  end if;
  if p_field = 'business_tin' then
    if p_provider is null then
      raise exception 'bad_field' using errcode = '22023';
    end if;
    select p.owner_id into p_user from public.providers p where p.id = p_provider;
  elsif p_field not in ('nida', 'passport', 'tin') or p_provider is not null then
    raise exception 'bad_field' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('identifier_read:' || p_actor::text));
  if (select count(*) from public.person_check_log l
      where l.actor = p_actor and l.action = 'identifier_viewed'
        and l.created_at > now() - interval '1 hour') >= 20 then
    select exists (select 1 from public.person_check_log l
                   where l.action = 'identifier_read_refused' and l.created_at > now() - interval '1 hour')
      into v_alerted;
    insert into public.person_check_log (user_id, provider_id, action, actor, reason, field)
    values (p_user, p_provider, 'identifier_read_refused', p_actor, 'rate_limited', p_field);
    if not v_alerted then
      for v_admin in select p.id from public.profiles p where p.role = 'admin' loop
        perform private.notify_user('identifier_read_limit', v_admin, '{}'::jsonb, null, array['email']);
      end loop;
    end if;
    return jsonb_build_object('error', 'rate_limited');
  end if;

  if p_field = 'business_tin' then
    select b.tin_cipher into v_cipher from public.business_identifiers b where b.provider_id = p_provider;
  else
    select case p_field when 'nida' then i.nida_cipher when 'passport' then i.passport_cipher else i.tin_cipher end
      into v_cipher
    from public.person_identifiers i where i.user_id = p_user;
  end if;
  if v_cipher is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  insert into public.person_check_log (user_id, provider_id, action, actor, reason, field)
  values (p_user, p_provider, 'identifier_viewed', p_actor, private.mask_digit_runs(btrim(p_reason)), p_field);
  return jsonb_build_object('cipher', encode(v_cipher, 'base64'));
end;
$$;

revoke all on function public.svc_identifier_cipher_for_read(uuid, text, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.svc_identifier_cipher_for_read(uuid, text, uuid, uuid, text, text) to service_role;

-- H2 / M11: the verification files to delete, with the reason. Never lists a waiting document's
-- file, nor old guide and business papers still referenced by guide_private or provider_private.
--
-- MA3, REQUIRED: every column, in any table, that stores a path in the `verification` bucket MUST be
-- added to `legacy` below in the same migration that creates it. Otherwise the 'no_row' rule deletes
-- those files within the hour. Run the sweep with {"dry_run": true} after any such migration.
create or replace function public.svc_verification_sweep_list(p_limit int default 500)
returns table (name text, reason text)
language sql
stable
security definer
set search_path = ''
as $$
  with objs as (
    select o.name, o.created_at, (storage.foldername(o.name))[1] as folder
    from storage.objects o
    where o.bucket_id = 'verification'
  ),
  legacy as (
    select unnest(array[g.id_document_path, g.license_document_path, g.first_aid_document_path]) as p
    from public.guide_private g
    union all
    select pp.licence_document_path from public.provider_private pp
  ),
  hits as (
    -- the owner's account is gone (deleted in the app or by an admin in the dashboard)
    select o.name, 'no_account'::text as reason
    from objs o
    where not exists (select 1 from public.profiles p where p.id::text = o.folder)
    union all
    -- uploaded but no document row after 24 hours, and not an old guide or business paper
    select o.name, 'no_row'
    from objs o
    where o.created_at < now() - interval '24 hours'
      and exists (select 1 from public.profiles p where p.id::text = o.folder)
      and not exists (select 1 from public.person_documents d where d.path = o.name)
      and not exists (select 1 from legacy l where l.p in (o.name, 'verification/' || o.name))
    union all
    -- decided (or expired unreviewed) and past the retention period
    select o.name, 'retention_' || d.review_state::text
    from objs o
    join public.person_documents d on d.path = o.name
    where d.review_state <> 'waiting'
      and coalesce(d.reviewed_at, d.uploaded_at)
          + make_interval(days => private.retention_days(d.review_state::text)) <= now()
  )
  select f.name, min(f.reason) from hits f group by f.name
  order by 1
  limit greatest(1, least(coalesce(p_limit, 500), 1000));
$$;

revoke all on function public.svc_verification_sweep_list(int) from public, anon, authenticated;
grant execute on function public.svc_verification_sweep_list(int) to service_role;

-- MA3: the size of the bucket, for the sweep's circuit breaker (no names).
create or replace function public.svc_verification_bucket_count()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) from storage.objects o where o.bucket_id = 'verification';
$$;

revoke all on function public.svc_verification_bucket_count() from public, anon, authenticated;
grant execute on function public.svc_verification_bucket_count() to service_role;

-- LA4: documents nobody reviewed within private.waiting_limit_days() become 'expired' (their file is
-- then swept). With p_dry_run it only counts. Returns the number of rows.
create or replace function public.svc_expire_stale_waiting(p_dry_run boolean default true)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if p_dry_run then
    select count(*) into v_count from public.person_documents d
    where d.review_state = 'waiting'
      and d.uploaded_at < now() - make_interval(days => private.waiting_limit_days());
    return v_count;
  end if;
  perform set_config('kwetuly.log_reason', 'not_reviewed_in_time', true);
  update public.person_documents d
  set review_state = 'expired'
  where d.review_state = 'waiting'
    and d.uploaded_at < now() - make_interval(days => private.waiting_limit_days());
  get diagnostics v_count = row_count;
  perform set_config('kwetuly.log_reason', '', true);
  return v_count;
end;
$$;

revoke all on function public.svc_expire_stale_waiting(boolean) from public, anon, authenticated;
grant execute on function public.svc_expire_stale_waiting(boolean) to service_role;

-- LA7: after the Edge Function deleted files, mark the rows (the row and its dates stay). Only rows
-- whose file is really gone from storage are marked, so removed_at is true when written. Also catches
-- decided rows past retention whose file disappeared some other way.
create or replace function public.svc_verification_sweep_mark(p_names text[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  update public.person_documents d
  set removed_at = now()
  where d.removed_at is null
    and d.review_state <> 'waiting'
    and (d.path = any (p_names)
         or coalesce(d.reviewed_at, d.uploaded_at)
            + make_interval(days => private.retention_days(d.review_state::text)) <= now())
    and not exists (select 1 from storage.objects o where o.bucket_id = 'verification' and o.name = d.path);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.svc_verification_sweep_mark(text[]) from public, anon, authenticated;
grant execute on function public.svc_verification_sweep_mark(text[]) to service_role;

-- MA3: the sweep stopped itself. Alerts every admin by email, at most once per 6 hours.
create or replace function public.svc_verification_sweep_halted()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid;
begin
  if exists (select 1 from public.notification_outbox o
             where o.event = 'verification_sweep_halted' and o.created_at > now() - interval '6 hours') then
    return;
  end if;
  for v_admin in select p.id from public.profiles p where p.role = 'admin' loop
    perform private.notify_user('verification_sweep_halted', v_admin, '{}'::jsonb, null, array['email']);
  end loop;
end;
$$;

revoke all on function public.svc_verification_sweep_halted() from public, anon, authenticated;
grant execute on function public.svc_verification_sweep_halted() to service_role;

-- ---------------------------------------------------------------------------
-- 8. Storage policies for the `verification` bucket
-- ---------------------------------------------------------------------------
-- M1: replaces "Owners delete their verification documents" (20261016000000).
drop policy if exists "Owners delete their verification documents" on storage.objects;
create policy "Owners delete their unreviewed verification files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'verification'
         and owner_id = (select auth.uid())::text
         and private.verification_path_deletable(name));

-- Same as 20261016001800, plus: a path that already has a document row can never be uploaded again.
drop policy if exists "Users upload own verification docs" on storage.objects;
create policy "Users upload own verification docs" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'verification'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select private.is_onboarded())
              and not private.verification_path_has_row(name));

-- ---------------------------------------------------------------------------
-- 9. Hourly sweep (H2). URL and key live in Vault, never in this file:
--   select vault.create_secret('https://<project>.supabase.co/functions/v1/verification-sweep', 'verification_sweep_url');
--   select vault.create_secret('<VERIFICATION_SWEEP_SECRET>', 'verification_sweep_key');
-- ---------------------------------------------------------------------------
create or replace function private.run_verification_sweep()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'verification_sweep_url');
  v_key text := (select decrypted_secret from vault.decrypted_secrets where name = 'verification_sweep_key');
begin
  if v_url is null or v_key is null then return; end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000);
end;
$$;

revoke execute on function private.run_verification_sweep() from public, anon, authenticated;

select cron.schedule('verification-sweep', '17 * * * *', 'select private.run_verification_sweep()');
