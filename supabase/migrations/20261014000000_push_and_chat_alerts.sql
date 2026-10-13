-- Push notifications to the Rafrika app, and alerts for group chat messages.
--
-- Every alert can now also go to the person's phones (Expo push). Callers choose the channels,
-- so busy events (group chats) can use push only and an occasional email, never WhatsApp.

alter type public.notification_channel add value if not exists 'push';

-- ---------------------------------------------------------------------------
-- Devices that receive push alerts
-- ---------------------------------------------------------------------------
create table public.push_tokens (
  token text primary key check (token ~ '^Expo(nent)?PushToken\[.+\]$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy "Users see their own devices" on public.push_tokens
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users remove their own devices" on public.push_tokens
  for delete to authenticated using (user_id = (select auth.uid()));

-- A phone can change hands (sign out, sign in as someone else), so registering moves the token.
create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Sign in first'; end if;
  insert into public.push_tokens (token, user_id, platform)
  values (p_token, (select auth.uid()), p_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, last_seen_at = now();
end;
$$;

revoke execute on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- notify_user: same as before, plus push, and the caller picks the channels.
-- ---------------------------------------------------------------------------
drop function private.notify_user(text, uuid, jsonb, text);

create or replace function private.notify_user(
  p_event text, p_user uuid, p_payload jsonb, p_phone text default null,
  p_channels text[] default '{email,whatsapp,push}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_phone text;
  v_locale text;
begin
  if p_user is null then return; end if;
  select u.email, coalesce(p_phone, p.phone), coalesce(p.preferred_language, 'en')
    into v_email, v_phone, v_locale
  from auth.users u join public.profiles p on p.id = u.id
  where u.id = p_user;

  if 'email' = any (p_channels) and v_email is not null then
    insert into public.notification_outbox (event, channel, recipient_user_id, recipient, locale, payload)
    values (p_event, 'email', p_user, v_email, v_locale, p_payload);
  end if;
  if 'whatsapp' = any (p_channels) and v_phone is not null and length(regexp_replace(v_phone, '\D', '', 'g')) >= 9 then
    insert into public.notification_outbox (event, channel, recipient_user_id, recipient, locale, payload)
    values (p_event, 'whatsapp', p_user, v_phone, v_locale, p_payload);
  end if;
  -- One push row per person; the Edge Function sends it to all of their phones.
  if 'push' = any (p_channels) and exists (select 1 from public.push_tokens t where t.user_id = p_user) then
    insert into public.notification_outbox (event, channel, recipient_user_id, recipient, locale, payload)
    values (p_event, 'push', p_user, p_user::text, v_locale, p_payload);
  end if;
end;
$$;

revoke execute on function private.notify_user(text, uuid, jsonb, text, text[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Group chat alerts
--   push:  at most one per chat per minute
--   email: at most one per chat every 6 hours, and only if the person hasn't opened the chat lately
--   muted members get nothing
-- ---------------------------------------------------------------------------
alter table public.group_chat_members add column muted boolean not null default false;

-- When each person was last alerted about each chat (not visible to clients).
create table private.chat_alert_state (
  chat_id uuid not null references public.group_chats (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_push_at timestamptz,
  last_email_at timestamptz,
  primary key (chat_id, user_id)
);

create or replace function private.on_group_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chat text;
  v_preview text;
  m record;
  v_push boolean;
  v_email boolean;
  v_channels text[];
begin
  select name into v_chat from public.group_chats where id = new.chat_id;
  v_preview := coalesce(nullif(left(trim(new.body), 160), ''),
                        case new.media_type when 'video' then '🎬' else '📷' end);

  for m in
    select gm.user_id, gm.last_read_at, s.last_push_at, s.last_email_at
    from public.group_chat_members gm
    left join private.chat_alert_state s on s.chat_id = gm.chat_id and s.user_id = gm.user_id
    where gm.chat_id = new.chat_id and gm.user_id <> new.sender_id and not gm.muted
  loop
    v_push := m.last_push_at is null or m.last_push_at < now() - interval '1 minute';
    v_email := (m.last_email_at is null or m.last_email_at < now() - interval '6 hours')
               and m.last_read_at < now() - interval '30 minutes';
    v_channels := case when v_push then '{push}'::text[] else '{}'::text[] end
                  || case when v_email then '{email}'::text[] else '{}'::text[] end;
    continue when cardinality(v_channels) = 0;

    perform private.notify_user('group_chat_message', m.user_id,
      jsonb_build_object('chat', v_chat, 'sender', new.sender_name, 'preview', v_preview,
                         'chat_id', new.chat_id, 'link', '/chats/' || new.chat_id),
      null, v_channels);

    insert into private.chat_alert_state (chat_id, user_id, last_push_at, last_email_at)
    values (new.chat_id, m.user_id,
            case when v_push then now() end, case when v_email then now() end)
    on conflict (chat_id, user_id) do update set
      last_push_at = case when v_push then now() else private.chat_alert_state.last_push_at end,
      last_email_at = case when v_email then now() else private.chat_alert_state.last_email_at end;
  end loop;
  return new;
end;
$$;

revoke execute on function private.on_group_message() from public, anon, authenticated;

create trigger group_chat_messages_notify after insert on public.group_chat_messages
  for each row execute function private.on_group_message();
