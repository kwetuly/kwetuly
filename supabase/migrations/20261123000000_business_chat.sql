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
-- Security review of d4c8f1c / 48a87f5, fixed here:
--   H1 (live guide threads too) clients may insert only traveler_id, guide_id, trip_id and update only
--      the read times and contact_unlocked (column grants); the guard also keeps the preview, the
--      traveller's name and the creation time.
--   M1 traveler_id, guide_id, provider_id and was_business never change, for any caller.
--   M2 business-thread messages and preview are replaced by a fixed marker 30 days after the latest
--      reservation date (daily job kwetuly-business-chat-cleanup).
--   M3 sending in a business thread needs an open reservation, or the latest reservation date less
--      than 30 days ago (trigger with the fixed code chat_closed, and the insert policy).
--   L1 a deleted business leaves its threads read-only (provider_id null, was_business true).
--   L3 not done: hiding conversations.traveler_id from the business owner needs column-level rules per
--      row, which grants cannot do; the chat screens compare traveler_id with the signed-in user. It is
--      an account id only (profiles do not show phone or email to others). A safe view for the business
--      side can replace direct reads later.
--
-- Access rules after this file:
--   conversations: read and mark read: the traveller, the guide's owner (guide thread), the business
--     owner (business thread), admins. Insert: travellers, guide threads only (unchanged).
--   messages: read and send: participants as above (via private.in_conversation), admins read.
--
-- Undo (before any business thread exists; deleting business threads deletes their messages):
--   select cron.unschedule('kwetuly-business-chat-cleanup');
--   drop trigger messages_chat_open on public.messages; drop function private.guard_message_chat_open(),
--     private.run_business_chat_cleanup(); re-create "Participants send messages" from 20261016001800;
--     drop function private.chat_open(uuid);
--   grant insert, update on public.conversations to authenticated;   -- the old table-wide grants
--   delete from public.conversations where was_business;
--   alter table public.reservations drop column chat_id;   -- then re-run the two functions from 20261122300000
--   drop trigger reservations_link_chat on public.reservations; drop function private.reservation_link_chat();
--   re-create private.in_conversation(), public.guard_conversation_update(),
--     private.set_conversation_traveler_name(), private.after_message() and the two conversation
--     policies from 20261012001100, 20261012001200, 20261012001300 and 20261025000100;
--   drop index conversations_traveler_provider_key, conversations_provider_idx;
--   alter table public.conversations drop constraint conversations_one_party,
--     drop constraint conversations_business_never_unlocked, drop column provider_id, drop column was_business, drop column texts_cleared_at,
--     alter column guide_id set not null;

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
-- A deleted business keeps its threads, read-only (review L1): provider_id becomes null and
-- was_business stays true, so the thread is never mistaken for anything else and nobody can send.
alter table public.conversations
  add column if not exists provider_id uuid references public.providers (id) on delete set null,
  add column if not exists was_business boolean not null default false,
  -- Set by the daily cleanup once every text in a closed business thread is removed; cleared when a
  -- new reservation reopens the thread. Only the server writes it (no client update grant).
  add column if not exists texts_cleared_at timestamptz;
alter table public.conversations alter column guide_id drop not null;

alter table public.conversations drop constraint if exists conversations_one_party;
alter table public.conversations add constraint conversations_one_party
  check (case when was_business then guide_id is null
              else num_nonnulls(guide_id, provider_id) = 1 and provider_id is null end);
alter table public.conversations drop constraint if exists conversations_business_never_unlocked;
alter table public.conversations add constraint conversations_business_never_unlocked
  check (not was_business or not contact_unlocked);

-- Review H1 (guide threads too): clients may only create a guide thread with these columns and only
-- update the read times (and contact_unlocked, which the guard keeps for admins and the server).
-- Checked against the frontend: inserts send traveler_id and guide_id; updates send
-- traveler_last_read_at / guide_last_read_at, and the admin page contact_unlocked.
revoke insert, update on public.conversations from anon, authenticated;
grant insert (traveler_id, guide_id, trip_id) on public.conversations to authenticated;
grant update (traveler_last_read_at, guide_last_read_at, contact_unlocked) on public.conversations to authenticated;

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

-- From 20261012001100, with the security review fixes:
--   M1 who the thread is between never changes, for ANY caller (admins and server code included).
--      The only exception: the foreign key clearing provider_id when a business is deleted (L1).
--   H1 clients cannot change the preview, the traveller's name or the creation time.
-- Read markers and unlocking: unchanged.
create or replace function public.guard_conversation_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_traveler boolean := old.traveler_id = (select auth.uid());
begin
  if new.traveler_id is distinct from old.traveler_id
     or new.guide_id is distinct from old.guide_id
     or new.was_business is distinct from old.was_business
     or (new.provider_id is distinct from old.provider_id
         and not (new.provider_id is null and pg_trigger_depth() > 1)) then
    raise exception 'conversation_parties_fixed' using errcode = 'P0001',
      hint = 'Who a conversation is between cannot be changed.';
  end if;
  if private.is_trusted() then
    return new;
  end if;
  new.trip_id := old.trip_id;
  new.contact_unlocked := old.contact_unlocked;
  new.last_message_at := old.last_message_at;
  new.last_message_preview := old.last_message_preview;
  new.traveler_name := old.traveler_name;
  new.created_at := old.created_at;
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
  if new.was_business then
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

  if c.was_business then
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
  insert into public.conversations (traveler_id, provider_id, was_business)
  values (new.traveler_id, new.provider_id, true)
  on conflict (traveler_id, provider_id) where provider_id is not null do nothing;
  select c.id into new.chat_id
  from public.conversations c
  where c.traveler_id = new.traveler_id and c.provider_id = new.provider_id;
  -- A new reservation reopens the thread, so the daily cleanup looks at it again later.
  update public.conversations set texts_cleared_at = null
  where id = new.chat_id and texts_cleared_at is not null;
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

-- ---------------------------------------------------------------------------
-- 5. Business threads close (security review M3, L1)
-- ---------------------------------------------------------------------------
-- A business thread is open while one of its reservations is open (requested, other time offered,
-- confirmed) or until 30 days after the latest reservation date, and only while the business exists.
-- Guide threads: always open, as before.
create or replace function private.chat_open(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when not c.was_business then true
      when c.provider_id is null then false
      else exists (
        select 1 from public.reservations r
        where r.chat_id = c.id
          and (r.status in ('requested', 'other_time_offered', 'confirmed')
               or (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date + 30 >= private.tz_today()))
    end
    from public.conversations c where c.id = p_conversation), false);
$$;
revoke execute on function private.chat_open(uuid) from public;
grant execute on function private.chat_open(uuid) to authenticated;

-- Before insert (runs before the masking trigger and before the policy check): a fixed code.
create or replace function private.guard_message_chat_open()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.chat_open(new.conversation_id) then
    raise exception 'chat_closed' using errcode = 'P0001',
      hint = 'This chat is closed: no open reservation and more than 30 days after the last one.';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_message_chat_open() from public;
drop trigger if exists messages_chat_open on public.messages;
create trigger messages_chat_open
  before insert on public.messages
  for each row execute function private.guard_message_chat_open();

-- The same rule in the policy, so it holds even if the trigger were ever dropped.
-- From 20261016001800 "Participants send messages", plus private.chat_open().
drop policy if exists "Participants send messages" on public.messages;
create policy "Participants send messages" on public.messages
  for insert to authenticated
  with check (sender_id = (select auth.uid())
              and (select private.is_onboarded())
              and private.in_conversation(conversation_id)
              and private.chat_open(conversation_id));

-- ---------------------------------------------------------------------------
-- 6. Business thread texts are removed 30 days after the latest reservation date (review M2)
-- ---------------------------------------------------------------------------
-- Daily. The message rows stay (who and when) with a fixed marker as the body; the moderation copy of
-- masked messages and the preview go too. Guide threads: untouched.
-- A message with an unresolved report keeps its body and moderation copy until an admin resolves the
-- report (re-review, Medium): the thread stays on the list and is looked at again the next day.
-- A thread with nothing left to remove gets texts_cleared_at and is not scanned again (re-review, Low)
-- until a new reservation reopens it.
create or replace function private.run_business_chat_cleanup()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_marker constant text := '[deleted after 30 days]';
  v_ids uuid[];
  v_count integer := 0;
begin
  select coalesce(array_agg(c.id), '{}') into v_ids
  from public.conversations c
  where c.was_business
    and c.texts_cleared_at is null
    and not exists (
      select 1 from public.reservations r
      where r.chat_id = c.id
        and (r.status in ('requested', 'other_time_offered', 'confirmed')
             or (r.starts_at at time zone 'Africa/Dar_es_Salaam')::date + 30 >= private.tz_today()));
  if cardinality(v_ids) = 0 then
    return 0;
  end if;
  delete from public.message_moderation mm
  using public.messages m
  where mm.message_id = m.id and m.conversation_id = any (v_ids)
    and not exists (select 1 from public.message_reports mr where mr.message_id = m.id and not mr.resolved);
  update public.messages m set body = v_marker
  where m.conversation_id = any (v_ids) and m.body <> v_marker
    and not exists (select 1 from public.message_reports mr where mr.message_id = m.id and not mr.resolved);
  get diagnostics v_count = row_count;
  update public.conversations c set last_message_preview = v_marker
  where c.id = any (v_ids) and c.last_message_preview is distinct from v_marker and c.last_message_preview is not null;
  -- Done when no text is left (messages under an open report keep the thread on the list).
  update public.conversations c set texts_cleared_at = now()
  where c.id = any (v_ids)
    and not exists (select 1 from public.messages m where m.conversation_id = c.id and m.body <> v_marker);
  return v_count;
end;
$$;
revoke execute on function private.run_business_chat_cleanup() from public, anon, authenticated;

-- Daily at 02:40 UTC (05:40 in Dar es Salaam). Its own job, so the reservations job does not depend
-- on this migration.
select cron.schedule('kwetuly-business-chat-cleanup', '40 2 * * *', 'select private.run_business_chat_cleanup()');

-- ---------------------------------------------------------------------------
-- 7. Can this chat still take messages? (QA 2026-11-23, for the chat screens)
-- ---------------------------------------------------------------------------
-- True or false for a participant (traveller, guide owner, business owner) or an admin; null for
-- anyone else, the same as for a thread that does not exist, so nothing leaks.
create or replace function public.conversation_chat_open(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.in_conversation(p_conversation) or private.is_admin()
              then private.chat_open(p_conversation) end;
$$;
revoke execute on function public.conversation_chat_open(uuid) from public, anon;
grant execute on function public.conversation_chat_open(uuid) to authenticated;
