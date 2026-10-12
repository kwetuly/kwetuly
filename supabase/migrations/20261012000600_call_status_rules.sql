-- Who may change what on a call request:
-- the guide accepts/declines/completes and sets the time and link; the traveller can only cancel.
create or replace function public.guard_call_request_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_guide boolean;
begin
  if private.is_trusted() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'requested';
    new.payment_status := 'pending';
    new.scheduled_at := null;
    new.meeting_link := null;
    select g.call_price_usd into new.price_usd from public.guides g where g.id = new.guide_id;
    return new;
  end if;

  new.guide_id := old.guide_id;
  new.traveler_id := old.traveler_id;
  new.price_usd := old.price_usd;
  new.payment_status := old.payment_status;

  select exists (
    select 1 from public.guides g where g.id = old.guide_id and g.owner_id = (select auth.uid())
  ) into is_guide;

  if is_guide then
    if new.status not in ('requested', 'accepted', 'declined', 'completed') then
      new.status := old.status;
    end if;
    new.topic := old.topic;
    new.preferred_times := old.preferred_times;
    new.message := old.message;
    new.traveler_contact := old.traveler_contact;
  else
    -- Traveller: may cancel and edit their own notes, nothing else.
    if new.status <> 'cancelled' then
      new.status := old.status;
    end if;
    new.scheduled_at := old.scheduled_at;
    new.meeting_link := old.meeting_link;
  end if;
  return new;
end;
$$;
