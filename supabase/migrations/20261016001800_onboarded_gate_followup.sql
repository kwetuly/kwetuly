-- Security review of 5f9cb52 (2026-10-16): follow-ups M2, L4 and L2.
--
--   M2  Five more places where a signed-in person creates content now also need a finished account
--       ((select private.is_onboarded())): prep call requests, job posts, investment projects, message
--       reports and objections to public use of group chat media. Each policy is the original word
--       for word plus the check.
--   L4  The policies re-created in 20261016001700 call private.is_onboarded() once per row. They are
--       re-created here with (select private.is_onboarded()) so Postgres evaluates it once per
--       statement. Same names, same logic.
--   L2  The deletion scrub also matches "coming soon" sign-ups and interest alerts by profiles.phone,
--       but only when that phone was verified (profiles.phone_verified_at is set), in addition to the
--       confirmed email and confirmed auth phone.
--
-- No data is changed or deleted by this migration (the scrub function only runs when an account is
-- deleted).
--
-- Undo:
--   M2  for each policy in the M2 section: drop it and re-create the original from the file noted
--       next to it.
--   L4  re-run the policy section of 20261016001700_onboarded_gate_and_scrub.sql (drop + create).
--   L2  re-create private.scrub_deleted_user() from 20261016001700_onboarded_gate_and_scrub.sql.

-- ---------------------------------------------------------------------------
-- M2. Insert policies that were missing the onboarding check.
-- ---------------------------------------------------------------------------

-- call_requests (20261012000500_calls_jobs_hub.sql)
drop policy "Travelers request calls with guides who offer them" on public.call_requests;
create policy "Travelers request calls with guides who offer them" on public.call_requests
  for insert to authenticated
  with check (
    traveler_id = (select auth.uid())
    and exists (
      select 1 from public.guides g
      where g.id = guide_id and g.call_enabled and g.verification_status = 'approved')
    and (select private.is_onboarded()));

-- jobs (20261012000500_calls_jobs_hub.sql)
drop policy "Signed-in businesses post jobs" on public.jobs;
create policy "Signed-in businesses post jobs" on public.jobs
  for insert to authenticated with check (posted_by = (select auth.uid()) and (select private.is_onboarded()));

-- investment_projects (20261012000000_initial_schema.sql)
drop policy "Users submit projects" on public.investment_projects;
create policy "Users submit projects" on public.investment_projects
  for insert to authenticated with check (submitted_by = (select auth.uid()) and (select private.is_onboarded()));

-- message_reports (20261012001100_messaging.sql). "Admins manage reports" is unchanged.
drop policy "Participants report messages" on public.message_reports;
create policy "Participants report messages" on public.message_reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and exists (select 1 from public.messages m where m.id = message_id and private.in_conversation(m.conversation_id))
    and (select private.is_onboarded()));

-- group_chat_objections (20261013000500_group_chats.sql). Withdrawing an objection (delete) stays open.
drop policy "Members object to public use" on public.group_chat_objections;
create policy "Members object to public use" on public.group_chat_objections
  for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.group_chat_messages m where m.id = message_id and private.is_chat_member(m.chat_id))
    and (select private.is_onboarded()));

-- ---------------------------------------------------------------------------
-- L4. 20261016001700 policies, with the helper wrapped in a sub-select (evaluated once per statement).
-- ---------------------------------------------------------------------------

-- trip_requests
drop policy "Travellers post requests" on public.trip_requests;
create policy "Travellers post requests" on public.trip_requests
  for insert to authenticated
  with check (traveler_id = (select auth.uid()) and (select private.is_onboarded()));

drop policy "Travellers edit their requests" on public.trip_requests;
create policy "Travellers edit their requests" on public.trip_requests
  for update to authenticated
  using ((traveler_id = (select auth.uid()) and (select private.is_onboarded())) or private.is_admin())
  with check ((traveler_id = (select auth.uid()) and (select private.is_onboarded())) or private.is_admin());

-- group_trips
drop policy "Verified guides and businesses create group trips" on public.group_trips;
create policy "Verified guides and businesses create group trips" on public.group_trips
  for insert to authenticated
  with check (organizer_id = (select auth.uid())
              and (select private.is_onboarded())
              and private.can_organize_group(guide_id, company_name));

drop policy "Organisers and admins update group trips" on public.group_trips;
create policy "Organisers and admins update group trips" on public.group_trips
  for update to authenticated
  using ((organizer_id = (select auth.uid()) and (select private.is_onboarded())) or private.is_admin())
  with check ((organizer_id = (select auth.uid()) and (select private.is_onboarded())) or private.is_admin());

-- group_trip_members
drop policy "Travellers ask to join open trips" on public.group_trip_members;
create policy "Travellers ask to join open trips" on public.group_trip_members
  for insert to authenticated
  with check (traveler_id = (select auth.uid())
              and (select private.is_onboarded())
              and private.group_trip_open(group_trip_id));

drop policy "Travellers and organisers update requests" on public.group_trip_members;
create policy "Travellers and organisers update requests" on public.group_trip_members
  for update to authenticated
  using (((traveler_id = (select auth.uid()) or private.is_group_organizer(group_trip_id)) and (select private.is_onboarded()))
         or private.is_admin())
  with check (((traveler_id = (select auth.uid()) or private.is_group_organizer(group_trip_id)) and (select private.is_onboarded()))
              or private.is_admin());

-- conversations and messages
drop policy "Travellers start conversations with approved guides" on public.conversations;
create policy "Travellers start conversations with approved guides" on public.conversations
  for insert to authenticated
  with check (
    traveler_id = (select auth.uid())
    and (select private.is_onboarded())
    and exists (select 1 from public.guides g where g.id = guide_id and g.verification_status = 'approved')
    and contact_unlocked = false);

drop policy "Participants send messages" on public.messages;
create policy "Participants send messages" on public.messages
  for insert to authenticated
  with check (sender_id = (select auth.uid())
              and (select private.is_onboarded())
              and private.in_conversation(conversation_id));

-- group chats
drop policy "Signed-in users start chats" on public.group_chats;
create policy "Signed-in users start chats" on public.group_chats
  for insert to authenticated
  with check (created_by = (select auth.uid()) and group_trip_id is null and (select private.is_onboarded()));

drop policy "Members post messages" on public.group_chat_messages;
create policy "Members post messages" on public.group_chat_messages
  for insert to authenticated
  with check (sender_id = (select auth.uid())
              and (select private.is_onboarded())
              and private.is_chat_member(chat_id));

drop policy "Senders change consent; admins feature" on public.group_chat_messages;
create policy "Senders change consent; admins feature" on public.group_chat_messages
  for update to authenticated
  using ((sender_id = (select auth.uid()) and (select private.is_onboarded())) or private.is_admin())
  with check ((sender_id = (select auth.uid()) and (select private.is_onboarded())) or private.is_admin());

-- guide_reviews
drop policy "Travellers who dealt with the guide can review" on public.guide_reviews;
create policy "Travellers who dealt with the guide can review" on public.guide_reviews
  for insert to authenticated
  with check (author_id = (select auth.uid()) and (select private.is_onboarded()) and private.can_review_guide(guide_id));

drop policy "Authors and admins update reviews" on public.guide_reviews;
create policy "Authors and admins update reviews" on public.guide_reviews
  for update to authenticated
  using ((author_id = (select auth.uid()) and (select private.is_onboarded())) or private.is_admin())
  with check ((author_id = (select auth.uid()) and (select private.is_onboarded())) or private.is_admin());

-- leads: signed-out enquiries stay open; an enquiry linked to an account needs a finished account.
drop policy "Anyone can send an enquiry to an approved guide or business" on public.leads;
create policy "Anyone can send an enquiry to an approved guide or business" on public.leads
  for insert to anon, authenticated
  with check (
    (traveler_id is null or (traveler_id = (select auth.uid()) and (select private.is_onboarded())))
    and private.lead_target_ok(guide_id, provider_id)
  );

-- Guide and business sign-up rows.
drop policy "Users create own guide profile" on public.guides;
create policy "Users create own guide profile" on public.guides
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.is_onboarded()));

drop policy "Users create own provider" on public.providers;
create policy "Users create own provider" on public.providers
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.is_onboarded()));

-- Storage uploads. Read and delete policies are unchanged.
drop policy "Users upload own avatar" on storage.objects;
create policy "Users upload own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select private.is_onboarded()));

drop policy "Users replace own avatar" on storage.objects;
create policy "Users replace own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars'
         and (storage.foldername(name))[1] = (select auth.uid())::text
         and (select private.is_onboarded()));

drop policy "Users upload own verification docs" on storage.objects;
create policy "Users upload own verification docs" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'verification'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select private.is_onboarded()));

drop policy "Chat members upload media" on storage.objects;
create policy "Chat members upload media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-media'
              and (select private.is_onboarded())
              and private.is_chat_member(((storage.foldername(name))[1])::uuid));

-- ---------------------------------------------------------------------------
-- L2. Deletion scrub: same as 20261016001700, plus the verified profile phone.
--   The profile row still exists here: this runs BEFORE DELETE on auth.users, and the cascade to
--   public.profiles happens afterwards. profiles.phone is only used when phone_verified_at is set
--   (the profile guard trigger clears phone_verified_at whenever the phone changes), so a phone
--   someone merely typed is never used.
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

  -- Alerts to guides and admins about their enquiries.
  update public.notification_outbox
  set payload = payload - 'name' - 'contact' - 'message',
      status = case when status = 'pending' then 'skipped'::public.notification_status else status end
  where event in ('lead_for_guide', 'lead_for_admin')
    and payload ->> 'lead_id' = any (v_lead_ids);

  -- Interest alerts, and lead alerts from before lead_id was added, that carry their confirmed contact.
  if v_email is not null or cardinality(v_phones) > 0 then
    update public.notification_outbox
    set payload = payload - 'name' - 'contact' - 'message' - 'business',
        status = case when status = 'pending' then 'skipped'::public.notification_status else status end
    where (event like 'interest\_%' or (event in ('lead_for_guide', 'lead_for_admin') and not payload ? 'lead_id'))
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
