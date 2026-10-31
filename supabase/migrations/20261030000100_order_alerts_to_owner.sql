-- Enquiries and orders to a business alert the business owner (G1 in
-- docs/tech/items-approvals-orders-design.md, section 0). Approved by Walter on 2026-10-30.
--
-- Before: private.on_lead_created() (latest: 20261016001700_onboarded_gate_and_scrub.sql) alerted the
-- guide when leads.guide_id was set and otherwise every admin ('lead_for_admin', with the traveller's
-- name, contact and message). A lead to a business (provider_id) therefore went to Kwetuly, not to the
-- shop, and admins received contact details they did not need.
--
-- After:
--   1. private.provider_phone(p_provider) (new, SECURITY DEFINER, private schema, nobody can execute it
--      except the owner role): the business's WhatsApp number from provider_private, the same shape as
--      private.guide_phone(). It only returns a number to other definer functions; it is not exposed.
--   2. private.on_lead_created():
--      - guide_id set: unchanged ('lead_for_guide' to the guide owner, link /hub).
--      - provider_id set, real business: new event 'lead_for_business' to providers.owner_id through
--        private.notify_user, WhatsApp to private.provider_phone(), link /dashboard#business.
--        The payload carries lead_id, the traveller's name, the first 300 characters of the message
--        and the link. It does NOT carry the traveller's contact: the owner reads it in the dashboard
--        (owners can already read their leads: policy "Providers, guides, travelers and admins read
--        relevant leads").
--      - provider_id set, but the business is admin-only: admins get 'lead_for_admin' as before.
--        Admin-only means any of: is_sample; business_type 'merch' (the Kwetuly Shop); the listing in
--        site_settings 'shop_provider'; owned by an admin; no owner (owner_id null or no profile row;
--        not possible today because owner_id is NOT NULL with ON DELETE CASCADE, kept as a safety net).
--      - neither guide_id nor provider_id (tour and general enquiries): admins, as before.
--      - Channels are unchanged: signed-out enquiries (traveler_id null) send email only, so anonymous
--        senders cannot trigger WhatsApp or push.
--      The shop setting is compared as a uuid; a missing or malformed value does not throw (L3).
--   3. Rate limit on public.leads (security review M1), trigger leads_throttle (BEFORE INSERT):
--      signed in: at most 10 enquiries per traveler_id per hour; signed out (traveler_id null): at most
--      5 per provider_id and 5 per guide_id per hour. Over the limit: error 'rate_limited' (SQLSTATE
--      P0001); the website shows "Too many requests" (packages/shared/src/dictionaries/limits.ts).
--      Admins, the service role and the database are not limited (private.is_trusted()).
--      Helper private.lead_rate_exceeded() is SECURITY DEFINER (anon cannot read leads), returns only a
--      boolean, and is executable by anon/authenticated because the trigger runs as the caller.
--      New partial index leads_traveler_created_idx (traveler_id, created_at desc).
--      Signed-out tour and general enquiries (no guide, no business) are not limited here.
--   4. Constraint leads_one_target (L2), NOT VALID: guide_id and provider_id are never both set.
--      Existing rows are not checked. Read-only count to run before applying (expected 0):
--        select count(*) from public.leads where guide_id is not null and provider_id is not null;
--      If 0, it can later be validated: alter table public.leads validate constraint leads_one_target;
--   5. private.scrub_deleted_user(): identical to 20261016001800, plus 'lead_for_business' in the two
--      event lists, so a deleted traveller's name and message are also removed from alerts queued to
--      business owners.
--
-- No column, policy or data is changed or deleted. Functions, one trigger, one index and one NOT VALID
-- check constraint are added or replaced.
-- The notify Edge Function (supabase/functions/notify/index.ts) gets the English and Kiswahili text for
-- 'lead_for_business'. Deploy it BEFORE or together with this migration (Walter approves the deploy);
-- until it is deployed, 'lead_for_business' rows fall back to the generic "Kwetuly update" text.
--
-- Undo (no data to restore):
--   re-create private.on_lead_created() from 20261016001700_onboarded_gate_and_scrub.sql (N3a);
--   re-create private.scrub_deleted_user() from 20261016001800_onboarded_gate_followup.sql (L2);
--   drop function private.provider_phone(uuid);
--   drop trigger leads_throttle on public.leads; drop function private.throttle_leads();
--   drop function private.lead_rate_exceeded(uuid, uuid, uuid); drop index public.leads_traveler_created_idx;
--   alter table public.leads drop constraint leads_one_target;
--   optionally: update public.notification_outbox set status = 'skipped'
--     where event = 'lead_for_business' and status = 'pending';  (stops queued owner alerts)

-- ---------------------------------------------------------------------------
-- 1. WhatsApp number for a business
-- ---------------------------------------------------------------------------
create or replace function private.provider_phone(p_provider uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(trim(whatsapp_number), '') from public.provider_private where provider_id = p_provider;
$$;

revoke execute on function private.provider_phone(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Lead alerts
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
  v_channels text[];
  v_admin uuid;
  v_to_admins boolean := false;
  v_admin_only boolean;
begin
  v_channels := case when new.traveler_id is null then '{email}'::text[] else '{email,whatsapp,push}'::text[] end;
  select title_en into v_trip from public.trips where id = new.trip_id;
  v_payload := jsonb_build_object(
    'lead_id', new.id,
    'name', new.traveler_name, 'contact', new.traveler_contact,
    'message', left(coalesce(new.message, ''), 500), 'trip', v_trip);

  if new.guide_id is not null then
    select owner_id into v_owner from public.guides where id = new.guide_id;
    perform private.notify_user('lead_for_guide', v_owner, v_payload || '{"link":"/hub"}',
      private.guide_phone(new.guide_id), v_channels);
  end if;

  if new.provider_id is not null then
    v_owner := null;
    select pr.owner_id,
           pr.is_sample
             or pr.business_type = 'merch'
             or exists (select 1 from public.site_settings s
                        where s.key = 'shop_provider'
                          -- Compared as uuid; a missing or malformed value never throws, it just
                          -- does not match (CASE keeps the cast behind the format test).
                          and case when s.value ->> 'provider_id'
                                        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                                   then (s.value ->> 'provider_id')::uuid end = pr.id)
             or pf.id is null
             or coalesce(pf.role = 'admin', false)
      into v_owner, v_admin_only
    from public.providers pr
    left join public.profiles pf on pf.id = pr.owner_id
    where pr.id = new.provider_id;

    if v_admin_only is distinct from false then
      -- Sample or Kwetuly-run listing, no owner, or the row is gone: Kwetuly handles it.
      v_to_admins := true;
    else
      -- The owner gets who wrote and what they asked; the contact stays in the dashboard.
      perform private.notify_user('lead_for_business', v_owner,
        jsonb_build_object(
          'lead_id', new.id,
          'name', new.traveler_name,
          'message', left(coalesce(new.message, ''), 300),
          'link', '/dashboard#business'),
        private.provider_phone(new.provider_id), v_channels);
    end if;
  end if;

  if new.guide_id is null and new.provider_id is null then
    v_to_admins := true;
  end if;

  if v_to_admins then
    for v_admin in select id from public.profiles where role = 'admin' loop
      perform private.notify_user('lead_for_admin', v_admin, v_payload || '{"link":"/admin"}', null, v_channels);
    end loop;
  end if;
  return new;
end;
$$;

revoke execute on function private.on_lead_created() from public, anon, authenticated;
-- The trigger leads_notify (20261012000800) already calls this function.

-- ---------------------------------------------------------------------------
-- 3. Enquiry rate limit (security review M1)
--   The count runs in a SECURITY DEFINER helper because anon cannot read leads under RLS. The trigger
--   itself is SECURITY INVOKER so private.is_trusted() still sees the real caller: admins, the service
--   role and the database itself are not limited. The helper takes a transaction advisory lock per
--   key so two parallel inserts cannot both slip under the limit. It answers only true/false.
-- ---------------------------------------------------------------------------
create or replace function private.lead_rate_exceeded(p_traveler uuid, p_guide uuid, p_provider uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_since timestamptz := now() - interval '1 hour';
begin
  if p_traveler is not null then
    perform pg_advisory_xact_lock(hashtextextended('leads_rate:t:' || p_traveler::text, 0));
    return (select count(*) from public.leads l
            where l.traveler_id = p_traveler and l.created_at > v_since) >= 10;
  end if;

  -- Signed out: per business and per guide.
  if p_provider is not null then
    perform pg_advisory_xact_lock(hashtextextended('leads_rate:p:' || p_provider::text, 0));
    if (select count(*) from public.leads l
        where l.provider_id = p_provider and l.traveler_id is null and l.created_at > v_since) >= 5 then
      return true;
    end if;
  end if;
  if p_guide is not null then
    perform pg_advisory_xact_lock(hashtextextended('leads_rate:g:' || p_guide::text, 0));
    if (select count(*) from public.leads l
        where l.guide_id = p_guide and l.traveler_id is null and l.created_at > v_since) >= 5 then
      return true;
    end if;
  end if;
  return false;
end;
$$;

revoke execute on function private.lead_rate_exceeded(uuid, uuid, uuid) from public;
grant execute on function private.lead_rate_exceeded(uuid, uuid, uuid) to anon, authenticated;

create or replace function private.throttle_leads()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if private.is_trusted() then
    return new;
  end if;
  if private.lead_rate_exceeded(new.traveler_id, new.guide_id, new.provider_id) then
    raise exception 'rate_limited' using errcode = 'P0001',
      hint = 'Too many enquiries in the last hour. Please try again later.';
  end if;
  return new;
end;
$$;

revoke execute on function private.throttle_leads() from public, anon, authenticated;

drop trigger if exists leads_throttle on public.leads;
create trigger leads_throttle
  before insert on public.leads
  for each row execute function private.throttle_leads();

create index if not exists leads_traveler_created_idx on public.leads (traveler_id, created_at desc)
  where traveler_id is not null;

-- ---------------------------------------------------------------------------
-- 4. One target per enquiry (security review L2): never both a guide and a business.
--   NOT VALID: existing rows are not checked (see the count query in the header); new rows are.
-- ---------------------------------------------------------------------------
alter table public.leads
  add constraint leads_one_target check (guide_id is null or provider_id is null) not valid;

-- ---------------------------------------------------------------------------
-- 5. Deletion scrub: 20261016001800 unchanged, plus 'lead_for_business'.
-- ---------------------------------------------------------------------------
create or replace function private.scrub_deleted_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := case when old.email_confirmed_at is not null then nullif(lower(trim(old.email)), '') end;
  v_phone_digits text := case when old.phone_confirmed_at is not null
                              then nullif(regexp_replace(coalesce(old.phone, ''), '\D', '', 'g'), '') end;
  v_profile_phone_digits text;
  v_phones text[];
  v_lead_ids text[];
begin
  if length(v_phone_digits) < 9 then
    v_phone_digits := null;
  end if;

  select nullif(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), '') into v_profile_phone_digits
  from public.profiles p
  where p.id = old.id and p.phone_verified_at is not null;
  if length(v_profile_phone_digits) < 9 then
    v_profile_phone_digits := null;
  end if;

  -- Confirmed auth phone and verified profile phone (either may be null; often they are the same).
  v_phones := array_remove(array[v_phone_digits, v_profile_phone_digits], null);

  select coalesce(array_agg(l.id::text), '{}') into v_lead_ids
  from public.leads l where l.traveler_id = old.id;

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

  -- Alerts to guides, businesses and admins about their enquiries.
  update public.notification_outbox
  set payload = payload - 'name' - 'contact' - 'message',
      status = case when status = 'pending' then 'skipped'::public.notification_status else status end
  where event in ('lead_for_guide', 'lead_for_business', 'lead_for_admin')
    and payload ->> 'lead_id' = any (v_lead_ids);

  -- Interest alerts, and lead alerts from before lead_id was added, that carry their confirmed contact.
  if v_email is not null or cardinality(v_phones) > 0 then
    update public.notification_outbox
    set payload = payload - 'name' - 'contact' - 'message' - 'business',
        status = case when status = 'pending' then 'skipped'::public.notification_status else status end
    where (event like 'interest\_%' or (event in ('lead_for_guide', 'lead_for_business', 'lead_for_admin') and not payload ? 'lead_id'))
      and payload ? 'contact'
      and ((v_email is not null and lower(trim(payload ->> 'contact')) = v_email)
           or (cardinality(v_phones) > 0
               and payload ->> 'contact' !~ '@'
               and regexp_replace(payload ->> 'contact', '\D', '', 'g') = any (v_phones)));

    -- "Coming soon" sign-ups have no user link.
    delete from public.interest_signups s
    where (v_email is not null and lower(trim(s.contact)) = v_email)
       or (cardinality(v_phones) > 0
           and s.contact !~ '@'
           and regexp_replace(s.contact, '\D', '', 'g') = any (v_phones));
  end if;

  return old;
end;
$$;

revoke execute on function private.scrub_deleted_user() from public, anon, authenticated;
-- The trigger auth_users_scrub_before_delete (20261016001200) already calls this function.
