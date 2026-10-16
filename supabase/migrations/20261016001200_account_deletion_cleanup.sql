-- M4 from the 2026-10 security review: personal data left behind after an account is deleted,
-- and how long sent alerts are kept.
--
-- 1. Before an auth user is deleted (delete_my_account, or an admin in the Supabase dashboard):
--    - their enquiries (leads) stay for the guide's / business's records, but the name, contact and
--      message are blanked;
--    - alerts addressed to them in notification_outbox lose the address and contents (pending ones
--      are skipped, never sent);
--    - alerts to guides, businesses or admins that copied their contact details (lead and interest
--      alerts) lose the name, contact and message;
--    - their "coming soon" interest_signups are removed when the contact matches their email or phone.
-- 2. private.purge_old_notifications() deletes sent and skipped alerts after 30 days and failed ones
--    (or given up on after 5 attempts) after 90 days; alerts still being retried are kept; pg_cron runs it daily (pg_cron is already used for flush-notifications).
--
-- Undo: drop trigger auth_users_scrub_before_delete on auth.users; drop function private.scrub_deleted_user();
-- select cron.unschedule('purge-old-notifications'); drop function private.purge_old_notifications(int, int).
-- Note: once applied, the daily job deletes old alert rows; data already purged or blanked cannot be restored.

create or replace function private.scrub_deleted_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := nullif(lower(trim(old.email)), '');
  v_phone text;
  v_phone_digits text;
  v_contacts text[];
begin
  select nullif(trim(p.phone), '') into v_phone from public.profiles p where p.id = old.id;
  v_phone_digits := nullif(regexp_replace(coalesce(v_phone, old.phone, ''), '\D', '', 'g'), '');
  if length(v_phone_digits) < 9 then
    v_phone_digits := null;
  end if;

  -- Every contact this person is known by: account email, phone, and what they typed on enquiries.
  select coalesce(array_agg(distinct lower(trim(l.traveler_contact))), '{}')
    into v_contacts
  from public.leads l
  where l.traveler_id = old.id and nullif(trim(l.traveler_contact), '') is not null;
  v_contacts := v_contacts || array_remove(array[v_email, lower(v_phone)], null);

  -- Their enquiries: keep the row (date, guide/business) but not who wrote it or what they said.
  update public.leads
  set traveler_name = null, traveler_contact = null, message = null
  where traveler_id = old.id;

  -- Alerts addressed to them.
  update public.notification_outbox
  set recipient = '',
      payload = '{}'::jsonb,
      last_error = null,
      status = case when status = 'pending' then 'skipped'::public.notification_status else status end
  where recipient_user_id = old.id;

  -- Alerts to other people that copied their details.
  update public.notification_outbox
  set payload = payload - 'name' - 'contact' - 'message',
      status = case when status = 'pending' then 'skipped'::public.notification_status else status end
  where payload ? 'contact'
    and lower(trim(payload ->> 'contact')) = any (v_contacts);

  -- "Coming soon" sign-ups have no user link; remove the ones with their email or phone.
  delete from public.interest_signups s
  where (v_email is not null and lower(trim(s.contact)) = v_email)
     or (v_phone_digits is not null
         and s.contact !~ '@'
         and regexp_replace(s.contact, '\D', '', 'g') = v_phone_digits);

  return old;
end;
$$;

revoke execute on function private.scrub_deleted_user() from public, anon, authenticated;

drop trigger if exists auth_users_scrub_before_delete on auth.users;
create trigger auth_users_scrub_before_delete
  before delete on auth.users
  for each row execute function private.scrub_deleted_user();

-- Retention for the alert outbox (it holds email addresses, phone numbers and message previews).
create or replace function private.purge_old_notifications(p_sent_days int default 30, p_failed_days int default 90)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.notification_outbox
  where (status in ('sent', 'skipped') and coalesce(sent_at, created_at) < now() - make_interval(days => greatest(p_sent_days, 1)))
     or ((status = 'failed' or (status = 'pending' and attempts >= 5))   -- given up on
         and created_at < now() - make_interval(days => greatest(p_failed_days, 1)));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function private.purge_old_notifications(int, int) from public, anon, authenticated;

-- Daily at 03:30 UTC (06:30 in Dar es Salaam).
select cron.schedule('purge-old-notifications', '30 3 * * *', 'select private.purge_old_notifications()');
