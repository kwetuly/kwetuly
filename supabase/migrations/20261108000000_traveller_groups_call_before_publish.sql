-- Traveller group trips: post first, call before publishing (Walter, 2026-11-08).
--
--   A  A signed-in, onboarded traveller with a phone on their account (confirmed or not) may submit
--      a group trip. As before, the guard trigger forces every new trip to 'pending', and the read
--      policy shows a pending trip only to its organiser and to admins.
--      private.can_organize_group() is also used by the trip offer guard, but offers must carry a
--      guide or a company name (trip_offers check constraint), so the traveller branch changed here
--      never applies to offers.
--   B  A traveller's trip can only become (or stay, when the organiser changes) 'approved' while the
--      organiser's phone is confirmed (profiles.phone_verified_at). The check now runs after the
--      guard triggers (group_trips_guard, group_trips_guard_name), so it sees the final status and
--      organizer_kind, and it covers inserts by trusted callers too, not only status updates.
--   C  If a traveller organiser's phone stops being confirmed (they change or remove the number, which
--      makes guard_profile_role clear phone_verified_at, or an admin clears it), every approved trip
--      they organise goes back to 'pending': it disappears from the public list and from other users,
--      nobody can ask to join it (private.group_trip_open needs 'approved'), and the existing
--      group_trips_notify trigger tells admins it is waiting again. Accepted members keep their seat
--      and the trip chat; the trip page is hidden from them until Kwetuly calls the new number,
--      presses "Phone confirmed" and approves the trip again. A number confirmed in the same update
--      (private.sync_phone_confirmed, SMS code) keeps the trips public.
--   D  One-off clean-up: approved traveller trips whose organiser's phone is not confirmed today (only
--      possible from before C existed) go back to 'pending' the same way. No rows are deleted.
--
-- Rollback (run as one transaction; trips moved to 'pending' by C or D stay pending, admins approve
-- them again from the queue once the phone is confirmed):
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

-- ---------------------------------------------------------------------------
-- A. Who may submit a group trip (insert policy on group_trips, offer guard).
--    Same as 20261016001400 except the traveller branch: a phone on the account is enough to submit.
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
          where p.id = (select auth.uid()) and nullif(btrim(p.phone), '') is not null));
$$;

-- ---------------------------------------------------------------------------
-- B. A traveller's group is public only with a confirmed organiser phone.
-- ---------------------------------------------------------------------------
create or replace function private.check_group_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and new.organizer_kind = 'traveller'
     and (tg_op = 'INSERT'
          or old.status is distinct from 'approved'
          or old.organizer_id is distinct from new.organizer_id)
     and not exists (select 1 from public.profiles p where p.id = new.organizer_id and p.phone_verified_at is not null) then
    raise exception 'Confirm the organiser''s phone number before approving this group';
  end if;
  return new;
end;
$$;

revoke execute on function private.check_group_approval() from public, anon, authenticated;

-- BEFORE triggers fire in name order: group_trips_guard and group_trips_guard_name run first and set
-- the final status and organizer_kind, then this check.
drop trigger if exists group_trips_approval_check on public.group_trips;
create trigger group_trips_phone_gate
  before insert or update on public.group_trips
  for each row execute function private.check_group_approval();

-- ---------------------------------------------------------------------------
-- C. Phone no longer confirmed: take the organiser's traveller groups off the public list.
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

create trigger profiles_unpublish_unconfirmed_groups
  after update on public.profiles
  for each row
  when (old.phone_verified_at is not null and new.phone_verified_at is null)
  execute function private.unpublish_unconfirmed_traveller_groups();

-- ---------------------------------------------------------------------------
-- D. One-off: no approved traveller group without a confirmed organiser phone.
-- ---------------------------------------------------------------------------
update public.group_trips t
   set status = 'pending'
 where t.organizer_kind = 'traveller'
   and t.status = 'approved'
   and not exists (select 1 from public.profiles p where p.id = t.organizer_id and p.phone_verified_at is not null);
