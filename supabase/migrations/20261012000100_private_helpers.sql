-- Move role helpers out of the exposed API schema so they can't be called via /rest/v1/rpc.
-- Policies and triggers reference functions by OID, so they keep working after the move.
create schema if not exists private;
grant usage on schema private to anon, authenticated;

alter function public.is_admin() set schema private;
alter function public.is_trusted() set schema private;

-- Function bodies refer to helpers by name, so redefine them against the new schema.
create or replace function private.is_trusted()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user not in ('anon', 'authenticated') or private.is_admin();
$$;

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and not private.is_trusted() then
    raise exception 'Only admins can change roles';
  end if;
  return new;
end;
$$;

create or replace function public.guard_provider_admin_fields()
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
    new.listing_fee_paid_until := null;
  else
    new.verification_status := old.verification_status;
    new.verified_at := old.verified_at;
    new.listing_fee_paid_until := old.listing_fee_paid_until;
  end if;
  return new;
end;
$$;

create or replace function public.guard_investment_project_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.is_trusted() then
    new.status := case when tg_op = 'INSERT' then 'pending'::public.review_status else old.status end;
  end if;
  return new;
end;
$$;
