-- Profile links (slice S5, docs/team/design-2026-11-24.md sections 5.2 and 8). NOT APPLIED. Walter pastes
-- it on live himself, after the reservations migrations (20261122200000, 20261122300000, 20261123000000);
-- it does not depend on them, nor on S1 (20261126000000) or S4 (20261126000100).
--
-- What it does:
--   1. New link columns, all empty to start:
--        guides.google_business_url, guides.youtube_url, guides.website
--        providers.facebook_url, providers.instagram_url, providers.tiktok_url,
--        providers.google_business_url, providers.youtube_url
--      (providers.website already exists, with its check from 20261030000000.)
--   2. Format checks with exactly the patterns in packages/shared/src/links.ts (links.test.ts reads this
--      file and compares them):
--        google_business_url  https://g.page/<name> | https://g.page/r/<id> | https://maps.app.goo.gl/<id>
--                             | https://www.google.com/maps/place/<path> | https://business.google.com/<path>,
--                             no query or fragment, no path segment starting with a dot, no "//" after the
--                             host, at most 600 characters
--        youtube_url          https://www.youtube.com/@<handle> | https://www.youtube.com/channel/UC<22>
--        guides.website       the website form (as providers.website), not a blocked host (chat links,
--                             link-in-bio pages, short links, and Facebook, Instagram, Google, YouTube and
--                             TikTok, which have their own fields, Messenger and Discord invites), and no
--                             Tanzanian phone number anywhere in it (255 or 0, then 6 or 7, then 8 digits)
--        providers.website    providers_website_format from 20261030000000 stays as it is (validated). The
--                             same block and phone rules run in a BEFORE trigger
--                             (private.guard_provider_website), only when the website is set or changed,
--                             so websites already on live never block other saves
--        providers.facebook_url / instagram_url / tiktok_url   the same rules as the guides' columns
--      The columns are new and empty, so the checks are added validated (nothing to clean first).
--   3. Switch: feature.profile_links (seeded on, legal 'none', if S1 has not seeded it already). While it
--      is off, signed-in members cannot set the new links (clearing one is always allowed); admins and
--      server jobs are not limited. A switch never deletes data. Instagram, Facebook and TikTok on guides
--      are not switched: they existed before.
--   4. The admin alert for link changes on approved profiles (private.on_guide_link_changed and
--      private.on_provider_link_changed from 20261030000000) now covers the new columns too, and a change
--      is never dropped: it is added to an alert that nobody has claimed yet, and an alert that comes
--      within 15 minutes of one already sent is held until those 15 minutes are over.
--
-- Optional, read-only: this lists business websites already on live that the new rules would refuse if
-- they were typed in now. Nothing fails because of them (the trigger only checks a website when it is set
-- or changed); an admin may want to correct or clear them with the owner:
--
--   select id, business_name, website from public.providers
--    where website is not null and (
--      website ~ '^https://([a-z0-9-]+\.)*(wa\.me|wa\.link|whatsapp\.com|whatsapp\.net|t\.me|telegram\.me|telegram\.org|telegram\.dog|m\.me|ig\.me|signal\.me|viber\.me|invite\.viber\.com|messenger\.com|discord\.gg|linktr\.ee|tr\.ee|beacons\.ai|bio\.link|lnk\.bio|bit\.ly|bitly\.com|tinyurl\.com|goo\.gl|t\.co|t\.ly|s\.id|bl\.ink|j\.mp|ow\.ly|is\.gd|buff\.ly|cutt\.ly|rb\.gy|tiny\.cc|shorturl\.at|rebrand\.ly|lnkd\.in|fb\.me|qrco\.de|snip\.ly|youtu\.be|g\.page|facebook\.com|fb\.com|instagram\.com|youtube\.com|tiktok\.com|google\.([a-z]{2,63}|com?\.[a-z]{2}))(/|$)|^https://([a-z0-9-]+\.)*discord(app)?\.com/invite(/|$)'
--      or website ~ '(^|[^0-9])(\+|%2[bB]|00)?(2([^0-9a-z]|%[0-9a-fA-F]{2}){0,2}5([^0-9a-z]|%[0-9a-fA-F]{2}){0,2}5|0)([^0-9a-z]|%[0-9a-fA-F]{2}){0,2}[67](([^0-9a-z]|%[0-9a-fA-F]{2}){0,2}[0-9]){8}([^0-9]|$)');
--
--
-- Access rules: unchanged. Owners already update their own guides and providers rows ("Owners update own
-- guide profile" and the providers owner policy); everyone already reads approved guides and providers.
-- These are public links on public pages; nothing private is added. The admin-only fields keep their guards.
--
-- Tests: supabase/checks/profile_links_tests.sql (one transaction, ends with ROLLBACK; local or test
-- project only).
--
-- Undo (drops the new links; ask Walter first, it deletes what members typed in):
--   drop trigger if exists guides_profile_links_switch on public.guides;
--   drop trigger if exists providers_profile_links_switch on public.providers;
--   drop function if exists private.guard_guide_profile_links_switch();
--   drop function if exists private.guard_provider_profile_links_switch();
--   then re-run section 2 of 20261030000000_profile_link_checks.sql (the two alert functions and the
--   two "after update of" triggers) to put the old alert back;
--   drop trigger if exists providers_website_rules on public.providers;
--   drop function if exists private.guard_provider_website();
--   drop function if exists private.link_alert(uuid, text, text, text[], jsonb, jsonb);
--   drop function if exists private.link_changes(jsonb, jsonb, text[]); and:
--   alter table public.guides drop column if exists google_business_url, drop column if exists youtube_url,
--     drop column if exists website;
--   alter table public.providers drop column if exists facebook_url, drop column if exists instagram_url,
--     drop column if exists tiktok_url, drop column if exists google_business_url, drop column if exists youtube_url;
--   delete from public.site_settings where key = 'feature.profile_links';   -- only if S1 is not applied
-- A softer undo that keeps the data: switch feature.profile_links off.

-- ---------------------------------------------------------------------------
-- 1. Columns and format checks
-- ---------------------------------------------------------------------------
alter table public.guides
  add column if not exists google_business_url text,
  add column if not exists youtube_url text,
  add column if not exists website text;

alter table public.providers
  add column if not exists facebook_url text,
  add column if not exists instagram_url text,
  add column if not exists tiktok_url text,
  add column if not exists google_business_url text,
  add column if not exists youtube_url text;

-- Dropped first so a second paste of this file does not fail half way.
alter table public.guides
  drop constraint if exists guides_google_business_url_format,
  drop constraint if exists guides_youtube_url_format,
  drop constraint if exists guides_website_format;
alter table public.providers
  drop constraint if exists providers_instagram_url_format,
  drop constraint if exists providers_facebook_url_format,
  drop constraint if exists providers_tiktok_url_format,
  drop constraint if exists providers_google_business_url_format,
  drop constraint if exists providers_youtube_url_format;

alter table public.guides
  add constraint guides_google_business_url_format check (
    google_business_url is null or (
      char_length(google_business_url) <= 600
      and google_business_url ~ '^https://(g\.page/(r/)?[A-Za-z0-9_-]{2,100}|maps\.app\.goo\.gl/[A-Za-z0-9]{4,40}|www\.google\.com/maps/place/[A-Za-z0-9%+._,:@!=~/-]{1,560}|business\.google\.com/[A-Za-z0-9_~/-]{1,200})$'
      and google_business_url !~ '/(\.|%2[eE])|^https://[^/]+.*//'
    )
  ),
  add constraint guides_youtube_url_format check (
    youtube_url is null or (
      youtube_url ~ '^https://www\.youtube\.com/(@[a-z0-9._-]{3,30}|channel/UC[A-Za-z0-9_-]{22})$'
      and youtube_url !~ '^https://www\.youtube\.com/@[._-]+$'
    )
  ),
  add constraint guides_website_format check (
    website is null or (
      char_length(website) <= 300
      and website ~ '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{1,59})(/[!-~]*)?$'
      and website !~ '["<>]'
      and strpos(website, '\') = 0
      and website !~ '^https://([a-z0-9-]+\.)*(wa\.me|wa\.link|whatsapp\.com|whatsapp\.net|t\.me|telegram\.me|telegram\.org|telegram\.dog|m\.me|ig\.me|signal\.me|viber\.me|invite\.viber\.com|messenger\.com|discord\.gg|linktr\.ee|tr\.ee|beacons\.ai|bio\.link|lnk\.bio|bit\.ly|bitly\.com|tinyurl\.com|goo\.gl|t\.co|t\.ly|s\.id|bl\.ink|j\.mp|ow\.ly|is\.gd|buff\.ly|cutt\.ly|rb\.gy|tiny\.cc|shorturl\.at|rebrand\.ly|lnkd\.in|fb\.me|qrco\.de|snip\.ly|youtu\.be|g\.page|facebook\.com|fb\.com|instagram\.com|youtube\.com|tiktok\.com|google\.([a-z]{2,63}|com?\.[a-z]{2}))(/|$)|^https://([a-z0-9-]+\.)*discord(app)?\.com/invite(/|$)'
      and website !~ '(^|[^0-9])(\+|%2[bB]|00)?(2([^0-9a-z]|%[0-9a-fA-F]{2}){0,2}5([^0-9a-z]|%[0-9a-fA-F]{2}){0,2}5|0)([^0-9a-z]|%[0-9a-fA-F]{2}){0,2}[67](([^0-9a-z]|%[0-9a-fA-F]{2}){0,2}[0-9]){8}([^0-9]|$)'
    )
  );

alter table public.providers
  add constraint providers_instagram_url_format check (
    instagram_url is null or (
      instagram_url ~ '^https://www\.instagram\.com/[a-z0-9._]{1,30}/$'
      and instagram_url !~ '^https://www\.instagram\.com/(\.+|p|reel|reels|stories|explore|accounts)/$'
    )
  ),
  add constraint providers_facebook_url_format check (
    facebook_url is null or (
      facebook_url ~ '^https://www\.facebook\.com/([a-z0-9.]{5,50}|profile\.php\?id=[0-9]{5,20})$'
      and facebook_url !~ '^https://www\.facebook\.com/(\.+|[a-z0-9.]*\.php|share|sharer|login|logout|groups|watch|events|plugins|pages|people|photo|photos|videos|reels|stories|marketplace|gaming|settings|messages|notifications|friends|hashtag|search|dialog|policies|privacy|business|recover|checkpoint)$'
    )
  ),
  add constraint providers_tiktok_url_format check (
    tiktok_url is null or (
      tiktok_url ~ '^https://www\.tiktok\.com/@[a-z0-9._]{2,24}$'
      and tiktok_url !~ '^https://www\.tiktok\.com/@\.+$'
    )
  ),
  add constraint providers_google_business_url_format check (
    google_business_url is null or (
      char_length(google_business_url) <= 600
      and google_business_url ~ '^https://(g\.page/(r/)?[A-Za-z0-9_-]{2,100}|maps\.app\.goo\.gl/[A-Za-z0-9]{4,40}|www\.google\.com/maps/place/[A-Za-z0-9%+._,:@!=~/-]{1,560}|business\.google\.com/[A-Za-z0-9_~/-]{1,200})$'
      and google_business_url !~ '/(\.|%2[eE])|^https://[^/]+.*//'
    )
  ),
  add constraint providers_youtube_url_format check (
    youtube_url is null or (
      youtube_url ~ '^https://www\.youtube\.com/(@[a-z0-9._-]{3,30}|channel/UC[A-Za-z0-9_-]{22})$'
      and youtube_url !~ '^https://www\.youtube\.com/@[._-]+$'
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Switch: feature.profile_links
-- S1 (20261126000000) seeds every new switch too; whichever runs first wins and the other leaves it.
-- ---------------------------------------------------------------------------
insert into public.site_settings (key, value)
values ('feature.profile_links', '{"on": true, "legal": "none"}')
on conflict (key) do nothing;

-- While the switch is off, a signed-in member cannot put a new value in a switched link (clearing is
-- fine). Security invoker: it only reads the public switch row and the caller's own admin state.
create or replace function private.guard_guide_profile_links_switch()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce((select auth.jwt()) ->> 'role', '') <> 'authenticated' or private.is_admin() or private.feature_on('profile_links') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.google_business_url is not null or new.youtube_url is not null or new.website is not null then
      raise exception 'profile_links_off' using errcode = 'P0001', hint = 'Profile links are switched off.';
    end if;
  elsif (new.google_business_url is not null and new.google_business_url is distinct from old.google_business_url)
     or (new.youtube_url is not null and new.youtube_url is distinct from old.youtube_url)
     or (new.website is not null and new.website is distinct from old.website) then
    raise exception 'profile_links_off' using errcode = 'P0001', hint = 'Profile links are switched off.';
  end if;
  return new;
end;
$$;

create or replace function private.guard_provider_profile_links_switch()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce((select auth.jwt()) ->> 'role', '') <> 'authenticated' or private.is_admin() or private.feature_on('profile_links') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.facebook_url is not null or new.instagram_url is not null or new.tiktok_url is not null
       or new.google_business_url is not null or new.youtube_url is not null then
      raise exception 'profile_links_off' using errcode = 'P0001', hint = 'Profile links are switched off.';
    end if;
  elsif (new.facebook_url is not null and new.facebook_url is distinct from old.facebook_url)
     or (new.instagram_url is not null and new.instagram_url is distinct from old.instagram_url)
     or (new.tiktok_url is not null and new.tiktok_url is distinct from old.tiktok_url)
     or (new.google_business_url is not null and new.google_business_url is distinct from old.google_business_url)
     or (new.youtube_url is not null and new.youtube_url is distinct from old.youtube_url) then
    raise exception 'profile_links_off' using errcode = 'P0001', hint = 'Profile links are switched off.';
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_guide_profile_links_switch() from public, anon, authenticated;
revoke execute on function private.guard_provider_profile_links_switch() from public, anon, authenticated;

drop trigger if exists guides_profile_links_switch on public.guides;
create trigger guides_profile_links_switch
  before insert or update of google_business_url, youtube_url, website on public.guides
  for each row execute function private.guard_guide_profile_links_switch();

drop trigger if exists providers_profile_links_switch on public.providers;
create trigger providers_profile_links_switch
  before insert or update of facebook_url, instagram_url, tiktok_url, google_business_url, youtube_url on public.providers
  for each row execute function private.guard_provider_profile_links_switch();

-- ---------------------------------------------------------------------------
-- 3. providers.website: the same block and phone rules as guides.website (security review L4, N3)
-- providers_website_format from 20261030000000 is kept as it is (validated). The extra rules are a
-- trigger, not a constraint, so they only look at a website when it is set or changed (always on insert):
-- a website already on live never blocks a save of something else. Applies to everyone, admins included.
-- Owners get the code 'website_not_allowed' and a message that this website is not allowed.
-- ---------------------------------------------------------------------------
create or replace function private.guard_provider_website()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.website is null or (tg_op = 'UPDATE' and new.website is not distinct from old.website) then
    return new;
  end if;
  if new.website ~ '^https://([a-z0-9-]+\.)*(wa\.me|wa\.link|whatsapp\.com|whatsapp\.net|t\.me|telegram\.me|telegram\.org|telegram\.dog|m\.me|ig\.me|signal\.me|viber\.me|invite\.viber\.com|messenger\.com|discord\.gg|linktr\.ee|tr\.ee|beacons\.ai|bio\.link|lnk\.bio|bit\.ly|bitly\.com|tinyurl\.com|goo\.gl|t\.co|t\.ly|s\.id|bl\.ink|j\.mp|ow\.ly|is\.gd|buff\.ly|cutt\.ly|rb\.gy|tiny\.cc|shorturl\.at|rebrand\.ly|lnkd\.in|fb\.me|qrco\.de|snip\.ly|youtu\.be|g\.page|facebook\.com|fb\.com|instagram\.com|youtube\.com|tiktok\.com|google\.([a-z]{2,63}|com?\.[a-z]{2}))(/|$)|^https://([a-z0-9-]+\.)*discord(app)?\.com/invite(/|$)'
     or new.website ~ '(^|[^0-9])(\+|%2[bB]|00)?(2([^0-9a-z]|%[0-9a-fA-F]{2}){0,2}5([^0-9a-z]|%[0-9a-fA-F]{2}){0,2}5|0)([^0-9a-z]|%[0-9a-fA-F]{2}){0,2}[67](([^0-9a-z]|%[0-9a-fA-F]{2}){0,2}[0-9]){8}([^0-9]|$)' then
    raise exception 'website_not_allowed' using errcode = 'P0001',
      hint = 'Chat links, link-in-bio pages, short links, social and Google pages and phone numbers cannot be a website.';
  end if;
  return new;
end;
$$;

revoke execute on function private.guard_provider_website() from public, anon, authenticated;

drop trigger if exists providers_website_rules on public.providers;
create trigger providers_website_rules
  before insert or update of website on public.providers
  for each row execute function private.guard_provider_website();

-- ---------------------------------------------------------------------------
-- 4. Admin alert when an approved guide or business changes a link (now every link column)
-- Same rules as 20261030000000: SECURITY DEFINER so it can call notify_admins; the caller's role is read
-- from the JWT, so only signed-in members (not admins, server jobs or the SQL editor) raise the alert.
-- No change is dropped (security review M3, N1, N2):
--   - A change is added to a pending alert for the same profile that the sender has not claimed (the
--     sender claims a row by raising attempts and setting locked_until to now + 2 minutes): created in the
--     last 15 minutes, or held (see below). The earliest "before" and the latest "after" are kept.
--   - Otherwise a new alert is written. If an alert for this profile was sent in the last 15 minutes, the
--     new one is held: locked_until = that sent_at + 15 minutes, so the sender does not take it before
--     then and later changes are added to it. At most one alert per profile every 15 minutes goes out.
--   - The "changes" text keeps its newest end if it ever passes 4000 characters (N4).
-- ---------------------------------------------------------------------------
create or replace function private.link_alert(p_ref uuid, p_kind text, p_name text, p_changes text[], p_before jsonb, p_after jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merged int;
  v_last_sent timestamptz;
begin
  if coalesce(cardinality(p_changes), 0) = 0 then
    return;
  end if;
  update public.notification_outbox o
     set payload = o.payload || jsonb_build_object(
           'changes', right(concat_ws('; ', nullif(o.payload ->> 'changes', ''), array_to_string(p_changes, '; ')), 4000),
           'before', p_before || coalesce(o.payload -> 'before', '{}'::jsonb),
           'after', coalesce(o.payload -> 'after', '{}'::jsonb) || p_after)
   where o.event = 'link_changed'
     and o.payload ->> 'ref' = p_ref::text
     and o.status = 'pending'
     and (o.attempts = 0 or o.locked_until is null or o.locked_until < now())
     and (o.created_at > now() - interval '15 minutes' or (o.attempts = 0 and o.locked_until > now()));
  get diagnostics v_merged = row_count;
  if v_merged > 0 then
    return;
  end if;

  select max(o.sent_at) into v_last_sent
    from public.notification_outbox o
   where o.event = 'link_changed'
     and o.payload ->> 'ref' = p_ref::text
     and o.status = 'sent'
     and o.sent_at > now() - interval '15 minutes';

  perform private.notify_admins('link_changed', jsonb_build_object(
    'ref', p_ref, 'kind', p_kind, 'name', p_name,
    'changes', right(array_to_string(p_changes, '; '), 4000), 'before', p_before, 'after', p_after,
    'link', '/admin'));

  if v_last_sent is not null then
    update public.notification_outbox o
       set locked_until = v_last_sent + interval '15 minutes'
     where o.event = 'link_changed'
       and o.payload ->> 'ref' = p_ref::text
       and o.status = 'pending'
       and o.attempts = 0
       and o.locked_until is null
       and o.created_at = now();
  end if;
end;
$$;

-- The changed link columns of one row: "X was A, now B" lines and before/after objects.
create or replace function private.link_changes(p_old jsonb, p_new jsonb, p_columns text[],
  out changes text[], out before jsonb, out after jsonb)
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_col text;
  v_label text;
begin
  changes := '{}';
  before := '{}';
  after := '{}';
  foreach v_col in array p_columns loop
    if (p_new ->> v_col) is distinct from (p_old ->> v_col) then
      v_label := case v_col
        when 'instagram_url' then 'Instagram' when 'facebook_url' then 'Facebook' when 'tiktok_url' then 'TikTok'
        when 'google_business_url' then 'Google' when 'youtube_url' then 'YouTube' else 'Website' end;
      changes := changes || format('%s was %s, now %s', v_label, coalesce(p_old ->> v_col, 'empty'), coalesce(p_new ->> v_col, 'empty'));
      before := before || jsonb_build_object(v_col, p_old -> v_col);
      after := after || jsonb_build_object(v_col, p_new -> v_col);
    end if;
  end loop;
end;
$$;

create or replace function private.on_guide_link_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
begin
  if coalesce((select auth.jwt()) ->> 'role', '') <> 'authenticated' or private.is_admin() then
    return new;
  end if;
  if old.verification_status <> 'approved' or new.is_sample then
    return new;
  end if;
  select * into v from private.link_changes(to_jsonb(old), to_jsonb(new),
    array['instagram_url', 'facebook_url', 'tiktok_url', 'google_business_url', 'youtube_url', 'website']);
  perform private.link_alert(new.id, 'Guide', new.display_name, v.changes, v.before, v.after);
  return new;
end;
$$;

create or replace function private.on_provider_link_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
begin
  if coalesce((select auth.jwt()) ->> 'role', '') <> 'authenticated' or private.is_admin() then
    return new;
  end if;
  if old.verification_status <> 'approved' or new.is_sample then
    return new;
  end if;
  select * into v from private.link_changes(to_jsonb(old), to_jsonb(new),
    array['website', 'instagram_url', 'facebook_url', 'tiktok_url', 'google_business_url', 'youtube_url']);
  perform private.link_alert(new.id, 'Business', new.business_name, v.changes, v.before, v.after);
  return new;
end;
$$;

revoke execute on function private.link_alert(uuid, text, text, text[], jsonb, jsonb) from public, anon, authenticated;
revoke execute on function private.link_changes(jsonb, jsonb, text[]) from public, anon, authenticated;
revoke execute on function private.on_guide_link_changed() from public, anon, authenticated;
revoke execute on function private.on_provider_link_changed() from public, anon, authenticated;

drop trigger if exists guides_link_changed on public.guides;
create trigger guides_link_changed
  after update of instagram_url, facebook_url, tiktok_url, google_business_url, youtube_url, website on public.guides
  for each row execute function private.on_guide_link_changed();

drop trigger if exists providers_link_changed on public.providers;
create trigger providers_link_changed
  after update of website, instagram_url, facebook_url, tiktok_url, google_business_url, youtube_url on public.providers
  for each row execute function private.on_provider_link_changed();
