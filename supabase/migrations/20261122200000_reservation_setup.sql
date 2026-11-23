-- NOT APPLIED. Slice 1 of docs/team/design-reservations-and-trip-record-2026-11-22.md: business setup for
-- reservations and the reservation commission rates. backend-engineer, 2026-11-22. Apply on live only
-- with Walter's yes, after security-reviewer and qa-tester (test project or local stack first).
-- Needs: 20261122000000_person_documents_identifiers.sql (person_document_checks, private.tz_today) on
-- the database first. Migration D (feature rules) is NOT needed: this file uses narrow helpers only.
--
-- Walter's direction (2026-11-22): build now; commission is RECORDED, nobody is ever charged by Kwetuly
-- from this code. Nothing here takes or moves money. One rate per business type, not per business.
--
-- What it does:
--   1. public.business_hours, public.business_closed_dates, public.business_services: when a
--      restaurant, spa or salon is open and what can be reserved (with the business's own listed price
--      in TZS, optional). No "at your place" option and no address column anywhere: no home visits.
--   2. public.price_list (design A.4 / PV 2.1, without rank, with rank_warning_ack_at/by for migration C)
--      and public.price_list_log (every save). Seeded with FOUR draft rows, every amount null:
--        business / restaurant / reservation_commission / once     = TZS per guest who came, with
--                                                                    max_guests_counted
--        business / spa        / reservation_commission / percent  = percent of the listed price
--        business / salon      / reservation_commission / percent  = percent of the listed price
--        business / (all types)/ reservation_unpriced_fee / once   = TZS per person for a spa or salon
--                                                                    service with no listed price
--      Walter types the numbers in /admin/prices and activates them; until then nobody can switch
--      reservations on. Only admins with a two-step session change prices, only through the admin_*
--      functions below; clients have no write grant. Active rows cannot be edited: a change is a new
--      version from a date, and activating it ends the previous one on that date. No backdating.
--   3. providers: takes_reservations, reservation_terms_version, reservation_terms_at,
--      reservation_min_notice_min, reservation_max_days, approved_business_type (the type Kwetuly
--      approved; backfilled for approved businesses). A guard trigger keeps the terms columns and the
--      approved type server-only, lets only the owner switch on, and refuses takes_reservations = true
--      unless every rule passes:
--        approved business, still of the approved type; type restaurant, spa or salon; current terms accepted; opening hours set;
--        spa (spa and massage): a current business_licence check by Kwetuly; an active commission rate
--        for the type; spa and salon: at least one active service that has a rate (a priced service
--        with the percent rate, or an unpriced one with the per-person fee).
--      The full rules are checked again by private.provider_open_for_reservations() (the rate shown to
--      visitors now; the booking function in slice 2), so a licence that expires, a rate that ends or
--      hours that are removed close reservations that day. Public read policies use the cheap
--      private.provider_takes_reservations() (switched on, approved, approved type).
--   4. Functions for the owner screens (frontend-engineer): reservation_setup_status,
--      accept_reservation_terms, set_takes_reservations, set_business_hours, reservation_rate,
--      business_closed_dates_with_notes. Closed dates and services are plain table writes under RLS.
--   5. Functions for /admin/prices: admin_price_rows, admin_price_log, admin_save_price_draft,
--      admin_activate_price, admin_new_price_version, admin_end_price.
--
-- Access rules:
--   business_hours, business_closed_dates, business_services: anyone reads rows of a business that is
--     open for reservations (services: active ones only); the owner reads and writes his own; admins
--     (two-step) all. Column grants: provider_id cannot be changed after insert. Closed-date notes are
--     not readable by the public (column grant); the owner reads them through a function.
--   price_list: anyone reads ACTIVE rows, without the admin note; admins read all through
--     admin_price_rows(). No client insert, update or delete grant at all.
--   price_list_log: admins read; only the trigger writes; no update, delete or truncate for anyone.
--   price_list rows are never deleted (drafts included) and cannot be truncated.
--   Security definer functions: search_path = '', execute revoked from public; granted only to the
--     roles named next to each.
--
-- [legal] placeholders: the terms version '2026-11-22-draft' (private.reservation_terms_version(),
-- mirrored in packages/shared/src/reservations.ts), the spa licence rule, the disclosure wording.
--
-- Undo (before any reservation exists; dropping the tables deletes hours, services and prices):
--   drop trigger providers_reservations_guard on public.providers;
--   drop function public.admin_end_price(uuid, date), public.admin_new_price_version(uuid),
--     public.admin_activate_price(uuid), public.admin_save_price_draft(uuid, integer, numeric, integer, date, text),
--     public.admin_price_log(integer), public.admin_price_rows(), public.reservation_rate(uuid, uuid),
--     public.set_business_hours(uuid, jsonb), public.set_takes_reservations(uuid, boolean),
--     public.accept_reservation_terms(uuid, text), public.reservation_setup_status(uuid),
--     public.business_closed_dates_with_notes(uuid),
--     private.guard_provider_reservations(), private.provider_open_for_reservations(uuid),
--     private.provider_takes_reservations(uuid), private.price_list_log_append_only(),
--     private.reservation_blockers(uuid, text, public.review_status, text, text),
--     private.reservation_rate_for(text, uuid, uuid), private.price_list_guard(), private.price_list_log_row(),
--     private.guard_business_hours(), private.guard_business_rows(), private.owns_provider(uuid),
--     private.reservation_terms_version();
--   drop trigger price_list_log_no_change on public.price_list_log; (and the two no_truncate triggers)
--   drop table public.price_list_log, public.price_list, public.business_services,
--     public.business_closed_dates, public.business_hours;
--   drop type public.priced_account_type;   -- only if migration C has not used it
--   alter table public.providers drop column takes_reservations, drop column reservation_terms_version,
--     drop column reservation_terms_at, drop column reservation_min_notice_min, drop column reservation_max_days,
--     drop column approved_business_type;

-- ---------------------------------------------------------------------------
-- 0. Small helpers
-- ---------------------------------------------------------------------------
create or replace function private.reservation_terms_version()
returns text
language sql
immutable
set search_path = ''
as $$
  select '2026-11-22-draft'::text;
$$;
comment on function private.reservation_terms_version() is
  'Current reservation terms for businesses. [legal] placeholder. Mirrored in packages/shared/src/reservations.ts.';
revoke execute on function private.reservation_terms_version() from public;
grant execute on function private.reservation_terms_version() to anon, authenticated;

-- True when the signed-in person owns this business. Used by the RLS policies below.
create or replace function private.owns_provider(p_provider uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.providers p
    where p.id = p_provider and p.owner_id = (select auth.uid())
  );
$$;
revoke execute on function private.owns_provider(uuid) from public;
grant execute on function private.owns_provider(uuid) to anon, authenticated;   -- anon: read policies (always false)

-- ---------------------------------------------------------------------------
-- 1. Providers: the switch, the terms and two reservation rules
-- ---------------------------------------------------------------------------
alter table public.providers
  add column if not exists takes_reservations boolean not null default false,
  add column if not exists reservation_terms_version text,
  add column if not exists reservation_terms_at timestamptz,
  add column if not exists reservation_min_notice_min integer not null default 120,
  add column if not exists reservation_max_days integer not null default 60,
  -- The business type Kwetuly approved (security review M1). Set only by trusted callers (admins,
  -- server code) by providers_reservations_guard; owners cannot write it. Reservations need
  -- business_type = approved_business_type, so an owner cannot approve as a hotel and then take
  -- reservations as an unchecked spa.
  add column if not exists approved_business_type text;

comment on column public.providers.approved_business_type is
  'Business type at Kwetuly''s approval. Set by trusted callers only (guard). Reservations need business_type to match.';

-- Backfill for businesses approved before this migration (touches updated_at of those rows).
update public.providers
set approved_business_type = business_type
where verification_status = 'approved' and approved_business_type is null;

alter table public.providers drop constraint if exists providers_reservation_rules;
alter table public.providers add constraint providers_reservation_rules check (
  reservation_min_notice_min between 30 and 2880
  and reservation_max_days between 1 and 180
  and (reservation_terms_version is null or char_length(reservation_terms_version) <= 40)
  and ((reservation_terms_version is null) = (reservation_terms_at is null)));

-- ---------------------------------------------------------------------------
-- 2. Opening hours, closed dates, services
-- ---------------------------------------------------------------------------
create table if not exists public.business_hours (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),   -- 0 Sunday .. 6 Saturday
  opens time not null,
  closes time not null,
  created_at timestamptz not null default now(),
  constraint business_hours_order check (closes > opens)        -- no overnight hours in version 1
);
create index if not exists business_hours_provider_idx on public.business_hours (provider_id, weekday);
comment on table public.business_hours is
  'Opening hours per weekday (0 Sunday). Up to 3 periods per day, no overlap, no overnight. Tanzania time.';

create table if not exists public.business_closed_dates (
  provider_id uuid not null references public.providers (id) on delete cascade,
  day date not null,
  note text check (note is null or (char_length(note) <= 80 and note !~ '[0-9]{6,}' and note !~* '(https?://|www\.)')),
  created_at timestamptz not null default now(),
  primary key (provider_id, day)
);

create table if not exists public.business_services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80
                            and name !~ '[0-9]{6,}' and name !~* '(https?://|www\.|@)'),
  duration_min integer not null default 90 check (duration_min between 15 and 480),
  price_tzs integer check (price_tzs is null or price_tzs between 100 and 50000000),
  max_people integer not null default 1 check (max_people between 1 and 50),
  -- Optional group discount, set by the owner (Walter 2026-11-23): from this many people, each
  -- person's price is lower by this percent. price_tzs stays the price per person.
  group_discount_min_people integer check (group_discount_min_people between 2 and 20),
  group_discount_percent integer check (group_discount_percent between 1 and 50),
  active boolean not null default true,
  sort integer not null default 0 check (sort between 0 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_services_group_discount check (
    (group_discount_min_people is null) = (group_discount_percent is null)
    and (group_discount_min_people is null or (price_tzs is not null and group_discount_min_people <= max_people)))
);
create index if not exists business_services_provider_idx on public.business_services (provider_id, sort);
comment on table public.business_services is
  'What can be reserved at a restaurant, spa or salon. price_tzs is the business''s own listed price per person (null = price on request), with an optional group discount. No home visits.';
-- For a test database that already has the table from an earlier draft of this file.
alter table public.business_services
  add column if not exists group_discount_min_people integer check (group_discount_min_people between 2 and 20),
  add column if not exists group_discount_percent integer check (group_discount_percent between 1 and 50);

drop trigger if exists business_services_updated_at on public.business_services;
create trigger business_services_updated_at
  before update on public.business_services
  for each row execute function public.set_updated_at();

-- Hours: at most 3 periods per day, no overlapping periods.
create or replace function private.guard_business_hours()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('business_hours:' || new.provider_id::text, 0));
  if (select count(*) from public.business_hours h
      where h.provider_id = new.provider_id and h.weekday = new.weekday and h.id <> new.id) >= 3 then
    raise exception 'At most 3 opening periods per day' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.business_hours h
             where h.provider_id = new.provider_id and h.weekday = new.weekday and h.id <> new.id
               and h.opens < new.closes and new.opens < h.closes) then
    raise exception 'Opening periods on the same day overlap' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
drop trigger if exists business_hours_guard on public.business_hours;
create trigger business_hours_guard
  before insert or update on public.business_hours
  for each row execute function private.guard_business_hours();

-- Closed dates and services: row limits per business; client inserts of closed dates are today to a
-- year ahead (Tanzania date).
create or replace function private.guard_business_rows()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_client boolean := current_user in ('anon', 'authenticated');
begin
  perform pg_advisory_xact_lock(hashtextextended(tg_table_name || ':' || new.provider_id::text, 0));
  if tg_table_name = 'business_closed_dates' then
    if tg_op = 'INSERT' and v_client
       and (new.day < private.tz_today() or new.day > private.tz_today() + 366) then
      raise exception 'Closed dates can be set from today up to one year ahead' using errcode = 'check_violation';
    end if;
    if tg_op = 'INSERT' and (select count(*) from public.business_closed_dates d
                             where d.provider_id = new.provider_id and d.day >= private.tz_today()) >= 120 then
      raise exception 'Too many closed dates' using errcode = 'check_violation';
    end if;
  elsif tg_table_name = 'business_services' then
    if tg_op = 'INSERT' and (select count(*) from public.business_services s
                             where s.provider_id = new.provider_id) >= 40 then
      raise exception 'At most 40 services per business' using errcode = 'check_violation';
    end if;
    new.name := btrim(new.name);
  end if;
  return new;
end;
$$;
drop trigger if exists business_closed_dates_guard on public.business_closed_dates;
create trigger business_closed_dates_guard
  before insert or update on public.business_closed_dates
  for each row execute function private.guard_business_rows();
drop trigger if exists business_services_guard on public.business_services;
create trigger business_services_guard
  before insert or update on public.business_services
  for each row execute function private.guard_business_rows();

-- ---------------------------------------------------------------------------
-- 3. Price list (A.4) and its log
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'priced_account_type') then
    create type public.priced_account_type as enum ('porter', 'cook', 'driver', 'assistant_guide', 'guide', 'business');
  end if;
end;
$$;

create table if not exists public.price_list (
  id uuid primary key default gen_random_uuid(),
  account_type public.priced_account_type not null,
  business_type text check (business_type in ('hotel', 'lodge', 'homestay', 'hostel', 'rental', 'curio_shop',
    'gem_shop', 'gear_rental', 'transport', 'car_hire', 'restaurant', 'spa', 'salon', 'nightlife', 'other')),
  -- Fixed list (PV 2.2): a new service needs a code change. Migration C extends this check.
  service_code text not null check (service_code in ('reservation_commission', 'reservation_unpriced_fee')),
  period text not null check (period in ('month', 'year', 'once', 'percent')),
  amount_tzs integer check (amount_tzs is null or amount_tzs between 1 and 100000000),
  percent numeric(5, 2) check (percent is null or (percent > 0 and percent <= 50)),
  max_guests_counted integer check (max_guests_counted is null or max_guests_counted between 1 and 100),
  active_from date,
  active_to date,
  status text not null default 'draft' check (status in ('draft', 'active', 'legal_hold')),
  note text check (note is null or char_length(note) <= 300),
  rank_warning_ack_at timestamptz,
  rank_warning_ack_by uuid,   -- no foreign key: deleting an admin account must not rewrite price rows
  created_by uuid,            -- no foreign key, as above
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_list_value_matches_period check (
    (period = 'percent' and amount_tzs is null) or (period <> 'percent' and percent is null)),
  constraint price_list_business_type_only_for_business check (account_type = 'business' or business_type is null),
  constraint price_list_reservation_shape check (
    service_code not in ('reservation_commission', 'reservation_unpriced_fee')
    or (account_type = 'business'
        and (amount_tzs is null or amount_tzs <= 200000)
        and (service_code <> 'reservation_commission'
             or (business_type in ('restaurant', 'spa', 'salon') and period in ('once', 'percent')))
        and (service_code <> 'reservation_unpriced_fee'
             or ((business_type is null or business_type in ('spa', 'salon')) and period = 'once')))),
  constraint price_list_max_guests_only_per_guest check (
    max_guests_counted is null or (service_code = 'reservation_commission' and period = 'once')),
  constraint price_list_active_is_complete check (
    status <> 'active' or ((amount_tzs is not null or percent is not null) and active_from is not null)),
  constraint price_list_dates check (active_to is null or (active_from is not null and active_to > active_from))
);
create index if not exists price_list_key_idx on public.price_list (account_type, business_type, service_code, status);
comment on table public.price_list is
  'Kwetuly prices and commission rates (TZS or percent). amount null = not set. Admins (two-step) write through admin_* functions; anyone reads active rows. Reservation commission is recorded only; Kwetuly charges nobody from this table.';
comment on column public.price_list.amount_tzs is
  'reservation_commission with period once: TZS per guest who came. reservation_unpriced_fee: TZS per person served.';
comment on column public.price_list.max_guests_counted is
  'reservation_commission per guest only: guests counted up to this number per reservation.';

create table if not exists public.price_list_log (
  id bigint generated always as identity primary key,
  price_id uuid references public.price_list (id),   -- price rows are never deleted (guard)
  action text not null check (action in ('created', 'edited', 'activated', 'ended', 'status_changed')),
  actor uuid,   -- who saved it; no foreign key, so the record survives a deleted admin account
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index if not exists price_list_log_price_idx on public.price_list_log (price_id, created_at desc);

-- The log is append-only for everyone, server code included (security review L5).
create or replace function private.price_list_log_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Prices and the price log cannot be removed or rewritten' using errcode = 'P0001';
end;
$$;
revoke execute on function private.price_list_log_append_only() from public;
drop trigger if exists price_list_log_no_change on public.price_list_log;
create trigger price_list_log_no_change
  before update or delete on public.price_list_log
  for each row execute function private.price_list_log_append_only();
drop trigger if exists price_list_log_no_truncate on public.price_list_log;
create trigger price_list_log_no_truncate
  before truncate on public.price_list_log
  for each statement execute function private.price_list_log_append_only();

-- Same key = same rate: (account, business type, service, period); reservation rates ignore the
-- period, so a type cannot have a per-guest and a percent rate at the same time.
create or replace function private.price_list_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_today date := private.tz_today();
  v_reservation boolean;
begin
  -- Price rows are never deleted, drafts included: every row has log entries (security review L5).
  if tg_op = 'DELETE' then
    raise exception 'Prices are never deleted. End an active price or leave the draft unused.' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'active' then
      raise exception 'A new price starts as a draft' using errcode = 'P0001';
    end if;
  else
    if old.status = 'active' then
      if (new.account_type, new.business_type, new.service_code, new.period, new.amount_tzs, new.percent,
          new.max_guests_counted, new.active_from, new.status, new.created_by, new.created_at)
         is distinct from
         (old.account_type, old.business_type, old.service_code, old.period, old.amount_tzs, old.percent,
          old.max_guests_counted, old.active_from, old.status, old.created_by, old.created_at) then
        raise exception 'An active price cannot be changed. Make a new version from a date.' using errcode = 'P0001';
      end if;
      if new.active_to is distinct from old.active_to then
        if old.active_to is not null and old.active_to <= v_today then
          raise exception 'This price has already ended' using errcode = 'P0001';
        end if;
        if new.active_to is null or new.active_to < v_today then
          raise exception 'An end date must be today or later' using errcode = 'P0001';
        end if;
      end if;
    elsif old.status = 'legal_hold' and new.status = 'active' then
      raise exception 'A price on legal hold cannot be activated in the same save' using errcode = 'P0001';
    end if;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;

  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active' or new.active_to is distinct from old.active_to) then
    v_reservation := new.service_code in ('reservation_commission', 'reservation_unpriced_fee');
    perform pg_advisory_xact_lock(hashtextextended(
      'price_list:' || new.account_type::text || ':' || coalesce(new.business_type, '*') || ':' || new.service_code, 0));
    if exists (
      select 1 from public.price_list o
      where o.id <> new.id and o.status = 'active'
        and o.account_type = new.account_type
        and o.business_type is not distinct from new.business_type
        and o.service_code = new.service_code
        and (v_reservation or o.period = new.period)
        and daterange(o.active_from, o.active_to, '[)') && daterange(new.active_from, new.active_to, '[)')) then
      raise exception 'Another active price for the same service covers these dates' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists price_list_guard on public.price_list;
create trigger price_list_guard
  before insert or update or delete on public.price_list
  for each row execute function private.price_list_guard();
drop trigger if exists price_list_no_truncate on public.price_list;
create trigger price_list_no_truncate
  before truncate on public.price_list
  for each statement execute function private.price_list_log_append_only();

create or replace function private.price_list_log_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_before jsonb;
  v_after jsonb;
begin
  v_after := jsonb_build_object('status', new.status, 'amount_tzs', new.amount_tzs, 'percent', new.percent,
    'max_guests_counted', new.max_guests_counted, 'active_from', new.active_from, 'active_to', new.active_to,
    'note', new.note);
  if tg_op = 'INSERT' then
    v_action := 'created';
  else
    v_before := jsonb_build_object('status', old.status, 'amount_tzs', old.amount_tzs, 'percent', old.percent,
      'max_guests_counted', old.max_guests_counted, 'active_from', old.active_from, 'active_to', old.active_to,
      'note', old.note);
    if v_before = v_after then
      return null;
    end if;
    v_action := case
      when new.status = 'active' and old.status <> 'active' then 'activated'
      when new.active_to is distinct from old.active_to then 'ended'
      when new.status <> old.status then 'status_changed'
      else 'edited' end;
  end if;
  insert into public.price_list_log (price_id, action, actor, before, after)
  values (new.id, v_action, (select auth.uid()), v_before, v_after);
  return null;
end;
$$;
revoke execute on function private.price_list_log_row() from public;
drop trigger if exists price_list_log on public.price_list;
create trigger price_list_log
  after insert or update on public.price_list
  for each row execute function private.price_list_log_row();

-- Seed: four draft rows, every value null (no amount is ever seeded). Walter fills them in.
insert into public.price_list (account_type, business_type, service_code, period, note)
select 'business', x.business_type, x.service_code, x.period, null
from (values
  ('restaurant', 'reservation_commission', 'once'),
  ('spa', 'reservation_commission', 'percent'),
  ('salon', 'reservation_commission', 'percent'),
  (null, 'reservation_unpriced_fee', 'once')
) as x(business_type, service_code, period)
where not exists (
  select 1 from public.price_list p
  where p.account_type = 'business' and p.business_type is not distinct from x.business_type
    and p.service_code = x.service_code);

-- ---------------------------------------------------------------------------
-- 4. Rates and the "take reservations" rules
-- ---------------------------------------------------------------------------
-- The commission basis for a business type, and for one service when given.
--   per_guest  : restaurant rate, amount_tzs per guest who came, up to max_guests_counted
--   percent    : percent of the service's listed price (no service given: the type's percent)
--   per_person : a service with no listed price, amount_tzs per person served
-- Returns no row when no rate applies (then nothing can be reserved).
create or replace function private.reservation_rate_for(p_business_type text, p_provider uuid, p_service uuid)
returns table (kind text, amount_tzs integer, percent numeric, max_guests_counted integer, price_list_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := private.tz_today();
  r record;
  u record;
  v_price integer;
begin
  if p_business_type is null or p_business_type not in ('restaurant', 'spa', 'salon') then
    return;
  end if;
  select pl.id, pl.period, pl.amount_tzs, pl.percent, pl.max_guests_counted into r
  from public.price_list pl
  where pl.account_type = 'business' and pl.business_type = p_business_type
    and pl.service_code = 'reservation_commission' and pl.status = 'active'
    and pl.active_from <= v_today and (pl.active_to is null or pl.active_to > v_today)
  order by pl.active_from desc
  limit 1;
  if not found then
    return;
  end if;

  if p_service is not null then
    select s.price_tzs into v_price
    from public.business_services s
    where s.id = p_service and s.provider_id = p_provider and s.active;
    if not found then
      return;
    end if;
  end if;

  if r.period = 'percent' then
    if p_service is null or v_price is not null then
      return query select 'percent'::text, null::integer, r.percent, null::integer, r.id;
      return;
    end if;
    select pl.id, pl.amount_tzs into u
    from public.price_list pl
    where pl.account_type = 'business' and pl.service_code = 'reservation_unpriced_fee' and pl.status = 'active'
      and (pl.business_type = p_business_type or pl.business_type is null)
      and pl.active_from <= v_today and (pl.active_to is null or pl.active_to > v_today)
    order by (pl.business_type is null), pl.active_from desc
    limit 1;
    if found and u.amount_tzs is not null then
      return query select 'per_person'::text, u.amount_tzs, null::numeric, null::integer, u.id;
    end if;
    return;
  end if;

  if r.amount_tzs is not null then
    return query select 'per_guest'::text, r.amount_tzs, null::numeric, r.max_guests_counted, r.id;
  end if;
end;
$$;
revoke execute on function private.reservation_rate_for(text, uuid, uuid) from public;
grant execute on function private.reservation_rate_for(text, uuid, uuid) to anon, authenticated, service_role;

-- Every reason a business cannot take reservations today, as fixed codes (empty = it can).
-- Takes the type, status, approved type and terms as arguments so the providers guard can pass the
-- values it trusts (OLD status for client callers, security review L2).
create or replace function private.reservation_blockers(
  p_provider uuid, p_business_type text, p_status public.review_status, p_approved_type text, p_terms text)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  b text[] := '{}';
  v_kind text;
  v_active integer;
  v_rateable integer;
begin
  if p_status is distinct from 'approved' then
    b := array_append(b, 'not_approved');
  elsif p_business_type is distinct from p_approved_type then
    -- Approved as another type (security review M1): Kwetuly has not checked this type.
    b := array_append(b, 'type_not_approved');
  end if;
  if p_business_type is null or p_business_type not in ('restaurant', 'spa', 'salon') then
    return array_append(b, 'type_not_reservable');
  end if;
  if p_terms is distinct from private.reservation_terms_version() then
    b := array_append(b, 'terms_not_accepted');
  end if;
  if not exists (select 1 from public.business_hours h where h.provider_id = p_provider) then
    b := array_append(b, 'no_opening_hours');
  end if;
  -- Spa and massage: licensed premises only (P8). A current check = not ended, valid today.
  if p_business_type = 'spa' and not exists (
       select 1 from public.person_document_checks c
       where c.provider_id = p_provider and c.kind = 'business_licence'
         and c.ended_at is null and c.valid_until >= private.tz_today()) then
    b := array_append(b, 'licence_check_missing');
  end if;

  select r.kind into v_kind from private.reservation_rate_for(p_business_type, p_provider, null) r limit 1;
  if v_kind is null then
    return array_append(b, 'no_commission_rate');
  end if;

  select count(*),
         count(*) filter (where exists (select 1 from private.reservation_rate_for(p_business_type, p_provider, s.id)))
    into v_active, v_rateable
  from public.business_services s
  where s.provider_id = p_provider and s.active;
  if p_business_type in ('spa', 'salon') then
    if v_active = 0 then
      b := array_append(b, 'no_service');
    elsif v_rateable = 0 then
      b := array_append(b, 'service_needs_price');
    end if;
  elsif v_kind <> 'per_guest' and v_rateable = 0 then
    b := array_append(b, 'service_needs_price');
  end if;
  return b;
end;
$$;
revoke execute on function private.reservation_blockers(uuid, text, public.review_status, text, text) from public;
grant execute on function private.reservation_blockers(uuid, text, public.review_status, text, text) to authenticated, service_role;

-- Open for reservations today: switched on AND every rule still passes (licence, rate, hours, ...).
-- The full check. Slice 2's booking function must call this; the public read policies use the cheap
-- private.provider_takes_reservations() below instead (security review L4).
create or replace function private.provider_open_for_reservations(p_provider uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p.takes_reservations
       and cardinality(private.reservation_blockers(p.id, p.business_type, p.verification_status,
                                                    p.approved_business_type, p.reservation_terms_version)) = 0
    from public.providers p
    where p.id = p_provider), false);
$$;
revoke execute on function private.provider_open_for_reservations(uuid) from public;
grant execute on function private.provider_open_for_reservations(uuid) to anon, authenticated, service_role;

-- Cheap check for read policies: switched on, approved, and still the approved type.
create or replace function private.provider_takes_reservations(p_provider uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.providers p
    where p.id = p_provider and p.takes_reservations and p.verification_status = 'approved'
      and p.business_type = p.approved_business_type);
$$;
revoke execute on function private.provider_takes_reservations(uuid) from public;
grant execute on function private.provider_takes_reservations(uuid) to anon, authenticated;

-- Guard on providers (security invoker: current_user is the caller's role).
--   * Clients never write the terms columns (only accept_reservation_terms() does) nor
--     approved_business_type. Trusted callers (admins, server code) set approved_business_type
--     automatically when a business becomes approved or an approved business changes type.
--   * Switching on is refused while a rule fails, for every caller. For client callers the rules use
--     the OLD status and approved type (L2), and only the owner may switch on directly (L1); admins
--     switch off only.
create or replace function private.guard_provider_reservations()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_client boolean := current_user in ('anon', 'authenticated');
  v_status public.review_status;
  v_approved text;
  v_blockers text[];
begin
  if v_client then
    if tg_op = 'INSERT' then
      new.takes_reservations := false;
      new.reservation_terms_version := null;
      new.reservation_terms_at := null;
    else
      new.reservation_terms_version := old.reservation_terms_version;
      new.reservation_terms_at := old.reservation_terms_at;
    end if;
  end if;

  if not private.is_trusted() then
    new.approved_business_type := case when tg_op = 'INSERT' then null else old.approved_business_type end;
  elsif new.verification_status = 'approved'
        and (tg_op = 'INSERT' or old.verification_status is distinct from 'approved'
             or new.business_type is distinct from old.business_type) then
    new.approved_business_type := new.business_type;
  end if;

  if new.business_type not in ('restaurant', 'spa', 'salon') then
    new.takes_reservations := false;
  end if;

  if new.takes_reservations and (tg_op = 'INSERT' or not old.takes_reservations) then
    if v_client then
      if tg_op = 'INSERT' or old.owner_id is distinct from (select auth.uid()) then
        raise exception 'Only the owner can switch reservations on' using errcode = '42501';
      end if;
      v_status := old.verification_status;
      v_approved := old.approved_business_type;
    else
      v_status := new.verification_status;
      v_approved := new.approved_business_type;
    end if;
    v_blockers := private.reservation_blockers(new.id, new.business_type, v_status, v_approved,
                                               new.reservation_terms_version);
    if cardinality(v_blockers) > 0 then
      raise exception 'reservations_blocked: %', array_to_string(v_blockers, ',') using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists providers_reservations_guard on public.providers;
create trigger providers_reservations_guard
  before insert or update on public.providers
  for each row execute function private.guard_provider_reservations();

-- ---------------------------------------------------------------------------
-- 5. RLS and grants on the business tables
-- ---------------------------------------------------------------------------
alter table public.business_hours enable row level security;
alter table public.business_closed_dates enable row level security;
alter table public.business_services enable row level security;
alter table public.price_list enable row level security;
alter table public.price_list_log enable row level security;

revoke all on public.business_hours, public.business_closed_dates, public.business_services,
  public.price_list, public.price_list_log from anon, authenticated;

grant select on public.business_hours, public.business_services to anon, authenticated;
-- Closed dates: the note is the owner's own (security review L3). Visitors and other members read the
-- dates only; the owner and admins read notes through public.business_closed_dates_with_notes().
grant select (provider_id, day, created_at) on public.business_closed_dates to anon, authenticated;
grant insert (provider_id, weekday, opens, closes), update (weekday, opens, closes), delete
  on public.business_hours to authenticated;
grant insert (provider_id, day, note), update (note), delete on public.business_closed_dates to authenticated;
grant insert (provider_id, name, duration_min, price_tzs, max_people, group_discount_min_people,
              group_discount_percent, active, sort),
  update (name, duration_min, price_tzs, max_people, group_discount_min_people, group_discount_percent,
          active, sort), delete
  on public.business_services to authenticated;

-- price_list: active rows for everyone, without the admin note and author columns.
grant select (id, account_type, business_type, service_code, period, amount_tzs, percent, max_guests_counted,
              active_from, active_to, status)
  on public.price_list to anon, authenticated;
grant select on public.price_list_log to authenticated;

drop policy if exists "Anyone reads hours of reserving businesses" on public.business_hours;
create policy "Anyone reads hours of reserving businesses" on public.business_hours
  for select to anon, authenticated
  using ((select private.provider_takes_reservations(provider_id))
         or (select private.owns_provider(provider_id)) or (select private.is_admin()));
drop policy if exists "Owners and admins write hours" on public.business_hours;
create policy "Owners and admins write hours" on public.business_hours
  for all to authenticated
  using ((select private.owns_provider(provider_id)) or (select private.is_admin()))
  with check ((select private.owns_provider(provider_id)) or (select private.is_admin()));

drop policy if exists "Anyone reads closed dates of reserving businesses" on public.business_closed_dates;
create policy "Anyone reads closed dates of reserving businesses" on public.business_closed_dates
  for select to anon, authenticated
  using ((select private.provider_takes_reservations(provider_id))
         or (select private.owns_provider(provider_id)) or (select private.is_admin()));
drop policy if exists "Owners and admins write closed dates" on public.business_closed_dates;
create policy "Owners and admins write closed dates" on public.business_closed_dates
  for all to authenticated
  using ((select private.owns_provider(provider_id)) or (select private.is_admin()))
  with check ((select private.owns_provider(provider_id)) or (select private.is_admin()));

drop policy if exists "Anyone reads active services of reserving businesses" on public.business_services;
create policy "Anyone reads active services of reserving businesses" on public.business_services
  for select to anon, authenticated
  using ((active and (select private.provider_takes_reservations(provider_id)))
         or (select private.owns_provider(provider_id)) or (select private.is_admin()));
drop policy if exists "Owners and admins write services" on public.business_services;
create policy "Owners and admins write services" on public.business_services
  for all to authenticated
  using ((select private.owns_provider(provider_id)) or (select private.is_admin()))
  with check ((select private.owns_provider(provider_id)) or (select private.is_admin()));

drop policy if exists "Anyone reads active prices" on public.price_list;
create policy "Anyone reads active prices" on public.price_list
  for select to anon, authenticated
  using (status = 'active' or (select private.is_admin()));

drop policy if exists "Admins read the price log" on public.price_list_log;
create policy "Admins read the price log" on public.price_list_log
  for select to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- 6. Functions for the business owner screens
-- ---------------------------------------------------------------------------
-- The disclosure: what the business pays Kwetuly for a reservation (nothing is added for the guest).
-- Visitors and other members see it only for a business open for reservations today (security
-- review L8); the owner and admins see it before switching on.
create or replace function public.reservation_rate(p_provider uuid, p_service uuid default null)
returns table (kind text, amount_tzs integer, percent numeric, max_guests_counted integer)
language sql
stable
security definer
set search_path = ''
as $$
  select r.kind, r.amount_tzs, r.percent, r.max_guests_counted
  from public.providers p
  cross join lateral private.reservation_rate_for(p.business_type, p.id, p_service) r
  where p.id = p_provider
    and (p.owner_id = (select auth.uid()) or (select private.is_admin())
         or private.provider_open_for_reservations(p.id));
$$;
revoke execute on function public.reservation_rate(uuid, uuid) from public;
grant execute on function public.reservation_rate(uuid, uuid) to anon, authenticated;

-- Closed dates with the owner's notes. Owner or admin only (the notes are not public, L3).
create or replace function public.business_closed_dates_with_notes(p_provider uuid)
returns table (day date, note text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.owns_provider(p_provider) or private.is_admin()) then
    raise exception 'Business not found' using errcode = 'P0001';
  end if;
  return query
    select d.day, d.note from public.business_closed_dates d
    where d.provider_id = p_provider
    order by d.day;
end;
$$;
revoke execute on function public.business_closed_dates_with_notes(uuid) from public, anon;
grant execute on function public.business_closed_dates_with_notes(uuid) to authenticated;

-- Everything the owner setup screen needs in one call. Owner or admin only.
create or replace function public.reservation_setup_status(p_provider uuid)
returns table (
  takes_reservations boolean,
  open_now boolean,
  blockers text[],
  terms_version text,
  terms_current_version text,
  terms_accepted_at timestamptz,
  min_notice_min integer,
  max_days integer,
  rate_kind text,
  rate_amount_tzs integer,
  rate_percent numeric,
  rate_max_guests_counted integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p public.providers;
  v_blockers text[];
begin
  select * into p from public.providers where id = p_provider;
  if not found or not (p.owner_id = (select auth.uid()) or private.is_admin()) then
    raise exception 'Business not found' using errcode = 'P0001';
  end if;
  v_blockers := private.reservation_blockers(p.id, p.business_type, p.verification_status, p.approved_business_type,
                                            p.reservation_terms_version);
  return query
    select p.takes_reservations,
           p.takes_reservations and cardinality(v_blockers) = 0,
           v_blockers,
           p.reservation_terms_version,
           private.reservation_terms_version(),
           p.reservation_terms_at,
           p.reservation_min_notice_min,
           p.reservation_max_days,
           r.kind, r.amount_tzs, r.percent, r.max_guests_counted
    from (select 1) x
    left join lateral private.reservation_rate_for(p.business_type, p.id, null) r on true;
end;
$$;
revoke execute on function public.reservation_setup_status(uuid) from public, anon;
grant execute on function public.reservation_setup_status(uuid) to authenticated;

-- The owner accepts the current terms. The version must be the current one; the time is the server's.
create or replace function public.accept_reservation_terms(p_provider uuid, p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.providers p where p.id = p_provider and p.owner_id = (select auth.uid())) then
    raise exception 'Business not found' using errcode = 'P0001';
  end if;
  if p_version is distinct from private.reservation_terms_version() then
    raise exception 'terms_outdated' using errcode = 'P0001', hint = 'Reload the page to read the current terms.';
  end if;
  update public.providers
  set reservation_terms_version = p_version, reservation_terms_at = now()
  where id = p_provider;
end;
$$;
revoke execute on function public.accept_reservation_terms(uuid, text) from public, anon;
grant execute on function public.accept_reservation_terms(uuid, text) to authenticated;

-- Switch on (owner only) or off (owner or admin). Returns the blockers; empty means it was done.
create or replace function public.set_takes_reservations(p_provider uuid, p_on boolean)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.providers;
  v_blockers text[];
begin
  select * into p from public.providers where id = p_provider for update;
  if not found or not (p.owner_id = (select auth.uid()) or (not coalesce(p_on, false) and private.is_admin())) then
    raise exception 'Business not found' using errcode = 'P0001';
  end if;
  if not coalesce(p_on, false) then
    update public.providers set takes_reservations = false where id = p_provider;
    return '{}'::text[];
  end if;
  v_blockers := private.reservation_blockers(p.id, p.business_type, p.verification_status, p.approved_business_type,
                                            p.reservation_terms_version);
  if cardinality(v_blockers) > 0 then
    return v_blockers;
  end if;
  update public.providers set takes_reservations = true where id = p_provider;
  return '{}'::text[];
end;
$$;
revoke execute on function public.set_takes_reservations(uuid, boolean) from public, anon;
grant execute on function public.set_takes_reservations(uuid, boolean) to authenticated;

-- Replace all opening hours in one go: p_hours = [{"weekday":1,"opens":"08:00","closes":"17:00"}, ...].
-- Runs as the caller (invoker), so RLS and the hours guard apply as for direct writes.
create or replace function public.set_business_hours(p_provider uuid, p_hours jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not ((select private.owns_provider(p_provider)) or (select private.is_admin())) then
    raise exception 'Business not found' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_hours) is distinct from 'array' or jsonb_array_length(p_hours) > 21 then
    raise exception 'Send up to 21 opening periods' using errcode = 'P0001';
  end if;
  delete from public.business_hours where provider_id = p_provider;
  insert into public.business_hours (provider_id, weekday, opens, closes)
  select p_provider, x.weekday, x.opens, x.closes
  from jsonb_to_recordset(p_hours) as x(weekday smallint, opens time, closes time);
end;
$$;
revoke execute on function public.set_business_hours(uuid, jsonb) from public, anon;
grant execute on function public.set_business_hours(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Functions for /admin/prices (admins with a two-step session only; every save is logged)
-- ---------------------------------------------------------------------------
create or replace function public.admin_price_rows()
returns table (
  id uuid, account_type public.priced_account_type, business_type text, service_code text, period text,
  amount_tzs integer, percent numeric, max_guests_counted integer, active_from date, active_to date,
  status text, note text, updated_at timestamptz, editable boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  return query
    select pl.id, pl.account_type, pl.business_type, pl.service_code, pl.period, pl.amount_tzs, pl.percent,
           pl.max_guests_counted, pl.active_from, pl.active_to, pl.status, pl.note, pl.updated_at,
           pl.service_code in ('reservation_commission', 'reservation_unpriced_fee')
    from public.price_list pl
    order by pl.service_code, pl.business_type nulls last, pl.active_from nulls last, pl.created_at;
end;
$$;
revoke execute on function public.admin_price_rows() from public, anon;
grant execute on function public.admin_price_rows() to authenticated;

create or replace function public.admin_price_log(p_limit integer default 50)
returns table (id bigint, price_id uuid, action text, actor_name text, before jsonb, after jsonb, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  return query
    select l.id, l.price_id, l.action, coalesce(pf.full_name, 'Kwetuly'), l.before, l.after, l.created_at
    from public.price_list_log l
    left join public.profiles pf on pf.id = l.actor
    order by l.created_at desc, l.id desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;
revoke execute on function public.admin_price_log(integer) from public, anon;
grant execute on function public.admin_price_log(integer) to authenticated;

-- Edit a draft. For percent rows send p_percent, for TZS rows send p_amount_tzs; null = not set.
create or replace function public.admin_save_price_draft(
  p_id uuid, p_amount_tzs integer, p_percent numeric, p_max_guests integer, p_active_from date, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.price_list;
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  select * into r from public.price_list where id = p_id for update;
  if not found then
    raise exception 'price not found' using errcode = 'P0001';
  end if;
  if r.service_code not in ('reservation_commission', 'reservation_unpriced_fee') then
    raise exception 'not editable yet' using errcode = 'P0001';
  end if;
  if r.status <> 'draft' then
    raise exception 'only drafts can be edited' using errcode = 'P0001';
  end if;
  if r.period = 'percent' and p_amount_tzs is not null or r.period <> 'percent' and p_percent is not null then
    raise exception 'wrong value kind' using errcode = 'P0001';
  end if;
  if p_max_guests is not null and not (r.service_code = 'reservation_commission' and r.period = 'once') then
    raise exception 'max guests only for per-guest rates' using errcode = 'P0001';
  end if;
  if p_active_from is not null and p_active_from < private.tz_today() then
    raise exception 'start date in the past' using errcode = 'P0001';
  end if;
  update public.price_list
  set amount_tzs = p_amount_tzs,
      percent = p_percent,
      max_guests_counted = p_max_guests,
      active_from = p_active_from,
      note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_id;
end;
$$;
revoke execute on function public.admin_save_price_draft(uuid, integer, numeric, integer, date, text) from public, anon;
grant execute on function public.admin_save_price_draft(uuid, integer, numeric, integer, date, text) to authenticated;

-- Activate a complete draft from its start date (today or later). An active price for the same
-- service that is still running then ends on that date.
create or replace function public.admin_activate_price(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.price_list;
  o public.price_list;
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  select * into r from public.price_list where id = p_id for update;
  if not found then
    raise exception 'price not found' using errcode = 'P0001';
  end if;
  if r.service_code not in ('reservation_commission', 'reservation_unpriced_fee') then
    raise exception 'not editable yet' using errcode = 'P0001';
  end if;
  if r.status <> 'draft' then
    raise exception 'only drafts can be activated' using errcode = 'P0001';
  end if;
  if r.amount_tzs is null and r.percent is null then
    raise exception 'value not set' using errcode = 'P0001';
  end if;
  if r.active_from is null or r.active_from < private.tz_today() then
    raise exception 'start date in the past' using errcode = 'P0001';
  end if;
  if r.service_code = 'reservation_commission' and r.period = 'once' and r.max_guests_counted is null then
    raise exception 'max guests not set' using errcode = 'P0001';
  end if;

  for o in
    select * from public.price_list pl
    where pl.id <> r.id and pl.status = 'active' and pl.account_type = r.account_type
      and pl.business_type is not distinct from r.business_type and pl.service_code = r.service_code
      and (pl.active_to is null or pl.active_to > r.active_from)
    for update
  loop
    if o.active_from >= r.active_from then
      raise exception 'another price starts on or after this date' using errcode = 'P0001';
    end if;
    update public.price_list set active_to = r.active_from where id = o.id;
  end loop;

  update public.price_list set status = 'active' where id = r.id;
end;
$$;
revoke execute on function public.admin_activate_price(uuid) from public, anon;
grant execute on function public.admin_activate_price(uuid) to authenticated;

-- Start a new version of a price (to change an active one). One open draft per service at a time.
create or replace function public.admin_new_price_version(p_from uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.price_list;
  v_id uuid;
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  select * into r from public.price_list where id = p_from;
  if not found then
    raise exception 'price not found' using errcode = 'P0001';
  end if;
  if r.service_code not in ('reservation_commission', 'reservation_unpriced_fee') then
    raise exception 'not editable yet' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.price_list pl
             where pl.status = 'draft' and pl.account_type = r.account_type
               and pl.business_type is not distinct from r.business_type and pl.service_code = r.service_code) then
    raise exception 'a draft already exists' using errcode = 'P0001';
  end if;
  insert into public.price_list (account_type, business_type, service_code, period, amount_tzs, percent,
                                 max_guests_counted, status, created_by)
  values (r.account_type, r.business_type, r.service_code, r.period, r.amount_tzs, r.percent,
          r.max_guests_counted, 'draft', (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.admin_new_price_version(uuid) from public, anon;
grant execute on function public.admin_new_price_version(uuid) to authenticated;

-- End an active price on a date (today or later). From that date the type has no rate and nobody can
-- make a new reservation there (reservations already made keep the rate copied at request time).
create or replace function public.admin_end_price(p_id uuid, p_on date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.price_list;
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  select * into r from public.price_list where id = p_id for update;
  if not found or r.status <> 'active' then
    raise exception 'price not found' using errcode = 'P0001';
  end if;
  if r.service_code not in ('reservation_commission', 'reservation_unpriced_fee') then
    raise exception 'not editable yet' using errcode = 'P0001';
  end if;
  if p_on is null or p_on < private.tz_today() or p_on <= r.active_from then
    raise exception 'end date not allowed' using errcode = 'P0001';
  end if;
  if r.active_to is not null and r.active_to <= p_on then
    raise exception 'end date not allowed' using errcode = 'P0001';
  end if;
  update public.price_list set active_to = p_on where id = p_id;
end;
$$;
revoke execute on function public.admin_end_price(uuid, date) from public, anon;
grant execute on function public.admin_end_price(uuid, date) to authenticated;
