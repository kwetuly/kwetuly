-- Show the traveller's name and the latest message in inboxes without exposing the profiles table.
alter table public.conversations
  add column traveler_name text,
  add column last_message_preview text;

create or replace function private.set_conversation_traveler_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select coalesce(full_name, 'Traveller') into new.traveler_name from public.profiles where id = new.traveler_id;
  return new;
end;
$$;

revoke execute on function private.set_conversation_traveler_name() from public, anon, authenticated;

create trigger conversations_set_traveler_name
  before insert on public.conversations
  for each row execute function private.set_conversation_traveler_name();

-- Keep the preview up to date (runs alongside the existing after-insert trigger).
create or replace function private.set_last_message_preview()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations set last_message_preview = left(new.body, 120) where id = new.conversation_id;
  return new;
end;
$$;

revoke execute on function private.set_last_message_preview() from public, anon, authenticated;

create trigger messages_set_preview
  after insert on public.messages
  for each row execute function private.set_last_message_preview();
