-- Security review 2026-10, approved by Walter on 2026-10-16: H1, H2, H4, M3 and the first step of H5.
--
--   A (H1)  Admin powers need a two-step (aal2) session: private.is_admin() checks the JWT's aal claim.
--   B (H2)  Business accounts make offers, see open trip requests and run group trips only once
--           Rafrika has approved a (non-sample) listing they own, not just because role = 'provider'.
--   C (H4)  Traveller-run groups never take deposits; changing the deposit sends a group back for
--           review; the price per person is saved on the member row when a member is accepted.
--      (M3) At most one pending deposit order per offer / member (the Edge Function cancels the
--           old one before starting a new one).
--   D (H5)  Enquiries (leads) are accepted only for approved guides and approved businesses, and
--           enquiries from signed-out senders alert by email only (no paid WhatsApp messages).
--
-- BEFORE APPLYING: the admin account must have two-step sign-in turned on (website: /en/security),
-- or the admin pages and every admin-only rule stop working for it until it does.
--
-- Data changes (no deletes): traveller-run groups get deposit_percent = 0; accepted group members get
-- the trip's current price per person copied onto their row.
--
-- Undo:
--   A  re-create private.is_admin() without the aal line (body from 20261012000000_initial_schema.sql).
--   B  re-create private.can_offer() (20261014000100) and private.can_organize_group()
--      (20261016000600); drop function private.has_approved_business().
--   C  re-create public.guard_group_trip_fields() from 20261016000500; drop trigger
--      group_trip_members_price, function private.snapshot_member_price() and column
--      group_trip_members.price_per_person_usd; drop indexes payments_one_pending_offer and
--      payments_one_pending_member. The deposit_percent values set to 0 are not restored (they were
--      on traveller groups, which must not take deposits).
--   D  drop policy "Anyone can send an enquiry to an approved guide or business" and re-create
--      "Anyone can create a lead" (20261012000000); drop function private.lead_target_ok();
--      re-create private.on_lead_created() from 20261012000800.

-- ---------------------------------------------------------------------------
-- A. Admins must use two-step sign-in.
-- Server-side callers (service role, cron, SQL editor) never relied on is_admin(): they have no
-- auth.uid(), and private.is_trusted() lets them through by their database role. Only admin
-- accounts signed in with a password alone lose admin powers.
-- ---------------------------------------------------------------------------
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin'
    );
$$;

-- ---------------------------------------------------------------------------
-- B. Business accounts act as businesses only once Rafrika has approved their listing.
-- ---------------------------------------------------------------------------
create or replace function private.has_approved_business()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.providers p
    where p.owner_id = (select auth.uid()) and p.verification_status = 'approved' and not p.is_sample
  );
$$;

revoke execute on function private.has_approved_business() from public, anon;
grant execute on function private.has_approved_business() to authenticated;

-- Used by the read policy on open trip requests and the insert policy on offers.
create or replace function private.can_offer()
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.is_admin()
    or exists (select 1 from public.guides g where g.owner_id = (select auth.uid()) and g.verification_status = 'approved')
    or private.has_approved_business();
$$;

-- Used by the insert policy on group trips and by the offer guard.
create or replace function private.can_organize_group(p_guide_id uuid, p_company text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin()
    or (p_guide_id is not null and exists (
          select 1 from public.guides g
          where g.id = p_guide_id and g.owner_id = (select auth.uid()) and g.verification_status = 'approved'))
    or (p_guide_id is null and p_company is not null and private.has_approved_business())
    or (p_guide_id is null and p_company is null and exists (
          select 1 from public.profiles p where p.id = (select auth.uid()) and p.phone_verified_at is not null));
$$;

-- ---------------------------------------------------------------------------
-- C1. Group trip guard: traveller-run groups take no deposit; a deposit change is a material change.
-- Same as 20261016000500 otherwise.
-- ---------------------------------------------------------------------------
create or replace function public.guard_group_trip_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.organizer_kind := case when new.guide_id is not null then 'guide'
                             when new.company_name is not null then 'business'
                             else 'traveller' end;
  if private.is_trusted() then
    if new.organizer_kind = 'traveller' then
      new.deposit_percent := 0;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.seats_taken := 0;
    new.cancelled := false;
  else
    new.organizer_id := old.organizer_id;
    new.guide_id := old.guide_id;
    new.company_name := old.company_name;
    new.organizer_kind := old.organizer_kind;
    new.seats_taken := old.seats_taken;
  end if;

  -- Rafrika does not collect deposits for groups run by travellers.
  if new.organizer_kind = 'traveller' then
    new.deposit_percent := 0;
  end if;

  if tg_op = 'UPDATE' then
    -- Material changes send the trip back for review; cancelling does not.
    if (new.title, new.description, new.start_date, new.end_date, new.price_per_person_usd, new.max_people,
        new.already_going, new.deposit_percent)
       is distinct from
       (old.title, old.description, old.start_date, old.end_date, old.price_per_person_usd, old.max_people,
        old.already_going, old.deposit_percent) then
      new.status := 'pending';
    else
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;

update public.group_trips set deposit_percent = 0 where organizer_kind = 'traveller' and deposit_percent <> 0;

-- ---------------------------------------------------------------------------
-- C2. The price per person in force when a member is accepted is saved on the member row, and the
-- deposit is charged on that price, so a later price change cannot change what an accepted member pays.
-- Runs after group_trip_members_guard (triggers fire in name order), so it sees the final status.
-- Not security definer: private.is_trusted() must see the real caller.
-- ---------------------------------------------------------------------------
alter table public.group_trip_members
  add column price_per_person_usd integer check (price_per_person_usd between 0 and 100000);

create or replace function private.snapshot_member_price()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'accepted' then
    if tg_op = 'INSERT' or old.status is distinct from 'accepted' then
      select t.price_per_person_usd into new.price_per_person_usd
      from public.group_trips t where t.id = new.group_trip_id;
    elsif not private.is_trusted() then
      new.price_per_person_usd := old.price_per_person_usd;
    end if;
  else
    new.price_per_person_usd := null;
  end if;
  return new;
end;
$$;

-- Trigger functions cannot be called directly, and private is not exposed through the API.

create trigger group_trip_members_price
  before insert or update on public.group_trip_members
  for each row execute function private.snapshot_member_price();

update public.group_trip_members m
set price_per_person_usd = t.price_per_person_usd
from public.group_trips t
where t.id = m.group_trip_id and m.status = 'accepted' and m.price_per_person_usd is null;

-- ---------------------------------------------------------------------------
-- C3. One pending deposit order per offer and per group member. Payments have never been switched
-- on, so there should be no duplicates; stop with a clear message if there are.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.payments where status = 'pending' and trip_offer_id is not null
             group by trip_offer_id having count(*) > 1)
     or exists (select 1 from public.payments where status = 'pending' and group_member_id is not null
                group by group_member_id having count(*) > 1) then
    raise exception 'Several pending deposit orders exist for the same offer or member. Ask payments-engineer to check them with Selcom and mark the stale ones failed, then run this migration again.';
  end if;
end;
$$;

create unique index payments_one_pending_offer on public.payments (trip_offer_id)
  where status = 'pending' and trip_offer_id is not null;
create unique index payments_one_pending_member on public.payments (group_member_id)
  where status = 'pending' and group_member_id is not null;

-- ---------------------------------------------------------------------------
-- D. Enquiries only for approved guides and approved businesses. Enquiries that name neither
-- (tour and general enquiries) go to Rafrika and are still accepted.
-- ---------------------------------------------------------------------------
create or replace function private.lead_target_ok(p_guide uuid, p_provider uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (p_guide is null or exists (
            select 1 from public.guides g where g.id = p_guide and g.verification_status = 'approved'))
     and (p_provider is null or exists (
            select 1 from public.providers p where p.id = p_provider and p.verification_status = 'approved'));
$$;

revoke execute on function private.lead_target_ok(uuid, uuid) from public;
grant execute on function private.lead_target_ok(uuid, uuid) to anon, authenticated;

drop policy "Anyone can create a lead" on public.leads;
create policy "Anyone can send an enquiry to an approved guide or business" on public.leads
  for insert to anon, authenticated
  with check (
    (traveler_id is null or traveler_id = (select auth.uid()))
    and private.lead_target_ok(guide_id, provider_id)
  );

-- Alerts: enquiries from signed-out senders go by email only (WhatsApp messages cost money and a
-- signed-out form is the easiest one to flood). Signed-in senders keep email, WhatsApp and push.
create or replace function private.on_lead_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_trip text;
  v_payload jsonb;
  v_channels text[];
  v_admin uuid;
begin
  v_channels := case when new.traveler_id is null then '{email}'::text[] else '{email,whatsapp,push}'::text[] end;
  select title_en into v_trip from public.trips where id = new.trip_id;
  v_payload := jsonb_build_object(
    'name', new.traveler_name, 'contact', new.traveler_contact,
    'message', left(coalesce(new.message, ''), 500), 'trip', v_trip);

  if new.guide_id is not null then
    select owner_id into v_owner from public.guides where id = new.guide_id;
    perform private.notify_user('lead_for_guide', v_owner, v_payload || '{"link":"/hub"}',
      private.guide_phone(new.guide_id), v_channels);
  else
    for v_admin in select id from public.profiles where role = 'admin' loop
      perform private.notify_user('lead_for_admin', v_admin, v_payload || '{"link":"/admin"}', null, v_channels);
    end loop;
  end if;
  return new;
end;
$$;

revoke execute on function private.on_lead_created() from public, anon, authenticated;
