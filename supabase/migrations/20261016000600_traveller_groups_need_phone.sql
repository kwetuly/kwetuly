-- Travellers may submit a group once their account has a phone number. Rafrika calls the number
-- (or the person confirms it by SMS code) and only then approves the group.
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
    or (p_guide_id is null and p_company is not null and exists (
          select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('provider', 'admin')))
    or (p_guide_id is null and p_company is null and exists (
          select 1 from public.profiles p where p.id = (select auth.uid()) and p.phone is not null));
$$;

-- A traveller's group cannot be approved until their phone number is confirmed.
create or replace function private.check_group_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' and new.organizer_kind = 'traveller'
     and not exists (select 1 from public.profiles p where p.id = new.organizer_id and p.phone_verified_at is not null) then
    raise exception 'Confirm the organiser''s phone number before approving this group';
  end if;
  return new;
end;
$$;

create trigger group_trips_approval_check
  before update of status on public.group_trips
  for each row execute function private.check_group_approval();
