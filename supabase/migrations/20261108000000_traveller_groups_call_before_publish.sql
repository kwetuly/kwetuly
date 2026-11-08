-- Traveller group trips: post first, call before publishing (Walter, 2026-11-08).
-- Not applied yet; revised after the security review (M1, M2, L1, L2, L3) and Walter's L2 decision.
--
--   A  A signed-in, onboarded traveller whose account phone is a full international number
--      (^\+[1-9][0-9]{7,14}$), confirmed or not, may submit a group trip. As before, the guard trigger
--      forces every new trip to 'pending', and the read policy shows a pending trip only to its
--      organiser and to admins. private.can_organize_group() is also used by the trip offer guard,
--      but offers must carry a guide or a company name (trip_offers check constraint), so the
--      traveller branch never applies to offers.
--   B  New column profiles.phone_called_at: when Kwetuly last confirmed the account phone by calling
--      it (the admin "Phone confirmed" button). Only admins and trusted server code can set it, and
--      it is cleared whenever the phone changes, unless that same update sets it. An SMS code
--      (private.sync_phone_confirmed) still sets phone_verified_at as before, but never
--      phone_called_at, so an SMS confirmation alone never makes or keeps a traveller trip public
--      (Walter's L2 decision: option b).
--   C  Phone gate: a traveller trip can only become 'approved' while phone_called_at is set. Checked
--      on inserts, on status changes, when the organiser changes and when organizer_kind changes (M1:
--      a guide trip turns into a traveller trip when the guide row is deleted). The profile row is
--      read FOR SHARE (L1), so an approval and a phone change cannot both slip through at once.
--      In the organizer_kind case the trip is moved back to 'pending' instead of raising an error,
--      so deleting a guide or an account (foreign key "set null" on guide_id) is never blocked.
--      The gate runs after group_trips_guard and group_trips_guard_name (BEFORE triggers fire in
--      name order), so it sees the final status and organizer_kind.
--   D  Any change of a traveller organiser's phone (new number, removed number, a new number
--      confirmed by SMS code), or an admin clearing phone_called_at, sends every approved traveller
--      trip they organise back to 'pending': it disappears from the public list and from other users,
--      nobody can ask to join (private.group_trip_open needs 'approved'), and the existing
--      group_trips_notify trigger tells admins it is waiting again. Accepted members keep their seat
--      and the trip chat; the trip page is hidden from them until Kwetuly calls the new number,
--      presses "Phone confirmed" and approves the trip again.
--   E  Spam limit (M2) for non-trusted callers on traveller trips: at most 3 open trips (pending or
--      approved, not cancelled) per organiser, and at most 5 new trips in 24 hours (counted in
--      private.group_trip_submissions, so deleting a trip does not free a slot). The open-trip limit
--      also applies when an organiser re-opens one of their trips (un-cancels it, or edits a rejected
--      one, which sends it back to 'pending'). Error message: 'group_trip_limit'.
--   F  One-off clean-up: approved, not-cancelled traveller trips whose organiser has no
--      phone_called_at go back to 'pending'. phone_called_at starts empty for everyone (a confirmed
--      phone today may come from an SMS code, which no longer counts), so this is every approved,
--      open traveller trip. No rows are deleted.
--
-- Read-only count to run on live before applying (same condition as F, before the column exists):
--   select count(*) as trips_to_pending
--   from public.group_trips t
--   where t.organizer_kind = 'traveller'
--     and t.status = 'approved'
--     and not t.cancelled;
--
-- Rollback (run as one transaction; trips moved to 'pending' by D or F stay pending, and admins approve
-- them again from the queue):
--   drop trigger if exists group_trips_traveller_limit on public.group_trips;
--   drop function if exists private.limit_traveller_groups();
--   drop function if exists private.traveller_group_limit_reached(uuid, boolean);
--   drop table if exists private.group_trip_submissions;
--   drop trigger if exists profiles_unpublish_unconfirmed_groups on public.profiles;
--   drop function if exists private.unpublish_unconfirmed_traveller_groups();
--   drop trigger if exists group_trips_phone_gate on public.group_trips;
--   create or replace function private.check_group_approval()
--   returns trigger language plpgsql security definer set search_path = ''
--   as $$
--   begin
--     if new.status = 'approved' and old.status is distinct from 'approved' and new.organizer_kind = 'traveller'
--        and not exists (select 1 from public.profiles p where p.id = new.organizer_id and p.phone_verified_at is not null) then
--       raise exception 'Confirm the organiser''s phone number before approving this group';
--     end if;
--     return new;
--   end;
--   $$;
--   create trigger group_trips_approval_check
--     before update of status on public.group_trips
--     for each row execute function private.check_group_approval();
--   create or replace function private.can_organize_group(p_guide_id uuid, p_company text)
--   returns boolean language sql stable security definer set search_path = ''
--   as $$
--     select private.is_admin()
--       or (p_guide_id is not null and exists (
--             select 1 from public.guides g
--             where g.id = p_guide_id and g.owner_id = (select auth.uid()) and g.verification_status = 'approved'))
--       or (p_guide_id is null and p_company is not null and private.has_approved_business())
--       or (p_guide_id is null and p_company is null and exists (
--             select 1 from public.profiles p where p.id = (select auth.uid()) and p.phone_verified_at is not null));
--   $$;
--   -- public.guard_profile_role(): re-create the version from 20261016001800_onboarded_gate_followup.sql.
--   alter table public.profiles drop column phone_called_at;
--   (Then deploy the website and app from before this change: they read phone_called_at.)

-- ---------------------------------------------------------------------------
-- A. Who may submit a group trip (insert policy on group_trips, offer guard).
--    Same as 20261016001400 except the traveller branch: a full international phone number on the
--    account is enough to submit.
-- ---------------------------------------------------------------------------
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
          select 1 from public.profiles p
          where p.id = (select auth.uid()) and p.phone ~ '^\+[1-9][0-9]{7,14}$'));
$$;

-- ---------------------------------------------------------------------------
-- B. Kwetuly's call, separate from an SMS code.
-- ---------------------------------------------------------------------------
alter table public.profiles add column phone_called_at timestamptz;
comment on column public.profiles.phone_called_at is
  'When Kwetuly last confirmed profiles.phone by calling it (admin "Phone confirmed"). Cleared when the phone changes. Traveller group trips go public only while this is set.';

-- Same as 20261016001800 (M1) plus phone_called_at, which follows the same rules as phone_verified_at
-- except that nothing but an admin or trusted server code sets it.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.is_trusted() then
    if new.role is distinct from old.role then
      raise exception 'Only admins can change roles';
    end if;
    new.onboarded_at := old.onboarded_at;
    -- A confirmed number stays confirmed only while it is unchanged.
    if new.phone is distinct from old.phone then
      new.phone_verified_at := null;
      new.phone_called_at := null;
    else
      new.phone_verified_at := old.phone_verified_at;
      new.phone_called_at := old.phone_called_at;
    end if;
  elsif new.phone is distinct from old.phone then
    -- Trusted callers too: a new number is not confirmed unless this same update confirms it.
    if new.phone_verified_at is not distinct from old.phone_verified_at then
      new.phone_verified_at := null;
    end if;
    if new.phone_called_at is not distinct from old.phone_called_at then
      new.phone_called_at := null;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- C. Phone gate: a traveller's group is public only after Kwetuly's call.
-- ---------------------------------------------------------------------------
create or replace function private.check_group_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'approved' or new.organizer_kind <> 'traveller' then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.status = 'approved'
     and old.organizer_id = new.organizer_id
     and old.organizer_kind = new.organizer_kind then
    -- Already public under the same organiser and kind; phone changes are handled by D.
    return new;
  end if;

  -- FOR SHARE waits for, and then blocks, a phone change on the same profile (L1).
  perform 1 from public.profiles p
   where p.id = new.organizer_id and p.phone_called_at is not null
   for share;
  if found then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'approved' and old.organizer_id = new.organizer_id then
    -- M1: the trip became a traveller trip (its guide row was deleted). Take it off the public list
    -- rather than refuse, so deleting a guide or an account is never blocked.
    new.status := 'pending';
    return new;
  end if;
  raise exception 'Confirm the organiser''s phone number before approving this group';
end;
$$;

revoke execute on function private.check_group_approval() from public, anon, authenticated;

drop trigger if exists group_trips_approval_check on public.group_trips;
drop trigger if exists group_trips_phone_gate on public.group_trips;
create trigger group_trips_phone_gate
  before insert or update on public.group_trips
  for each row execute function private.check_group_approval();

-- ---------------------------------------------------------------------------
-- D. Phone changed or call cleared: take the organiser's traveller groups off the public list.
-- ---------------------------------------------------------------------------
create or replace function private.unpublish_unconfirmed_traveller_groups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Runs as the function owner, so guard_group_trip_fields treats it as trusted and keeps 'pending';
  -- group_trips_notify then alerts admins that the trip is waiting again.
  update public.group_trips
     set status = 'pending'
   where organizer_id = new.id
     and organizer_kind = 'traveller'
     and status = 'approved';
  return null;
end;
$$;

revoke execute on function private.unpublish_unconfirmed_traveller_groups() from public, anon, authenticated;

-- Walter's L2 decision (b): ANY phone change counts, including a new number confirmed by SMS code in
-- the same update (private.sync_phone_confirmed). Only Kwetuly's call (phone_called_at) re-opens them.
drop trigger if exists profiles_unpublish_unconfirmed_groups on public.profiles;
create trigger profiles_unpublish_unconfirmed_groups
  after update on public.profiles
  for each row
  when (old.phone is distinct from new.phone
        or (old.phone_called_at is not null and new.phone_called_at is null))
  execute function private.unpublish_unconfirmed_traveller_groups();

-- ---------------------------------------------------------------------------
-- E. Spam limit on traveller group trips (M2).
-- ---------------------------------------------------------------------------
-- One row per traveller trip submitted by a non-trusted caller; kept for 2 days. Not exposed
-- (private schema), RLS on with no policies.
create table private.group_trip_submissions (
  organizer_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index group_trip_submissions_organizer_idx on private.group_trip_submissions (organizer_id, created_at desc);
alter table private.group_trip_submissions enable row level security;
revoke all on private.group_trip_submissions from public, anon, authenticated;

-- SECURITY DEFINER so it can count trips and submissions the caller cannot see; it only ever looks
-- at the caller's own rows (auth.uid()) and answers true/false. The advisory lock per organiser
-- stops two parallel inserts from both slipping under the limit.
create or replace function private.traveller_group_limit_reached(p_trip uuid, p_insert boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    return true;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('group_trip_limit:' || v_uid::text, 0));
  if (select count(*) from public.group_trips t
      where t.organizer_id = v_uid
        and t.organizer_kind = 'traveller'
        and t.status in ('pending', 'approved')
        and not t.cancelled
        and t.id is distinct from p_trip) >= 3 then
    return true;
  end if;
  if p_insert then
    delete from private.group_trip_submissions s
     where s.organizer_id = v_uid and s.created_at < now() - interval '2 days';
    if (select count(*) from private.group_trip_submissions s
        where s.organizer_id = v_uid and s.created_at > now() - interval '24 hours') >= 5 then
      return true;
    end if;
    -- Rolled back with the insert if anything later refuses it (RLS check, other triggers).
    insert into private.group_trip_submissions (organizer_id) values (v_uid);
  end if;
  return false;
end;
$$;

revoke execute on function private.traveller_group_limit_reached(uuid, boolean) from public, anon;
grant execute on function private.traveller_group_limit_reached(uuid, boolean) to authenticated;

-- SECURITY INVOKER so private.is_trusted() sees the real caller: admins and server code are not limited.
create or replace function private.limit_traveller_groups()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.organizer_kind <> 'traveller' or new.cancelled or new.status not in ('pending', 'approved')
     or private.is_trusted() then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.status in ('pending', 'approved') and not old.cancelled then
    -- Already counted as open; edits to an open trip are not limited.
    return new;
  end if;
  if private.traveller_group_limit_reached(new.id, tg_op = 'INSERT') then
    raise exception 'group_trip_limit' using errcode = 'P0001',
      hint = 'At most 3 open group trips, and 5 new ones in 24 hours.';
  end if;
  return new;
end;
$$;

revoke execute on function private.limit_traveller_groups() from public, anon, authenticated;

-- Fires after group_trips_guard and group_trips_guard_name (name order), so status, cancelled and
-- organizer_kind are final.
drop trigger if exists group_trips_traveller_limit on public.group_trips;
create trigger group_trips_traveller_limit
  before insert or update on public.group_trips
  for each row execute function private.limit_traveller_groups();

-- ---------------------------------------------------------------------------
-- F. One-off: no approved, open traveller group without Kwetuly's call.
-- ---------------------------------------------------------------------------
update public.group_trips t
   set status = 'pending'
 where t.organizer_kind = 'traveller'
   and t.status = 'approved'
   and not t.cancelled
   and not exists (select 1 from public.profiles p where p.id = t.organizer_id and p.phone_called_at is not null);
