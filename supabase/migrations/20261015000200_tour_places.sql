-- More information on tours:
-- 1. Places: a short guide to each park, site or town a tour visits, with facts taken from an
--    official source (TANAPA, UNESCO, NCAA, Ramsar) and the date Rafrika checked it.
-- 2. Stop altitudes, read from open terrain data (not typed in by hand).
-- 3. "Good to know" notes per tour. Day details (overnight, meals, activities) live in the
--    existing itinerary JSON: { day, title, body, overnight?, meals?: ["B","L","D"], activities?: [] }.

create type public.place_kind as enum
  ('national_park', 'conservation_area', 'game_reserve', 'heritage_site', 'lake', 'mountain', 'island', 'town', 'village', 'marine_area');

create table public.places (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(name) between 2 and 120),
  kind public.place_kind not null,
  region text check (length(region) <= 80),
  summary text not null check (length(summary) between 20 and 1200),   -- written by Rafrika
  known_for text[] not null default '{}',
  wildlife text[] not null default '{}',
  activities text[] not null default '{}',
  area_km2 numeric(9, 1) check (area_km2 > 0),
  established int check (established between 1800 and 2100),
  unesco_year int check (unesco_year between 1972 and 2100),
  highest_point text check (length(highest_point) <= 120),             -- e.g. 'Kibo, 5,895 m'
  managed_by text check (length(managed_by) <= 120),
  lat numeric(8, 5) check (lat between -12 and 0),
  lng numeric(8, 5) check (lng between 29 and 41),
  source_name text check (length(source_name) <= 120),
  source_url text check (length(source_url) <= 400),
  source_checked_at date,
  status public.publish_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Figures are only stored together with where they came from.
  check ((area_km2 is null and established is null and unesco_year is null and highest_point is null) or (source_url is not null and source_checked_at is not null))
);

create trigger places_updated_at
  before update on public.places
  for each row execute function public.set_updated_at();

alter table public.places enable row level security;
create policy "Anyone reads published places; admins read all" on public.places
  for select to anon, authenticated using (status = 'published' or private.is_admin());
create policy "Admins manage places" on public.places
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

alter table public.trip_stops
  add column place_id uuid references public.places (id) on delete set null,
  add column elevation_m int check (elevation_m between -200 and 6000);  -- approximate, from terrain data

create index trip_stops_place_idx on public.trip_stops (place_id);

alter table public.trips add column good_to_know text[] not null default '{}';
