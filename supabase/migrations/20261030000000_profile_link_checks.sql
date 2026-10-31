-- Profile link checks (security review 2026-10-30, findings H1, M1 and L3).
--
-- The website, the app and the admin pages now clean every profile link with the shared rules in
-- packages/shared/src/links.ts (normaliseSocial, normaliseWebsite, normaliseTripadvisor) and store
-- only the canonical form. Owners can also write to guides and providers directly through the API,
-- so the database now refuses anything that is not in that canonical form:
--
--   guides.instagram_url   https://www.instagram.com/<name>/       name [a-z0-9._]{1,30}, not p, reel,
--                                                                   reels, stories, explore, accounts
--   guides.facebook_url    https://www.facebook.com/<name>         name [a-z0-9.]{5,50}, not l.php, share,
--                          https://www.facebook.com/profile.php?id=<5-20 digits>   sharer, login, ... *.php
--   guides.tiktok_url      https://www.tiktok.com/@<name>          name [a-z0-9._]{2,24}
--   providers.website      https://<lower-case public host>[/<printable ASCII>], at most 300 characters,
--   tour_operators.website   no spaces, quotes, < > or backslash
--   tour_operators.tripadvisor_url   the same, on a tripadvisor host, at most 400 characters
--   call_requests.meeting_link       the website form, at most 300 characters (the guide's call link)
--
-- links.test.ts reads this file and checks that these patterns are exactly the ones the shared
-- code uses, so change both together.
--
-- The constraints are NOT VALID: rows that already exist are not checked when this runs, but any
-- later UPDATE of such a row (even of another column, e.g. a guide saving another step) fails until
-- its links are fixed. So before applying, run this read-only count:
--
--   select 'guides.instagram_url' as field, count(*) from public.guides
--    where instagram_url is not null and not (instagram_url ~ '^https://www\.instagram\.com/[a-z0-9._]{1,30}/$'
--      and instagram_url !~ '^https://www\.instagram\.com/(\.+|p|reel|reels|stories|explore|accounts)/$')
--   union all
--   select 'guides.facebook_url', count(*) from public.guides
--    where facebook_url is not null and not (facebook_url ~ '^https://www\.facebook\.com/([a-z0-9.]{5,50}|profile\.php\?id=[0-9]{5,20})$'
--      and facebook_url !~ '^https://www\.facebook\.com/(\.+|[a-z0-9.]*\.php|share|sharer|login|logout|groups|watch|events|plugins|pages|people|photo|photos|videos|reels|stories|marketplace|gaming|settings|messages|notifications|friends|hashtag|search|dialog|policies|privacy|business|recover|checkpoint)$')
--   union all
--   select 'guides.tiktok_url', count(*) from public.guides
--    where tiktok_url is not null and not (tiktok_url ~ '^https://www\.tiktok\.com/@[a-z0-9._]{2,24}$'
--      and tiktok_url !~ '^https://www\.tiktok\.com/@\.+$')
--   union all
--   select 'providers.website', count(*) from public.providers
--    where website is not null and not (char_length(website) <= 300
--      and website ~ '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{1,59})(/[!-~]*)?$'
--      and website !~ '["<>]' and strpos(website, '\') = 0)
--   union all
--   select 'tour_operators.website', count(*) from public.tour_operators
--    where website is not null and not (char_length(website) <= 300
--      and website ~ '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{1,59})(/[!-~]*)?$'
--      and website !~ '["<>]' and strpos(website, '\') = 0)
--   union all
--   select 'tour_operators.tripadvisor_url', count(*) from public.tour_operators
--    where tripadvisor_url is not null and not (char_length(tripadvisor_url) <= 400
--      and tripadvisor_url ~ '^https://(www\.|[a-z]{2}\.)?tripadvisor\.(com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})(/[!-~]*)?$'
--      and tripadvisor_url !~ '["<>]' and strpos(tripadvisor_url, '\') = 0)
--   union all
--   select 'call_requests.meeting_link', count(*) from public.call_requests
--    where meeting_link is not null and not (char_length(meeting_link) <= 300
--      and meeting_link ~ '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{1,59})(/[!-~]*)?$'
--      and meeting_link !~ '["<>]' and strpos(meeting_link, '\') = 0);
--
-- If any count is above 0: list those rows (same WHERE, selecting id and the link), and an admin
-- re-saves them through the admin pages or the owner re-saves them (the save paths store the
-- canonical form). Nothing here changes or removes existing links. Once every count is 0,
-- the constraints can be validated:
--   alter table public.guides validate constraint guides_instagram_url_format; (and the others)
--
-- Also: an admin alert (event 'link_changed', admins only) when a guide or owner changes a link
-- after their profile or listing was approved. The message text is in supabase/functions/notify,
-- which needs to be deployed for the alert to read well (until then it falls back to the generic
-- "Kwetuly update").
--
-- Undo:
--   drop trigger if exists guides_link_changed on public.guides;
--   drop trigger if exists providers_link_changed on public.providers;
--   drop function if exists private.on_guide_link_changed();
--   drop function if exists private.on_provider_link_changed();
--   drop function if exists private.link_alert_recent(uuid);
--   alter table public.guides drop constraint if exists guides_instagram_url_format,
--     drop constraint if exists guides_facebook_url_format, drop constraint if exists guides_tiktok_url_format;
--   alter table public.providers drop constraint if exists providers_website_format;
--   alter table public.tour_operators drop constraint if exists tour_operators_website_format,
--     drop constraint if exists tour_operators_tripadvisor_url_format;
--   alter table public.call_requests drop constraint if exists call_requests_meeting_link_format;

-- ---------------------------------------------------------------------------
-- 1. Format checks
-- ---------------------------------------------------------------------------
alter table public.guides
  add constraint guides_instagram_url_format check (
    instagram_url is null or (
      instagram_url ~ '^https://www\.instagram\.com/[a-z0-9._]{1,30}/$'
      and instagram_url !~ '^https://www\.instagram\.com/(\.+|p|reel|reels|stories|explore|accounts)/$'
    )
  ) not valid,
  add constraint guides_facebook_url_format check (
    facebook_url is null or (
      facebook_url ~ '^https://www\.facebook\.com/([a-z0-9.]{5,50}|profile\.php\?id=[0-9]{5,20})$'
      and facebook_url !~ '^https://www\.facebook\.com/(\.+|[a-z0-9.]*\.php|share|sharer|login|logout|groups|watch|events|plugins|pages|people|photo|photos|videos|reels|stories|marketplace|gaming|settings|messages|notifications|friends|hashtag|search|dialog|policies|privacy|business|recover|checkpoint)$'
    )
  ) not valid,
  add constraint guides_tiktok_url_format check (
    tiktok_url is null or (
      tiktok_url ~ '^https://www\.tiktok\.com/@[a-z0-9._]{2,24}$'
      and tiktok_url !~ '^https://www\.tiktok\.com/@\.+$'
    )
  ) not valid;

-- The old check (website ~ '^https://') stays; this one is stricter.
alter table public.providers
  add constraint providers_website_format check (
    website is null or (
      char_length(website) <= 300
      and website ~ '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{1,59})(/[!-~]*)?$'
      and website !~ '["<>]'
      and strpos(website, '\') = 0
    )
  ) not valid;

-- Only admins write tour operators, but the pages link to these, so the same rules apply.
alter table public.tour_operators
  add constraint tour_operators_website_format check (
    website is null or (
      char_length(website) <= 300
      and website ~ '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{1,59})(/[!-~]*)?$'
      and website !~ '["<>]'
      and strpos(website, '\') = 0
    )
  ) not valid,
  add constraint tour_operators_tripadvisor_url_format check (
    tripadvisor_url is null or (
      char_length(tripadvisor_url) <= 400
      and tripadvisor_url ~ '^https://(www\.|[a-z]{2}\.)?tripadvisor\.(com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})(/[!-~]*)?$'
      and tripadvisor_url !~ '["<>]'
      and strpos(tripadvisor_url, '\') = 0
    )
  ) not valid;

-- The link a guide gives for an accepted prep call (shown to the traveller).
alter table public.call_requests
  add constraint call_requests_meeting_link_format check (
    meeting_link is null or (
      char_length(meeting_link) <= 300
      and meeting_link ~ '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{1,59})(/[!-~]*)?$'
      and meeting_link !~ '["<>]'
      and strpos(meeting_link, '\') = 0
    )
  ) not valid;

-- ---------------------------------------------------------------------------
-- 2. Admin alert when an approved guide or business changes a link
-- These are SECURITY DEFINER (like the other alert triggers) so they can call notify_admins, which
-- means current_user is the owner here and private.is_trusted() would always say yes. So the
-- request's own role is read from the JWT instead: only signed-in users (not admins, not server
-- jobs or the SQL editor) raise the alert.
-- ---------------------------------------------------------------------------
-- At most one alert per guide or business every 15 minutes (a guide saving several times in a row
-- should not flood the admins). The alert shows each link as "was X, now Y".
create or replace function private.link_alert_recent(p_ref uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.notification_outbox o
    where o.event = 'link_changed'
      and o.payload ->> 'ref' = p_ref::text
      and o.created_at > now() - interval '15 minutes'
  );
$$;

create or replace function private.on_guide_link_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes text[] := '{}';
  v_before jsonb := '{}';
  v_after jsonb := '{}';
begin
  if coalesce((select auth.jwt()) ->> 'role', '') <> 'authenticated' or private.is_admin() then
    return new;
  end if;
  if old.verification_status <> 'approved' or new.is_sample then
    return new;
  end if;
  if new.instagram_url is distinct from old.instagram_url then
    v_changes := v_changes || format('Instagram was %s, now %s', coalesce(old.instagram_url, 'empty'), coalesce(new.instagram_url, 'empty'));
    v_before := v_before || jsonb_build_object('instagram_url', old.instagram_url);
    v_after := v_after || jsonb_build_object('instagram_url', new.instagram_url);
  end if;
  if new.facebook_url is distinct from old.facebook_url then
    v_changes := v_changes || format('Facebook was %s, now %s', coalesce(old.facebook_url, 'empty'), coalesce(new.facebook_url, 'empty'));
    v_before := v_before || jsonb_build_object('facebook_url', old.facebook_url);
    v_after := v_after || jsonb_build_object('facebook_url', new.facebook_url);
  end if;
  if new.tiktok_url is distinct from old.tiktok_url then
    v_changes := v_changes || format('TikTok was %s, now %s', coalesce(old.tiktok_url, 'empty'), coalesce(new.tiktok_url, 'empty'));
    v_before := v_before || jsonb_build_object('tiktok_url', old.tiktok_url);
    v_after := v_after || jsonb_build_object('tiktok_url', new.tiktok_url);
  end if;
  if cardinality(v_changes) > 0 and not private.link_alert_recent(new.id) then
    perform private.notify_admins('link_changed', jsonb_build_object(
      'ref', new.id, 'kind', 'Guide', 'name', new.display_name,
      'changes', array_to_string(v_changes, '; '), 'before', v_before, 'after', v_after,
      'link', '/admin'));
  end if;
  return new;
end;
$$;

create or replace function private.on_provider_link_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.jwt()) ->> 'role', '') <> 'authenticated' or private.is_admin() then
    return new;
  end if;
  if old.verification_status <> 'approved' or new.is_sample then
    return new;
  end if;
  if new.website is distinct from old.website and not private.link_alert_recent(new.id) then
    perform private.notify_admins('link_changed', jsonb_build_object(
      'ref', new.id, 'kind', 'Business', 'name', new.business_name,
      'changes', format('Website was %s, now %s', coalesce(old.website, 'empty'), coalesce(new.website, 'empty')),
      'before', jsonb_build_object('website', old.website), 'after', jsonb_build_object('website', new.website),
      'link', '/admin'));
  end if;
  return new;
end;
$$;

revoke execute on function private.link_alert_recent(uuid) from public, anon, authenticated;
revoke execute on function private.on_guide_link_changed() from public, anon, authenticated;
revoke execute on function private.on_provider_link_changed() from public, anon, authenticated;

create trigger guides_link_changed
  after update of instagram_url, facebook_url, tiktok_url on public.guides
  for each row execute function private.on_guide_link_changed();

create trigger providers_link_changed
  after update of website on public.providers
  for each row execute function private.on_provider_link_changed();
