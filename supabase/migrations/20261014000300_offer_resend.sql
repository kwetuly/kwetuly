-- A guide who withdrew an offer may send it again while the request is still open.
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
    -- The offerer can edit while the offer is on the table, withdraw it, or send it again
    -- after withdrawing (only while the request is open). Accepted or declined offers are final.
    if old.status in ('accepted', 'declined')
       or (old.status = 'withdrawn' and not exists (
             select 1 from public.trip_requests r where r.id = old.request_id and r.status = 'open')) then
      new := old;
      new.updated_at := now();
    elsif new.status not in ('sent', 'withdrawn') then
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;
