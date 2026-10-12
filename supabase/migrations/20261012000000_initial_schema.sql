-- Rafrika initial schema (Path A: lead generation only, no client money held).
-- Escrow / payout tables are intentionally deferred to a later migration.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('traveler', 'provider', 'investor', 'admin');
create type public.pillar as enum ('kilimanjaro', 'safari', 'culture', 'zanzibar', 'combo', 'investment');
create type public.review_status as enum ('pending', 'approved', 'rejected');
create type public.price_tier as enum ('regular', 'premium', 'vip');
create type public.trip_request_status as enum ('open', 'closed', 'cancelled');
create type public.lead_source as enum ('whatsapp_click', 'contact_form', 'ai_concierge', 'trip_request');
create type public.service_type as enum ('kili_prep_call', 'safari_prep_call', 'combo_design', 'vip_concierge', 'prep_pdf');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  role public.user_role not null default 'traveler',
  preferred_language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- Admins, plus server-side callers (service role, SQL editor) that are not the API's anon/authenticated roles.
-- Used by guard triggers, which run as the caller.
create or replace function public.is_trusted()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user not in ('anon', 'authenticated') or public.is_admin();
$$;

-- Create a profile on sign-up. Role comes from sign-up metadata, but never 'admin'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := new.raw_user_meta_data ->> 'role';
begin
  insert into public.profiles (id, full_name, phone, role, preferred_language)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.phone, new.raw_user_meta_data ->> 'phone'),
    case when requested in ('traveler', 'provider', 'investor')
         then requested::public.user_role else 'traveler' end,
    coalesce(new.raw_user_meta_data ->> 'preferred_language', 'en')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only admins may change a user's role.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and not public.is_trusted() then
    raise exception 'Only admins can change roles';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Providers (gear owners, drivers, guides, hosts, lodges...)
-- ---------------------------------------------------------------------------
create table public.providers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  business_name text not null,
  story text,
  base_region text not null,
  whatsapp_number text not null,
  languages text[] not null default '{en}',
  pillars public.pillar[] not null default '{}',
  photo_url text,
  verification_status public.review_status not null default 'pending',
  verified_at timestamptz,
  listing_fee_paid_until date,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index providers_owner_id_idx on public.providers (owner_id);
create index providers_status_idx on public.providers (verification_status);

-- Providers cannot verify themselves or extend their own listing fee.
create or replace function public.guard_provider_admin_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_trusted() then
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

create trigger providers_guard_admin_fields
  before insert or update on public.providers
  for each row execute function public.guard_provider_admin_fields();

create trigger providers_updated_at
  before update on public.providers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Listings (what a provider offers, per pillar)
-- ---------------------------------------------------------------------------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  pillar public.pillar not null,
  category text not null,          -- e.g. 'gear_rental', 'transfer', 'lodge', 'village_visit'
  title text not null,
  description text,
  region text not null,
  price_from_usd numeric(10, 2),
  price_note text,
  photos text[] not null default '{}',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_provider_id_idx on public.listings (provider_id);
create index listings_pillar_region_idx on public.listings (pillar, region) where is_published;

create trigger listings_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Favourites
-- ---------------------------------------------------------------------------
create table public.favourites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index favourites_listing_id_idx on public.favourites (listing_id);

-- ---------------------------------------------------------------------------
-- Trip requests + tiered quotes (lead-gen version of the reverse auction)
-- ---------------------------------------------------------------------------
create table public.trip_requests (
  id uuid primary key default gen_random_uuid(),
  traveler_id uuid not null references public.profiles (id) on delete cascade,
  pillars public.pillar[] not null,
  regions text[] not null default '{}',
  start_date date,
  end_date date,
  group_size int not null default 1 check (group_size > 0),
  preferred_tier public.price_tier,
  budget_usd numeric(10, 2),
  notes text,
  status public.trip_request_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trip_requests_traveler_id_idx on public.trip_requests (traveler_id);
create index trip_requests_open_idx on public.trip_requests (created_at desc) where status = 'open';

create trigger trip_requests_updated_at
  before update on public.trip_requests
  for each row execute function public.set_updated_at();

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  trip_request_id uuid not null references public.trip_requests (id) on delete cascade,
  provider_id uuid not null references public.providers (id) on delete cascade,
  regular_price_usd numeric(10, 2),
  premium_price_usd numeric(10, 2),
  vip_price_usd numeric(10, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_request_id, provider_id),
  check (coalesce(regular_price_usd, premium_price_usd, vip_price_usd) is not null)
);

create index quotes_provider_id_idx on public.quotes (provider_id);

create trigger quotes_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Leads (every introduction Rafrika makes)
-- ---------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers (id) on delete set null,
  listing_id uuid references public.listings (id) on delete set null,
  traveler_id uuid references public.profiles (id) on delete set null,
  source public.lead_source not null,
  traveler_name text,
  traveler_contact text,
  message text,
  created_at timestamptz not null default now()
);

create index leads_provider_id_idx on public.leads (provider_id, created_at desc);
create index leads_listing_id_idx on public.leads (listing_id);
create index leads_traveler_id_idx on public.leads (traveler_id);

-- ---------------------------------------------------------------------------
-- Paid services sold by Rafrika (prep calls, combo design...) — paid via Selcom
-- ---------------------------------------------------------------------------
create table public.service_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  service public.service_type not null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  preferred_date date,
  details jsonb not null default '{}',
  amount_usd numeric(10, 2),
  amount_tzs numeric(14, 2),
  payment_status public.payment_status not null default 'pending',
  selcom_order_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index service_bookings_user_id_idx on public.service_bookings (user_id);

create trigger service_bookings_updated_at
  before update on public.service_bookings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Investment matching (introductions only — no financial advice)
-- ---------------------------------------------------------------------------
create table public.investment_projects (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  sector text not null,            -- e.g. 'guesthouse', 'tour_startup', 'craft_cooperative'
  region text not null,
  investment_min_usd numeric(12, 2),
  investment_max_usd numeric(12, 2),
  story text,
  photos text[] not null default '{}',
  status public.review_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index investment_projects_submitted_by_idx on public.investment_projects (submitted_by);

create or replace function public.guard_investment_project_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_trusted() then
    new.status := case when tg_op = 'INSERT' then 'pending'::public.review_status else old.status end;
  end if;
  return new;
end;
$$;

create trigger investment_projects_guard_status
  before insert or update on public.investment_projects
  for each row execute function public.guard_investment_project_status();

create trigger investment_projects_updated_at
  before update on public.investment_projects
  for each row execute function public.set_updated_at();

create table public.investment_inquiries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.investment_projects (id) on delete cascade,
  investor_id uuid references public.profiles (id) on delete set null,
  investor_name text not null,
  investor_email text not null,
  budget_usd numeric(12, 2),
  message text,
  status public.review_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index investment_inquiries_project_id_idx on public.investment_inquiries (project_id);
create index investment_inquiries_investor_id_idx on public.investment_inquiries (investor_id);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.providers enable row level security;
alter table public.listings enable row level security;
alter table public.favourites enable row level security;
alter table public.trip_requests enable row level security;
alter table public.quotes enable row level security;
alter table public.leads enable row level security;
alter table public.service_bookings enable row level security;
alter table public.investment_projects enable row level security;
alter table public.investment_inquiries enable row level security;

-- profiles
create policy "Users read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or public.is_admin());
create policy "Users update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid()) or public.is_admin());

-- providers
create policy "Anyone reads approved providers" on public.providers
  for select to anon, authenticated
  using (verification_status = 'approved' or owner_id = (select auth.uid()) or public.is_admin());
create policy "Users create own provider" on public.providers
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners update own provider" on public.providers
  for update to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin())
  with check (owner_id = (select auth.uid()) or public.is_admin());
create policy "Admins delete providers" on public.providers
  for delete to authenticated using (public.is_admin());

-- listings
create policy "Anyone reads published listings of approved providers" on public.listings
  for select to anon, authenticated
  using (
    (is_published and exists (
      select 1 from public.providers p
      where p.id = provider_id and p.verification_status = 'approved'))
    or exists (
      select 1 from public.providers p
      where p.id = provider_id and p.owner_id = (select auth.uid()))
    or public.is_admin()
  );
create policy "Owners manage own listings" on public.listings
  for all to authenticated
  using (
    exists (select 1 from public.providers p where p.id = provider_id and p.owner_id = (select auth.uid()))
    or public.is_admin())
  with check (
    exists (select 1 from public.providers p where p.id = provider_id and p.owner_id = (select auth.uid()))
    or public.is_admin());

-- favourites
create policy "Users manage own favourites" on public.favourites
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- trip_requests
create policy "Travelers manage own trip requests" on public.trip_requests
  for all to authenticated
  using (traveler_id = (select auth.uid()) or public.is_admin())
  with check (traveler_id = (select auth.uid()) or public.is_admin());
create policy "Approved providers read open trip requests" on public.trip_requests
  for select to authenticated
  using (status = 'open' and exists (
    select 1 from public.providers p
    where p.owner_id = (select auth.uid()) and p.verification_status = 'approved'));

-- quotes
create policy "Providers manage own quotes" on public.quotes
  for all to authenticated
  using (
    exists (select 1 from public.providers p where p.id = provider_id and p.owner_id = (select auth.uid()))
    or public.is_admin())
  with check (
    exists (
      select 1 from public.providers p
      where p.id = provider_id and p.owner_id = (select auth.uid()) and p.verification_status = 'approved')
    or public.is_admin());
create policy "Travelers read quotes on their requests" on public.quotes
  for select to authenticated
  using (exists (
    select 1 from public.trip_requests r
    where r.id = trip_request_id and r.traveler_id = (select auth.uid())));

-- leads
create policy "Anyone can create a lead" on public.leads
  for insert to anon, authenticated
  with check (traveler_id is null or traveler_id = (select auth.uid()));
create policy "Providers, travelers and admins read relevant leads" on public.leads
  for select to authenticated
  using (
    traveler_id = (select auth.uid())
    or exists (select 1 from public.providers p where p.id = provider_id and p.owner_id = (select auth.uid()))
    or public.is_admin());

-- service_bookings (payment_status is only changed server-side by the Selcom webhook / admin)
create policy "Anyone can request a service booking" on public.service_bookings
  for insert to anon, authenticated
  with check (
    payment_status = 'pending' and selcom_order_id is null
    and (user_id is null or user_id = (select auth.uid())));
create policy "Users read own bookings" on public.service_bookings
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy "Admins update bookings" on public.service_bookings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- investment_projects
create policy "Anyone reads approved projects" on public.investment_projects
  for select to anon, authenticated
  using (status = 'approved' or submitted_by = (select auth.uid()) or public.is_admin());
create policy "Users submit projects" on public.investment_projects
  for insert to authenticated with check (submitted_by = (select auth.uid()));
create policy "Owners update own projects" on public.investment_projects
  for update to authenticated
  using (submitted_by = (select auth.uid()) or public.is_admin())
  with check (submitted_by = (select auth.uid()) or public.is_admin());
create policy "Admins delete projects" on public.investment_projects
  for delete to authenticated using (public.is_admin());

-- investment_inquiries (reviewed by Rafrika before any introduction)
create policy "Anyone can send an inquiry" on public.investment_inquiries
  for insert to anon, authenticated
  with check (status = 'pending' and (investor_id is null or investor_id = (select auth.uid())));
create policy "Investors read own inquiries" on public.investment_inquiries
  for select to authenticated using (investor_id = (select auth.uid()) or public.is_admin());
create policy "Admins update inquiries" on public.investment_inquiries
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Helper functions should not be callable directly by clients beyond what policies need.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
