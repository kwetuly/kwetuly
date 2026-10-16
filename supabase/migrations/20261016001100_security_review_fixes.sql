-- Fixes from the 2026-10 security review (H3, M5, L1, L2, L7 and length limits).
--
-- Undo: re-run the previous definitions of guard_guide_admin_fields (20261014000600_guide_checks.sql),
-- guard_review_fields (20261013000200_guide_reviews.sql) and guard_payment (20261014000200_payments.sql);
-- drop trigger group_chats_guard and function public.guard_group_chat; drop the payout_by / payout_at
-- columns; drop the leads_*_length constraints; recreate the two dropped insert policies from
-- 20261012000000_initial_schema.sql. Nothing in this file deletes data.

-- ---------------------------------------------------------------------------
-- H3: guides cannot set their own rating summary.
-- 20261014000600_guide_checks.sql redefined this guard and lost the rating_avg / rating_count lines
-- from 20261013000200_guide_reviews.sql. This keeps everything the later version protects and adds
-- them back. The rating summary is written by private.refresh_guide_rating (security definer, trusted).
-- ---------------------------------------------------------------------------
create or replace function public.guard_guide_admin_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_trusted() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.verification_status := 'pending';
    new.verified_at := null;
    new.plan := 'msingi';
    new.plan_expires_at := null;
    new.identity_checked_at := null;
    new.licence_checked_at := null;
    new.first_aid_checked_at := null;
    new.first_aid_valid_until := null;
    new.rating_avg := null;
    new.rating_count := 0;
  else
    new.verification_status := old.verification_status;
    new.verified_at := old.verified_at;
    new.plan := old.plan;
    new.plan_expires_at := old.plan_expires_at;
    -- A guide may clear a check (new document uploaded), never set one.
    new.identity_checked_at := case when new.identity_checked_at is null then null else old.identity_checked_at end;
    new.licence_checked_at := case when new.licence_checked_at is null then null else old.licence_checked_at end;
    new.first_aid_checked_at := case when new.first_aid_checked_at is null then null else old.first_aid_checked_at end;
    new.first_aid_valid_until := case when new.first_aid_checked_at is null then null else old.first_aid_valid_until end;
    new.rating_avg := old.rating_avg;
    new.rating_count := old.rating_count;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- L1: the name shown on a review comes from the reviewer's profile, not from the browser or app.
-- Same format the clients used: first name and initial ("Anna K."), else "Traveller".
-- ---------------------------------------------------------------------------
create or replace function private.review_author_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select left(
       case when array_length(parts, 1) >= 2 then parts[1] || ' ' || left(parts[2], 1) || '.' else parts[1] end,
       80)
     from (
       select regexp_split_to_array(trim(p.full_name), '\s+') as parts
       from public.profiles p
       where p.id = p_user and nullif(trim(p.full_name), '') is not null
     ) s),
    'Traveller');
$$;

revoke execute on function private.review_author_name(uuid) from public, anon;
grant execute on function private.review_author_name(uuid) to authenticated;

create or replace function public.guard_review_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_trusted() then
    new.updated_at := now();
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.hidden := false;
    new.created_at := now();
  else
    new.guide_id := old.guide_id;
    new.author_id := old.author_id;
    new.hidden := old.hidden;
    new.created_at := old.created_at;
  end if;
  new.author_name := private.review_author_name(new.author_id);
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- M5: chat owners may rename a chat and change its invite link, nothing else.
-- Internal updates (last_message_at from private.touch_group_chat) run as the definer and are trusted.
-- ---------------------------------------------------------------------------
create or replace function public.guard_group_chat()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_trusted() then
    return new;
  end if;
  new.id := old.id;
  new.created_by := old.created_by;
  new.group_trip_id := old.group_trip_id;
  new.last_message_at := old.last_message_at;
  new.created_at := old.created_at;
  -- A new invite code must still be hard to guess.
  if new.invite_code is distinct from old.invite_code
     and (new.invite_code is null or length(new.invite_code) < 12 or new.invite_code !~ '^[A-Za-z0-9_-]+$') then
    raise exception 'Invite code must be at least 12 letters or digits';
  end if;
  return new;
end;
$$;

create trigger group_chats_guard
  before update on public.group_chats
  for each row execute function public.guard_group_chat();

-- ---------------------------------------------------------------------------
-- L2: service_bookings and investment_inquiries are not written by the website or the app.
-- Stop anonymous inserts (tables and other policies stay).
-- ---------------------------------------------------------------------------
drop policy if exists "Anyone can request a service booking" on public.service_bookings;
drop policy if exists "Anyone can send an inquiry" on public.investment_inquiries;

-- ---------------------------------------------------------------------------
-- L7: who marked a deposit as paid out, and when.
-- ---------------------------------------------------------------------------
alter table public.payments
  add column payout_by uuid references auth.users (id) on delete set null,
  add column payout_at timestamptz;

create or replace function public.guard_payment()
returns trigger language plpgsql set search_path = ''
as $$
declare
  v_payout boolean := new.payout_done;
begin
  -- Admins may only tick "paid out": the row is rebuilt from OLD except payout_done.
  if current_user in ('anon', 'authenticated') then
    new := old;
    new.payout_done := v_payout;
  end if;
  -- Record the last change of the payout tick, whoever made it.
  if new.payout_done is distinct from old.payout_done then
    new.payout_by := (select auth.uid());
    new.payout_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Length limits on enquiries (generous; the forms already cut shorter).
-- NOT VALID first so existing rows never block the migration, then validate when they fit.
-- interest_signups already has limits (name 120, contact 160, message 2000, business_name 120).
-- ---------------------------------------------------------------------------
alter table public.leads
  add constraint leads_traveler_name_length check (length(traveler_name) <= 120) not valid,
  add constraint leads_traveler_contact_length check (length(traveler_contact) <= 200) not valid,
  add constraint leads_message_length check (length(message) <= 4000) not valid;

do $$
declare
  c text;
begin
  foreach c in array array['leads_traveler_name_length', 'leads_traveler_contact_length', 'leads_message_length'] loop
    begin
      execute format('alter table public.leads validate constraint %I', c);
    exception when check_violation then
      raise notice '% : some older leads are longer than the limit; it applies to new rows only.', c;
    end;
  end loop;
end;
$$;
