-- Social sign-in (Google, Facebook, Apple) and a phone number for every account.
-- Email sign-ups send role and phone with the form and are complete at once.
-- Social sign-ups arrive without them, so they finish a short welcome step first.

alter table public.profiles add column onboarded_at timestamptz;

-- Everyone who already has an account counts as onboarded.
update public.profiles set onboarded_at = coalesce(created_at, now()) where onboarded_at is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := new.raw_user_meta_data ->> 'role';
  phone text := coalesce(new.phone, new.raw_user_meta_data ->> 'phone');
begin
  insert into public.profiles (id, full_name, phone, role, preferred_language, onboarded_at)
  values (
    new.id,
    -- Google and Apple send "full_name" or "name"; Facebook sends "name".
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    phone,
    case when requested in ('traveler', 'provider', 'investor', 'guide')
         then requested::public.user_role else 'traveler' end,
    coalesce(new.raw_user_meta_data ->> 'preferred_language', 'en'),
    case when requested is not null and phone is not null then now() end
  );
  return new;
end;
$$;

-- The welcome step: a new account picks traveller, guide or business once, and adds a phone number.
-- Role changes are otherwise admin-only (see guard_profile_role), so this runs as a trusted function
-- and only while the account has not been onboarded yet.
create or replace function public.complete_onboarding(p_role text, p_phone text, p_full_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_role not in ('traveler', 'guide', 'provider') then
    raise exception 'Unknown account type';
  end if;
  if p_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Phone number must be in international format';
  end if;
  update public.profiles
  set role = p_role::public.user_role,
      phone = p_phone,
      full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
      onboarded_at = now()
  where id = (select auth.uid()) and onboarded_at is null;
  if not found then
    raise exception 'Account already set up';
  end if;
end;
$$;

revoke execute on function public.complete_onboarding(text, text, text) from public, anon;
grant execute on function public.complete_onboarding(text, text, text) to authenticated;

-- Users can edit their own profile, but not their role or onboarding mark
-- (otherwise they could reset onboarding and pick a different account type).
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
  end if;
  return new;
end;
$$;
