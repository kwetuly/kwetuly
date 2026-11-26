-- "Please contact me" on /hosts (W1-3): who sent an interest request, and a rate limit.
-- Security review items for slice W1-3. Not applied anywhere by the engineer: Walter pastes it.
--
-- Before: public.interest_signups (20261012000400) had no link to an account. Anyone (anon or signed in)
-- could insert as often as they liked; only admins read it. Account deletion
-- (private.scrub_deleted_user, latest 20261030000100) removed sign-ups only when their contact equalled
-- the account's confirmed email or phone. The app could not tell whether an account had already sent
-- "Please contact me", so the website showed the button on every visit and the app kept a
-- device-only flag.
--
-- After:
--   1. interest_signups.user_id uuid null, default auth.uid(), references auth.users ON DELETE CASCADE.
--      Signed-in inserts are linked to the account automatically; signed-out inserts (and the service
--      role) get null. CASCADE rather than SET NULL: a row holds the person's name and contact, so an
--      unlinked copy left behind after deletion would still be personal data with nobody to ask about
--      it. The deletion trigger below removes the rows first anyway; CASCADE is the safety net.
--      Existing rows keep user_id null (nothing is back-filled).
--   2. Insert policy "Anyone can register interest" re-created with the same checks plus
--      (user_id is null or user_id = auth.uid()): nobody can file a request under another account.
--      There is still no update or delete policy, so user_id cannot be changed afterwards, and there is
--      still no select policy for non-admins.
--   3. public.my_interest_exists(p_section, p_item) boolean: SECURITY DEFINER, search_path '',
--      executable by authenticated only (not anon, not public). True when the caller (auth.uid()) has a
--      row for that section and item. It answers only true/false about the caller's own rows.
--      Requests sent before this migration (user_id null) are not counted.
--   4. private.on_interest_created(): unchanged, plus 'interest_id' in the admin alert payload, so the
--      alert copies in notification_outbox can be found again when the account is deleted.
--   5. private.scrub_deleted_user(): identical to 20261030000100, plus: the account's interest_signups
--      rows (by user_id) are deleted, and the admin alert copies of those rows (events 'interest_%' whose
--      payload interest_id matches) are deleted from notification_outbox. The contact-based clean-up
--      for older rows stays as it was.
--   6. Rate limit, trigger interest_signups_throttle (BEFORE INSERT): at most 5 rows per hour per
--      user_id; with user_id null, at most 5 per hour per lower(trim(contact)) among user_id-null rows.
--      Over the limit: error 'rate_limited', SQLSTATE P0001, the same as leads (20261030000100) and
--      isRateLimited() in packages/shared/src/dictionaries/limits.ts. Admins, the service role and the
--      database are not limited (private.is_trusted()). The count runs in
--      private.interest_rate_exceeded() (SECURITY DEFINER because anon cannot read the table; answers
--      only true/false; takes a transaction advisory lock per key so parallel inserts cannot both slip
--      under the limit). Two partial indexes support the count and my_interest_exists().
--
-- Nothing is deleted by applying this. One nullable column, two indexes, one trigger and three functions
-- are added; one policy and two functions are replaced.
-- Order: the website and app call my_interest_exists() and treat an error as "not sent yet", and they do
-- not write user_id themselves (the default does), so the hosts pages work before and after this
-- migration. The admin list (apps/web/src/app/[lang]/admin/all/page.tsx) selects user_id, so apply this
-- migration BEFORE deploying the website, or the admin sign-up list shows empty until it is applied.
--
-- Undo (no data to restore; the user_id links are lost):
--   drop trigger interest_signups_throttle on public.interest_signups;
--   drop function private.throttle_interest_signups();
--   drop function private.interest_rate_exceeded(uuid, text);
--   drop function public.my_interest_exists(text, text);
--   re-create private.scrub_deleted_user() from 20261030000100_order_alerts_to_owner.sql (section 5);
--   re-create private.on_interest_created() from 20261012000800_notifications.sql;
--   drop policy "Anyone can register interest" on public.interest_signups;
--   create policy "Anyone can register interest" on public.interest_signups
--     for insert to anon, authenticated with check (length(name) > 0 and length(contact) > 0);
--   drop index public.interest_signups_user_created_idx;
--   drop index public.interest_signups_contact_created_idx;
--   alter table public.interest_signups drop column user_id;

-- ---------------------------------------------------------------------------
-- 1. Owner column
-- ---------------------------------------------------------------------------
alter table public.interest_signups
  add column if not exists user_id uuid default auth.uid() references auth.users (id) on delete cascade;

create index if not exists interest_signups_user_created_idx
  on public.interest_signups (user_id, created_at desc) where user_id is not null;
create index if not exists interest_signups_contact_created_idx
  on public.interest_signups (lower(trim(contact)), created_at desc) where user_id is null;

-- ---------------------------------------------------------------------------
-- 2. Insert policy: the existing checks, plus the row is the caller's own or unlinked.
-- ---------------------------------------------------------------------------
drop policy if exists "Anyone can register interest" on public.interest_signups;
create policy "Anyone can register interest" on public.interest_signups
  for insert to anon, authenticated
  with check (length(name) > 0 and length(contact) > 0
              and (user_id is null or user_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- 3. "Did I already send this?" for the signed-in caller only.
-- ---------------------------------------------------------------------------
create or replace function public.my_interest_exists(p_section text, p_item text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.interest_signups s
    where s.user_id = (select auth.uid())
      and s.section = p_section
      and s.item = p_item
  );
$$;

revoke all on function public.my_interest_exists(text, text) from public, anon;
grant execute on function public.my_interest_exists(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Admin alert: unchanged from 20261012000800, plus interest_id.
-- ---------------------------------------------------------------------------
create or replace function private.on_interest_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify_admins('interest_' || new.kind::text,
    jsonb_build_object('interest_id', new.id, 'section', new.section, 'item', new.item, 'name', new.name,
                       'contact', new.contact, 'business', new.business_name,
                       'message', left(coalesce(new.message, ''), 500), 'link', '/admin'));
  return new;
end;
$$;

revoke execute on function private.on_interest_created() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Deletion scrub: 20261030000100 unchanged, plus the account's interest rows and their alerts.
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
  v_interest_ids text[];
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

  -- Interest requests sent while signed in (user_id, 20261126000060), whatever contact they carry,
  -- and the admin alert copies of them.
  select coalesce(array_agg(s.id::text), '{}') into v_interest_ids
  from public.interest_signups s where s.user_id = old.id;
  if cardinality(v_interest_ids) > 0 then
    delete from public.notification_outbox
    where event like 'interest\_%'
      and payload ->> 'interest_id' = any (v_interest_ids);
    delete from public.interest_signups s where s.user_id = old.id;
  end if;

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

    -- "Coming soon" sign-ups sent signed out have no user link.
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

-- ---------------------------------------------------------------------------
-- 6. Rate limit: 5 per hour per account, or per contact when signed out.
-- ---------------------------------------------------------------------------
create or replace function private.interest_rate_exceeded(p_user uuid, p_contact text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_since timestamptz := now() - interval '1 hour';
  v_contact text := lower(trim(coalesce(p_contact, '')));
begin
  if p_user is not null then
    perform pg_advisory_xact_lock(hashtextextended('interest_rate:u:' || p_user::text, 0));
    return (select count(*) from public.interest_signups s
            where s.user_id = p_user and s.created_at > v_since) >= 5;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('interest_rate:c:' || v_contact, 0));
  return (select count(*) from public.interest_signups s
          where s.user_id is null and lower(trim(s.contact)) = v_contact and s.created_at > v_since) >= 5;
end;
$$;

revoke execute on function private.interest_rate_exceeded(uuid, text) from public;
-- The trigger runs as the caller (so private.is_trusted() sees who it really is), so they need execute.
grant execute on function private.interest_rate_exceeded(uuid, text) to anon, authenticated;

create or replace function private.throttle_interest_signups()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if private.is_trusted() then
    return new;
  end if;
  if private.interest_rate_exceeded(new.user_id, new.contact) then
    raise exception 'rate_limited' using errcode = 'P0001',
      hint = 'Too many requests in the last hour. Please try again later.';
  end if;
  return new;
end;
$$;

revoke execute on function private.throttle_interest_signups() from public, anon, authenticated;

drop trigger if exists interest_signups_throttle on public.interest_signups;
create trigger interest_signups_throttle
  before insert on public.interest_signups
  for each row execute function private.throttle_interest_signups();
