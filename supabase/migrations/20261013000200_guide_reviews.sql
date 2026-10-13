-- Reviews that belong to the guide. Only travellers who really dealt with a guide can review:
-- an accepted or completed prep call, or a conversation where contact was unlocked (booking agreed).
-- One review per traveller per guide; the traveller can edit it, admins can hide it.

create table public.guide_reviews (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.guides (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null check (length(author_name) between 1 and 80),
  rating smallint not null check (rating between 1 and 5),
  body text not null check (length(body) between 10 and 2000),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guide_id, author_id)
);

create index guide_reviews_guide_idx on public.guide_reviews (guide_id, created_at desc);
create index guide_reviews_author_idx on public.guide_reviews (author_id);

-- Summary shown on cards and profiles, kept up to date by a trigger.
alter table public.guides
  add column rating_avg numeric(2, 1),
  add column rating_count integer not null default 0;

create or replace function private.can_review_guide(p_guide_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not exists (select 1 from public.guides g where g.id = p_guide_id and g.owner_id = (select auth.uid()))
    and (
      exists (
        select 1 from public.call_requests c
        where c.guide_id = p_guide_id and c.traveler_id = (select auth.uid())
          and c.status in ('accepted', 'completed'))
      or exists (
        select 1 from public.conversations v
        where v.guide_id = p_guide_id and v.traveler_id = (select auth.uid()) and v.contact_unlocked)
    );
$$;

create or replace function public.guard_review_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_trusted() then
    new.updated_at := now();
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.hidden := false;
    new.created_at := now();
  else
    new.guide_id := old.guide_id;
    new.author_id := old.author_id;
    new.hidden := old.hidden;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger guide_reviews_guard
  before insert or update on public.guide_reviews
  for each row execute function public.guard_review_fields();

create or replace function private.refresh_guide_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(new.guide_id, old.guide_id);
begin
  update public.guides g
  set rating_avg = s.avg_rating, rating_count = s.total
  from (
    select round(avg(rating)::numeric, 1) as avg_rating, count(*)::int as total
    from public.guide_reviews where guide_id = target and not hidden
  ) s
  where g.id = target;
  return null;
end;
$$;

create trigger guide_reviews_rating
  after insert or update or delete on public.guide_reviews
  for each row execute function private.refresh_guide_rating();

-- Guides cannot edit their own rating summary.
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
    new.rating_avg := null;
    new.rating_count := 0;
  else
    new.verification_status := old.verification_status;
    new.verified_at := old.verified_at;
    new.plan := old.plan;
    new.plan_expires_at := old.plan_expires_at;
    new.rating_avg := old.rating_avg;
    new.rating_count := old.rating_count;
  end if;
  return new;
end;
$$;

-- Tell the guide about a new review.
create or replace function private.on_review_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
  slug text;
begin
  select g.owner_id, g.slug into owner, slug from public.guides g where g.id = new.guide_id;
  perform private.notify_user('review_new', owner,
    jsonb_build_object('author', new.author_name, 'rating', new.rating::text,
                       'preview', left(new.body, 140), 'link', '/guides/' || slug),
    private.guide_phone(new.guide_id));
  return new;
end;
$$;

create trigger guide_reviews_notify after insert on public.guide_reviews
  for each row execute function private.on_review_created();

alter table public.guide_reviews enable row level security;

create policy "Anyone reads visible reviews" on public.guide_reviews
  for select to anon, authenticated
  using (not hidden or author_id = (select auth.uid()) or private.is_admin());
create policy "Travellers who dealt with the guide can review" on public.guide_reviews
  for insert to authenticated
  with check (author_id = (select auth.uid()) and private.can_review_guide(guide_id));
create policy "Authors and admins update reviews" on public.guide_reviews
  for update to authenticated
  using (author_id = (select auth.uid()) or private.is_admin())
  with check (author_id = (select auth.uid()) or private.is_admin());
create policy "Authors and admins delete reviews" on public.guide_reviews
  for delete to authenticated
  using (author_id = (select auth.uid()) or private.is_admin());

revoke execute on function private.can_review_guide(uuid) from public;
grant execute on function private.can_review_guide(uuid) to authenticated;
