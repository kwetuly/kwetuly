-- Guides offer their own packages (cultural visits, one-on-one trips, day trips...). Each package is
-- reviewed by an admin before travellers see it, and goes back for review whenever its content changes.

create type public.package_status as enum ('draft', 'pending', 'approved', 'rejected');

create table public.guide_packages (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.guides (id) on delete cascade,
  kind text not null check (kind in ('cultural', 'one_on_one', 'day_trip', 'multi_day', 'food', 'city', 'nature', 'other')),
  title text not null check (char_length(title) between 3 and 120),
  summary text not null check (char_length(summary) between 10 and 500),
  details text check (char_length(details) <= 4000),
  duration_hours int check (duration_hours between 1 and 24),
  duration_days int check (duration_days between 1 and 30),
  price_usd numeric(10, 2) check (price_usd >= 0),          -- null = price on request
  price_per text not null default 'person' check (price_per in ('person', 'group')),
  max_group int check (max_group between 1 and 60),
  includes text[] not null default '{}',
  meeting_point text check (char_length(meeting_point) <= 200),
  photo_url text,
  status public.package_status not null default 'pending',
  review_note text,
  reviewed_at timestamptz,
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index guide_packages_guide_idx on public.guide_packages (guide_id, sort_order);
create index guide_packages_approved_idx on public.guide_packages (kind) where status = 'approved';

create trigger guide_packages_updated_at
  before update on public.guide_packages
  for each row execute function public.set_updated_at();

-- Guides cannot approve their own packages; changing an approved package sends it back for review.
create or replace function public.guard_guide_package()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_trusted() then
    if new.status in ('approved', 'rejected') and (tg_op = 'INSERT' or new.status is distinct from old.status) then
      new.reviewed_at := now();
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'pending') then
      new.status := 'pending';
    end if;
    new.review_note := null;
    new.reviewed_at := null;
    return new;
  end if;
  new.review_note := old.review_note;
  new.reviewed_at := old.reviewed_at;
  if new.status not in ('draft', 'pending') then
    new.status := old.status;
  end if;
  if new.status = old.status and old.status in ('approved', 'rejected')
     and (new.kind, new.title, new.summary, new.details, new.duration_hours, new.duration_days, new.price_usd,
          new.price_per, new.max_group, new.includes, new.meeting_point, new.photo_url)
     is distinct from
         (old.kind, old.title, old.summary, old.details, old.duration_hours, old.duration_days, old.price_usd,
          old.price_per, old.max_group, old.includes, old.meeting_point, old.photo_url) then
    new.status := 'pending';
  end if;
  return new;
end;
$$;

create trigger guide_packages_guard
  before insert or update on public.guide_packages
  for each row execute function public.guard_guide_package();

alter table public.guide_packages enable row level security;

create policy "Read approved packages of approved guides" on public.guide_packages
  for select to anon, authenticated
  using (
    (status = 'approved'
      and exists (select 1 from public.guides g where g.id = guide_id and g.verification_status = 'approved'))
    or exists (select 1 from public.guides g where g.id = guide_id and g.owner_id = (select auth.uid()))
    or private.is_admin());
create policy "Guides add their own packages" on public.guide_packages
  for insert to authenticated
  with check (exists (select 1 from public.guides g where g.id = guide_id and g.owner_id = (select auth.uid())));
create policy "Guides and admins update packages" on public.guide_packages
  for update to authenticated
  using (exists (select 1 from public.guides g where g.id = guide_id and g.owner_id = (select auth.uid())) or private.is_admin())
  with check (exists (select 1 from public.guides g where g.id = guide_id and g.owner_id = (select auth.uid())) or private.is_admin());
create policy "Guides and admins delete packages" on public.guide_packages
  for delete to authenticated
  using (exists (select 1 from public.guides g where g.id = guide_id and g.owner_id = (select auth.uid())) or private.is_admin());

-- Enquiries can name the package the traveller asked about.
alter table public.leads add column package_id uuid references public.guide_packages (id) on delete set null;
create index leads_package_id_idx on public.leads (package_id);
