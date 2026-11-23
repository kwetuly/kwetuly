-- NOT APPLIED. Chat between a traveller and a business, for reservations (Walter 2026-11-23:
-- businesses and travellers talk only through Kwetuly chat; a business never sees the traveller's
-- phone number or email). backend-engineer, 2026-11-23. Needs 20261122200000_reservation_setup.sql
-- and 20261122300000_reservations.sql first. Apply on live only with Walter's yes, after
-- security-reviewer and qa-tester (tests: supabase/checks/business_chat_tests.sql).
--
-- This EXTENDS the existing 1-to-1 chat (public.conversations / public.messages); it is not a new
-- chat system. Every guide-thread behaviour stays exactly as before: the same rows, policies, masking,
-- unlocking, read markers and alerts. The tests prove it.
--
-- What it does:
--   1. conversations.provider_id (a business); guide_id becomes optional; exactly one of the two.
--      One thread per traveller and business (partial unique index). Business threads are NEVER
--      unlocked (check constraint), so private.mask_message() always hides phone numbers, emails and
--      WhatsApp / social links in them, both ways. An admin "unlock" on a business thread is refused.
--   2. Business threads are created only by the server: a reservation insert (only
--      place_reservation() inserts reservations) links the reservation to the traveller's thread with
--      that business, creating it the first time (reservations.chat_id). Clients cannot create one:
--      the existing insert policy needs an approved guide_id. Sample businesses get no thread.
--   3. Who is in a thread: the traveller and, for a business thread, the business owner (plus admins
--      for reading). private.in_conversation() and the read / update policies add the business owner.
--   4. Read markers: the business owner uses the same column as a guide, guide_last_read_at (meaning
--      "the guide's or the business's read time"), so the chat screens need no new column.
--   5. Alerts (private.after_message): for a business thread the business owner is alerted (email,
--      push, WhatsApp to the business number, private.provider_phone), the same 15-minute rule as for
--      guides. The sender is shown as the business name, or the traveller's first name.
--   6. conversations.traveler_name for a business thread is the traveller's first name only.
--   7. my_reservations() and business_reservations() return chat_id as a new last column.
--
-- Access rules after this file:
--   conversations: read and mark read: the traveller, the guide's owner (guide thread), the business
--     owner (business thread), admins. Insert: travellers, guide threads only (unchanged).
--   messages: read and send: participants as above (via private.in_conversation), admins read.
--
-- Undo (before any business thread exists; deleting business threads deletes their messages):
--   delete from public.conversations where provider_id is not null;
--   alter table public.reservations drop column chat_id;   -- then re-run the two functions from 20261122300000
--   drop trigger reservations_link_chat on public.reservations; drop function private.reservation_link_chat();
--   re-create private.in_conversation(), public.guard_conversation_update(),
--     private.set_conversation_traveler_name(), private.after_message() and the two conversation
--     policies from 20261012001100, 20261012001200, 20261012001300 and 20261025000100;
--   drop index conversations_traveler_provider_key, conversations_provider_idx;
--   alter table public.conversations drop constraint conversations_one_party,
--     drop constraint conversations_business_never_unlocked, drop column provider_id,
--     alter column guide_id set not null;

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
alter table public.conversations
  add column if not exists provider_id uuid references public.providers (id) on delete cascade;
alter table public.conversations alter column guide_id drop not null;

alter table public.conversations drop constraint if exists conversations_one_party;
alter table public.conversations add constraint conversations_one_party
  check (num_nonnulls(guide_id, provider_id) = 1);
alter table public.conversations drop constraint if exists conversations_business_never_unlocked;
alter table public.conversations add constraint conversations_business_never_unlocked
  check (provider_id is null or not contact_unlocked);

create unique index if not exists conversations_traveler_provider_key
  on public.conversations (traveler_id, provider_id) where provider_id is not null;
create index if not exists conversations_provider_idx
  on public.conversations (provider_id, last_message_at desc) where provider_id is not null;

comment on column public.conversations.provider_id is
  'Business thread (reservations). Exactly one of guide_id and provider_id. Never unlocked: contact details stay hidden.';
comment on column public.conversations.guide_last_read_at is
  'Read time of the other side: the guide''s owner in a guide thread, the business owner in a business thread.';

-- ---------------------------------------------------------------------------
-- 2. Membership
-- ---------------------------------------------------------------------------
-- From 20261012001100; the business owner is added. Guide threads: unchanged.
create or replace function private.in_conversation(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    left join public.guides g on g.id = c.guide_id
    left join public.providers pr on pr.id = c.provider_id
    where c.id = p_conversation
      and (c.traveler_id = (select auth.uid()) or g.owner_id = (select auth.uid()) or pr.owner_id = (select auth.uid()))
  );
$$;
grant execute on function private.in_conversation(uuid) to authenticated;

-- From 20261012001200; the business owner is added. Guide threads: unchanged.
drop policy if exists "Participants and admins read conversations" on public.conversations;
create policy "Participants and admins read conversations" on public.conversations
  for select to authenticated
  using (
    traveler_id = (select auth.uid())
    or exists (select 1 from public.guides g where g.id = guide_id and g.owner_id = (select auth.uid()))
    or exists (select 1 from public.providers pr where pr.id = provider_id and pr.owner_id = (select auth.uid()))
    or private.is_admin());

drop policy if exists "Participants mark conversations read" on public.conversations;
create policy "Participants mark conversations read" on public.conversations
  for update to authenticated
  using (
    traveler_id = (select auth.uid())
    or exists (select 1 from public.guides g where g.id = guide_id and g.owner_id = (select auth.uid()))
    or exists (select 1 from public.providers pr where pr.id = provider_id and pr.owner_id = (select auth.uid()))
    or private.is_admin());

-- The insert policy "Travellers start conversations with approved guides" (20261016001800) is kept as
-- it is: it needs an approved guide_id, so no client can create a business thread.

-- From 20261012001100; provider_id is frozen too. Guide threads: unchanged.
create or replace function public.guard_conversation_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_traveler boolean := old.traveler_id = (select auth.uid());
begin
  if private.is_trusted() then
    return new;
  end if;
  new.traveler_id := old.traveler_id;
  new.guide_id := old.guide_id;
  new.provider_id := old.provider_id;
  new.trip_id := old.trip_id;
  new.contact_unlocked := old.contact_unlocked;
  new.last_message_at := old.last_message_at;
  if is_traveler then
    new.guide_last_read_at := old.guide_last_read_at;
  else
    new.traveler_last_read_at := old.traveler_last_read_at;
  end if;
  return new;
end;
$$;

-- From 20261012001300; business threads get the first name only. Guide threads: unchanged.
create or replace function private.set_conversation_traveler_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.provider_id is not null then
    select coalesce(nullif(split_part(btrim(full_name), ' ', 1), ''), 'Traveller') into new.traveler_name
    from public.profiles where id = new.traveler_id;
    new.traveler_name := coalesce(new.traveler_name, 'Traveller');
    return new;
  end if;
  select coalesce(full_name, 'Traveller') into new.traveler_name from public.profiles where id = new.traveler_id;
  return new;
end;
$$;
revoke execute on function private.set_conversation_traveler_name() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Alerts
-- ---------------------------------------------------------------------------
-- From 20261025000100 (latest); the business branch is added. Guide threads: unchanged.
create or replace function private.after_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.conversations;
  v_guide_owner uuid;
  v_business_owner uuid;
  v_business_name text;
  v_recipient uuid;
  v_phone text;
  v_sender text;
  v_sw boolean;
begin
  if new.masked then
    -- New setting name first; the old name covers a statement that started before the rename.
    insert into public.message_moderation (message_id, original_body)
    values (new.id, coalesce(
      nullif(current_setting('kwetuly.orig_' || replace(new.id::text, '-', ''), true), ''),
      current_setting('rafrika.orig_' || replace(new.id::text, '-', ''), true),
      ''));
  end if;

  select * into c from public.conversations where id = new.conversation_id;

  update public.conversations set last_message_at = new.created_at where id = c.id;

  if c.provider_id is not null then
    -- Business thread: the business owner and the business's WhatsApp number.
    select pr.owner_id, pr.business_name into v_business_owner, v_business_name
    from public.providers pr where pr.id = c.provider_id;
    if new.sender_id = c.traveler_id then
      v_recipient := v_business_owner;
      v_phone := private.provider_phone(c.provider_id);
    else
      v_recipient := c.traveler_id;
    end if;
    select p.preferred_language = 'sw' into v_sw from public.profiles p where p.id = v_recipient;
    if new.sender_id = c.traveler_id then
      select coalesce(nullif(split_part(btrim(p.full_name), ' ', 1), ''),
                      case when v_sw then 'Msafiri' else 'A traveller' end) into v_sender
      from public.profiles p where p.id = new.sender_id;
    elsif new.sender_id = v_business_owner then
      v_sender := v_business_name;
    else
      select case when p.role = 'admin' then 'Kwetuly' else case when v_sw then 'Mwanachama' else 'A member' end end
        into v_sender
      from public.profiles p where p.id = new.sender_id;
    end if;
  else
    -- Guide thread: exactly as before.
    select owner_id into v_guide_owner from public.guides where id = c.guide_id;
    if new.sender_id = c.traveler_id then
      v_recipient := v_guide_owner;
      v_phone := private.guide_phone(c.guide_id);
    else
      v_recipient := c.traveler_id;
    end if;

    -- The fallback is in the recipient's language (the alert text is sw or en, see the notify function)
    -- and never says "Kwetuly" unless the sender is an admin.
    select p.preferred_language = 'sw' into v_sw from public.profiles p where p.id = v_recipient;
    select coalesce(g.display_name, p.full_name,
             case
               when p.role = 'admin' then 'Kwetuly'
               when new.sender_id = c.traveler_id or p.role = 'traveler' then case when v_sw then 'Msafiri' else 'A traveller' end
               when p.role = 'guide' then case when v_sw then 'Mwongoza watalii' else 'A guide' end
               else case when v_sw then 'Mwanachama' else 'A member' end
             end) into v_sender
    from public.profiles p left join public.guides g on g.owner_id = p.id where p.id = new.sender_id;
  end if;

  -- At most one alert per conversation every 15 minutes, so a busy chat doesn't flood WhatsApp.
  if v_recipient is not null and not exists (
    select 1 from public.notification_outbox o
    where o.recipient_user_id = v_recipient
      and o.event = 'message_new'
      and o.payload->>'conversation' = c.id::text
      and o.created_at > now() - interval '15 minutes'
  ) then
    perform private.notify_user('message_new', v_recipient,
      jsonb_build_object('sender', v_sender, 'preview', left(new.body, 160),
                         'conversation', c.id, 'link', '/messages/' || c.id), v_phone);
  end if;
  return new;
end;
$$;
revoke execute on function private.after_message() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Reservations link to the thread
-- ---------------------------------------------------------------------------
alter table public.reservations
  add column if not exists chat_id uuid references public.conversations (id) on delete set null;

-- Before insert (only place_reservation() inserts reservations): reuse the traveller's thread with
-- this business, or create it. Sample businesses get none.
create or replace function private.reservation_link_chat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_sample or new.traveler_id is null or new.provider_id is null then
    return new;
  end if;
  insert into public.conversations (traveler_id, provider_id)
  values (new.traveler_id, new.provider_id)
  on conflict (traveler_id, provider_id) where provider_id is not null do nothing;
  select c.id into new.chat_id
  from public.conversations c
  where c.traveler_id = new.traveler_id and c.provider_id = new.provider_id;
  return new;
end;
$$;
revoke execute on function private.reservation_link_chat() from public, anon, authenticated;
drop trigger if exists reservations_link_chat on public.reservations;
create trigger reservations_link_chat
  before insert on public.reservations
  for each row execute function private.reservation_link_chat();

-- From 20261122300000; chat_id added as the last column.
drop function if exists public.my_reservations();
create or replace function public.my_reservations()
returns table (
  id uuid, provider_id uuid, business_name text, business_type text, service_name text,
  starts_at timestamptz, party_size integer, note text, status public.reservation_status,
  offered_starts_at timestamptz, business_note text, cancelled_by text, decline_reason text,
  diet_line text, traveller_said_happened boolean, can_answer_visit boolean,
  commission_kind text, commission_rate_tzs integer, commission_percent numeric, created_at timestamptz,
  asks_people_count boolean, answer_by timestamptz, chat_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.provider_id, r.business_name, r.business_type, r.service_name, r.starts_at, r.party_size,
         r.note, r.status, r.offered_starts_at, r.business_note, r.cancelled_by, r.decline_reason,
         d.line, r.traveller_said_happened,
         (r.traveller_answered_at is null and r.status in ('confirmed', 'completed', 'no_show')
          and private.tz_today() > (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date
          and private.tz_today() <= (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date + 14),
         r.commission_kind, r.commission_rate_tzs, r.commission_percent, r.created_at,
         -- Review M1: ask "How many of you came?" when the business counted fewer than booked.
         (r.status = 'completed' and r.came_count < r.party_size),
         case when r.status in ('requested', 'other_time_offered') then r.answer_by end,
         r.chat_id
  from public.reservations r
  left join public.reservation_diet_lines d on d.reservation_id = r.id
  where r.traveler_id = (select auth.uid())
  order by r.starts_at desc
  limit 200;
$$;
revoke execute on function public.my_reservations() from public, anon;
grant execute on function public.my_reservations() to authenticated;

-- From 20261122300000; chat_id added as the last column.
drop function if exists public.business_reservations(uuid, date, date);
create or replace function public.business_reservations(p_provider uuid, p_from date, p_to date)
returns table (
  id uuid, starts_at timestamptz, party_size integer, service_name text, traveller_first_name text,
  note text, diet_line text, status public.reservation_status, offered_starts_at timestamptz,
  business_note text, cancelled_by text, came_count integer, disputed boolean,
  commission_kind text, commission_rate_tzs integer, commission_percent numeric, max_guests_counted integer,
  price_basis_tzs integer, commission_tzs integer, commission_status text, is_sample boolean,
  answer_by timestamptz, chat_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.owns_provider(p_provider) or private.is_admin()) then
    raise exception 'Business not found' using errcode = 'P0001';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 93 then
    raise exception 'Pick up to 93 days' using errcode = 'P0001';
  end if;
  return query
    select r.id, r.starts_at, r.party_size, r.service_name,
           coalesce(nullif(split_part(btrim(pf.full_name), ' ', 1), ''), 'Traveller'),
           -- Review M4: the note only until 30 days after the date (it is cleared then anyway).
           case when private.tz_today() <= (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date + 30 then r.note end,
           case when private.reservation_diet_visible(r.id) then d.line end,
           r.status, r.offered_starts_at, r.business_note, r.cancelled_by, r.came_count,
           r.disputed_at is not null and r.dispute_resolved_at is null,
           r.commission_kind, r.commission_rate_tzs, r.commission_percent, r.max_guests_counted,
           r.price_basis_tzs, r.commission_tzs, r.commission_status, r.is_sample,
           case when r.status in ('requested', 'other_time_offered') then r.answer_by end,
           r.chat_id
    from public.reservations r
    left join public.profiles pf on pf.id = r.traveler_id
    left join public.reservation_diet_lines d on d.reservation_id = r.id
    where r.provider_id = p_provider
      and (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date between p_from and p_to
    order by r.starts_at;
end;
$$;
revoke execute on function public.business_reservations(uuid, date, date) from public, anon;
grant execute on function public.business_reservations(uuid, date, date) to authenticated;
