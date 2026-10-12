-- Guide-first pivot: guides get their own profile, separate from other providers
-- (drivers, gear shops, hosts stay in `providers`).

create type public.guide_specialty as enum
  ('mountain', 'safari', 'cultural', 'city', 'birding', 'marine', 'photography', 'day_trips');
create type public.guide_plan as enum ('msingi', 'pro');
create type public.profile_visibility as enum ('public', 'link_only');

create table public.guides (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  display_name text not null,
  photo_url text,
  headline text,                    -- one line, e.g. "Kilimanjaro guide, 300+ summits"
  bio text,
  base_region text not null,
  regions text[] not null default '{}',
  specialties public.guide_specialty[] not null default '{}',
  languages text[] not null default '{sw,en}',   -- ISO 639-1 codes
  max_group_size int not null default 8 check (max_group_size between 1 and 60),
  years_experience int check (years_experience between 0 and 70),
  summits int check (summits >= 0),
  certifications text[] not null default '{}',  -- e.g. 'first_aid', 'wfr'
  association text,                 -- e.g. 'TTGA'
  has_vehicle boolean not null default false,
  facebook_url text,
  instagram_url text,
  tiktok_url text,
  visibility public.profile_visibility not null default 'public',
  verification_status public.review_status not null default 'pending',
  verified_at timestamptz,
  plan public.guide_plan not null default 'msingi',
  plan_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index guides_search_idx on public.guides using gin (specialties, languages);
create index guides_region_idx on public.guides (base_region);

-- Private guide data: only the guide and admins can read it.
-- Contact details are shared with travellers only once a trip is confirmed (later phase).
create table public.guide_private (
  guide_id uuid primary key references public.guides (id) on delete cascade,
  phone text,
  whatsapp_number text,
  registration_number text,         -- Director of Tourism guide ID card number
  kinapa_tanapa_id text,
  id_document_path text,            -- path in the private 'verification' storage bucket
  license_document_path text,
  admin_notes text,
  updated_at timestamptz not null default now()
);

create trigger guides_updated_at
  before update on public.guides
  for each row execute function public.set_updated_at();

create trigger guide_private_updated_at
  before update on public.guide_private
  for each row execute function public.set_updated_at();

-- Guides cannot verify themselves or change their own plan.
create or replace function public.guard_guide_admin_fields()
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
    new.plan := 'msingi';
    new.plan_expires_at := null;
  else
    new.verification_status := old.verification_status;
    new.verified_at := old.verified_at;
    new.plan := old.plan;
    new.plan_expires_at := old.plan_expires_at;
  end if;
  return new;
end;
$$;

create trigger guides_guard_admin_fields
  before insert or update on public.guides
  for each row execute function public.guard_guide_admin_fields();

-- Admin notes are admin-only.
create or replace function public.guard_guide_private_admin_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.is_trusted() then
    new.admin_notes := case when tg_op = 'INSERT' then null else old.admin_notes end;
  end if;
  return new;
end;
$$;

create trigger guide_private_guard_admin_fields
  before insert or update on public.guide_private
  for each row execute function public.guard_guide_private_admin_fields();

alter table public.guides enable row level security;
alter table public.guide_private enable row level security;

-- Approved public guides are listed; link-only guides are readable by slug (the app filters
-- listings on visibility = 'public'), owners and admins see everything.
create policy "Read guides" on public.guides
  for select to anon, authenticated
  using (
    verification_status = 'approved'
    or owner_id = (select auth.uid())
    or private.is_admin());
create policy "Users create own guide profile" on public.guides
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Owners update own guide profile" on public.guides
  for update to authenticated
  using (owner_id = (select auth.uid()) or private.is_admin())
  with check (owner_id = (select auth.uid()) or private.is_admin());
create policy "Admins delete guides" on public.guides
  for delete to authenticated using (private.is_admin());

create policy "Owners and admins manage guide private data" on public.guide_private
  for all to authenticated
  using (
    exists (select 1 from public.guides g where g.id = guide_id and g.owner_id = (select auth.uid()))
    or private.is_admin())
  with check (
    exists (select 1 from public.guides g where g.id = guide_id and g.owner_id = (select auth.uid()))
    or private.is_admin());

-- Storage: public avatars, private verification documents (folder = owner's user id).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true), ('verification', 'verification', false)
on conflict (id) do nothing;

create policy "Users upload own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users replace own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users upload own verification docs" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'verification' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Owners and admins read verification docs" on storage.objects
  for select to authenticated
  using (bucket_id = 'verification'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or private.is_admin()));
