-- Group chat alerts: only count a push as sent when the person has the app on a phone.
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
    -- Only people with the app on a phone get push (and only then does the 1-minute pause start).
    v_push := (m.last_push_at is null or m.last_push_at < now() - interval '1 minute')
              and exists (select 1 from public.push_tokens t where t.user_id = m.user_id);
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
