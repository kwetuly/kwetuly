-- Trip catalogue, organised like the Tanzania Tourist Board's circuits and attractions.
-- Each trip records who operates it: a licensed partner company for now, Rafrika itself
-- once the company holds its own licence, or an individual guide (e.g. day trips).

create type public.trip_circuit as enum ('northern', 'southern', 'western', 'coast', 'nationwide');
create type public.trip_kind as enum ('day_trip', 'multi_day', 'combo');
create type public.trip_category as enum
  ('safari', 'mountain', 'cultural', 'beach', 'historical', 'marine', 'chimpanzee', 'walking', 'event');
create type public.trip_operator as enum ('partner', 'rafrika', 'guide');
create type public.publish_status as enum ('draft', 'published', 'archived');

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_en text not null,
  title_sw text,
  summary_en text not null,
  summary_sw text,
  circuit public.trip_circuit not null,
  kind public.trip_kind not null,
  categories public.trip_category[] not null default '{}',
  days int not null default 1 check (days between 1 and 40),
  destinations text[] not null default '{}',   -- TTB attractions: parks, reserves, islands, sites
  start_from text,                             -- e.g. 'Arusha', 'Moshi', 'Dar es Salaam', 'Zanzibar'
  highlights text[] not null default '{}',
  itinerary jsonb not null default '[]',       -- [{ "day": 1, "title": "...", "body": "..." }]
  includes text[] not null default '{}',
  excludes text[] not null default '{}',
  best_months int[] not null default '{}',     -- 1-12
  price_from_usd numeric(10, 2),               -- null = price on request
  operated_by public.trip_operator not null default 'partner',
  is_signature boolean not null default false, -- Rafrika-designed trips used for promotion
  promo_text text,
  status public.publish_status not null default 'draft',
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trips_published_idx on public.trips (circuit, kind) where status = 'published';

create trigger trips_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

-- Partner operators behind each trip: commercial details stay admin-only.
create table public.trip_partners (
  trip_id uuid primary key references public.trips (id) on delete cascade,
  company_name text not null,
  tala_licence text,
  contact text,
  commission_note text,
  updated_at timestamptz not null default now()
);

create trigger trip_partners_updated_at
  before update on public.trip_partners
  for each row execute function public.set_updated_at();

alter table public.trips enable row level security;
alter table public.trip_partners enable row level security;

create policy "Anyone reads published trips; admins read all" on public.trips
  for select to anon, authenticated using (status = 'published' or private.is_admin());
create policy "Admins manage trips" on public.trips
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "Admins manage trip partners" on public.trip_partners
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- Trip enquiries become leads.
alter table public.leads add column trip_id uuid references public.trips (id) on delete set null;
create index leads_trip_id_idx on public.leads (trip_id);
