-- NOT APPLIED. Slice 2 of docs/team/design-reservations-and-trip-record-2026-11-22.md: reservations at
-- restaurants, spas and salons, and the commission each business owes Kwetuly for reservations that
-- took place. backend-engineer, 2026-11-22. Apply on live only with Walter's yes, after
-- security-reviewer and qa-tester (test project or local stack first, supabase/checks/reservations_tests.sql).
-- Needs, in this order: 20261122000000 (migration A), 20261031214101 (feature switches),
-- 20261122200000_reservation_setup.sql.
--
-- KWETULY NEVER CHARGES ANYONE HERE. The traveller pays the business on the day, as any other guest.
-- Commission is RECORDED per completed reservation and listed per business and month for admins.
-- While the feature switch feature.reservation_commission_billing is off (seeded off), statements are
-- "for information, no charge" and admins cannot mark anything invoiced or paid. Payments and payouts
-- stay with payments-engineer; nothing here touches public.payments.
--
-- Walter's decisions (2026-11-22, relayed by the coordinator):
--   one rate per business type; restaurant = TZS per guest who came, up to max_guests_counted;
--   spa and salon = percent of the service's listed price (copied at request time) per person who came;
--   service without a listed price = TZS per person who came; no commission on declined, cancelled,
--   no-show, expired or (unresolved) disputed reservations; a guide linked by guide code gets half of
--   Kwetuly's commission (recorded only); traveller with 2 no-shows in 90 days cannot reserve for 30
--   days after the latest; spa and massage need a current licence check (slice 1 rules).
--
-- Deviation from the design paper (on purpose): no public.leads row per reservation. Lead alerts
-- (private.on_lead_created) put the traveller's name and message into the alert payload, and a new
-- public.lead_source value would need its own migration. Reservations alert the owner through the
-- same private.notify_user path (email, WhatsApp to private.provider_phone, push) with IDS ONLY:
-- {"reservation_id", "link"}. No name, note, diet line or phone number in any payload.
-- Trip files (slice 4) do not exist yet: trip_file_id and trip_day_no are plain columns without a
-- foreign key; slice 4 adds the key and the "linked by trip" guide rule.
--
-- Security review of slice 2 (docs/team/security-review-reservations-slice-2-2026-11-22.md), fixed here:
--   M1 the traveller may say how many came; more than the business counted holds the commission;
--      admin_reservation_quality_month() shows no-show, low-count and late-cancel rates per business.
--   M2 the no-show pause ignores no-shows with an open dispute and counts from the reservation time;
--      "did not come" only 30 minutes after the time; admin outcome business_fault (nothing owed, no strike).
--   M3 caps: 10 requests a day (3 for accounts younger than 3 days), 5 traveller cancellations a day.
--   M4 note and business_note cleared 30 days after the date; owners see the note only until then.
--   L1 owners read through functions only. L2 provider_ref. L3 per-row errors in the job. L4 admins
--   alerted on a late "no". L5 invoiced -> waived, final. L7 null-safe traveller check. L8 fixed log codes.
--
-- What it does:
--   1. enum public.reservation_status: requested, confirmed, declined, other_time_offered, cancelled,
--      no_show, completed. "Disputed" is a flag (disputed_at), not a status.
--   2. public.reservations: no client insert, update or delete grant. Rows change only through
--      place_reservation(), reservation_action(), reservation_visit_answer(),
--      admin_resolve_reservation_dispute(), admin_set_reservation_commission() and the hourly job.
--      The rate, its kind, max_guests_counted, the price_list row and the service's listed price are
--      COPIED at request time (security review L9), so the disclosed rate is the rate owed. A trigger
--      works out commission_tzs, guide_share_tzs and commission_status; nobody types them.
--   3. public.reservation_diet_lines: the optional diet or allergy line, with consent time. Only the
--      traveller, that business (while the reservation is open, until the day after it) and admins read
--      it; never copied anywhere; deleted 30 days after the reservation date by the hourly job.
--   4. public.reservation_log: append-only history of every status and commission change, admins read.
--   5. Hourly job private.run_reservation_jobs() (pg_cron 'kwetuly-reservations', minute 23):
--      requested / other_time_offered past their time -> declined ('no_answer'); confirmed 3 days past
--      their time -> completed ('auto', everyone booked counted as came); reminder to the owner 2 hours
--      after the time; "Did your visit happen?" to the traveller the day after; diet lines past their
--      date deleted.
--   6. Services referenced by a reservation cannot be deleted by owners (switch them off).
--   7. Feature switch feature.reservation_commission_billing, off.
--
-- Access rules (RLS on every table):
--   reservations: the traveller reads own rows; admins (two-step) read all. Business owners read only
--     through business_reservations() / business_reservation_statement() (security review L1). No writes
--     from clients.
--   reservation_diet_lines: as in 3. No writes from clients.
--   reservation_log: admins read. Nobody updates or deletes.
--   Functions: security definer, search_path = '', execute only for the roles named.
--
-- Account deletion: a deleted traveller's reservations keep the dates and commission figures; the
-- foreign key sets traveler_id to null and a trigger clears the note and deletes the diet line.
-- A deleted business keeps its reservations with provider_id null and business_name as copied.
--
-- [legal] placeholders: the disclosure wording, the 30-day diet line rule, the no-show pause, the
-- guide share, invoicing (company, TIN, EFD) before the billing switch is ever turned on.
--
-- Undo (deletes every reservation, diet line and log row):
--   select cron.unschedule('kwetuly-reservations');
--   drop function public.place_reservation(uuid, uuid, timestamptz, integer, text, text, boolean, text),
--     public.reservation_action(uuid, text, timestamptz, text, integer), public.reservation_visit_answer(uuid, boolean, integer),
--     public.my_reservations(), public.business_reservations(uuid, date, date),
--     public.business_reservation_statement(uuid, date), public.admin_reservation_commission_month(date),
--     public.admin_set_reservation_commission(uuid, date, text), public.admin_reservation_quality_month(date),
--     public.admin_resolve_reservation_dispute(uuid, text, text), public.reservation_billing_on(),
--     private.run_reservation_jobs(), private.reservation_compute(), private.reservation_traveller_gone(),
--     private.reservation_disputed(),
--     private.reservation_log_add(uuid, text, public.reservation_status, public.reservation_status, text),
--     private.reservation_notify(uuid, text), private.reservation_time_problem(uuid, uuid, timestamptz),
--     private.reservation_mask(text), private.reservation_guide_share_pct(), private.reservations_append_only(),
--     private.reservation_diet_visible(uuid), private.guard_service_delete(), private.service_has_reservations(uuid);
--   drop function public.guide_code_status(text); drop table private.guide_code_checks;
--   drop table public.reservation_log, public.reservation_diet_lines, public.reservations;
--   drop type public.reservation_status;
--   delete from public.site_settings where key = 'feature.reservation_commission_billing';

-- ---------------------------------------------------------------------------
-- 0. Constants and small helpers
-- ---------------------------------------------------------------------------
insert into public.site_settings (key, value)
values ('feature.reservation_commission_billing', '{"on": false}')
on conflict (key) do nothing;

-- Half of Kwetuly's commission goes to a linked guide (record only). Mirrored in packages/shared.
create or replace function private.reservation_guide_share_pct()
returns numeric
language sql
immutable
set search_path = ''
as $$
  select 50::numeric;
$$;
revoke execute on function private.reservation_guide_share_pct() from public;

-- Notes and diet lines: no phone numbers, emails or links (masked like messages).
create or replace function private.reservation_mask(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(regexp_replace(regexp_replace(private.mask_digit_runs(p_text),
           '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[contact hidden]', 'g'),
           '(https?://|www\.)\S+|(wa\.me|t\.me|instagram\.com|facebook\.com)\S*', '[contact hidden]', 'gi')), '');
$$;
revoke execute on function private.reservation_mask(text) from public;

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where n.nspname = 'public' and t.typname = 'reservation_status') then
    create type public.reservation_status as enum
      ('requested', 'confirmed', 'declined', 'other_time_offered', 'cancelled', 'no_show', 'completed');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers (id) on delete set null,
  provider_ref uuid not null,   -- the business id, copied, no foreign key: survives deletion (review L2)
  business_name text not null check (char_length(business_name) <= 160),   -- copied (left 160), survives deletion
  business_type text not null check (business_type in ('restaurant', 'spa', 'salon')),
  traveler_id uuid references public.profiles (id) on delete set null,
  service_id uuid references public.business_services (id) on delete set null,
  service_name text check (char_length(service_name) <= 80),                -- copied
  guide_id uuid references public.guides (id) on delete set null,          -- linked by guide code
  trip_file_id uuid,                                                        -- slice 4 adds the key
  trip_day_no integer check (trip_day_no between 1 and 60),
  starts_at timestamptz not null,
  party_size integer not null check (party_size between 1 and 50),
  note text check (char_length(note) <= 300),
  status public.reservation_status not null default 'requested',
  status_at timestamptz not null default now(),
  cancelled_by text check (cancelled_by in ('traveller', 'business', 'admin')),
  business_cancelled_late boolean not null default false,   -- business cancelled a confirmed one < 2 h before (M1)
  decline_reason text check (decline_reason in ('business', 'no_answer', 'offer_refused')),
  offered_starts_at timestamptz,
  business_note text check (char_length(business_note) <= 300),
  came_count integer check (came_count between 1 and 50),
  completed_by text check (completed_by in ('business', 'auto', 'admin')),
  traveller_said_happened boolean,
  traveller_said_people integer check (traveller_said_people between 1 and 50),   -- asked when fewer came than booked (M1)
  traveller_answered_at timestamptz,
  traveller_asked_at timestamptz,
  owner_reminded_at timestamptz,
  disputed_at timestamptz,
  dispute_resolved_at timestamptz,
  dispute_outcome text check (dispute_outcome in ('completed', 'no_show', 'business_fault')),
  texts_cleared_at timestamptz,   -- note and business_note cleared 30 days after the date (M4)
  -- QA 2026-11-23: who must answer by when. Requests: the business, by least(created + 4 h, time -
  -- minimum notice). Other-time offers: the traveller, by least(offered + 4 h, new time - minimum
  -- notice). The job closes it after that and tells the traveller.
  answer_by timestamptz,
  -- Copied at request time (L9): what was disclosed is what is owed.
  commission_kind text not null check (commission_kind in ('per_guest', 'percent', 'per_person')),
  commission_rate_tzs integer check (commission_rate_tzs between 1 and 200000),
  commission_percent numeric(5, 2) check (commission_percent > 0 and commission_percent <= 50),
  max_guests_counted integer check (max_guests_counted between 1 and 100),
  price_basis_tzs integer check (price_basis_tzs between 100 and 50000000),   -- listed price per person
  -- The service's group discount, copied at request time (Walter 2026-11-23). It applies when
  -- party_size >= group_discount_min_people: commission uses price x (1 - percent / 100) per person.
  group_discount_min_people integer check (group_discount_min_people between 2 and 20),
  group_discount_percent integer check (group_discount_percent between 1 and 30),
  price_list_id uuid not null references public.price_list (id),
  guide_share_pct numeric(5, 2) not null default 0 check (guide_share_pct between 0 and 100),
  -- Set by the trigger only.
  commission_tzs integer check (commission_tzs >= 0),
  guide_share_tzs integer check (guide_share_tzs >= 0),
  commission_status text not null default 'none'
    check (commission_status in ('none', 'held', 'owed', 'invoiced', 'paid', 'waived')),
  commission_status_at timestamptz,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservations_rate_shape check (
    (commission_kind = 'percent' and commission_percent is not null and price_basis_tzs is not null
       and commission_rate_tzs is null)
    or (commission_kind in ('per_guest', 'per_person') and commission_rate_tzs is not null
        and commission_percent is null)),
  constraint reservations_max_only_per_guest check (max_guests_counted is null or commission_kind = 'per_guest'),
  constraint reservations_group_discount_shape check (
    (group_discount_min_people is null) = (group_discount_percent is null)
    and (group_discount_min_people is null or commission_kind = 'percent')),
  constraint reservations_offer_shape check ((status = 'other_time_offered') = (offered_starts_at is not null)),
  constraint reservations_came_le_party check (came_count is null or came_count <= party_size),
  constraint reservations_cancel_shape check ((status = 'cancelled') = (cancelled_by is not null))
);
create index if not exists reservations_provider_idx on public.reservations (provider_id, starts_at);
create index if not exists reservations_provider_ref_idx on public.reservations (provider_ref, starts_at);
create index if not exists reservations_traveler_idx on public.reservations (traveler_id, created_at desc);
create index if not exists reservations_answer_by_idx on public.reservations (answer_by)
  where status in ('requested', 'other_time_offered');
create index if not exists reservations_open_idx on public.reservations (status, starts_at)
  where status in ('requested', 'other_time_offered', 'confirmed');
create index if not exists reservations_guide_idx on public.reservations (guide_id) where guide_id is not null;
comment on table public.reservations is
  'Reservations at restaurants, spas and salons. The traveller pays the business on the day; Kwetuly never charges anyone. Commission is recorded per completed reservation (trigger), with the rate copied at request time.';

create table if not exists public.reservation_diet_lines (
  reservation_id uuid primary key references public.reservations (id) on delete cascade,
  line text not null check (char_length(line) between 2 and 120),
  consent_at timestamptz not null,
  delete_after date not null
);
comment on table public.reservation_diet_lines is
  'Optional diet or allergy line for one reservation (health data). Only the traveller, that business while the reservation is open, and admins read it. Deleted after delete_after (reservation date + 30). Never copied into alerts, logs or analytics.';

create table if not exists public.reservation_log (
  id bigint generated always as identity primary key,
  reservation_id uuid references public.reservations (id) on delete cascade,
  action text not null check (char_length(action) <= 40),
  from_status public.reservation_status,
  to_status public.reservation_status,
  actor uuid,                 -- no foreign key, so the record survives a deleted account; null = system
  detail text check (char_length(detail) <= 120),   -- fixed words only, never free text
  created_at timestamptz not null default now()
);
create index if not exists reservation_log_reservation_idx on public.reservation_log (reservation_id, id);

create or replace function private.reservations_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Reservations are never deleted by any function, so their log never needs to be. (Deleting a
  -- reservation row as postgres is refused through the cascade too: the history is kept.)
  raise exception 'The reservation log cannot be changed' using errcode = 'P0001';
end;
$$;
revoke execute on function private.reservations_append_only() from public;
drop trigger if exists reservation_log_no_change on public.reservation_log;
create trigger reservation_log_no_change
  before update or delete on public.reservation_log
  for each row execute function private.reservations_append_only();

create or replace function private.reservation_log_add(
  p_reservation uuid, p_action text, p_from public.reservation_status, p_to public.reservation_status, p_detail text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.reservation_log (reservation_id, action, from_status, to_status, actor, detail)
  values (p_reservation, p_action, p_from, p_to, (select auth.uid()), p_detail);
$$;
revoke execute on function private.reservation_log_add(uuid, text, public.reservation_status, public.reservation_status, text) from public;

-- ---------------------------------------------------------------------------
-- 2. Commission and dispute rules (one trigger; nobody types a commission)
-- ---------------------------------------------------------------------------
create or replace function private.reservation_compute()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_came integer;
  v_base text;
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    -- Copied facts never change after the request.
    if (new.business_type, new.commission_kind, new.commission_rate_tzs, new.commission_percent,
        new.max_guests_counted, new.price_basis_tzs, new.price_list_id, new.guide_share_pct, new.is_sample,
        new.party_size, new.created_at, new.provider_ref, new.group_discount_min_people, new.group_discount_percent)
       is distinct from
       (old.business_type, old.commission_kind, old.commission_rate_tzs, old.commission_percent,
        old.max_guests_counted, old.price_basis_tzs, old.price_list_id, old.guide_share_pct, old.is_sample,
        old.party_size, old.created_at, old.provider_ref, old.group_discount_min_people, old.group_discount_percent) then
      raise exception 'Reservation facts cannot be changed' using errcode = 'P0001';
    end if;
    if new.status is distinct from old.status then
      new.status_at := now();
    end if;
  end if;

  -- P4: the traveller's answer against the business's (or the automatic) outcome.
  -- An already invoiced, paid or waived line is not reopened by a late answer; admins see the answer.
  if new.disputed_at is null and new.traveller_said_happened is not null
     and (tg_op = 'INSERT' or old.commission_status not in ('invoiced', 'paid', 'waived'))
     and ((new.status = 'completed' and not new.traveller_said_happened)
          or (new.status = 'no_show' and new.traveller_said_happened)
          -- Review M1: more people came than the business counted.
          or (new.status = 'completed' and new.traveller_said_happened
              and new.traveller_said_people is not null and new.came_count is not null
              and new.traveller_said_people > new.came_count)) then
    new.disputed_at := now();
  end if;

  if new.status = 'completed' then
    v_came := coalesce(new.came_count, new.party_size);
    new.came_count := v_came;
    new.commission_tzs := case new.commission_kind
      when 'per_guest' then new.commission_rate_tzs * least(v_came, coalesce(new.max_guests_counted, v_came))
      when 'per_person' then new.commission_rate_tzs * v_came
      -- Percent of the listed price per person, less the group discount when the booking qualifies.
      else round(new.price_basis_tzs::numeric
                 * case when new.group_discount_min_people is not null
                             and new.party_size >= new.group_discount_min_people
                        then (100 - new.group_discount_percent)::numeric / 100 else 1 end
                 * v_came * new.commission_percent / 100)::integer
    end;
    new.guide_share_tzs := case when new.guide_id is null or new.guide_share_pct = 0 then 0
                                else round(new.commission_tzs::numeric * new.guide_share_pct / 100)::integer end;
    v_base := case
      when new.is_sample then 'none'
      when new.disputed_at is not null and new.dispute_resolved_at is null then 'held'
      else 'owed' end;
  else
    new.commission_tzs := null;
    new.guide_share_tzs := null;
    v_base := 'none';
  end if;

  if tg_op = 'UPDATE' and old.commission_status in ('invoiced', 'paid', 'waived') and v_base <> 'owed' then
    raise exception 'This reservation is already invoiced, paid or waived.' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and old.commission_status in ('invoiced', 'paid', 'waived')
     and new.commission_tzs is distinct from old.commission_tzs then
    raise exception 'This reservation is already invoiced, paid or waived. Its commission cannot change.' using errcode = 'P0001';
  end if;
  -- Waiving is final (review L5).
  if tg_op = 'UPDATE' and old.commission_status = 'waived' and new.commission_status is distinct from 'waived' then
    raise exception 'Waiving is final.' using errcode = 'P0001';
  end if;
  -- invoiced / paid / waived are set only by admin_set_reservation_commission() on owed or invoiced rows.
  if v_base = 'owed' and new.commission_status in ('invoiced', 'paid', 'waived') then
    null;
  else
    new.commission_status := v_base;
  end if;
  if tg_op = 'INSERT' or new.commission_status is distinct from old.commission_status then
    new.commission_status_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists reservations_compute on public.reservations;
create trigger reservations_compute
  before insert or update on public.reservations
  for each row execute function private.reservation_compute();

-- A new dispute alerts every admin (ids only). Commission stays held until an admin decides.
create or replace function private.reservation_disputed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.disputed_at is not null and old.disputed_at is null and new.dispute_resolved_at is null
     and not new.is_sample then
    perform private.notify_admins('reservation_disputed',
      jsonb_build_object('reservation_id', new.id, 'link', '/admin/commissions#reservation-disputes'));
  end if;
  return null;
end;
$$;
revoke execute on function private.reservation_disputed() from public;
drop trigger if exists reservations_disputed on public.reservations;
create trigger reservations_disputed
  after update on public.reservations   -- not "of disputed_at": the before trigger sets it
  for each row execute function private.reservation_disputed();

-- A deleted traveller (traveler_id set to null by the foreign key): clear the note and the diet line,
-- keep dates and commission figures.
create or replace function private.reservation_traveller_gone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.traveler_id is not null and new.traveler_id is null then
    new.note := null;
    delete from public.reservation_diet_lines d where d.reservation_id = new.id;
  end if;
  return new;
end;
$$;
revoke execute on function private.reservation_traveller_gone() from public;
drop trigger if exists reservations_traveller_gone on public.reservations;
create trigger reservations_traveller_gone
  before update of traveler_id on public.reservations
  for each row execute function private.reservation_traveller_gone();

-- Owners switch referenced services off; they cannot delete them. A whole business deleted with its
-- account (server code) still cascades, and reservations keep the copied service name.
-- Owners have no direct read on reservations (review L1), so the check is a narrow definer helper.
create or replace function private.service_has_reservations(p_service uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.reservations r where r.service_id = p_service);
$$;
revoke execute on function private.service_has_reservations(uuid) from public;
grant execute on function private.service_has_reservations(uuid) to authenticated;

create or replace function private.guard_service_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Security invoker: current_user is the caller's role. Server code (account deletion) is not refused.
  if current_user in ('anon', 'authenticated')
     and private.service_has_reservations(old.id) then
    raise exception 'service_in_use' using errcode = 'P0001',
      hint = 'This service has reservations. Switch it off instead of deleting it.';
  end if;
  return old;
end;
$$;
revoke execute on function private.guard_service_delete() from public;
drop trigger if exists business_services_delete_guard on public.business_services;
create trigger business_services_delete_guard
  before delete on public.business_services
  for each row execute function private.guard_service_delete();

-- ---------------------------------------------------------------------------
-- 2b. Guide codes: every check is recorded; 10 wrong codes an hour stop further checks (QA L-G)
-- ---------------------------------------------------------------------------
-- No code is stored in any form (final review N2): an ok check keeps only the guide it matched; a
-- wrong code keeps only who and when, for the counter.
create table if not exists private.guide_code_checks (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  guide_id uuid,                    -- set for ok checks only
  ok boolean not null,
  created_at timestamptz not null default now(),
  constraint guide_code_checks_shape check (ok = (guide_id is not null))
);
create index if not exists guide_code_checks_user_idx on private.guide_code_checks (user_id, created_at desc);
alter table private.guide_code_checks enable row level security;
revoke all on private.guide_code_checks from anon, authenticated;

-- 'ok' (an approved guide who is not the caller), 'unknown', or 'too_many' (10 wrong codes, or 30
-- checks of any kind, in the last hour; nothing is checked or written then, final review N1). The
-- reservation form calls this before place_reservation(), which accepts a code only when it resolves to
-- a guide the same person had an 'ok' check for in the last hour.
create or replace function public.guide_code_status(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_guide uuid;
begin
  if v_user is null then
    raise exception 'reservation_refused: not_signed_in' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('guide_code_checks:' || v_user::text, 0));
  if (select count(*) from private.guide_code_checks k
      where k.user_id = v_user and not k.ok and k.created_at > now() - interval '1 hour') >= 10
     or (select count(*) from private.guide_code_checks k
         where k.user_id = v_user and k.created_at > now() - interval '1 hour') >= 30 then
    return 'too_many';
  end if;
  if v_code <> '' and char_length(v_code) <= 40 then
    select g.id into v_guide
    from public.referral_codes rc
    join public.guides g on g.id = rc.guide_id
    where upper(rc.code) = v_code and g.verification_status = 'approved' and g.owner_id <> v_user
    limit 1;
  end if;
  insert into private.guide_code_checks (user_id, guide_id, ok) values (v_user, v_guide, v_guide is not null);
  return case when v_guide is not null then 'ok' else 'unknown' end;
end;
$$;
revoke execute on function public.guide_code_status(text) from public, anon;
grant execute on function public.guide_code_status(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Time rules
-- ---------------------------------------------------------------------------
-- Null when p_starts is a time this business takes reservations at; otherwise a fixed code.
create or replace function private.reservation_time_problem(p_provider uuid, p_service uuid, p_starts timestamptz)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p record;
  v_local timestamp;
  v_minutes integer;
  v_duration integer;
begin
  select pr.reservation_min_notice_min, pr.reservation_max_days into p
  from public.providers pr where pr.id = p_provider;
  if not found or p_starts is null then
    return 'time_not_allowed';
  end if;
  v_local := p_starts at time zone 'Africa/Dar_es_Salaam';
  if extract(second from v_local) <> 0 or extract(minute from v_local)::integer % 15 <> 0 then
    return 'time_not_allowed';
  end if;
  if p_starts < now() + make_interval(mins => p.reservation_min_notice_min) then
    return 'too_soon';
  end if;
  if v_local::date > private.tz_today() + p.reservation_max_days then
    return 'too_far';
  end if;
  if exists (select 1 from public.business_closed_dates d where d.provider_id = p_provider and d.day = v_local::date) then
    return 'closed_date';
  end if;
  select s.duration_min into v_duration from public.business_services s where s.id = p_service;
  v_duration := coalesce(v_duration, 60);
  v_minutes := extract(hour from v_local)::integer * 60 + extract(minute from v_local)::integer;
  if not exists (
    select 1 from public.business_hours h
    where h.provider_id = p_provider
      and h.weekday = extract(dow from v_local)::integer
      and v_minutes >= extract(hour from h.opens)::integer * 60 + extract(minute from h.opens)::integer
      and v_minutes + v_duration <= extract(hour from h.closes)::integer * 60 + extract(minute from h.closes)::integer) then
    return 'outside_hours';
  end if;
  return null;
end;
$$;
revoke execute on function private.reservation_time_problem(uuid, uuid, timestamptz) from public;

-- ---------------------------------------------------------------------------
-- 4. Alerts (ids only)
-- ---------------------------------------------------------------------------
-- p_to: 'owner' or 'traveller'. Sample reservations send nothing.
create or replace function private.reservation_notify(p_reservation uuid, p_event text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_owner uuid;
begin
  select res.id, res.provider_id, res.traveler_id, res.is_sample into r
  from public.reservations res where res.id = p_reservation;
  if not found or r.is_sample or p_event is null or p_event = 'none' then
    return;
  end if;
  if p_event in ('reservation_requested', 'reservation_cancelled_by_traveller', 'reservation_offer_accepted',
                 'reservation_offer_refused', 'reservation_mark_reminder') then
    select pr.owner_id into v_owner from public.providers pr where pr.id = r.provider_id;
    if v_owner is not null then
      perform private.notify_user(p_event, v_owner,
        jsonb_build_object('reservation_id', r.id, 'link', '/dashboard/business/reservations'),
        private.provider_phone(r.provider_id), '{email,whatsapp,push}');
    end if;
  elsif r.traveler_id is not null then
    perform private.notify_user(p_event, r.traveler_id,
      jsonb_build_object('reservation_id', r.id, 'link', '/reservations'), null, '{email,push}');
  end if;
end;
$$;
revoke execute on function private.reservation_notify(uuid, text) from public;

-- ---------------------------------------------------------------------------
-- 5. Placing a reservation
-- ---------------------------------------------------------------------------
-- Errors are 'reservation_refused: <code>' with a fixed code (packages/shared reservationRefusals).
create or replace function public.place_reservation(
  p_provider uuid,
  p_service uuid,
  p_starts_at timestamptz,
  p_party_size integer,
  p_note text default null,
  p_diet_line text default null,
  p_diet_consent boolean default false,
  p_guide_code text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  p public.providers;
  s public.business_services;
  rate record;
  v_problem text;
  v_guide uuid;
  v_id uuid;
  v_note text;
  v_diet text;
  v_max_party integer;
begin
  if v_user is null then
    raise exception 'reservation_refused: not_signed_in' using errcode = 'P0001';
  end if;
  if not private.is_onboarded() then
    raise exception 'reservation_refused: not_onboarded' using errcode = 'P0001';
  end if;

  select * into p from public.providers pr where pr.id = p_provider;
  if not found then
    raise exception 'reservation_refused: not_open' using errcode = 'P0001';
  end if;
  if p.owner_id = v_user then
    raise exception 'reservation_refused: own_business' using errcode = 'P0001';
  end if;
  -- The full rules (approved type, licence, rate, hours, services), not the cheap read check (L9).
  if not private.provider_open_for_reservations(p.id) then
    raise exception 'reservation_refused: not_open' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('reservations:traveller:' || v_user::text, 0));

  -- Traveller no-show pause: 2 no-shows in 90 days, then no reservations for 30 days after the latest.
  -- Counted from the reservation time; no-shows with an open dispute do not count (review M2).
  if (select count(*) from public.reservations r
      where r.traveler_id = v_user and r.status = 'no_show' and r.starts_at > now() - interval '90 days'
        and not (r.disputed_at is not null and r.dispute_resolved_at is null)) >= 2
     and (select max(r.starts_at) from public.reservations r
          where r.traveler_id = v_user and r.status = 'no_show'
            and not (r.disputed_at is not null and r.dispute_resolved_at is null)) > now() - interval '30 days' then
    raise exception 'reservation_refused: no_show_pause' using errcode = 'P0001';
  end if;
  -- Request caps (review M3): 10 a day, 3 a day for accounts younger than 3 days.
  if (select count(*) from public.reservations r
      where r.traveler_id = v_user and r.created_at > now() - interval '24 hours')
     >= (case when (select u.created_at from auth.users u where u.id = v_user) > now() - interval '3 days'
             then 3 else 10 end) then
    raise exception 'reservation_refused: too_many_requests' using errcode = 'P0001';
  end if;
  if (select count(*) from public.reservations r
      where r.traveler_id = v_user and r.status in ('requested', 'other_time_offered')) >= 5 then
    raise exception 'reservation_refused: too_many_open' using errcode = 'P0001';
  end if;
  if (select count(*) from public.reservations r
      where r.traveler_id = v_user and r.provider_id = p.id
        and (r.created_at at time zone 'Africa/Dar_es_Salaam')::date = private.tz_today()) >= 3 then
    raise exception 'reservation_refused: too_many_today' using errcode = 'P0001';
  end if;

  if p_service is not null then
    select * into s from public.business_services bs
    where bs.id = p_service and bs.provider_id = p.id and bs.active;
    if not found then
      raise exception 'reservation_refused: service_not_found' using errcode = 'P0001';
    end if;
  elsif p.business_type in ('spa', 'salon') then
    raise exception 'reservation_refused: service_required' using errcode = 'P0001';
  end if;

  select x.kind, x.amount_tzs, x.percent, x.max_guests_counted, x.price_list_id into rate
  from private.reservation_rate_for(p.business_type, p.id, p_service) x limit 1;
  if rate.kind is null then
    raise exception 'reservation_refused: %', case when p_service is null then 'service_required' else 'no_rate' end
      using errcode = 'P0001';
  end if;
  -- A percent rate needs a listed price to copy (a restaurant with a percent rate needs a service).
  if rate.kind = 'percent' and (p_service is null or s.price_tzs is null) then
    raise exception 'reservation_refused: service_required' using errcode = 'P0001';
  end if;

  v_max_party := case when p_service is null then 20 else s.max_people end;
  if p_party_size is null or p_party_size < 1 or p_party_size > v_max_party then
    raise exception 'reservation_refused: party_size' using errcode = 'P0001';
  end if;

  v_problem := private.reservation_time_problem(p.id, p_service, p_starts_at);
  if v_problem is not null then
    raise exception 'reservation_refused: %', v_problem using errcode = 'P0001';
  end if;

  if char_length(coalesce(p_note, '')) > 300 then
    raise exception 'reservation_refused: note_too_long' using errcode = 'P0001';
  end if;
  v_note := left(private.reservation_mask(p_note), 300);
  if nullif(btrim(coalesce(p_diet_line, '')), '') is not null then
    if not coalesce(p_diet_consent, false) then
      raise exception 'reservation_refused: diet_consent_needed' using errcode = 'P0001';
    end if;
    if char_length(btrim(p_diet_line)) > 120 then
      raise exception 'reservation_refused: diet_too_long' using errcode = 'P0001';
    end if;
    v_diet := left(private.reservation_mask(p_diet_line), 120);
  end if;

  -- Guide code (referral_codes): an approved guide who is neither the traveller nor the business owner.
  -- The code must resolve to a guide this person had an 'ok' check for with public.guide_code_status()
  -- in the last hour (QA L-G, final review N2): that function counts every attempt and stops after 10
  -- wrong codes or 30 checks an hour, so codes cannot be guessed in a loop here (a refused reservation
  -- rolls back and could not record anything).
  if nullif(btrim(coalesce(p_guide_code, '')), '') is not null then
    select g.id into v_guide
    from public.referral_codes rc
    join public.guides g on g.id = rc.guide_id
    where upper(rc.code) = upper(btrim(p_guide_code)) and g.verification_status = 'approved'
      and g.owner_id <> v_user and g.owner_id <> p.owner_id
      and exists (select 1 from private.guide_code_checks k
                  where k.user_id = v_user and k.ok and k.guide_id = g.id
                    and k.created_at > now() - interval '1 hour')
    limit 1;
    if v_guide is null then
      raise exception 'reservation_refused: guide_code_unknown' using errcode = 'P0001';
    end if;
  end if;

  insert into public.reservations (
    provider_id, provider_ref, business_name, business_type, traveler_id, service_id, service_name, guide_id,
    starts_at, answer_by, party_size, note, commission_kind, commission_rate_tzs, commission_percent,
    max_guests_counted, price_basis_tzs, group_discount_min_people, group_discount_percent,
    price_list_id, guide_share_pct, is_sample)
  values (
    p.id, p.id, left(p.business_name, 160), p.business_type, v_user, p_service, s.name, v_guide,
    p_starts_at,
    least(now() + interval '4 hours', p_starts_at - make_interval(mins => p.reservation_min_notice_min)),
    p_party_size, v_note, rate.kind,
    case when rate.kind = 'percent' then null else rate.amount_tzs end,
    case when rate.kind = 'percent' then rate.percent end,
    case when rate.kind = 'per_guest' then rate.max_guests_counted end,
    case when rate.kind = 'percent' then s.price_tzs end,
    case when rate.kind = 'percent' then s.group_discount_min_people end,
    case when rate.kind = 'percent' then s.group_discount_percent end,
    rate.price_list_id,
    case when v_guide is null then 0 else private.reservation_guide_share_pct() end,
    p.is_sample)
  returning id into v_id;

  if v_diet is not null then
    insert into public.reservation_diet_lines (reservation_id, line, consent_at, delete_after)
    values (v_id, v_diet, now(), (p_starts_at at time zone 'Africa/Dar_es_Salaam')::date + 30);
  end if;

  perform private.reservation_log_add(v_id, 'requested', null, 'requested', null);
  perform private.reservation_notify(v_id, 'reservation_requested');
  return v_id;
end;
$$;
revoke execute on function public.place_reservation(uuid, uuid, timestamptz, integer, text, text, boolean, text) from public, anon;
grant execute on function public.place_reservation(uuid, uuid, timestamptz, integer, text, text, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. The state machine
-- ---------------------------------------------------------------------------
--   owner     requested            confirm | decline | offer_time (p_offered_starts_at)
--   traveller requested, offered   cancel
--   traveller other_time_offered   accept_offer | refuse_offer
--   either    confirmed            cancel (before the time)
--   owner     confirmed, after it  mark_came (p_came_count, 1..party size) | mark_no_show
-- Every other move is refused. Errors are 'reservation_action_refused: <code>'.
create or replace function public.reservation_action(
  p_reservation uuid,
  p_action text,
  p_offered_starts_at timestamptz default null,
  p_note text default null,
  p_came_count integer default null)
returns public.reservation_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  r public.reservations;
  v_owner boolean;
  v_traveller boolean;
  v_problem text;
  v_to public.reservation_status;
  v_note text;
begin
  select * into r from public.reservations res where res.id = p_reservation for update;
  if not found or v_user is null then
    raise exception 'reservation_action_refused: not_found' using errcode = 'P0001';
  end if;
  v_owner := exists (select 1 from public.providers pr where pr.id = r.provider_id and pr.owner_id = v_user);
  v_traveller := coalesce(r.traveler_id = v_user, false);   -- traveler_id may be null (review L7)
  if not (v_owner or v_traveller) then
    raise exception 'reservation_action_refused: not_found' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_note, '')) > 300 then
    raise exception 'reservation_action_refused: note_too_long' using errcode = 'P0001';
  end if;
  v_note := left(private.reservation_mask(p_note), 300);

  if p_action in ('confirm', 'decline', 'offer_time') and v_owner and r.status = 'requested' then
    if r.starts_at <= now() or r.answer_by < now() then
      raise exception 'reservation_action_refused: too_late' using errcode = 'P0001';
    end if;
    if p_action = 'confirm' then
      update public.reservations set status = 'confirmed', business_note = coalesce(v_note, business_note)
      where id = r.id;
      v_to := 'confirmed';
    elsif p_action = 'decline' then
      update public.reservations set status = 'declined', decline_reason = 'business', business_note = v_note
      where id = r.id;
      v_to := 'declined';
    else
      if p_offered_starts_at is null or p_offered_starts_at = r.starts_at then
        raise exception 'reservation_action_refused: time_not_allowed' using errcode = 'P0001';
      end if;
      v_problem := private.reservation_time_problem(r.provider_id, r.service_id, p_offered_starts_at);
      if v_problem is not null then
        raise exception 'reservation_action_refused: %', v_problem using errcode = 'P0001';
      end if;
      update public.reservations set status = 'other_time_offered', offered_starts_at = p_offered_starts_at,
        answer_by = least(now() + interval '4 hours',
                          p_offered_starts_at - make_interval(mins => (select pr.reservation_min_notice_min
                                                                       from public.providers pr where pr.id = r.provider_id))),
        business_note = v_note
      where id = r.id;
      v_to := 'other_time_offered';
    end if;
  elsif p_action in ('accept_offer', 'refuse_offer') and v_traveller and r.status = 'other_time_offered' then
    if p_action = 'accept_offer' then
      if r.offered_starts_at <= now() or r.answer_by < now() then
        raise exception 'reservation_action_refused: too_late' using errcode = 'P0001';
      end if;
      update public.reservations set status = 'confirmed', starts_at = offered_starts_at, offered_starts_at = null
      where id = r.id;
      update public.reservation_diet_lines
      set delete_after = (r.offered_starts_at at time zone 'Africa/Dar_es_Salaam')::date + 30
      where reservation_id = r.id;
      v_to := 'confirmed';
    else
      update public.reservations set status = 'declined', decline_reason = 'offer_refused', offered_starts_at = null
      where id = r.id;
      v_to := 'declined';
    end if;
  elsif p_action = 'cancel'
        and ((v_traveller and r.status in ('requested', 'other_time_offered', 'confirmed'))
             or (v_owner and r.status = 'confirmed')) then
    if r.status = 'confirmed' and r.starts_at <= now() then
      raise exception 'reservation_action_refused: too_late' using errcode = 'P0001';
    end if;
    -- Review M3: at most 5 cancellations by a traveller in 24 hours.
    if v_traveller and (select count(*) from public.reservations x
                        where x.traveler_id = v_user and x.status = 'cancelled' and x.cancelled_by = 'traveller'
                          and x.status_at > now() - interval '24 hours') >= 5 then
      raise exception 'reservation_action_refused: too_many_cancellations' using errcode = 'P0001';
    end if;
    update public.reservations
    set status = 'cancelled', offered_starts_at = null,
        cancelled_by = case when v_traveller then 'traveller' else 'business' end,
        -- Review M1: the business cancelling a confirmed reservation less than 2 hours before.
        business_cancelled_late = (not v_traveller and r.status = 'confirmed' and r.starts_at < now() + interval '2 hours'),
        business_note = case when v_owner then coalesce(v_note, business_note) else business_note end
    where id = r.id;
    v_to := 'cancelled';
  elsif p_action in ('mark_came', 'mark_no_show') and v_owner and r.status = 'confirmed' then
    if r.starts_at > now() then
      raise exception 'reservation_action_refused: too_early' using errcode = 'P0001';
    end if;
    -- Review M2: "did not come" only from 30 minutes after the time.
    if p_action = 'mark_no_show' and r.starts_at > now() - interval '30 minutes' then
      raise exception 'reservation_action_refused: too_early' using errcode = 'P0001';
    end if;
    if p_action = 'mark_came' then
      if p_came_count is null or p_came_count < 1 or p_came_count > r.party_size then
        raise exception 'reservation_action_refused: came_count' using errcode = 'P0001';
      end if;
      update public.reservations set status = 'completed', came_count = p_came_count, completed_by = 'business'
      where id = r.id;
      v_to := 'completed';
    else
      update public.reservations set status = 'no_show' where id = r.id;
      v_to := 'no_show';
    end if;
  else
    raise exception 'reservation_action_refused: not_allowed' using errcode = 'P0001';
  end if;

  perform private.reservation_log_add(r.id, p_action, r.status, v_to, case when v_owner then 'business' else 'traveller' end);
  perform private.reservation_notify(r.id, case
    when p_action = 'confirm' then 'reservation_confirmed'
    when p_action = 'decline' then 'reservation_declined'
    when p_action = 'offer_time' then 'reservation_other_time'
    when p_action = 'accept_offer' then 'reservation_offer_accepted'
    when p_action = 'refuse_offer' then 'reservation_offer_refused'
    when p_action = 'cancel' and v_traveller then 'reservation_cancelled_by_traveller'
    when p_action = 'cancel' then 'reservation_cancelled_by_business'
    else 'none' end);
  return v_to;
end;
$$;
revoke execute on function public.reservation_action(uuid, text, timestamptz, text, integer) from public, anon;
grant execute on function public.reservation_action(uuid, text, timestamptz, text, integer) to authenticated;

-- "Did your visit happen?": the traveller answers once, from the day after the reservation date for
-- 14 days. With "yes", the traveller may also say how many came (asked when the business counted
-- fewer than booked; review M1). A mismatch with the business's answer, or more people than the
-- business counted, holds the commission for an admin (trigger). A late "no" (or a higher count) on a
-- line already invoiced, paid or waived does not reopen it; admins are alerted (review L4).
drop function if exists public.reservation_visit_answer(uuid, boolean);
create or replace function public.reservation_visit_answer(p_reservation uuid, p_happened boolean, p_people integer default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reservations;
  v_day date;
begin
  select * into r from public.reservations res
  where res.id = p_reservation and res.traveler_id = (select auth.uid()) for update;
  if not found or p_happened is null then
    raise exception 'reservation_action_refused: not_found' using errcode = 'P0001';
  end if;
  v_day := (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date;
  if r.status not in ('confirmed', 'completed', 'no_show') or r.traveller_answered_at is not null
     or private.tz_today() <= v_day or private.tz_today() > v_day + 14 then
    raise exception 'reservation_action_refused: not_allowed' using errcode = 'P0001';
  end if;
  if p_people is not null and (not p_happened or p_people < 1 or p_people > r.party_size) then
    raise exception 'reservation_action_refused: came_count' using errcode = 'P0001';
  end if;
  -- The trigger compares the answer with the outcome (now, or when the business or the job marks it).
  update public.reservations
  set traveller_said_happened = p_happened, traveller_said_people = p_people, traveller_answered_at = now()
  where id = r.id;
  if r.commission_status in ('invoiced', 'paid', 'waived') and not r.is_sample
     and ((r.status = 'completed' and not p_happened)
          or (r.status = 'completed' and p_people is not null and p_people > coalesce(r.came_count, r.party_size))) then
    perform private.notify_admins('reservation_late_answer',
      jsonb_build_object('reservation_id', r.id, 'link', '/admin/commissions#reservation-disputes'));
  end if;
  perform private.reservation_log_add(r.id, case when p_happened then 'traveller_said_yes' else 'traveller_said_no' end,
                                      r.status, r.status, 'traveller');
end;
$$;
revoke execute on function public.reservation_visit_answer(uuid, boolean, integer) from public, anon;
grant execute on function public.reservation_visit_answer(uuid, boolean, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Admin: disputes and commission marks (two-step admins only; logged)
-- ---------------------------------------------------------------------------
create or replace function public.admin_resolve_reservation_dispute(p_reservation uuid, p_outcome text, p_detail text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reservations;
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  -- completed: it took place (commission owed, with the higher of the two counts when the traveller
  --   gave one); no_show: the traveller did not come (counts for the pause);
  -- business_fault: the business could not receive the guest (review M2): nothing owed, no strike.
  if p_outcome not in ('completed', 'no_show', 'business_fault') then
    raise exception 'outcome must be completed, no_show or business_fault' using errcode = 'P0001';
  end if;
  select * into r from public.reservations res where res.id = p_reservation for update;
  if not found or r.disputed_at is null or r.dispute_resolved_at is not null then
    raise exception 'no open dispute' using errcode = 'P0001';
  end if;
  update public.reservations
  set dispute_resolved_at = now(), dispute_outcome = p_outcome,
      status = case p_outcome when 'business_fault' then 'cancelled' else p_outcome end::public.reservation_status,
      cancelled_by = case when p_outcome = 'business_fault' then 'admin' end,
      came_count = case when p_outcome = 'completed'
                        then least(party_size, greatest(coalesce(came_count, party_size), coalesce(traveller_said_people, 0))) end,
      completed_by = case when p_outcome = 'completed' then coalesce(completed_by, 'admin') end
  where id = r.id;
  -- Fixed codes only in the log (review L8).
  perform private.reservation_log_add(r.id, 'dispute_' || p_outcome, r.status,
    case p_outcome when 'business_fault' then 'cancelled' else p_outcome end::public.reservation_status,
    case when p_detail in ('admin_page', 'phoned_both', 'phoned_business', 'phoned_traveller', 'evidence') then p_detail
         else 'admin' end);
end;
$$;
revoke execute on function public.admin_resolve_reservation_dispute(uuid, text, text) from public, anon;
grant execute on function public.admin_resolve_reservation_dispute(uuid, text, text) to authenticated;

create or replace function public.reservation_billing_on()
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.feature_on('reservation_commission_billing');
$$;
revoke execute on function public.reservation_billing_on() from public;
grant execute on function public.reservation_billing_on() to anon, authenticated;

-- Monthly list per business (Tanzania month of the reservation time). p_month = any day in the month.
create or replace function public.admin_reservation_commission_month(p_month date)
returns table (
  provider_id uuid, business_name text, completed integer, held integer, no_show integer,
  commission_owed_tzs bigint, commission_invoiced_tzs bigint, commission_paid_tzs bigint,
  commission_waived_tzs bigint, guide_share_tzs bigint, billing_on boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from date := date_trunc('month', p_month)::date;
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  return query
    select r.provider_ref, max(r.business_name),   -- grouped by the copied id (review L2)
           (count(*) filter (where r.status = 'completed'))::integer,
           (count(*) filter (where r.commission_status = 'held'))::integer,
           (count(*) filter (where r.status = 'no_show'))::integer,
           coalesce(sum(r.commission_tzs) filter (where r.commission_status = 'owed'), 0)::bigint,
           coalesce(sum(r.commission_tzs) filter (where r.commission_status = 'invoiced'), 0)::bigint,
           coalesce(sum(r.commission_tzs) filter (where r.commission_status = 'paid'), 0)::bigint,
           coalesce(sum(r.commission_tzs) filter (where r.commission_status = 'waived'), 0)::bigint,
           coalesce(sum(r.guide_share_tzs) filter (where r.commission_status in ('owed', 'invoiced', 'paid')), 0)::bigint,
           private.feature_on('reservation_commission_billing')
    from public.reservations r
    where not r.is_sample
      and (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date >= v_from
      and (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date < (v_from + interval '1 month')::date
    group by r.provider_ref
    having count(*) filter (where r.status in ('completed', 'no_show')) > 0
    order by max(r.business_name);
end;
$$;
revoke execute on function public.admin_reservation_commission_month(date) from public, anon;
grant execute on function public.admin_reservation_commission_month(date) to authenticated;

-- Signs of under-reporting per business and month (review M1), for operations to look at:
--   due          reservations whose time came: completed, no-show, or cancelled late by the business
--   no_show      marked "did not come" (open disputes included)
--   low_count    completed with fewer people than booked
--   late_cancel  the business cancelled a confirmed reservation less than 2 hours before
-- Rates are percent of due, one decimal. Nothing is decided automatically.
create or replace function public.admin_reservation_quality_month(p_month date)
returns table (
  provider_id uuid, business_name text, due integer, no_show integer, low_count integer, late_cancel integer,
  disputed integer, no_show_rate numeric, low_count_rate numeric, late_cancel_rate numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from date := date_trunc('month', p_month)::date;
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  return query
    with m as (
      select r.provider_ref as ref, max(r.business_name) as name,
             count(*) filter (where r.status in ('completed', 'no_show')
                                    or (r.status = 'cancelled' and r.business_cancelled_late))::integer as due,
             count(*) filter (where r.status = 'no_show')::integer as ns,
             count(*) filter (where r.status = 'completed' and r.came_count < r.party_size)::integer as low,
             count(*) filter (where r.business_cancelled_late)::integer as late,
             count(*) filter (where r.disputed_at is not null)::integer as disp
      from public.reservations r
      where not r.is_sample
        and (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date >= v_from
        and (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date < (v_from + interval '1 month')::date
      group by r.provider_ref)
    select m.ref, m.name, m.due, m.ns, m.low, m.late, m.disp,
           round(m.ns * 100.0 / nullif(m.due, 0), 1),
           round(m.low * 100.0 / nullif(m.due, 0), 1),
           round(m.late * 100.0 / nullif(m.due, 0), 1)
    from m
    where m.due > 0
    order by (m.ns + m.low + m.late) * 1.0 / m.due desc, m.name;
end;
$$;
revoke execute on function public.admin_reservation_quality_month(date) from public, anon;
grant execute on function public.admin_reservation_quality_month(date) to authenticated;

-- Marks a business's month: owed -> invoiced, invoiced -> paid, or owed / invoiced -> waived (final,
-- review L5). Invoiced and paid are refused while the billing switch is off (statements are for
-- information only); every mark is refused for the running month. p_provider is the business id
-- (provider_ref, so a deleted business can still be marked).
create or replace function public.admin_set_reservation_commission(p_provider uuid, p_month date, p_to text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from date := date_trunc('month', p_month)::date;
  v_count integer;
  v_id uuid;
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  if p_to not in ('invoiced', 'paid', 'waived') then
    raise exception 'unknown mark' using errcode = 'P0001';
  end if;
  if p_to in ('invoiced', 'paid') and not private.feature_on('reservation_commission_billing') then
    raise exception 'billing is off' using errcode = 'P0001',
      hint = 'Statements are for information only. Walter turns billing on.';
  end if;
  if v_from >= date_trunc('month', private.tz_today())::date then
    raise exception 'month not finished' using errcode = 'P0001';
  end if;
  v_count := 0;
  for v_id in
    select r.id from public.reservations r
    where r.provider_ref = p_provider and not r.is_sample
      and (r.commission_status = case when p_to = 'paid' then 'invoiced' else 'owed' end
           or (p_to = 'waived' and r.commission_status = 'invoiced'))
      and (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date >= v_from
      and (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date < (v_from + interval '1 month')::date
    for update
  loop
    update public.reservations set commission_status = p_to where id = v_id;
    perform private.reservation_log_add(v_id, 'commission_' || p_to, 'completed', 'completed', null);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.admin_set_reservation_commission(uuid, date, text) from public, anon;
grant execute on function public.admin_set_reservation_commission(uuid, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Lists for the screens
-- ---------------------------------------------------------------------------
create or replace function private.reservation_diet_visible(p_reservation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.reservations r
    where r.id = p_reservation
      and (r.traveler_id = (select auth.uid())
           or private.is_admin()
           or (r.status in ('requested', 'confirmed', 'other_time_offered')
               and private.tz_today() <= (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date + 1
               and exists (select 1 from public.providers pr
                           where pr.id = r.provider_id and pr.owner_id = (select auth.uid())))));
$$;
revoke execute on function private.reservation_diet_visible(uuid) from public;
grant execute on function private.reservation_diet_visible(uuid) to authenticated;

-- The traveller's own reservations, newest first.
-- Returned columns changed while unapplied (answer_by); drop first in case a test project has the older one.
drop function if exists public.my_reservations();
create or replace function public.my_reservations()
returns table (
  id uuid, provider_id uuid, business_name text, business_type text, service_name text,
  starts_at timestamptz, party_size integer, note text, status public.reservation_status,
  offered_starts_at timestamptz, business_note text, cancelled_by text, decline_reason text,
  diet_line text, traveller_said_happened boolean, can_answer_visit boolean,
  commission_kind text, commission_rate_tzs integer, commission_percent numeric, created_at timestamptz,
  asks_people_count boolean, answer_by timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.provider_id, r.business_name, r.business_type, r.service_name, r.starts_at, r.party_size,
         r.note, r.status, r.offered_starts_at, r.business_note, r.cancelled_by, r.decline_reason,
         d.line, r.traveller_said_happened,
         (r.traveller_answered_at is null and r.status in ('confirmed', 'completed', 'no_show')
          and private.tz_today() > (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date
          and private.tz_today() <= (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date + 14),
         r.commission_kind, r.commission_rate_tzs, r.commission_percent, r.created_at,
         -- Review M1: ask "How many of you came?" when the business counted fewer than booked.
         (r.status = 'completed' and r.came_count < r.party_size),
         case when r.status in ('requested', 'other_time_offered') then r.answer_by end
  from public.reservations r
  left join public.reservation_diet_lines d on d.reservation_id = r.id
  where r.traveler_id = (select auth.uid())
  order by r.starts_at desc
  limit 200;
$$;
revoke execute on function public.my_reservations() from public, anon;
grant execute on function public.my_reservations() to authenticated;

-- A business's reservations between two Tanzania dates (owner or admin). The traveller is shown by
-- first name only; the diet line only while the business may see it.
drop function if exists public.business_reservations(uuid, date, date);
create or replace function public.business_reservations(p_provider uuid, p_from date, p_to date)
returns table (
  id uuid, starts_at timestamptz, party_size integer, service_name text, traveller_first_name text,
  note text, diet_line text, status public.reservation_status, offered_starts_at timestamptz,
  business_note text, cancelled_by text, came_count integer, disputed boolean,
  commission_kind text, commission_rate_tzs integer, commission_percent numeric, max_guests_counted integer,
  price_basis_tzs integer, commission_tzs integer, commission_status text, is_sample boolean,
  answer_by timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.owns_provider(p_provider) or private.is_admin()) then
    raise exception 'Business not found' using errcode = 'P0001';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 93 then
    raise exception 'Pick up to 93 days' using errcode = 'P0001';
  end if;
  return query
    select r.id, r.starts_at, r.party_size, r.service_name,
           coalesce(nullif(split_part(btrim(pf.full_name), ' ', 1), ''), 'Traveller'),
           -- Review M4: the note only until 30 days after the date (it is cleared then anyway).
           case when private.tz_today() <= (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date + 30 then r.note end,
           case when private.reservation_diet_visible(r.id) then d.line end,
           r.status, r.offered_starts_at, r.business_note, r.cancelled_by, r.came_count,
           r.disputed_at is not null and r.dispute_resolved_at is null,
           r.commission_kind, r.commission_rate_tzs, r.commission_percent, r.max_guests_counted,
           r.price_basis_tzs, r.commission_tzs, r.commission_status, r.is_sample,
           case when r.status in ('requested', 'other_time_offered') then r.answer_by end
    from public.reservations r
    left join public.profiles pf on pf.id = r.traveler_id
    left join public.reservation_diet_lines d on d.reservation_id = r.id
    where r.provider_id = p_provider
      and (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date between p_from and p_to
    order by r.starts_at;
end;
$$;
revoke execute on function public.business_reservations(uuid, date, date) from public, anon;
grant execute on function public.business_reservations(uuid, date, date) to authenticated;

-- The owner's monthly statement: totals per commission status. billing_on false = "for information,
-- no charge".
create or replace function public.business_reservation_statement(p_provider uuid, p_month date)
returns table (commission_status text, reservation_count integer, guests_counted integer, commission_tzs bigint, billing_on boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from date := date_trunc('month', p_month)::date;
begin
  if not (private.owns_provider(p_provider) or private.is_admin()) then
    raise exception 'Business not found' using errcode = 'P0001';
  end if;
  return query
    select r.commission_status, count(*)::integer, coalesce(sum(r.came_count), 0)::integer,
           coalesce(sum(r.commission_tzs), 0)::bigint, private.feature_on('reservation_commission_billing')
    from public.reservations r
    where r.provider_id = p_provider and r.status = 'completed'
      and (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date >= v_from
      and (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date < (v_from + interval '1 month')::date
    group by r.commission_status
    order by 1;
end;
$$;
revoke execute on function public.business_reservation_statement(uuid, date) from public, anon;
grant execute on function public.business_reservation_statement(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Hourly job
-- ---------------------------------------------------------------------------
create or replace function private.run_reservation_jobs()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_from public.reservation_status;
  v_expired integer := 0;
  v_completed integer := 0;
  v_reminded integer := 0;
  v_asked integer := 0;
  v_texts integer := 0;
  v_diet integer := 0;
  v_failed integer := 0;
begin
  -- Each row in its own block (review L3): one bad row never stops the rest. Only the step, the id
  -- and the error code are logged, never row contents.

  -- Unanswered requests and offers whose time has passed: declined, no answer.
  for v_id, v_from in
    select r.id, r.status from public.reservations r
    where r.status in ('requested', 'other_time_offered')
      and (r.answer_by < now() or coalesce(r.offered_starts_at, r.starts_at) < now())
    for update skip locked
  loop
    begin
      update public.reservations set status = 'declined', decline_reason = 'no_answer', offered_starts_at = null
      where id = v_id;
      perform private.reservation_log_add(v_id, 'expired', v_from, 'declined', 'no_answer');
      -- The business did not answer, or the traveller did not answer the business's other time.
      perform private.reservation_notify(v_id, case when v_from = 'other_time_offered'
                                                    then 'reservation_offer_expired' else 'reservation_expired' end);
      v_expired := v_expired + 1;
    exception when others then
      raise warning 'run_reservation_jobs: expire failed for reservation % (%)', v_id, sqlstate;
      v_failed := v_failed + 1;
    end;
  end loop;

  -- Confirmed, not marked by the business 3 days after the time: completed as booked (P3).
  for v_id in
    select r.id from public.reservations r
    where r.status = 'confirmed' and r.starts_at < now() - interval '3 days'
    for update skip locked
  loop
    begin
      update public.reservations set status = 'completed', came_count = party_size, completed_by = 'auto'
      where id = v_id;
      perform private.reservation_log_add(v_id, 'auto_completed', 'confirmed', 'completed', 'auto');
      v_completed := v_completed + 1;
    exception when others then
      raise warning 'run_reservation_jobs: auto-complete failed for reservation % (%)', v_id, sqlstate;
      v_failed := v_failed + 1;
    end;
  end loop;

  -- Reminder to the owner 2 hours after the time: mark came or did not come.
  for v_id in
    select r.id from public.reservations r
    where r.status = 'confirmed' and r.owner_reminded_at is null
      and r.starts_at < now() - interval '2 hours'
    for update skip locked
  loop
    begin
      update public.reservations set owner_reminded_at = now() where id = v_id;
      perform private.reservation_notify(v_id, 'reservation_mark_reminder');
      v_reminded := v_reminded + 1;
    exception when others then
      raise warning 'run_reservation_jobs: reminder failed for reservation % (%)', v_id, sqlstate;
      v_failed := v_failed + 1;
    end;
  end loop;

  -- "Did your visit happen?" the day after (Tanzania date), once.
  for v_id in
    select r.id from public.reservations r
    where r.status in ('confirmed', 'completed', 'no_show') and r.traveller_asked_at is null
      and r.traveller_answered_at is null and r.traveler_id is not null
      and private.tz_today() > (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date
      and private.tz_today() <= (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date + 14
    for update skip locked
  loop
    begin
      update public.reservations set traveller_asked_at = now() where id = v_id;
      perform private.reservation_notify(v_id, 'reservation_visit_question');
      v_asked := v_asked + 1;
    exception when others then
      raise warning 'run_reservation_jobs: visit question failed for reservation % (%)', v_id, sqlstate;
      v_failed := v_failed + 1;
    end;
  end loop;

  -- Review M4: the traveller's note and the business's note go 30 days after the reservation date,
  -- like the diet line. Dates, counts and commission stay.
  for v_id in
    select r.id from public.reservations r
    where r.texts_cleared_at is null
      and (r.note is not null or r.business_note is not null)
      and (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date + 30 < private.tz_today()
    for update skip locked
  loop
    begin
      update public.reservations set note = null, business_note = null, texts_cleared_at = now() where id = v_id;
      v_texts := v_texts + 1;
    exception when others then
      raise warning 'run_reservation_jobs: clearing texts failed for reservation % (%)', v_id, sqlstate;
      v_failed := v_failed + 1;
    end;
  end loop;

  -- Diet lines: deleted 30 days after the reservation date (P5).
  delete from public.reservation_diet_lines d where d.delete_after < private.tz_today();
  get diagnostics v_diet = row_count;

  -- Guide code checks are only needed for the last hour; keep one day.
  delete from private.guide_code_checks k where k.created_at < now() - interval '1 day';

  return jsonb_build_object('expired', v_expired, 'completed', v_completed, 'reminded', v_reminded,
                            'asked', v_asked, 'texts_cleared', v_texts, 'diet_lines_deleted', v_diet,
                            'failed', v_failed);
end;
$$;
revoke execute on function private.run_reservation_jobs() from public, anon, authenticated;

-- Every 15 minutes, so unanswered requests close soon after their answer-by time (QA 2026-11-23).
-- Each step reads only open rows through partial indexes, so a run is cheap.
select cron.schedule('kwetuly-reservations', '*/15 * * * *', 'select private.run_reservation_jobs()');

-- ---------------------------------------------------------------------------
-- 10. RLS and grants
-- ---------------------------------------------------------------------------
alter table public.reservations enable row level security;
alter table public.reservation_diet_lines enable row level security;
alter table public.reservation_log enable row level security;

revoke all on public.reservations, public.reservation_diet_lines, public.reservation_log from anon, authenticated;
grant select on public.reservations, public.reservation_diet_lines, public.reservation_log to authenticated;

-- Review L1: travellers read their own rows and admins all rows directly. Business owners have no
-- direct read: their screens use business_reservations() and business_reservation_statement(), which
-- return only the columns they need (first name, note within 30 days, diet line in its window).
drop policy if exists "Travellers, owners and admins read reservations" on public.reservations;
drop policy if exists "Travellers and admins read reservations" on public.reservations;
create policy "Travellers and admins read reservations" on public.reservations
  for select to authenticated
  using (traveler_id = (select auth.uid()) or (select private.is_admin()));

-- Diet lines: the traveller and admins directly; the business only through business_reservations().
drop policy if exists "Diet line readers" on public.reservation_diet_lines;
create policy "Diet line readers" on public.reservation_diet_lines
  for select to authenticated
  using ((select private.is_admin())
         or exists (select 1 from public.reservations r
                    where r.id = reservation_id and r.traveler_id = (select auth.uid())));

drop policy if exists "Admins read the reservation log" on public.reservation_log;
create policy "Admins read the reservation log" on public.reservation_log
  for select to authenticated
  using ((select private.is_admin()));
