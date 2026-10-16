-- 1) Travellers can start a group trip, or "complete their group" (some people already going,
--    looking for more). Traveller organisers need a confirmed phone number; Rafrika still
--    reviews every group before it goes public.
-- 2) Travel news for travellers (guides keep their own Field news in hub_posts).
-- 3) Sample business listings: researched from public information for testing, clearly marked,
--    and removable in one go before launch.
-- 4) Rafrika merchandise (t-shirts, caps...) ordered through the Rafrika Shop listing.

-- ---------------------------------------------------------------------------
-- Confirmed phone numbers
-- ---------------------------------------------------------------------------
alter table public.profiles add column phone_verified_at timestamptz;

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
    -- A confirmed number stays confirmed only while it is unchanged.
    if new.phone is distinct from old.phone then
      new.phone_verified_at := null;
    else
      new.phone_verified_at := old.phone_verified_at;
    end if;
  end if;
  return new;
end;
$$;

-- When Supabase confirms a phone by SMS code, mark the matching profile number as confirmed.
create or replace function private.sync_phone_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.phone_confirmed_at is not null and new.phone_confirmed_at is distinct from old.phone_confirmed_at then
    update public.profiles
    set phone = '+' || ltrim(new.phone, '+'), phone_verified_at = new.phone_confirmed_at
    where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_phone_confirmed
  after update of phone_confirmed_at on auth.users
  for each row execute function private.sync_phone_confirmed();

-- ---------------------------------------------------------------------------
-- Traveller-organised groups and "complete your group"
-- ---------------------------------------------------------------------------
alter table public.group_trips
  add column organizer_kind text not null default 'guide' check (organizer_kind in ('guide', 'business', 'traveller')),
  add column already_going integer not null default 0 check (already_going between 0 and 99);

update public.group_trips set organizer_kind = case when guide_id is not null then 'guide' else 'business' end;

alter table public.group_trips drop constraint group_trips_check2;
alter table public.group_trips drop constraint group_trips_capacity;
alter table public.group_trips add constraint group_trips_capacity check (seats_taken + already_going <= max_people);

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
          select 1 from public.profiles p where p.id = (select auth.uid()) and p.phone_verified_at is not null));
$$;

create or replace function public.guard_group_trip_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.organizer_kind := case when new.guide_id is not null then 'guide'
                             when new.company_name is not null then 'business'
                             else 'traveller' end;
  if private.is_trusted() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.seats_taken := 0;
    new.cancelled := false;
  else
    new.organizer_id := old.organizer_id;
    new.guide_id := old.guide_id;
    new.company_name := old.company_name;
    new.organizer_kind := old.organizer_kind;
    new.seats_taken := old.seats_taken;
    -- Material changes send the trip back for review; cancelling does not.
    if (new.title, new.description, new.start_date, new.end_date, new.price_per_person_usd, new.max_people, new.already_going)
       is distinct from
       (old.title, old.description, old.start_date, old.end_date, old.price_per_person_usd, old.max_people, old.already_going) then
      new.status := 'pending';
    else
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;

-- Spots left = max people - people already going - accepted requests.
create or replace function private.refresh_group_seats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(new.group_trip_id, old.group_trip_id);
  taken integer;
  capacity integer;
begin
  select coalesce(sum(seats), 0) into taken
  from public.group_trip_members where group_trip_id = target and status = 'accepted';
  select max_people - already_going into capacity from public.group_trips where id = target for update;
  if taken > capacity then
    raise exception 'Not enough spots left on this group trip';
  end if;
  update public.group_trips set seats_taken = taken where id = target;
  return null;
end;
$$;

create or replace function private.on_group_trip_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or (new.status = 'pending' and old.status is distinct from 'pending') then
    perform private.notify_admins('group_pending',
      jsonb_build_object('title', new.title, 'organizer', coalesce(new.company_name, new.organizer_kind), 'link', '/admin#groups'));
  elsif new.status = 'approved' and old.status is distinct from 'approved' then
    perform private.notify_user('group_approved', new.organizer_id,
      jsonb_build_object('title', new.title, 'link', '/group-trips/' || new.id));
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Travel news for travellers
-- ---------------------------------------------------------------------------
create table public.travel_news (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 5 and 160),
  body text not null check (char_length(body) between 20 and 8000),
  region text check (char_length(region) <= 80),
  source_name text check (char_length(source_name) <= 120),
  source_url text check (source_url ~ '^https://'),
  published boolean not null default true,
  published_on date not null default current_date,
  author_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index travel_news_published_idx on public.travel_news (published_on desc) where published;

alter table public.travel_news enable row level security;
create policy "Anyone reads published travel news" on public.travel_news
  for select to anon, authenticated using (published or private.is_admin());
create policy "Admins write travel news" on public.travel_news
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- ---------------------------------------------------------------------------
-- Sample listings and the Rafrika Shop
-- ---------------------------------------------------------------------------
alter table public.providers add column is_sample boolean not null default false;
alter table public.providers add column source_url text check (source_url ~ '^https://');

alter table public.providers drop constraint providers_business_type_check;
alter table public.providers add constraint providers_business_type_check check (business_type in (
  'hotel', 'lodge', 'homestay', 'hostel', 'rental', 'curio_shop', 'gem_shop', 'gear_rental', 'transport',
  'car_hire', 'restaurant', 'spa', 'salon', 'nightlife', 'merch', 'other'));

-- Owners cannot mark or unmark their listing as a sample.
create or replace function public.guard_provider_sample()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.is_trusted() then
    if tg_op = 'INSERT' then
      new.is_sample := false;
    else
      new.is_sample := old.is_sample;
    end if;
  end if;
  return new;
end;
$$;

create trigger providers_sample_guard
  before insert or update on public.providers
  for each row execute function public.guard_provider_sample();

create table public.shop_products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  description text check (char_length(description) <= 2000),
  price_tzs integer check (price_tzs between 0 and 100000000),
  sizes text[] not null default '{}',
  photo_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shop_products enable row level security;
create policy "Anyone sees active products" on public.shop_products
  for select to anon, authenticated using (active or private.is_admin());
create policy "Admins manage products" on public.shop_products
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
