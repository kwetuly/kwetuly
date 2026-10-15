-- Tours section: two tour types (Rafrika Signature Trips and Operator Tours), tour operator
-- profiles, route stops for the tour map, guides on each tour, saved tours, and prices that
-- only show once an admin has verified them.

create type public.tour_type as enum ('signature', 'operator');
create type public.accommodation_level as enum ('budget', 'mid_range', 'luxury', 'premium');
create type public.tour_group_type as enum ('private', 'group', 'private_or_group');
create type public.fitness_level as enum ('easy', 'moderate', 'challenging', 'strenuous');
create type public.stop_kind as enum
  ('town', 'airport', 'park', 'gate', 'camp', 'lodge', 'peak', 'beach', 'island', 'cultural', 'activity');

-- ---------------------------------------------------------------------------
-- Tour operators. Admins add them; the Verified badge shows only when verified_at is set.
-- Licence and TripAdvisor details are shown only with the date they were checked.
-- ---------------------------------------------------------------------------
create table public.tour_operators (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(name) between 2 and 120),
  logo_url text check (length(logo_url) <= 500),
  description text check (length(description) <= 2000),          -- written by Rafrika, never copied
  website text check (length(website) <= 300),
  contact_email text check (length(contact_email) <= 160),
  contact_phone text check (length(contact_phone) <= 40),
  location text check (length(location) <= 120),
  licence_number text check (length(licence_number) <= 80),
  licence_authority text check (length(licence_authority) <= 120),
  licence_checked_at date,
  tripadvisor_url text check (length(tripadvisor_url) <= 400),
  tripadvisor_rating numeric(2, 1) check (tripadvisor_rating between 0 and 5),
  tripadvisor_reviews int check (tripadvisor_reviews >= 0),
  tripadvisor_checked_at date,
  verified_at timestamptz,
  status public.publish_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (licence_number is null or licence_checked_at is not null),
  check ((tripadvisor_rating is null and tripadvisor_reviews is null) or tripadvisor_checked_at is not null)
);

create trigger tour_operators_updated_at
  before update on public.tour_operators
  for each row execute function public.set_updated_at();

alter table public.tour_operators enable row level security;

create policy "Anyone reads published operators; admins read all" on public.tour_operators
  for select to anon, authenticated using (status = 'published' or private.is_admin());
create policy "Admins manage operators" on public.tour_operators
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- ---------------------------------------------------------------------------
-- Trips become tours.
-- ---------------------------------------------------------------------------
alter table public.trips
  add column tour_type public.tour_type not null default 'operator',
  add column operator_id uuid references public.tour_operators (id) on delete set null,
  add column nights int check (nights between 0 and 40),
  add column end_at text check (length(end_at) <= 80),
  add column travel_styles text[] not null default '{}'
    check (travel_styles <@ array['family', 'honeymoon', 'vip', 'solo', 'photography', 'accessible']),
  add column accommodation public.accommodation_level,
  add column group_type public.tour_group_type,
  add column min_group int check (min_group between 1 and 100),
  add column max_group int check (max_group between 1 and 200),
  add column price_currency text not null default 'USD' check (price_currency in ('USD', 'EUR', 'GBP', 'TZS')),
  add column price_conditions text check (length(price_conditions) <= 400),
  add column price_verified_at date,
  add column price_valid_until date,
  add column best_time_note text check (length(best_time_note) <= 400),
  add column fitness public.fitness_level,
  add column packing text[] not null default '{}',
  add column cover_url text check (length(cover_url) <= 500),
  add column source_url text check (length(source_url) <= 500),        -- operator's own page or enquiry link
  add column source_checked_at date,
  add column needs_review boolean not null default false,
  add column updated_by uuid references auth.users (id) on delete set null,
  add check (min_group is null or max_group is null or min_group <= max_group);

alter table public.trips rename column price_from_usd to price_from;
-- A price is only stored together with the date it was verified.
alter table public.trips add check (price_from is null or price_verified_at is not null);
alter table public.trips add check (source_url is null or source_checked_at is not null);

update public.trips set tour_type = 'signature' where is_signature;
alter table public.trips drop column is_signature;
alter table public.trips add column is_signature boolean generated always as (tour_type = 'signature') stored;

create index trips_operator_idx on public.trips (operator_id);

-- Admin-only notes on how each tour was verified.
alter table public.trip_partners alter column company_name drop not null;
alter table public.trip_partners add column verification_note text check (length(verification_note) <= 2000);

-- ---------------------------------------------------------------------------
-- Route stops for the map: one or more per itinerary day. Coordinates are approximate.
-- Driving distance and time are optional and need a source; without one the page only
-- shows the straight-line distance worked out from the coordinates.
-- ---------------------------------------------------------------------------
create table public.trip_stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  position int not null,
  day int check (day between 1 and 40),
  name text not null check (length(name) between 1 and 120),
  kind public.stop_kind not null default 'town',
  lat numeric(8, 5) not null check (lat between -12 and 0),     -- Tanzania and its islands
  lng numeric(8, 5) not null check (lng between 29 and 41),
  note text check (length(note) <= 300),
  transfer_mode text check (transfer_mode in ('drive', 'flight', 'boat', 'walk')),
  distance_km numeric(6, 1) check (distance_km > 0),              -- from the previous stop
  transfer_hours numeric(4, 1) check (transfer_hours > 0),
  distance_source text check (length(distance_source) <= 300),
  unique (trip_id, position),
  check ((distance_km is null and transfer_hours is null) or distance_source is not null)
);

alter table public.trip_stops enable row level security;

create policy "Stops follow their tour" on public.trip_stops
  for select to anon, authenticated
  using (exists (select 1 from public.trips t where t.id = trip_id and (t.status = 'published' or private.is_admin())));
create policy "Admins manage stops" on public.trip_stops
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- ---------------------------------------------------------------------------
-- Guides an admin assigns to a tour ("Meet your guides"). Pages fill up with matching
-- guides when none are assigned.
-- ---------------------------------------------------------------------------
create table public.trip_guides (
  trip_id uuid not null references public.trips (id) on delete cascade,
  guide_id uuid not null references public.guides (id) on delete cascade,
  position int not null default 0,
  primary key (trip_id, guide_id)
);

create index trip_guides_guide_idx on public.trip_guides (guide_id);
alter table public.trip_guides enable row level security;

create policy "Tour guides follow their tour" on public.trip_guides
  for select to anon, authenticated
  using (exists (select 1 from public.trips t where t.id = trip_id and (t.status = 'published' or private.is_admin())));
create policy "Admins manage tour guides" on public.trip_guides
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- ---------------------------------------------------------------------------
-- Saved tours.
-- ---------------------------------------------------------------------------
create table public.saved_trips (
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, trip_id)
);

create index saved_trips_trip_idx on public.saved_trips (trip_id);
alter table public.saved_trips enable row level security;

create policy "People manage their saved tours" on public.saved_trips
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
