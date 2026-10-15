-- Approved businesses are readable by anyone, so private details move out of `providers`
-- into their own table that only the owner and admins can read (like guide_private).
-- The admin's badge note (payment reference) can only be written by admins.

create table public.provider_private (
  provider_id uuid primary key references public.providers (id) on delete cascade,
  whatsapp_number text check (char_length(whatsapp_number) <= 30),
  licence_document_path text,
  badge_note text check (char_length(badge_note) <= 500),
  updated_at timestamptz not null default now()
);

create trigger provider_private_updated_at
  before update on public.provider_private
  for each row execute function public.set_updated_at();

create or replace function public.guard_provider_private()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_trusted() then
    return new;
  end if;
  new.badge_note := case when tg_op = 'INSERT' then null else old.badge_note end;
  return new;
end;
$$;

create trigger provider_private_guard
  before insert or update on public.provider_private
  for each row execute function public.guard_provider_private();

alter table public.provider_private enable row level security;

create policy "Owners and admins manage business private data" on public.provider_private
  for all to authenticated
  using (exists (select 1 from public.providers p where p.id = provider_id and p.owner_id = (select auth.uid())) or private.is_admin())
  with check (exists (select 1 from public.providers p where p.id = provider_id and p.owner_id = (select auth.uid())) or private.is_admin());

-- The table was empty when this ran, so nothing needs copying.
alter table public.providers
  drop column whatsapp_number,
  drop column licence_document_path,
  drop column badge_note;

-- Guard on providers no longer touches badge_note.
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
    new.badge_checks := '{}';
    new.badge_checked_at := null;
    new.badge_valid_until := null;
  else
    new.verification_status := old.verification_status;
    new.verified_at := old.verified_at;
    new.listing_fee_paid_until := old.listing_fee_paid_until;
    new.badge_checks := old.badge_checks;
    new.badge_checked_at := old.badge_checked_at;
    new.badge_valid_until := old.badge_valid_until;
  end if;
  return new;
end;
$$;
