-- Email + WhatsApp alerts.
-- Database triggers write alerts into an outbox (so the website, the mobile app and admin edits
-- all produce the same alerts). The `notify` Edge Function sends them and records the result.

create extension if not exists pg_net;
create extension if not exists pg_cron;

create type public.notification_channel as enum ('email', 'whatsapp');
create type public.notification_status as enum ('pending', 'sent', 'failed', 'skipped');

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  channel public.notification_channel not null,
  recipient_user_id uuid references public.profiles (id) on delete set null,
  recipient text not null,                 -- email address or phone number
  locale text not null default 'en',
  payload jsonb not null default '{}',
  status public.notification_status not null default 'pending',
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index notification_outbox_pending_idx on public.notification_outbox (created_at) where status = 'pending';
create index notification_outbox_recipient_idx on public.notification_outbox (recipient_user_id);

-- Contains contact details: no client access at all (only the service role used by the Edge Function).
alter table public.notification_outbox enable row level security;

-- Queue one alert per available channel for a user.
create or replace function private.notify_user(
  p_event text, p_user uuid, p_payload jsonb, p_phone text default null)
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

  if v_email is not null then
    insert into public.notification_outbox (event, channel, recipient_user_id, recipient, locale, payload)
    values (p_event, 'email', p_user, v_email, v_locale, p_payload);
  end if;
  if v_phone is not null and length(regexp_replace(v_phone, '\D', '', 'g')) >= 9 then
    insert into public.notification_outbox (event, channel, recipient_user_id, recipient, locale, payload)
    values (p_event, 'whatsapp', p_user, v_phone, v_locale, p_payload);
  end if;
end;
$$;

create or replace function private.notify_admins(p_event text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_id uuid;
begin
  for admin_id in select id from public.profiles where role = 'admin' loop
    perform private.notify_user(p_event, admin_id, p_payload);
  end loop;
end;
$$;

-- WhatsApp number for a guide: their WhatsApp number, else their phone.
create or replace function private.guide_phone(p_guide uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(whatsapp_number, ''), nullif(phone, '')) from public.guide_private where guide_id = p_guide;
$$;

revoke execute on function private.notify_user(text, uuid, jsonb, text) from public, anon, authenticated;
revoke execute on function private.notify_admins(text, jsonb) from public, anon, authenticated;
revoke execute on function private.guide_phone(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Event triggers
-- ---------------------------------------------------------------------------
create or replace function private.on_lead_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_trip text;
  v_payload jsonb;
begin
  select title_en into v_trip from public.trips where id = new.trip_id;
  v_payload := jsonb_build_object(
    'name', new.traveler_name, 'contact', new.traveler_contact,
    'message', left(coalesce(new.message, ''), 500), 'trip', v_trip);

  if new.guide_id is not null then
    select owner_id into v_owner from public.guides where id = new.guide_id;
    perform private.notify_user('lead_for_guide', v_owner, v_payload || '{"link":"/hub"}', private.guide_phone(new.guide_id));
  else
    perform private.notify_admins('lead_for_admin', v_payload || '{"link":"/admin"}');
  end if;
  return new;
end;
$$;

create trigger leads_notify after insert on public.leads
  for each row execute function private.on_lead_created();

create or replace function private.on_call_requested()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.guides where id = new.guide_id;
  perform private.notify_user('call_requested', v_owner,
    jsonb_build_object('topic', new.topic, 'times', new.preferred_times, 'link', '/hub#calls'),
    private.guide_phone(new.guide_id));
  return new;
end;
$$;

create trigger call_requests_notify_created after insert on public.call_requests
  for each row execute function private.on_call_requested();

create or replace function private.on_call_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guide text;
  v_phone text;
begin
  if new.status = old.status or new.status not in ('accepted', 'declined') then
    return new;
  end if;
  select display_name into v_guide from public.guides where id = new.guide_id;
  -- Use the contact the traveller gave if it looks like a phone number.
  v_phone := case when new.traveler_contact ~ '^\+?[0-9 ]{9,}$' then new.traveler_contact end;
  perform private.notify_user('call_' || new.status::text, new.traveler_id,
    jsonb_build_object('guide', v_guide, 'topic', new.topic, 'when', new.scheduled_at,
                       'meeting_link', new.meeting_link, 'link', '/dashboard'),
    v_phone);
  return new;
end;
$$;

create trigger call_requests_notify_updated after update on public.call_requests
  for each row execute function private.on_call_updated();

create or replace function private.on_guide_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.notify_admins('guide_pending',
      jsonb_build_object('guide', new.display_name, 'region', new.base_region, 'link', '/admin'));
  elsif new.verification_status is distinct from old.verification_status and new.verification_status = 'approved' then
    perform private.notify_user('guide_approved', new.owner_id,
      jsonb_build_object('guide', new.display_name, 'link', '/hub'), private.guide_phone(new.id));
  end if;
  return new;
end;
$$;

create trigger guides_notify after insert or update on public.guides
  for each row execute function private.on_guide_changed();

create or replace function private.on_job_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.notify_admins('job_pending',
      jsonb_build_object('title', new.title, 'company', new.company_name, 'link', '/admin#jobs'));
  elsif new.status is distinct from old.status and new.status = 'approved' then
    perform private.notify_user('job_approved', new.posted_by,
      jsonb_build_object('title', new.title, 'link', '/dashboard'));
  end if;
  return new;
end;
$$;

create trigger jobs_notify after insert or update on public.jobs
  for each row execute function private.on_job_changed();

create or replace function private.on_interest_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify_admins('interest_' || new.kind::text,
    jsonb_build_object('section', new.section, 'item', new.item, 'name', new.name,
                       'contact', new.contact, 'business', new.business_name,
                       'message', left(coalesce(new.message, ''), 500), 'link', '/admin'));
  return new;
end;
$$;

create trigger interest_signups_notify after insert on public.interest_signups
  for each row execute function private.on_interest_created();

-- ---------------------------------------------------------------------------
-- Delivery: wake the Edge Function when alerts are queued, and retry every 5 minutes.
-- The function URL and key are stored in Vault (see below), not in this file.
-- ---------------------------------------------------------------------------
create or replace function private.flush_notifications()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'notify_function_url');
  v_key text := (select decrypted_secret from vault.decrypted_secrets where name = 'notify_function_key');
begin
  if v_url is null or v_key is null then return; end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000);
end;
$$;

revoke execute on function private.flush_notifications() from public, anon, authenticated;

create or replace function private.on_outbox_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.flush_notifications();
  return null;
end;
$$;

create trigger notification_outbox_flush after insert on public.notification_outbox
  for each statement execute function private.on_outbox_insert();

select cron.schedule('flush-notifications', '*/5 * * * *', 'select private.flush_notifications()');
