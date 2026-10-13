-- Trip requests with offers.
-- A traveller describes the trip they want; verified guides and tour companies send offers
-- (price, itinerary, what's included). The traveller accepts one: the request is booked, the
-- other offers are declined, and a chat opens between the traveller and whoever made the offer.
--
-- Replaces the unused provider-only trip_requests/quotes tables from the first schema (both empty).

drop table if exists public.quotes;
drop table if exists public.trip_requests;
drop type if exists public.trip_request_status;

create type public.trip_request_status as enum ('open', 'booked', 'closed');

create table public.trip_requests (
  id uuid primary key default gen_random_uuid(),
  traveler_id uuid not null references auth.users (id) on delete cascade,
  traveler_name text not null check (length(traveler_name) between 1 and 120),
  title text not null check (length(title) between 5 and 140),
  details text not null check (length(details) between 20 and 4000),
  specialty public.guide_specialty not null,
  expertise text[] not null default '{}',
  regions text[] not null default '{}',
  start_date date,
  end_date date,
  flexible_dates boolean not null default false,
  adults integer not null default 2 check (adults between 1 and 50),
  children integer not null default 0 check (children between 0 and 50),
  budget_per_person_usd integer check (budget_per_person_usd between 0 and 100000),
  languages text[] not null default '{}',
  female_guide boolean not null default false,
  status public.trip_request_status not null default 'open',
  offers_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create index trip_requests_open_idx on public.trip_requests (created_at desc) where status = 'open';
create index trip_requests_traveler_idx on public.trip_requests (traveler_id);

create table public.trip_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.trip_requests (id) on delete cascade,
  offered_by uuid not null references auth.users (id) on delete cascade,
  guide_id uuid references public.guides (id) on delete set null,   -- set when a guide offers as themselves
  company_name text check (length(company_name) <= 120),            -- set when a business offers
  price_total_usd integer not null check (price_total_usd between 1 and 1000000),
  deposit_percent integer not null default 30 check (deposit_percent between 0 and 100),
  itinerary text not null check (length(itinerary) between 20 and 6000),
  includes text check (length(includes) <= 1500),
  excludes text check (length(excludes) <= 1500),
  valid_until date,
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined', 'withdrawn')),
  chat_id uuid references public.group_chats (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, offered_by),
  check (guide_id is not null or company_name is not null)
);

create index trip_offers_offerer_idx on public.trip_offers (offered_by);
create index trip_offers_guide_idx on public.trip_offers (guide_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- Verified guides and business accounts may see open requests and make offers.
create or replace function private.can_offer()
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.is_admin()
    or exists (select 1 from public.guides g where g.owner_id = (select auth.uid()) and g.verification_status = 'approved')
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'provider');
$$;

create or replace function private.owns_request(p_request uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.trip_requests r where r.id = p_request and r.traveler_id = (select auth.uid()));
$$;

create or replace function private.has_offered(p_request uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.trip_offers o where o.request_id = p_request and o.offered_by = (select auth.uid()));
$$;

revoke execute on function private.can_offer() from public;
revoke execute on function private.owns_request(uuid) from public;
revoke execute on function private.has_offered(uuid) from public;
grant execute on function private.can_offer() to authenticated;
grant execute on function private.owns_request(uuid) to authenticated;
grant execute on function private.has_offered(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------
create or replace function public.guard_trip_request()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  if private.is_trusted() then return new; end if;
  if tg_op = 'INSERT' then
    new.traveler_id := (select auth.uid());
    new.status := 'open';
    new.offers_count := 0;
    return new;
  end if;
  new.traveler_id := old.traveler_id;
  new.offers_count := old.offers_count;
  -- Travellers can close or reopen; only accepting an offer books a request.
  if old.status = 'booked' or new.status = 'booked' then
    new.status := old.status;
  end if;
  return new;
end;
$$;

create trigger trip_requests_guard before insert or update on public.trip_requests
  for each row execute function public.guard_trip_request();

create or replace function public.guard_trip_offer()
returns trigger language plpgsql set search_path = ''
as $$
declare
  req public.trip_requests;
begin
  new.updated_at := now();
  if private.is_trusted() then return new; end if;

  if tg_op = 'INSERT' then
    select * into req from public.trip_requests where id = new.request_id;
    if req.id is null or req.status <> 'open' then
      raise exception 'This trip request is no longer open';
    end if;
    if req.traveler_id = (select auth.uid()) then
      raise exception 'You cannot make an offer on your own request';
    end if;
    -- Guides offer as themselves (approved profile they own); businesses give a company name.
    if not private.can_organize_group(new.guide_id, new.company_name) then
      raise exception 'Only verified guides and tour companies can make offers';
    end if;
    new.offered_by := (select auth.uid());
    new.status := 'sent';
    new.chat_id := null;
    return new;
  end if;

  new.request_id := old.request_id;
  new.offered_by := old.offered_by;
  new.guide_id := old.guide_id;
  new.chat_id := old.chat_id;

  if private.owns_request(old.request_id) and old.offered_by <> (select auth.uid()) then
    -- The traveller can only accept or decline an offer that is still on the table.
    if not (old.status = 'sent' and new.status in ('accepted', 'declined')) then
      new.status := old.status;
    end if;
    if new.status = 'accepted' and not exists (
      select 1 from public.trip_requests r where r.id = old.request_id and r.status = 'open') then
      raise exception 'This trip request is already booked or closed';
    end if;
    if new.status = 'accepted' and old.valid_until is not null and old.valid_until < current_date then
      raise exception 'This offer has expired';
    end if;
    new.company_name := old.company_name;
    new.price_total_usd := old.price_total_usd;
    new.deposit_percent := old.deposit_percent;
    new.itinerary := old.itinerary;
    new.includes := old.includes;
    new.excludes := old.excludes;
    new.valid_until := old.valid_until;
  else
    -- The offerer can edit while the offer is on the table, or withdraw it.
    if old.status <> 'sent' then
      new := old;
      new.updated_at := now();
    elsif new.status not in ('sent', 'withdrawn') then
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;

create trigger trip_offers_guard before insert or update on public.trip_offers
  for each row execute function public.guard_trip_offer();

-- ---------------------------------------------------------------------------
-- After an offer changes: keep the count, book the request, open a chat, send alerts.
-- ---------------------------------------------------------------------------
create or replace function private.on_trip_offer_changed()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  req public.trip_requests;
  v_from text;
  v_chat uuid;
  v_phone text;
begin
  select * into req from public.trip_requests where id = new.request_id;
  select coalesce(g.display_name, new.company_name) into v_from from (select 1) x
    left join public.guides g on g.id = new.guide_id;
  v_from := coalesce(v_from, new.company_name, 'Rafrika partner');
  v_phone := case when new.guide_id is not null then private.guide_phone(new.guide_id) end;

  update public.trip_requests
  set offers_count = (select count(*) from public.trip_offers o where o.request_id = new.request_id and o.status in ('sent', 'accepted'))
  where id = new.request_id;

  if tg_op = 'INSERT' then
    perform private.notify_user('offer_new', req.traveler_id,
      jsonb_build_object('title', req.title, 'from', v_from, 'price', new.price_total_usd, 'link', '/requests/' || req.id));
    return new;
  end if;

  if new.status = 'accepted' and old.status <> 'accepted' then
    update public.trip_requests set status = 'booked' where id = new.request_id;
    update public.trip_offers set status = 'declined'
    where request_id = new.request_id and id <> new.id and status = 'sent';

    -- A private chat for the traveller and the guide/company (the traveller can invite companions).
    insert into public.group_chats (name, created_by) values (left(req.title, 80), req.traveler_id)
    returning id into v_chat;
    insert into public.group_chat_members (chat_id, user_id, display_name)
    values (v_chat, new.offered_by, left(v_from, 120))
    on conflict do nothing;
    update public.trip_offers set chat_id = v_chat where id = new.id;

    perform private.notify_user('offer_accepted', new.offered_by,
      jsonb_build_object('title', req.title, 'name', req.traveler_name, 'link', '/requests/' || req.id), v_phone);
  elsif new.status = 'declined' and old.status = 'sent' then
    perform private.notify_user('offer_declined', new.offered_by,
      jsonb_build_object('title', req.title, 'link', '/requests'), null, '{email,push}');
  end if;
  return new;
end;
$$;

create trigger trip_offers_after after insert or update of status on public.trip_offers
  for each row execute function private.on_trip_offer_changed();

-- New requests: alert matching verified guides (push + email, at most 40) and the admins.
create or replace function private.on_trip_request_created()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid;
  v_payload jsonb := jsonb_build_object(
    'title', new.title, 'name', new.traveler_name, 'people', new.adults + new.children,
    'when', new.start_date, 'link', '/requests/' || new.id);
begin
  for v_owner in
    select g.owner_id from public.guides g
    where g.verification_status = 'approved'
      and g.owner_id <> new.traveler_id
      and new.specialty = any (g.specialties)
      and (not new.female_guide or g.female_guide)
      and (cardinality(new.regions) = 0 or g.base_region = any (new.regions) or g.regions && new.regions)
      and (cardinality(new.languages) = 0 or g.languages && new.languages)
    order by g.rating_avg desc nulls last
    limit 40
  loop
    perform private.notify_user('request_new', v_owner, v_payload, null, '{email,push}');
  end loop;
  perform private.notify_admins('request_new', v_payload);
  return new;
end;
$$;

create trigger trip_requests_notify after insert on public.trip_requests
  for each row execute function private.on_trip_request_created();

revoke execute on function private.on_trip_offer_changed() from public, anon, authenticated;
revoke execute on function private.on_trip_request_created() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Contact details once an offer is accepted (only for the two people involved).
-- ---------------------------------------------------------------------------
create or replace function public.offer_contacts(p_offer uuid)
returns table (traveler_email text, traveler_phone text, offerer_email text, offerer_phone text)
language sql stable security definer set search_path = ''
as $$
  select tu.email::text, tp.phone, ou.email::text,
         coalesce(case when o.guide_id is not null then private.guide_phone(o.guide_id) end, op.phone)
  from public.trip_offers o
  join public.trip_requests r on r.id = o.request_id
  join auth.users tu on tu.id = r.traveler_id
  join public.profiles tp on tp.id = r.traveler_id
  join auth.users ou on ou.id = o.offered_by
  join public.profiles op on op.id = o.offered_by
  where o.id = p_offer and o.status = 'accepted'
    and (select auth.uid()) in (r.traveler_id, o.offered_by);
$$;

revoke execute on function public.offer_contacts(uuid) from public, anon;
grant execute on function public.offer_contacts(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.trip_requests enable row level security;
alter table public.trip_offers enable row level security;

create policy "Travellers see their requests; guides and companies see open ones" on public.trip_requests
  for select to authenticated
  using (traveler_id = (select auth.uid()) or private.is_admin()
         or (status = 'open' and private.can_offer())
         or private.has_offered(id));
create policy "Travellers post requests" on public.trip_requests
  for insert to authenticated with check (traveler_id = (select auth.uid()));
create policy "Travellers edit their requests" on public.trip_requests
  for update to authenticated using (traveler_id = (select auth.uid()) or private.is_admin())
  with check (traveler_id = (select auth.uid()) or private.is_admin());
create policy "Travellers delete their requests" on public.trip_requests
  for delete to authenticated using (traveler_id = (select auth.uid()) or private.is_admin());

create policy "Offers are seen by the traveller and the offerer" on public.trip_offers
  for select to authenticated
  using (offered_by = (select auth.uid()) or private.owns_request(request_id) or private.is_admin());
create policy "Guides and companies make offers" on public.trip_offers
  for insert to authenticated with check (offered_by = (select auth.uid()) and private.can_offer());
create policy "Offerers edit; travellers accept or decline" on public.trip_offers
  for update to authenticated
  using (offered_by = (select auth.uid()) or private.owns_request(request_id) or private.is_admin())
  with check (offered_by = (select auth.uid()) or private.owns_request(request_id) or private.is_admin());

alter publication supabase_realtime add table public.trip_offers;
