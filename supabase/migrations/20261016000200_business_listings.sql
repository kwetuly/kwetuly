-- Business listings (hotels, lodges, homestays, rentals, curio shops...) on the existing providers
-- table. Listing is free once an admin approves it. The yearly "Checked by Rafrika" badge is paid:
-- only admins set what was checked, when, and until when it is valid.

alter table public.providers
  add column business_type text not null default 'other' check (business_type in (
    'hotel', 'lodge', 'homestay', 'hostel', 'rental', 'curio_shop', 'gem_shop', 'gear_rental',
    'transport', 'restaurant', 'spa', 'salon', 'nightlife', 'other')),
  add column location text check (char_length(location) <= 160),
  add column website text check (website ~ '^https://'),
  add column photos text[] not null default '{}',
  add column licence_document_path text,
  add column badge_requested_at timestamptz,
  add column badge_checks text[] not null default '{}',
  add column badge_checked_at date,
  add column badge_valid_until date,
  add column badge_note text;

create index providers_type_idx on public.providers (business_type) where verification_status = 'approved';

-- Owners cannot approve themselves or give themselves the badge.
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
    new.badge_note := null;
  else
    new.verification_status := old.verification_status;
    new.verified_at := old.verified_at;
    new.listing_fee_paid_until := old.listing_fee_paid_until;
    new.badge_checks := old.badge_checks;
    new.badge_checked_at := old.badge_checked_at;
    new.badge_valid_until := old.badge_valid_until;
    new.badge_note := old.badge_note;
  end if;
  return new;
end;
$$;

-- Small site settings that admins change without a code release, e.g. the badge fee.
create table public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create trigger site_settings_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

alter table public.site_settings enable row level security;

create policy "Anyone reads site settings" on public.site_settings
  for select to anon, authenticated using (true);
create policy "Admins manage site settings" on public.site_settings
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- The badge fee is not decided yet: null means "ask Rafrika".
insert into public.site_settings (key, value) values ('badge_fee', '{"amount_usd": null}');
