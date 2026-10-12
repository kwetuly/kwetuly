-- "Coming soon" pages collect travellers who want a service and businesses who want to be listed.
create type public.interest_kind as enum ('traveler', 'business');

create table public.interest_signups (
  id uuid primary key default gen_random_uuid(),
  section text not null check (length(section) <= 40),
  item text not null check (length(item) <= 40),
  kind public.interest_kind not null,
  name text not null check (length(name) <= 120),
  contact text not null check (length(contact) <= 160),
  business_name text check (length(business_name) <= 120),
  message text check (length(message) <= 2000),
  locale text not null default 'en' check (locale in ('en', 'sw')),
  created_at timestamptz not null default now()
);

create index interest_signups_section_idx on public.interest_signups (section, item, created_at desc);

alter table public.interest_signups enable row level security;

create policy "Anyone can register interest" on public.interest_signups
  for insert to anon, authenticated with check (length(name) > 0 and length(contact) > 0);
create policy "Admins read interest" on public.interest_signups
  for select to authenticated using (private.is_admin());
