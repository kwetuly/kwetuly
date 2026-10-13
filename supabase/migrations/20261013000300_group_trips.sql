-- Group trips: a verified guide or a business starts a trip with open spots and other
-- travellers ask to join. Rafrika reviews every group trip before it goes public.
-- The organiser accepts or declines each request; accepted seats can never exceed the limit.
-- Money is arranged directly between traveller and organiser (Rafrika does not take payments yet).

create table public.group_trips (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references auth.users (id) on delete cascade,
  guide_id uuid references public.guides (id) on delete set null,   -- set when the organiser is a guide
  company_name text check (length(company_name) <= 120),            -- set when the organiser is a business
  title text not null check (length(title) between 5 and 140),
  description text not null check (length(description) between 20 and 4000),
  specialty public.guide_specialty not null,
  region text not null check (length(region) <= 80),
  meeting_point text check (length(meeting_point) <= 200),
  start_date date not null,
  end_date date not null,
  price_per_person_usd integer not null check (price_per_person_usd between 0 and 100000),
  min_people integer not null default 1 check (min_people between 1 and 100),
  max_people integer not null check (max_people between 2 and 100),
  languages text[] not null default '{}',
  includes text check (length(includes) <= 1000),
  seats_taken integer not null default 0,
  status public.review_status not null default 'pending',
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (min_people <= max_people),
  check (guide_id is not null or company_name is not null)
);

create index group_trips_open_idx on public.group_trips (start_date) where status = 'approved' and not cancelled;
create index group_trips_organizer_idx on public.group_trips (organizer_id);
create index group_trips_guide_idx on public.group_trips (guide_id);

-- Organiser's phone/WhatsApp/email: only the organiser, accepted members and admins can read it.
create table public.group_trip_private (
  group_trip_id uuid primary key references public.group_trips (id) on delete cascade,
  contact text not null check (length(contact) between 3 and 160)
);

create table public.group_trip_members (
  id uuid primary key default gen_random_uuid(),
  group_trip_id uuid not null references public.group_trips (id) on delete cascade,
  traveler_id uuid not null references auth.users (id) on delete cascade,
  traveler_name text not null check (length(traveler_name) between 1 and 120),
  traveler_contact text not null check (length(traveler_contact) between 3 and 160),
  seats integer not null default 1 check (seats between 1 and 20),
  message text check (length(message) <= 1000),
  status text not null default 'requested' check (status in ('requested', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_trip_id, traveler_id)
);

create index group_trip_members_trip_idx on public.group_trip_members (group_trip_id, status);
create index group_trip_members_traveler_idx on public.group_trip_members (traveler_id);

-- ---------------------------------------------------------------------------
-- Who may organise: verified guides (as themselves) and business accounts.
-- ---------------------------------------------------------------------------
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
          select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('provider', 'admin')));
$$;

create or replace function private.is_group_organizer(p_trip uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.group_trips t where t.id = p_trip and t.organizer_id = (select auth.uid()));
$$;

create or replace function private.is_group_member(p_trip uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_trip_members m
    where m.group_trip_id = p_trip and m.traveler_id = (select auth.uid()) and m.status = 'accepted');
$$;

-- Requests are only accepted for approved, open trips that have not started.
create or replace function private.group_trip_open(p_trip uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_trips t
    where t.id = p_trip and t.status = 'approved' and not t.cancelled
      and t.start_date >= current_date and t.organizer_id <> (select auth.uid()));
$$;

revoke execute on function private.can_organize_group(uuid, text) from public;
revoke execute on function private.is_group_organizer(uuid) from public;
revoke execute on function private.is_group_member(uuid) from public;
revoke execute on function private.group_trip_open(uuid) from public;
grant execute on function private.can_organize_group(uuid, text) to authenticated;
grant execute on function private.is_group_organizer(uuid) to authenticated;
grant execute on function private.is_group_member(uuid) to authenticated;
grant execute on function private.group_trip_open(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Guards: organisers cannot approve their own trips or fake the seat count;
-- travellers can only cancel; organisers can only accept or decline.
-- ---------------------------------------------------------------------------
create or replace function public.guard_group_trip_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
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
    new.seats_taken := old.seats_taken;
    -- Material changes send the trip back for review; cancelling does not.
    if (new.title, new.description, new.start_date, new.end_date, new.price_per_person_usd, new.max_people)
       is distinct from
       (old.title, old.description, old.start_date, old.end_date, old.price_per_person_usd, old.max_people) then
      new.status := 'pending';
    else
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;

create trigger group_trips_guard
  before insert or update on public.group_trips
  for each row execute function public.guard_group_trip_fields();

create or replace function public.guard_group_member_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  organizer boolean;
begin
  new.updated_at := now();
  if private.is_trusted() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'requested';
    return new;
  end if;

  new.group_trip_id := old.group_trip_id;
  new.traveler_id := old.traveler_id;
  organizer := private.is_group_organizer(old.group_trip_id);
  if organizer then
    if new.status not in ('accepted', 'declined') then
      new.status := old.status;
    end if;
    new.seats := old.seats;
    new.message := old.message;
    new.traveler_name := old.traveler_name;
    new.traveler_contact := old.traveler_contact;
  else
    -- Travellers can cancel, or ask again after cancelling while the trip is still open.
    if not (new.status = 'cancelled'
            or (new.status = 'requested' and old.status = 'cancelled' and private.group_trip_open(old.group_trip_id))) then
      new.status := old.status;
    end if;
    -- A traveller can change seats or message only while still waiting.
    if old.status <> 'requested' then
      new.seats := old.seats;
    end if;
  end if;
  return new;
end;
$$;

create trigger group_trip_members_guard
  before insert or update on public.group_trip_members
  for each row execute function public.guard_group_member_fields();

-- Keep seats_taken in step with accepted requests, and refuse to overbook.
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
  select max_people into capacity from public.group_trips where id = target for update;
  if taken > capacity then
    raise exception 'Not enough spots left on this group trip';
  end if;
  update public.group_trips set seats_taken = taken where id = target;
  return null;
end;
$$;

create trigger group_trip_members_seats
  after insert or update or delete on public.group_trip_members
  for each row execute function private.refresh_group_seats();

-- ---------------------------------------------------------------------------
-- Alerts
-- ---------------------------------------------------------------------------
create or replace function private.on_group_trip_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or (new.status = 'pending' and old.status is distinct from 'pending') then
    perform private.notify_admins('group_pending',
      jsonb_build_object('title', new.title, 'organizer', coalesce(new.company_name, 'guide'), 'link', '/admin#groups'));
  elsif new.status = 'approved' and old.status is distinct from 'approved' then
    perform private.notify_user('group_approved', new.organizer_id,
      jsonb_build_object('title', new.title, 'link', '/group-trips/' || new.id));
  end if;
  return new;
end;
$$;

create trigger group_trips_notify after insert or update of status on public.group_trips
  for each row execute function private.on_group_trip_changed();

create or replace function private.on_group_member_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  trip public.group_trips;
begin
  select * into trip from public.group_trips where id = new.group_trip_id;
  if tg_op = 'INSERT' then
    perform private.notify_user('group_join_requested', trip.organizer_id,
      jsonb_build_object('title', trip.title, 'name', new.traveler_name, 'seats', new.seats::text,
                         'message', left(coalesce(new.message, ''), 300), 'link', '/group-trips/' || trip.id),
      case when trip.guide_id is not null then private.guide_phone(trip.guide_id) end);
  elsif new.status is distinct from old.status and new.status in ('accepted', 'declined') then
    perform private.notify_user('group_join_' || new.status, new.traveler_id,
      jsonb_build_object('title', trip.title, 'link', '/group-trips/' || trip.id));
  end if;
  return new;
end;
$$;

create trigger group_trip_members_notify after insert or update of status on public.group_trip_members
  for each row execute function private.on_group_member_changed();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.group_trips enable row level security;
alter table public.group_trip_private enable row level security;
alter table public.group_trip_members enable row level security;

create policy "Anyone sees approved group trips; organisers and admins see their own" on public.group_trips
  for select to anon, authenticated
  using (status = 'approved' or organizer_id = (select auth.uid()) or private.is_admin());
create policy "Verified guides and businesses create group trips" on public.group_trips
  for insert to authenticated
  with check (organizer_id = (select auth.uid()) and private.can_organize_group(guide_id, company_name));
create policy "Organisers and admins update group trips" on public.group_trips
  for update to authenticated
  using (organizer_id = (select auth.uid()) or private.is_admin())
  with check (organizer_id = (select auth.uid()) or private.is_admin());
create policy "Organisers and admins delete group trips" on public.group_trips
  for delete to authenticated
  using (organizer_id = (select auth.uid()) or private.is_admin());

create policy "Organiser, accepted members and admins read the contact" on public.group_trip_private
  for select to authenticated
  using (private.is_group_organizer(group_trip_id) or private.is_group_member(group_trip_id) or private.is_admin());
create policy "Organisers manage the contact" on public.group_trip_private
  for all to authenticated
  using (private.is_group_organizer(group_trip_id) or private.is_admin())
  with check (private.is_group_organizer(group_trip_id) or private.is_admin());

create policy "Travellers see their requests; organisers see requests for their trips" on public.group_trip_members
  for select to authenticated
  using (traveler_id = (select auth.uid()) or private.is_group_organizer(group_trip_id) or private.is_admin());
create policy "Travellers ask to join open trips" on public.group_trip_members
  for insert to authenticated
  with check (traveler_id = (select auth.uid()) and private.group_trip_open(group_trip_id));
create policy "Travellers and organisers update requests" on public.group_trip_members
  for update to authenticated
  using (traveler_id = (select auth.uid()) or private.is_group_organizer(group_trip_id) or private.is_admin())
  with check (traveler_id = (select auth.uid()) or private.is_group_organizer(group_trip_id) or private.is_admin());

-- An organiser cannot shrink a trip below the people already accepted.
alter table public.group_trips add constraint group_trips_capacity check (seats_taken <= max_people);
