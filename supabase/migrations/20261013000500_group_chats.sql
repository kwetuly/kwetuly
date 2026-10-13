-- Group chats for people travelling together: share messages, photos and short videos.
-- Anyone can start a chat and invite others with a link; every approved group trip gets
-- a chat automatically with its organiser and accepted travellers.
--
-- Public use of what is shared: the person who shared a photo, video or tip can say
-- "Rafrika may use this publicly". Anyone else in the chat can object ("I'm in this, please
-- don't"), which blocks public use. Rafrika then picks consented items to feature on the site.
-- Withdrawing consent or any objection removes the item from the site straight away.

create table public.group_chats (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  created_by uuid not null references auth.users (id) on delete cascade,
  group_trip_id uuid unique references public.group_trips (id) on delete cascade,
  invite_code text not null unique default substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 18),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.group_chat_members (
  chat_id uuid not null references public.group_chats (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 120),
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);

create index group_chat_members_user_idx on public.group_chat_members (user_id);

create table public.group_chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.group_chats (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  sender_name text not null check (length(sender_name) between 1 and 120),
  body text check (length(body) <= 4000),
  media_path text check (length(media_path) <= 300),
  media_type text check (media_type in ('image', 'video')),
  share_public boolean not null default false,   -- the sender agrees Rafrika may use it publicly
  shared_at timestamptz,
  featured boolean not null default false,       -- Rafrika chose to show it on the site
  created_at timestamptz not null default now(),
  check (coalesce(length(trim(body)), 0) > 0 or media_path is not null),
  check ((media_path is null) = (media_type is null))
);

create index group_chat_messages_chat_idx on public.group_chat_messages (chat_id, created_at);
create index group_chat_messages_public_idx on public.group_chat_messages (created_at desc) where share_public and featured;
create index group_chat_messages_sender_idx on public.group_chat_messages (sender_id);

create table public.group_chat_objections (
  message_id uuid not null references public.group_chat_messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index group_chat_objections_user_idx on public.group_chat_objections (user_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function private.is_chat_member(p_chat uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.group_chat_members m where m.chat_id = p_chat and m.user_id = (select auth.uid()));
$$;

create or replace function private.is_chat_owner(p_chat uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.group_chat_members m where m.chat_id = p_chat and m.user_id = (select auth.uid()) and m.role = 'owner');
$$;

-- An item may be shown publicly only while the sender consents, Rafrika features it, and nobody objects.
create or replace function private.message_is_public(p_message uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_chat_messages m
    where m.id = p_message and m.share_public and m.featured
      and not exists (select 1 from public.group_chat_objections o where o.message_id = m.id));
$$;

create or replace function private.media_is_public(p_path text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_chat_messages m
    where m.media_path = p_path and m.share_public and m.featured
      and not exists (select 1 from public.group_chat_objections o where o.message_id = m.id));
$$;

create or replace function private.member_name()
returns text language sql stable security definer set search_path = ''
as $$
  select coalesce(nullif(trim(p.full_name), ''), 'Traveller') from public.profiles p where p.id = (select auth.uid());
$$;

revoke execute on function private.is_chat_member(uuid) from public;
revoke execute on function private.is_chat_owner(uuid) from public;
revoke execute on function private.message_is_public(uuid) from public;
revoke execute on function private.media_is_public(text) from public;
revoke execute on function private.member_name() from public;
-- anon too: the public gallery policy checks membership, which is simply false for visitors.
grant execute on function private.is_chat_member(uuid) to anon, authenticated;
grant execute on function private.is_chat_owner(uuid) to authenticated;
grant execute on function private.message_is_public(uuid) to anon, authenticated;
grant execute on function private.media_is_public(text) to anon, authenticated;
grant execute on function private.member_name() to authenticated;

-- Join with an invite link. Trip chats only accept the organiser and accepted travellers.
create or replace function public.join_group_chat(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  chat public.group_chats;
begin
  select * into chat from public.group_chats where invite_code = p_code;
  if chat.id is null then
    raise exception 'Invite link not found';
  end if;
  if chat.group_trip_id is not null and not (
       exists (select 1 from public.group_trips t where t.id = chat.group_trip_id and t.organizer_id = (select auth.uid()))
    or exists (select 1 from public.group_trip_members m
               where m.group_trip_id = chat.group_trip_id and m.traveler_id = (select auth.uid()) and m.status = 'accepted')) then
    raise exception 'This chat is only for people on the trip';
  end if;
  insert into public.group_chat_members (chat_id, user_id, display_name)
  values (chat.id, (select auth.uid()), private.member_name())
  on conflict do nothing;
  return chat.id;
end;
$$;

revoke execute on function public.join_group_chat(text) from public, anon;
grant execute on function public.join_group_chat(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
-- The creator of a chat becomes its owner.
create or replace function private.on_group_chat_created()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.group_chat_members (chat_id, user_id, display_name, role)
  select new.id, new.created_by, coalesce(nullif(trim(p.full_name), ''), 'Organiser'), 'owner'
  from public.profiles p where p.id = new.created_by
  on conflict do nothing;
  return new;
end;
$$;

create trigger group_chats_owner after insert on public.group_chats
  for each row execute function private.on_group_chat_created();

-- Approved group trips get a chat; accepted travellers are added to it.
create or replace function private.ensure_trip_chat()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'approved' and not new.cancelled then
    insert into public.group_chats (name, created_by, group_trip_id)
    values (left(new.title, 80), new.organizer_id, new.id)
    on conflict (group_trip_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger group_trips_chat after insert or update of status on public.group_trips
  for each row execute function private.ensure_trip_chat();

create or replace function private.add_trip_member_to_chat()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  chat uuid;
begin
  select id into chat from public.group_chats where group_trip_id = new.group_trip_id;
  if chat is null then
    return new;
  end if;
  if new.status = 'accepted' then
    insert into public.group_chat_members (chat_id, user_id, display_name)
    values (chat, new.traveler_id, new.traveler_name)
    on conflict do nothing;
  elsif new.status in ('declined', 'cancelled') then
    delete from public.group_chat_members where chat_id = chat and user_id = new.traveler_id and role <> 'owner';
  end if;
  return new;
end;
$$;

create trigger group_trip_members_chat after insert or update of status on public.group_trip_members
  for each row execute function private.add_trip_member_to_chat();

-- Messages: sender fields come from the session; only Rafrika can feature; senders control consent.
create or replace function public.guard_group_message()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if private.is_trusted() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.sender_id := (select auth.uid());
    new.sender_name := private.member_name();
    new.featured := false;
    new.created_at := now();
    new.shared_at := case when new.share_public then now() end;
    -- Media must live in this chat's folder.
    if new.media_path is not null and split_part(new.media_path, '/', 1) <> new.chat_id::text then
      raise exception 'Media must be uploaded to this chat';
    end if;
    return new;
  end if;
  -- Updates: the sender may only change consent.
  if old.sender_id <> (select auth.uid()) then
    raise exception 'Only the sender can change this message';
  end if;
  new.chat_id := old.chat_id;
  new.sender_id := old.sender_id;
  new.sender_name := old.sender_name;
  new.body := old.body;
  new.media_path := old.media_path;
  new.media_type := old.media_type;
  new.featured := old.featured;
  new.created_at := old.created_at;
  new.shared_at := case when new.share_public then coalesce(old.shared_at, now()) end;
  return new;
end;
$$;

create trigger group_chat_messages_guard
  before insert or update on public.group_chat_messages
  for each row execute function public.guard_group_message();

create or replace function private.touch_group_chat()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.group_chats set last_message_at = new.created_at where id = new.chat_id;
  return new;
end;
$$;

create trigger group_chat_messages_touch after insert on public.group_chat_messages
  for each row execute function private.touch_group_chat();

-- Members may only change their own read time.
create or replace function public.guard_chat_member()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if not private.is_trusted() then
    new.chat_id := old.chat_id;
    new.user_id := old.user_id;
    new.role := old.role;
    new.joined_at := old.joined_at;
  end if;
  return new;
end;
$$;

create trigger group_chat_members_guard
  before update on public.group_chat_members
  for each row execute function public.guard_chat_member();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.group_chats enable row level security;
alter table public.group_chat_members enable row level security;
alter table public.group_chat_messages enable row level security;
alter table public.group_chat_objections enable row level security;

create policy "Members and admins see chats" on public.group_chats
  for select to authenticated using (created_by = (select auth.uid()) or private.is_chat_member(id) or private.is_admin());
create policy "Signed-in users start chats" on public.group_chats
  for insert to authenticated with check (created_by = (select auth.uid()) and group_trip_id is null);
create policy "Owners rename chats" on public.group_chats
  for update to authenticated using (private.is_chat_owner(id)) with check (private.is_chat_owner(id));

create policy "Members see who is in the chat" on public.group_chat_members
  for select to authenticated using (private.is_chat_member(chat_id) or private.is_admin());
create policy "Members update their own read time" on public.group_chat_members
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Members leave; owners remove members" on public.group_chat_members
  for delete to authenticated using (user_id = (select auth.uid()) or private.is_chat_owner(chat_id));

create policy "Members read messages; anyone reads featured public items" on public.group_chat_messages
  for select to anon, authenticated
  using (private.is_chat_member(chat_id) or private.is_admin() or private.message_is_public(id));
create policy "Members post messages" on public.group_chat_messages
  for insert to authenticated with check (sender_id = (select auth.uid()) and private.is_chat_member(chat_id));
create policy "Senders change consent; admins feature" on public.group_chat_messages
  for update to authenticated
  using (sender_id = (select auth.uid()) or private.is_admin())
  with check (sender_id = (select auth.uid()) or private.is_admin());
create policy "Senders and admins delete messages" on public.group_chat_messages
  for delete to authenticated using (sender_id = (select auth.uid()) or private.is_admin());

create policy "Members see objections in their chats" on public.group_chat_objections
  for select to authenticated
  using (private.is_admin() or exists (
    select 1 from public.group_chat_messages m where m.id = message_id and private.is_chat_member(m.chat_id)));
create policy "Members object to public use" on public.group_chat_objections
  for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.group_chat_messages m where m.id = message_id and private.is_chat_member(m.chat_id)));
create policy "Members withdraw their objection" on public.group_chat_objections
  for delete to authenticated using (user_id = (select auth.uid()));

-- Live updates for open chats.
alter publication supabase_realtime add table public.group_chat_messages;

-- ---------------------------------------------------------------------------
-- Storage: photos and short videos, private to chat members.
-- Files live at "<chat id>/<random name>". Featured public items can be read by anyone.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;

create policy "Chat members upload media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-media' and private.is_chat_member(((storage.foldername(name))[1])::uuid));
create policy "Chat members and the public (featured items) view media" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'chat-media' and (
    private.media_is_public(name)
    or ((select auth.uid()) is not null and (private.is_chat_member(((storage.foldername(name))[1])::uuid) or private.is_admin()))));
create policy "Uploaders delete their media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'chat-media' and owner_id = (select auth.uid())::text);
