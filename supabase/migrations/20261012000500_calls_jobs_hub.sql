-- 1-on-1 prep calls with chosen guides, a jobs board for guides/cooks/porters,
-- and the guides-only Guide Hub (forum + field news).

-- Approved guides (and admins) can enter the Guide Hub.
create or replace function private.is_verified_guide()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin() or exists (
    select 1 from public.guides
    where owner_id = (select auth.uid()) and verification_status = 'approved'
  );
$$;

grant execute on function private.is_verified_guide() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1-on-1 calls offered by guides
-- ---------------------------------------------------------------------------
alter table public.guides
  add column call_enabled boolean not null default false,
  add column call_price_usd numeric(10, 2) check (call_price_usd >= 0),
  add column call_minutes int not null default 45 check (call_minutes between 15 and 180),
  add column call_topics text[] not null default '{}';

create type public.call_status as enum ('requested', 'accepted', 'declined', 'completed', 'cancelled');

create table public.call_requests (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.guides (id) on delete cascade,
  traveler_id uuid not null references public.profiles (id) on delete cascade,
  topic text not null check (length(topic) <= 60),
  preferred_times text check (length(preferred_times) <= 500),
  message text check (length(message) <= 2000),
  traveler_contact text check (length(traveler_contact) <= 160),
  status public.call_status not null default 'requested',
  scheduled_at timestamptz,
  meeting_link text check (length(meeting_link) <= 300),
  price_usd numeric(10, 2),
  payment_status public.payment_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index call_requests_guide_idx on public.call_requests (guide_id, created_at desc);
create index call_requests_traveler_idx on public.call_requests (traveler_id, created_at desc);

create trigger call_requests_updated_at
  before update on public.call_requests
  for each row execute function public.set_updated_at();

-- Only the server (Selcom webhook) or admins change payment; parties can't be swapped.
create or replace function public.guard_call_request_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_trusted() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'requested';
    new.payment_status := 'pending';
    new.scheduled_at := null;
    new.meeting_link := null;
    -- Price comes from the guide's current offer, not from the client.
    select g.call_price_usd into new.price_usd from public.guides g where g.id = new.guide_id;
  else
    new.guide_id := old.guide_id;
    new.traveler_id := old.traveler_id;
    new.price_usd := old.price_usd;
    new.payment_status := old.payment_status;
  end if;
  return new;
end;
$$;

create trigger call_requests_guard_fields
  before insert or update on public.call_requests
  for each row execute function public.guard_call_request_fields();

alter table public.call_requests enable row level security;

create policy "Travelers request calls with guides who offer them" on public.call_requests
  for insert to authenticated
  with check (
    traveler_id = (select auth.uid())
    and exists (
      select 1 from public.guides g
      where g.id = guide_id and g.call_enabled and g.verification_status = 'approved'));
create policy "Travelers and guides read their calls" on public.call_requests
  for select to authenticated
  using (
    traveler_id = (select auth.uid())
    or exists (select 1 from public.guides g where g.id = guide_id and g.owner_id = (select auth.uid()))
    or private.is_admin());
create policy "Travelers and guides update their calls" on public.call_requests
  for update to authenticated
  using (
    traveler_id = (select auth.uid())
    or exists (select 1 from public.guides g where g.id = guide_id and g.owner_id = (select auth.uid()))
    or private.is_admin());

-- ---------------------------------------------------------------------------
-- Jobs board: companies advertise for guides, cooks, porters, drivers
-- ---------------------------------------------------------------------------
create type public.job_role as enum ('guide', 'assistant_guide', 'cook', 'porter', 'driver', 'other');

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  posted_by uuid not null references public.profiles (id) on delete cascade,
  company_name text not null check (length(company_name) <= 120),
  role_needed public.job_role not null,
  title text not null check (length(title) <= 140),
  description text check (length(description) <= 4000),
  location text not null check (length(location) <= 80),
  start_date date,
  end_date date,
  pay text check (length(pay) <= 120),
  how_to_apply text not null check (length(how_to_apply) <= 300),
  status public.review_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jobs_open_idx on public.jobs (created_at desc) where status = 'approved';
create index jobs_posted_by_idx on public.jobs (posted_by);

create trigger jobs_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

create or replace function public.guard_job_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.is_trusted() then
    new.status := case when tg_op = 'INSERT' then 'pending'::public.review_status else old.status end;
  end if;
  return new;
end;
$$;

create trigger jobs_guard_status
  before insert or update on public.jobs
  for each row execute function public.guard_job_status();

alter table public.jobs enable row level security;

create policy "Signed-in businesses post jobs" on public.jobs
  for insert to authenticated with check (posted_by = (select auth.uid()));
create policy "Verified guides see approved jobs; posters see their own" on public.jobs
  for select to authenticated
  using (
    (status = 'approved' and private.is_verified_guide())
    or posted_by = (select auth.uid())
    or private.is_admin());
create policy "Posters and admins update jobs" on public.jobs
  for update to authenticated
  using (posted_by = (select auth.uid()) or private.is_admin())
  with check (posted_by = (select auth.uid()) or private.is_admin());
create policy "Posters and admins delete jobs" on public.jobs
  for delete to authenticated using (posted_by = (select auth.uid()) or private.is_admin());

-- ---------------------------------------------------------------------------
-- Guide Hub: forum threads and official field news (verified guides only)
-- ---------------------------------------------------------------------------
create type public.hub_post_kind as enum ('forum', 'news');

create table public.hub_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  kind public.hub_post_kind not null default 'forum',
  title text not null check (length(title) <= 160),
  body text not null check (length(body) <= 6000),
  region text check (length(region) <= 60),
  source text check (length(source) <= 120), -- e.g. 'TANAPA', 'Ministry of Natural Resources and Tourism'
  author_name text, -- copied from the author's profile by trigger, so names show without exposing profiles
  author_slug text,
  created_at timestamptz not null default now()
);

create index hub_posts_kind_idx on public.hub_posts (kind, created_at desc);
create index hub_posts_author_idx on public.hub_posts (author_id);

create table public.hub_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.hub_posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(body) <= 3000),
  author_name text,
  author_slug text,
  created_at timestamptz not null default now()
);

create index hub_replies_post_idx on public.hub_replies (post_id, created_at);
create index hub_replies_author_idx on public.hub_replies (author_id);

alter table public.hub_posts enable row level security;
alter table public.hub_replies enable row level security;

create policy "Verified guides read the hub" on public.hub_posts
  for select to authenticated using (private.is_verified_guide());
create policy "Verified guides post in the forum; admins post news" on public.hub_posts
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and ((kind = 'forum' and private.is_verified_guide()) or private.is_admin()));
create policy "Authors and admins delete posts" on public.hub_posts
  for delete to authenticated using (author_id = (select auth.uid()) or private.is_admin());

create policy "Verified guides read replies" on public.hub_replies
  for select to authenticated using (private.is_verified_guide());
create policy "Verified guides reply" on public.hub_replies
  for insert to authenticated
  with check (author_id = (select auth.uid()) and private.is_verified_guide());
create policy "Authors and admins delete replies" on public.hub_replies
  for delete to authenticated using (author_id = (select auth.uid()) or private.is_admin());

create or replace function public.set_hub_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select coalesce(g.display_name, p.full_name, 'Rafrika'), g.slug
    into new.author_name, new.author_slug
  from public.profiles p
  left join public.guides g on g.owner_id = p.id
  where p.id = new.author_id;
  return new;
end;
$$;

revoke execute on function public.set_hub_author() from public, anon, authenticated;

create trigger hub_posts_set_author
  before insert on public.hub_posts
  for each row execute function public.set_hub_author();
create trigger hub_replies_set_author
  before insert on public.hub_replies
  for each row execute function public.set_hub_author();
