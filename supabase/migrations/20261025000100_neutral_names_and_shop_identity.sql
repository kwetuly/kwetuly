-- Two security fixes found during the brand rename (both existed before it). Runs right after
-- 20261025000000_brand_rename_kwetuly.sql.
--
-- 1. A person without a name was shown as the platform.
--    private.after_message (sender name in message alerts) and public.set_hub_author (hub author)
--    fell back to 'Kwetuly' when the sender had no guide name and no full_name (common after social
--    sign-in). WhatsApp/email alerts then read "New message from Kwetuly: pay your deposit to ...".
--    a) Both functions are redefined from 20261025000000 with only the fallback changed. The label now
--       depends on who the person is: an admin is still 'Kwetuly' (it really is the platform); a
--       traveller is 'A traveller' ('Msafiri' in Kiswahili alerts); a guide 'A guide' ('Mwongoza
--       watalii'); anyone else 'A member' ('Mwanachama'). No label contains the brand name, so a
--       non-admin can never look official. Message alerts follow the recipient's language (sw or en,
--       the same rule the notify function uses for the alert text); hub names are stored once and the
--       hub is English-first, so they are in English.
--       SECURITY DEFINER, search_path = '', grants and the kwetuly.orig_ / rafrika.orig_ hand-over
--       are unchanged. CREATE OR REPLACE keeps the existing grants and revokes.
--    b) Names that look like the brand are refused for everyone except admins:
--       private.is_reserved_display_name(text) is the one rule (same as isReservedDisplayName in
--       packages/shared/src/display-name.ts; the steps are listed above the function): "kwetuly"
--       ignoring case, accents, fullwidth forms and Cyrillic/Greek look-alikes, with i l 1 ! | all
--       accepted for the l and "vv" read as w, either inside any word or spaced out / split by
--       punctuation as a whole word ("Kwe tuly", "Kwe.tuly"); punctuation separates words, so
--       "Kwetu Lyimo" and "Kwetu-Lyimo" stay allowed. "rafrika" (the old name, same folding) at the
--       start of a word ("Safari-Rafrika" refused, "Safarafrika" allowed). Error code
--       'display_name_reserved' (SQLSTATE P0001), which the website and app turn into a clear message.
--       A NOTICE counts (no names) existing non-admin rows that already have such a name.
--       - profiles.full_name: new trigger profiles_guard_name, on insert and on any change of the
--         name or the role (so an admin named "Kwetuly ..." cannot be turned into a traveller and keep
--         the name). Allowed only when the profile's role is admin.
--       - guides.display_name: new trigger guides_guard_name (a guide name comes first in both
--         fallbacks above, so it is the same risk), on insert and when the name or the owner
--         changes. Allowed only when the owner is an admin, or for an ownerless sample guide written
--         by an admin or the database.
--       - Business names: providers.business_name, trip_offers.company_name (the offer "from" name
--         in alerts) and group_trips.company_name, through one trigger function
--         private.guard_business_name. Allowed for admins and the database (private.is_trusted())
--         and for rows owned by an admin; checked on insert and when the name or the owner changes.
--       - Sign-up: handle_new_user (from 20261025000000) checks the name from the sign-up metadata.
--         Email sign-ups with such a name are refused, like a wrong invite code; social sign-ups are
--         created without the name, so the person types one on the welcome step (complete_onboarding,
--         which the profile trigger checks).
--       Existing rows are not changed: the triggers only check a name when it is set or changed.
--    c) Stored hub names: posts and replies whose stored author_name is 'Kwetuly' but whose author is
--       not an admin get the neutral label, the same one the new set_hub_author would store. Only
--       that fallback text is updated; nothing is deleted.
--
-- 2. Shop takeover. The website and app sent shop orders (with travellers' names and contacts) to
--    "the first approved provider with business_type 'merch'", in no fixed order, and an approved
--    business owner could set business_type = 'merch' on their own listing.
--    a) public.guard_provider_admin_fields (latest: 20261016000400) keeps everything it protected and
--       adds: only admins or the database (private.is_trusted(), the test the guard already uses) may
--       create a 'merch' listing or change business_type to or from 'merch'. Others get the error
--       'business_type_reserved' (P0001).
--    b) The shop is now a fixed identity: site_settings 'shop_provider' = {"provider_id": "<uuid>"},
--       which only admins can write (existing policy "Admins manage site settings"). This migration
--       fills it with the oldest approved, non-sample 'merch' listing owned by an admin, if any. Clients
--       read the setting and then that listing (still requiring business_type 'merch' and approved).
--    c) A NOTICE counts any 'merch' listings not owned by an admin (count only, nothing changed), for
--       a person to look at in /admin.
--
-- Undo:
--   drop trigger profiles_guard_name on public.profiles; drop function private.guard_profile_name();
--   drop trigger guides_guard_name on public.guides; drop function private.guard_guide_name();
--   drop trigger providers_guard_name on public.providers; drop trigger trip_offers_guard_name on
--   public.trip_offers; drop trigger group_trips_guard_name on public.group_trips;
--   drop function private.guard_business_name();
--   drop function private.is_reserved_display_name(text);
--   re-run private.after_message, public.set_hub_author and public.handle_new_user from
--   20261025000000_brand_rename_kwetuly.sql, and public.guard_provider_admin_fields from
--   20261016000400_referral_commissions.sql;
--   delete from public.site_settings where key = 'shop_provider' (the clients then show "no shop" until
--   the old limit(1) code is restored);
--   hub names: update public.hub_posts / public.hub_replies set author_name = 'Kwetuly' where
--   author_name in ('A traveller', 'A guide', 'A member') and the author has no guide name or full_name.

-- ---------------------------------------------------------------------------
-- 1b. The one rule for names kept for Kwetuly
-- Pure function, no table access. Left executable by everyone (the default), because the name
-- triggers run as the signed-in user and as the service role.
-- ---------------------------------------------------------------------------
-- Same steps, in the same order, as foldDisplayName / isReservedDisplayName in
-- packages/shared/src/display-name.ts:
--   1. normalize(NFKD), then accents (combining marks U+0300..U+036F) removed: fullwidth letters,
--      non-breaking and other special spaces become plain ones, "ý" becomes "y". NFKD folds
--      everything NFKC folds and also splits off the accents so they can be dropped.
--   2. Cyrillic / Greek look-alikes become Latin (translate, both cases), then lower case.
--   3. 'vv' reads as 'w'.
--   4. Invisible characters (U+00AD, U+200B..U+200F, U+2060..U+2064, U+FEFF) are dropped; every
--      other character except a-z, 1, ! and | becomes a space, so punctuation separates words
--      ("Kwetu-Lyimo" is two words). Explicit a-z (code points), never [:alpha:], so the result does
--      not depend on the database collation.
--   5. Refused: kwetu + i/l/1/!/| + y anywhere; the same letters spaced out as a whole word
--      ("Kwe tuly", "Kwe.tuly", "kwetu_ly", "Kwetu ly"; "Kwetu Lyimo" is fine); rafr + i/l/1/!/| + ka
--      at the start of a word ("Safari-Rafrika"), or spaced out as a whole word ("Ra.frika").
create or replace function private.is_reserved_display_name(p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(v ~ ('kwetu[il1!|]y'
                       || '|(^|[^a-z])k *w *e *t *u *[il1!|] *y($|[^a-z])'
                       || '|(^|[^a-z])rafr[il1!|]ka'
                       || '|(^|[^a-z])r *a *f *r *[il1!|] *k *a($|[^a-z])'), false)
  from (
    select regexp_replace(
             regexp_replace(
               replace(
                 lower(translate(
                   regexp_replace(normalize(p_name, NFKD), '[' || chr(768) || '-' || chr(879) || ']', '', 'g'),
                   'АВЕКМНОРСТУХІӀЈЅԜҮавекмнорстухіӏјѕԝүԛΑΒΕΖΗΙΚΜΝΟΡΤΥΧαεικνορτυχγω',
                   'ABEKMHOPCTYXIlJSWYabekmhopctyxiljswyqABEZHIKMNOPTYXaeikvoptuxyw')),
                 'vv', 'w'),
               '[' || chr(173) || chr(8203) || '-' || chr(8207) || chr(8288) || '-' || chr(8292) || chr(65279) || ']', '', 'g'),
             '[^a-z1!|]', ' ', 'g') as v
  ) n;
$$;

comment on function private.is_reserved_display_name(text) is
  'True when a display or business name looks like the brand (Kwetuly, or the old name Rafrika), look-alike letters included. Keep in step with isReservedDisplayName in packages/shared/src/display-name.ts.';

create or replace function private.guard_profile_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT'
      or new.full_name is distinct from old.full_name
      or new.role is distinct from old.role)
     and new.role is distinct from 'admin'
     and private.is_reserved_display_name(new.full_name) then
    raise exception 'display_name_reserved' using errcode = 'P0001',
      hint = 'Names that include "Kwetuly" are kept for the Kwetuly team.';
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_profile_name() from public, anon, authenticated;

create trigger profiles_guard_name
  before insert or update of full_name, role on public.profiles
  for each row execute function private.guard_profile_name();

-- Runs as the caller. The owner lookup works for the owner (reads own profile), for admins (read
-- every profile) and for the database itself (table owner, no row level security).
create or replace function private.guard_guide_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT'
      or new.display_name is distinct from old.display_name
      or new.owner_id is distinct from old.owner_id)
     and private.is_reserved_display_name(new.display_name)
     and not (
       exists (select 1 from public.profiles p where p.id = new.owner_id and p.role = 'admin')
       or (new.owner_id is null and private.is_trusted())
     ) then
    raise exception 'display_name_reserved' using errcode = 'P0001',
      hint = 'Names that include "Kwetuly" are kept for the Kwetuly team.';
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_guide_name() from public, anon, authenticated;

create trigger guides_guard_name
  before insert or update of display_name, owner_id on public.guides
  for each row execute function private.guard_guide_name();

-- Business names on listings, trip offers and group trips (shown to travellers and in alerts, e.g.
-- the offer "from" name). One function for the three tables: tg_argv[0] is the name column,
-- tg_argv[1] the column holding the owner's user id. Allowed for admins and the database
-- (private.is_trusted()) and for rows owned by an admin. Checked on insert and when the name or the
-- owner changes; existing rows are not re-checked.
create or replace function private.guard_business_name()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  v_name text := v_new ->> tg_argv[0];
  v_owner uuid := (v_new ->> tg_argv[1])::uuid;
begin
  if (tg_op = 'INSERT'
      or v_name is distinct from (v_old ->> tg_argv[0])
      or (v_new ->> tg_argv[1]) is distinct from (v_old ->> tg_argv[1]))
     and private.is_reserved_display_name(v_name)
     and not private.is_trusted()
     and not exists (select 1 from public.profiles p where p.id = v_owner and p.role = 'admin') then
    raise exception 'display_name_reserved' using errcode = 'P0001',
      hint = 'Names that include "Kwetuly" are kept for the Kwetuly team.';
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_business_name() from public, anon, authenticated;

create trigger providers_guard_name
  before insert or update of business_name, owner_id on public.providers
  for each row execute function private.guard_business_name('business_name', 'owner_id');

create trigger trip_offers_guard_name
  before insert or update of company_name, offered_by on public.trip_offers
  for each row execute function private.guard_business_name('company_name', 'offered_by');

create trigger group_trips_guard_name
  before insert or update of company_name, organizer_id on public.group_trips
  for each row execute function private.guard_business_name('company_name', 'organizer_id');

-- ---------------------------------------------------------------------------
-- 1b. Sign-up: from 20261025000000 (handle_new_user), plus the name check (v_name).
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
  -- Google and Apple send "full_name" or "name"; Facebook sends "name".
  v_name text := coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name');
begin
  if private.invite_only() then
    begin
      invited := private.redeem_invite(new.raw_user_meta_data ->> 'invite_code', new.id);
    exception when others then
      raise warning 'handle_new_user: invite redemption failed for user % (%: %)', new.id, sqlstate, sqlerrm;
      invited := false;
    end;
    -- Email/password sign-ups must bring a valid code; the sign-up is rolled back otherwise.
    if not invited and coalesce(new.raw_app_meta_data ->> 'provider', '') = 'email' then
      raise exception 'invite_code_invalid' using errcode = 'P0001', hint = 'A valid invite code is needed while Kwetuly is invite-only.';
    end if;
  end if;

  -- A name that looks like Kwetuly (new accounts are never admins): email sign-ups are refused;
  -- social sign-ups go ahead without the name and type one on the welcome step.
  if private.is_reserved_display_name(v_name) then
    if coalesce(new.raw_app_meta_data ->> 'provider', '') = 'email' then
      raise exception 'display_name_reserved' using errcode = 'P0001',
        hint = 'Names that include "Kwetuly" are kept for the Kwetuly team.';
    end if;
    v_name := null;
  end if;

  insert into public.profiles (id, full_name, phone, role, preferred_language, onboarded_at)
  values (
    new.id,
    v_name,
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

-- ---------------------------------------------------------------------------
-- 1a. Messaging: from 20261025000000 (private.after_message); only the sender fallback changed.
-- ---------------------------------------------------------------------------
create or replace function private.after_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.conversations;
  v_guide_owner uuid;
  v_recipient uuid;
  v_phone text;
  v_sender text;
  v_sw boolean;
begin
  if new.masked then
    -- New setting name first; the old name covers a statement that started before the rename.
    insert into public.message_moderation (message_id, original_body)
    values (new.id, coalesce(
      nullif(current_setting('kwetuly.orig_' || replace(new.id::text, '-', ''), true), ''),
      current_setting('rafrika.orig_' || replace(new.id::text, '-', ''), true),
      ''));
  end if;

  select * into c from public.conversations where id = new.conversation_id;
  select owner_id into v_guide_owner from public.guides where id = c.guide_id;

  update public.conversations set last_message_at = new.created_at where id = c.id;

  if new.sender_id = c.traveler_id then
    v_recipient := v_guide_owner;
    v_phone := private.guide_phone(c.guide_id);
  else
    v_recipient := c.traveler_id;
  end if;

  -- The fallback is in the recipient's language (the alert text is sw or en, see the notify function)
  -- and never says "Kwetuly" unless the sender is an admin.
  select p.preferred_language = 'sw' into v_sw from public.profiles p where p.id = v_recipient;
  select coalesce(g.display_name, p.full_name,
           case
             when p.role = 'admin' then 'Kwetuly'
             when new.sender_id = c.traveler_id or p.role = 'traveler' then case when v_sw then 'Msafiri' else 'A traveller' end
             when p.role = 'guide' then case when v_sw then 'Mwongoza watalii' else 'A guide' end
             else case when v_sw then 'Mwanachama' else 'A member' end
           end) into v_sender
  from public.profiles p left join public.guides g on g.owner_id = p.id where p.id = new.sender_id;

  -- At most one alert per conversation every 15 minutes, so a busy chat doesn't flood WhatsApp.
  if not exists (
    select 1 from public.notification_outbox o
    where o.recipient_user_id = v_recipient
      and o.event = 'message_new'
      and o.payload->>'conversation' = c.id::text
      and o.created_at > now() - interval '15 minutes'
  ) then
    perform private.notify_user('message_new', v_recipient,
      jsonb_build_object('sender', v_sender, 'preview', left(new.body, 160),
                         'conversation', c.id, 'link', '/messages/' || c.id), v_phone);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1a. Hub author: from 20261025000000 (public.set_hub_author); only the fallback changed.
-- ---------------------------------------------------------------------------
create or replace function public.set_hub_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select coalesce(g.display_name, p.full_name,
           case p.role
             when 'admin' then 'Kwetuly'
             when 'traveler' then 'A traveller'
             when 'guide' then 'A guide'
             else 'A member'
           end), g.slug
    into new.author_name, new.author_slug
  from public.profiles p
  left join public.guides g on g.owner_id = p.id
  where p.id = new.author_id;
  return new;
end;
$$;

-- 1c. Stored hub names from the old fallback, for authors who are not admins.
update public.hub_posts h
set author_name = case p.role when 'traveler' then 'A traveller' when 'guide' then 'A guide' else 'A member' end
from public.profiles p
where p.id = h.author_id and h.author_name = 'Kwetuly' and p.role <> 'admin';

update public.hub_replies h
set author_name = case p.role when 'traveler' then 'A traveller' when 'guide' then 'A guide' else 'A member' end
from public.profiles p
where p.id = h.author_id and h.author_name = 'Kwetuly' and p.role <> 'admin';

-- ---------------------------------------------------------------------------
-- 2a. Provider guard: from 20261016000400 (public.guard_provider_admin_fields), plus business_type 'merch'.
-- ---------------------------------------------------------------------------
create or replace function public.guard_provider_admin_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_trusted() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- The shop listing receives shop orders with travellers' details: only Kwetuly creates it.
    if new.business_type = 'merch' then
      raise exception 'business_type_reserved' using errcode = 'P0001',
        hint = 'Only Kwetuly can create the Kwetuly Shop listing.';
    end if;
    new.verification_status := 'pending';
    new.verified_at := null;
    new.listing_fee_paid_until := null;
    new.badge_checks := '{}';
    new.badge_checked_at := null;
    new.badge_valid_until := null;
    new.has_referral_agreement := false;
  else
    if new.business_type is distinct from old.business_type
       and 'merch' in (new.business_type, old.business_type) then
      raise exception 'business_type_reserved' using errcode = 'P0001',
        hint = 'Only Kwetuly can change a listing to or from the Kwetuly Shop.';
    end if;
    new.verification_status := old.verification_status;
    new.verified_at := old.verified_at;
    new.listing_fee_paid_until := old.listing_fee_paid_until;
    new.badge_checks := old.badge_checks;
    new.badge_checked_at := old.badge_checked_at;
    new.badge_valid_until := old.badge_valid_until;
    new.has_referral_agreement := old.has_referral_agreement;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2b. The shop's fixed identity
-- ---------------------------------------------------------------------------
insert into public.site_settings (key, value)
select 'shop_provider', jsonb_build_object('provider_id', pr.id)
from public.providers pr
join public.profiles p on p.id = pr.owner_id and p.role = 'admin'
where pr.business_type = 'merch' and pr.verification_status = 'approved' and not pr.is_sample
order by pr.created_at, pr.id
limit 1
on conflict (key) do nothing;

-- 2c. Report only (counts, no names or contacts).
do $$
declare
  n bigint;
begin
  select count(*) into n
  from public.providers pr
  where pr.business_type = 'merch'
    and not exists (select 1 from public.profiles p where p.id = pr.owner_id and p.role = 'admin');
  if n > 0 then
    raise notice 'shop identity: % merch listing(s) not owned by an admin; check them in /admin', n;
  end if;
  if not exists (select 1 from public.site_settings where key = 'shop_provider') then
    raise notice 'shop identity: no admin-owned approved merch listing yet; create it in /admin/shop';
  end if;
end;
$$;

-- 1b. Report only (counts, no names): existing rows that already have a reserved name and do not
-- belong to an admin. They are not changed; a person decides what to do with them.
do $$
declare
  v_profiles bigint;
  v_guides bigint;
  v_providers bigint;
  v_offers bigint;
  v_groups bigint;
begin
  select count(*) into v_profiles from public.profiles p
  where p.role <> 'admin' and private.is_reserved_display_name(p.full_name);
  select count(*) into v_guides from public.guides g
  where private.is_reserved_display_name(g.display_name)
    and not exists (select 1 from public.profiles p where p.id = g.owner_id and p.role = 'admin');
  select count(*) into v_providers from public.providers pr
  where private.is_reserved_display_name(pr.business_name)
    and not exists (select 1 from public.profiles p where p.id = pr.owner_id and p.role = 'admin');
  select count(*) into v_offers from public.trip_offers o
  where private.is_reserved_display_name(o.company_name)
    and not exists (select 1 from public.profiles p where p.id = o.offered_by and p.role = 'admin');
  select count(*) into v_groups from public.group_trips t
  where private.is_reserved_display_name(t.company_name)
    and not exists (select 1 from public.profiles p where p.id = t.organizer_id and p.role = 'admin');
  if v_profiles + v_guides + v_providers + v_offers + v_groups > 0 then
    raise notice 'reserved names already in use by non-admins: % profile(s), % guide(s), % business listing(s), % trip offer(s), % group trip(s)',
      v_profiles, v_guides, v_providers, v_offers, v_groups;
  end if;
end;
$$;
