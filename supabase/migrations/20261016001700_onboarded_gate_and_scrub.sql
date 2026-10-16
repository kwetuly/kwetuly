-- Security re-check 2026-10-16: N1, N3 and N5.
--
--   N1  Accounts that never finished the welcome step (onboarded_at is null, e.g. no valid invite code
--       while Rafrika is invite-only) could still create content through the API. From now on every
--       place where a signed-in person creates or edits their own content also needs
--       private.is_onboarded(). Signed-out enquiries (leads with traveler_id null) stay allowed.
--       Not gated, on purpose: reading, deleting one's own content and files (so "delete my account"
--       keeps working), marking conversations read, the welcome step itself (complete_onboarding is
--       security definer and does not look at these policies) and the profile row (the welcome step
--       and the site read and update it before onboarding).
--   N3  The deletion scrub matched too widely (contacts typed on enquiries and profiles.phone, which
--       anyone can type). Lead alerts are now matched by lead id (on_lead_created adds 'lead_id' to the
--       payload), and "coming soon" sign-ups and interest alerts only by the account's confirmed email
--       and confirmed auth phone.
--   N5  handle_new_user logs a warning when redeeming the invite code fails unexpectedly (still fails
--       closed: the account is created without onboarding).
--
-- No data is changed or deleted by this migration.
--
-- Undo (each object's previous body is in the file named):
--   N1  for each policy below: drop it and re-create the original from the file noted next to it;
--       re-create public.join_group_chat(text) from 20261013000500_group_chats.sql;
--       then drop function private.is_onboarded().
--   N3  re-create private.scrub_deleted_user() from 20261016001200_account_deletion_cleanup.sql and
--       private.on_lead_created() from 20261016001400_admin_two_step_business_gate_deposits_leads.sql
--       (alerts already queued keep their 'lead_id'; harmless).
--   N5  re-create public.handle_new_user() from 20261016001500_invite_codes.sql.

-- ---------------------------------------------------------------------------
-- N1. Helper: has the signed-in person finished the welcome step?
-- Admins (two-step session, private.is_admin()) always count as onboarded so admin tools keep working.
-- Executable by anon because the leads insert policy is evaluated for signed-out senders too; it is
-- simply false there.
-- ---------------------------------------------------------------------------
create or replace function private.is_onboarded()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1 from public.profiles p
           where p.id = (select auth.uid()) and p.onboarded_at is not null)
      or private.is_admin();
$$;

revoke execute on function private.is_onboarded() from public;
grant execute on function private.is_onboarded() to anon, authenticated;

-- trip_requests (20261014000100_trip_requests_offers.sql)
drop policy "Travellers post requests" on public.trip_requests;
create policy "Travellers post requests" on public.trip_requests
  for insert to authenticated
  with check (traveler_id = (select auth.uid()) and private.is_onboarded());

drop policy "Travellers edit their requests" on public.trip_requests;
create policy "Travellers edit their requests" on public.trip_requests
  for update to authenticated
  using ((traveler_id = (select auth.uid()) and private.is_onboarded()) or private.is_admin())
  with check ((traveler_id = (select auth.uid()) and private.is_onboarded()) or private.is_admin());

-- group_trips (20261013000300_group_trips.sql)
drop policy "Verified guides and businesses create group trips" on public.group_trips;
create policy "Verified guides and businesses create group trips" on public.group_trips
  for insert to authenticated
  with check (organizer_id = (select auth.uid())
              and private.is_onboarded()
              and private.can_organize_group(guide_id, company_name));

drop policy "Organisers and admins update group trips" on public.group_trips;
create policy "Organisers and admins update group trips" on public.group_trips
  for update to authenticated
  using ((organizer_id = (select auth.uid()) and private.is_onboarded()) or private.is_admin())
  with check ((organizer_id = (select auth.uid()) and private.is_onboarded()) or private.is_admin());

-- group_trip_members (20261013000300_group_trips.sql)
drop policy "Travellers ask to join open trips" on public.group_trip_members;
create policy "Travellers ask to join open trips" on public.group_trip_members
  for insert to authenticated
  with check (traveler_id = (select auth.uid())
              and private.is_onboarded()
              and private.group_trip_open(group_trip_id));

drop policy "Travellers and organisers update requests" on public.group_trip_members;
create policy "Travellers and organisers update requests" on public.group_trip_members
  for update to authenticated
  using (((traveler_id = (select auth.uid()) or private.is_group_organizer(group_trip_id)) and private.is_onboarded())
         or private.is_admin())
  with check (((traveler_id = (select auth.uid()) or private.is_group_organizer(group_trip_id)) and private.is_onboarded())
              or private.is_admin());

-- conversations and messages (20261012001100_messaging.sql)
drop policy "Travellers start conversations with approved guides" on public.conversations;
create policy "Travellers start conversations with approved guides" on public.conversations
  for insert to authenticated
  with check (
    traveler_id = (select auth.uid())
    and private.is_onboarded()
    and exists (select 1 from public.guides g where g.id = guide_id and g.verification_status = 'approved')
    and contact_unlocked = false);

drop policy "Participants send messages" on public.messages;
create policy "Participants send messages" on public.messages
  for insert to authenticated
  with check (sender_id = (select auth.uid())
              and private.is_onboarded()
              and private.in_conversation(conversation_id));

-- group chats (20261013000500_group_chats.sql)
drop policy "Signed-in users start chats" on public.group_chats;
create policy "Signed-in users start chats" on public.group_chats
  for insert to authenticated
  with check (created_by = (select auth.uid()) and group_trip_id is null and private.is_onboarded());

drop policy "Members post messages" on public.group_chat_messages;
create policy "Members post messages" on public.group_chat_messages
  for insert to authenticated
  with check (sender_id = (select auth.uid())
              and private.is_onboarded()
              and private.is_chat_member(chat_id));

drop policy "Senders change consent; admins feature" on public.group_chat_messages;
create policy "Senders change consent; admins feature" on public.group_chat_messages
  for update to authenticated
  using ((sender_id = (select auth.uid()) and private.is_onboarded()) or private.is_admin())
  with check ((sender_id = (select auth.uid()) and private.is_onboarded()) or private.is_admin());

-- Joining a chat by invite link is how people get into group chats; same as 20261013000500 plus the check.
create or replace function public.join_group_chat(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  chat public.group_chats;
begin
  if not private.is_onboarded() then
    raise exception 'Finish setting up your account first';
  end if;
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

-- guide_reviews (20261013000200_guide_reviews.sql)
drop policy "Travellers who dealt with the guide can review" on public.guide_reviews;
create policy "Travellers who dealt with the guide can review" on public.guide_reviews
  for insert to authenticated
  with check (author_id = (select auth.uid()) and private.is_onboarded() and private.can_review_guide(guide_id));

drop policy "Authors and admins update reviews" on public.guide_reviews;
create policy "Authors and admins update reviews" on public.guide_reviews
  for update to authenticated
  using ((author_id = (select auth.uid()) and private.is_onboarded()) or private.is_admin())
  with check ((author_id = (select auth.uid()) and private.is_onboarded()) or private.is_admin());

-- leads (20261016001400_admin_two_step_business_gate_deposits_leads.sql): signed-out enquiries stay open;
-- an enquiry linked to an account needs a finished account.
drop policy "Anyone can send an enquiry to an approved guide or business" on public.leads;
create policy "Anyone can send an enquiry to an approved guide or business" on public.leads
  for insert to anon, authenticated
  with check (
    (traveler_id is null or (traveler_id = (select auth.uid()) and private.is_onboarded()))
    and private.lead_target_ok(guide_id, provider_id)
  );

-- Guide and business sign-up rows (20261012000200_guides.sql, 20261012000000_initial_schema.sql).
-- The website and the app only offer these after the welcome step.
drop policy "Users create own guide profile" on public.guides;
create policy "Users create own guide profile" on public.guides
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and private.is_onboarded());

drop policy "Users create own provider" on public.providers;
create policy "Users create own provider" on public.providers
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and private.is_onboarded());

-- Storage uploads. Read and delete policies are unchanged.
-- avatars and verification: 20261012000200_guides.sql; chat-media: 20261013000500_group_chats.sql.
drop policy "Users upload own avatar" on storage.objects;
create policy "Users upload own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and private.is_onboarded());

drop policy "Users replace own avatar" on storage.objects;
create policy "Users replace own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars'
         and (storage.foldername(name))[1] = (select auth.uid())::text
         and private.is_onboarded());

drop policy "Users upload own verification docs" on storage.objects;
create policy "Users upload own verification docs" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'verification'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and private.is_onboarded());

drop policy "Chat members upload media" on storage.objects;
create policy "Chat members upload media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-media'
              and private.is_onboarded()
              and private.is_chat_member(((storage.foldername(name))[1])::uuid));

-- ---------------------------------------------------------------------------
-- N3a. Lead alerts carry the lead id, so the deletion scrub can find exactly that person's alerts.
-- Same as 20261016001400 otherwise.
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
  else
    for v_admin in select id from public.profiles where role = 'admin' loop
      perform private.notify_user('lead_for_admin', v_admin, v_payload || '{"link":"/admin"}', null, v_channels);
    end loop;
  end if;
  return new;
end;
$$;

revoke execute on function private.on_lead_created() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- N3b. Deletion scrub, matched precisely.
--   * Enquiries: by traveler_id (unchanged).
--   * Alerts addressed to the person: by recipient_user_id (unchanged).
--   * Lead alerts to guides / admins: by the lead id of their enquiries.
--   * "Coming soon" sign-ups and their admin alerts (and lead alerts queued before lead_id existed):
--     only when the contact equals the account's confirmed email or confirmed auth phone. Contacts the
--     person typed and profiles.phone are not used: anyone can type someone else's address there.
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
  v_lead_ids text[];
begin
  if length(v_phone_digits) < 9 then
    v_phone_digits := null;
  end if;

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

  -- Alerts to guides and admins about their enquiries.
  update public.notification_outbox
  set payload = payload - 'name' - 'contact' - 'message',
      status = case when status = 'pending' then 'skipped'::public.notification_status else status end
  where event in ('lead_for_guide', 'lead_for_admin')
    and payload ->> 'lead_id' = any (v_lead_ids);

  -- Interest alerts, and lead alerts from before lead_id was added, that carry their confirmed contact.
  if v_email is not null or v_phone_digits is not null then
    update public.notification_outbox
    set payload = payload - 'name' - 'contact' - 'message' - 'business',
        status = case when status = 'pending' then 'skipped'::public.notification_status else status end
    where (event like 'interest\_%' or (event in ('lead_for_guide', 'lead_for_admin') and not payload ? 'lead_id'))
      and payload ? 'contact'
      and ((v_email is not null and lower(trim(payload ->> 'contact')) = v_email)
           or (v_phone_digits is not null
               and payload ->> 'contact' !~ '@'
               and regexp_replace(payload ->> 'contact', '\D', '', 'g') = v_phone_digits));

    -- "Coming soon" sign-ups have no user link.
    delete from public.interest_signups s
    where (v_email is not null and lower(trim(s.contact)) = v_email)
       or (v_phone_digits is not null
           and s.contact !~ '@'
           and regexp_replace(s.contact, '\D', '', 'g') = v_phone_digits);
  end if;

  return old;
end;
$$;

revoke execute on function private.scrub_deleted_user() from public, anon, authenticated;
-- The trigger auth_users_scrub_before_delete (20261016001200) already calls this function.

-- ---------------------------------------------------------------------------
-- N5. New accounts: same as 20261016001500, plus a warning in the database log when redeeming the
-- code fails unexpectedly. Only the error code and message are logged (never the invite code, email
-- or phone). Still fails closed: the account is created without onboarding.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := new.raw_user_meta_data ->> 'role';
  phone text := coalesce(new.phone, new.raw_user_meta_data ->> 'phone');
  invited boolean := true;
begin
  if private.invite_only() then
    begin
      invited := private.redeem_invite(new.raw_user_meta_data ->> 'invite_code', new.id);
    exception when others then
      raise warning 'handle_new_user: invite redemption failed for user % (%: %)', new.id, sqlstate, sqlerrm;
      invited := false;
    end;
  end if;

  insert into public.profiles (id, full_name, phone, role, preferred_language, onboarded_at)
  values (
    new.id,
    -- Google and Apple send "full_name" or "name"; Facebook sends "name".
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    phone,
    -- Without a valid invite the account stays a traveller until the welcome step.
    case when invited and requested in ('traveler', 'provider', 'investor', 'guide')
         then requested::public.user_role else 'traveler' end,
    coalesce(new.raw_user_meta_data ->> 'preferred_language', 'en'),
    case when invited and requested is not null and phone is not null then now() end
  );
  return new;
end;
$$;
