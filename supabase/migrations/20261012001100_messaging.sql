-- In-app messaging between travellers and guides.
-- Contact details (phone numbers, emails, WhatsApp links) are hidden until the conversation is
-- unlocked (a call is accepted, or an admin unlocks it). Originals are kept for admin moderation.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  traveler_id uuid not null references public.profiles (id) on delete cascade,
  guide_id uuid not null references public.guides (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,
  contact_unlocked boolean not null default false,
  last_message_at timestamptz not null default now(),
  traveler_last_read_at timestamptz,
  guide_last_read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (traveler_id, guide_id)
);

create index conversations_guide_idx on public.conversations (guide_id, last_message_at desc);
create index conversations_traveler_idx on public.conversations (traveler_id, last_message_at desc);
create index conversations_trip_idx on public.conversations (trip_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  masked boolean not null default false,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_sender_idx on public.messages (sender_id);

-- Admin-only: original text of messages where contact details were hidden.
create table public.message_moderation (
  message_id uuid primary key references public.messages (id) on delete cascade,
  original_body text not null,
  created_at timestamptz not null default now()
);

create table public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text check (length(reason) <= 500),
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);

create index message_reports_open_idx on public.message_reports (created_at) where not resolved;
create index message_reports_reporter_idx on public.message_reports (reporter_id);

-- Is the current user a participant in this conversation?
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
    where c.id = p_conversation
      and (c.traveler_id = (select auth.uid()) or g.owner_id = (select auth.uid()))
  );
$$;

grant execute on function private.in_conversation(uuid) to authenticated;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.message_moderation enable row level security;
alter table public.message_reports enable row level security;

create policy "Participants and admins read conversations" on public.conversations
  for select to authenticated
  using (private.in_conversation(id) or private.is_admin());
create policy "Travellers start conversations with approved guides" on public.conversations
  for insert to authenticated
  with check (
    traveler_id = (select auth.uid())
    and exists (select 1 from public.guides g where g.id = guide_id and g.verification_status = 'approved')
    and contact_unlocked = false);
create policy "Participants mark conversations read" on public.conversations
  for update to authenticated
  using (private.in_conversation(id) or private.is_admin());

create policy "Participants and admins read messages" on public.messages
  for select to authenticated
  using (private.in_conversation(conversation_id) or private.is_admin());
create policy "Participants send messages" on public.messages
  for insert to authenticated
  with check (sender_id = (select auth.uid()) and private.in_conversation(conversation_id));

create policy "Admins read moderation" on public.message_moderation
  for select to authenticated using (private.is_admin());

create policy "Participants report messages" on public.message_reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and exists (select 1 from public.messages m where m.id = message_id and private.in_conversation(m.conversation_id)));
create policy "Admins manage reports" on public.message_reports
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "Reporters see their reports" on public.message_reports
  for select to authenticated using (reporter_id = (select auth.uid()));

-- Participants may only update read markers; unlocking is for admins and the system.
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

create trigger conversations_guard_update
  before update on public.conversations
  for each row execute function public.guard_conversation_update();

-- Hide contact details in locked conversations, keep the original for moderation.
create or replace function private.mask_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unlocked boolean;
  v_masked text;
  v_match text;
begin
  select contact_unlocked into v_unlocked from public.conversations where id = new.conversation_id;
  if coalesce(v_unlocked, false) then
    return new;
  end if;

  v_masked := new.body;
  -- emails
  v_masked := regexp_replace(v_masked, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[contact hidden]', 'g');
  -- WhatsApp / Telegram / social links
  v_masked := regexp_replace(v_masked, '(https?://)?(wa\.me|chat\.whatsapp\.com|api\.whatsapp\.com|t\.me|instagram\.com|facebook\.com)\S*', '[contact hidden]', 'gi');
  -- phone numbers: digit runs (with spaces, dots, dashes, brackets) containing 9+ digits.
  -- Dates like 2027-06-19 (8 digits) and prices stay visible.
  for v_match in select (regexp_matches(v_masked, '\+?\d[\d\s.\-()]{6,}\d', 'g'))[1] loop
    if length(regexp_replace(v_match, '\D', '', 'g')) >= 9 then
      v_masked := replace(v_masked, v_match, '[contact hidden]');
    end if;
  end loop;

  if v_masked <> new.body then
    -- Hand the original to the after-insert trigger, which stores it for admins.
    perform set_config('rafrika.orig_' || replace(new.id::text, '-', ''), new.body, true);
    new.masked := true;
    new.body := v_masked;
  end if;
  return new;
end;
$$;

create trigger messages_mask
  before insert on public.messages
  for each row execute function private.mask_message();

-- After insert: keep the original (if masked), bump the conversation, alert the other person.
create or replace function private.after_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.conversations;
  v_guide_owner uuid;
  v_recipient uuid;
  v_phone text;
  v_sender text;
begin
  if new.masked then
    insert into public.message_moderation (message_id, original_body)
    values (new.id, coalesce(current_setting('rafrika.orig_' || replace(new.id::text, '-', ''), true), ''));
  end if;

  select * into c from public.conversations where id = new.conversation_id;
  select owner_id into v_guide_owner from public.guides where id = c.guide_id;

  update public.conversations set last_message_at = new.created_at where id = c.id;

  if new.sender_id = c.traveler_id then
    v_recipient := v_guide_owner;
    v_phone := private.guide_phone(c.guide_id);
  else
    v_recipient := c.traveler_id;
  end if;

  select coalesce(g.display_name, p.full_name, 'Rafrika') into v_sender
  from public.profiles p left join public.guides g on g.owner_id = p.id where p.id = new.sender_id;

  -- At most one alert per conversation every 15 minutes, so a busy chat doesn't flood WhatsApp.
  if not exists (
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

create trigger messages_after_insert
  after insert on public.messages
  for each row execute function private.after_message();


-- Unlock contact sharing once a call between the two is accepted.
create or replace function private.unlock_on_call_accepted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    update public.conversations set contact_unlocked = true
    where traveler_id = new.traveler_id and guide_id = new.guide_id;
  end if;
  return new;
end;
$$;

create trigger call_requests_unlock_contact
  after update on public.call_requests
  for each row execute function private.unlock_on_call_accepted();

revoke execute on function private.mask_message() from public, anon, authenticated;
revoke execute on function private.after_message() from public, anon, authenticated;
revoke execute on function private.unlock_on_call_accepted() from public, anon, authenticated;

-- Live updates in the browser and app.
alter publication supabase_realtime add table public.messages;
