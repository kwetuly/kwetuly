-- ALREADY APPLIED ON LIVE (history version 20261031214101, name feature_switches). Recovered on
-- 2026-11-22 from the live project's migration history with read-only queries (slice 0, "repo matches
-- live", docs/team/design-reservations-and-trip-record-2026-11-22.md). The SQL below is the statement
-- stored in supabase_migrations.schema_migrations, unchanged; only these comments are new. The live
-- objects were compared after recovery: private.feature_on body, the site_settings_feature_shape check
-- and the 17 feature.* rows match.
-- Do NOT paste this on live again (it is harmless if someone does: every statement is idempotent).
--
-- What it does:
--   1. site_settings rows whose key starts with "feature." must look like {"on": true|false}.
--   2. private.feature_on(id): true only when the row feature.<id> exists with "on": true (missing row =
--      off, fail closed). Security invoker, empty search_path; anon and authenticated may call it
--      (site_settings is publicly readable already).
--   3. Seeds the feature switches. feature.payments_live starts off.
--
-- Access rules: unchanged. site_settings keeps "Anyone reads site settings" and "Admins manage site
-- settings".
--
-- Undo (only if no policy or code uses feature_on; public.stories does, see 20261101000249_stories.sql):
--   drop function private.feature_on(text);
--   alter table public.site_settings drop constraint if exists site_settings_feature_shape;
--   delete from public.site_settings where key like 'feature.%';   -- deletes the switches

alter table public.site_settings drop constraint if exists site_settings_feature_shape;
alter table public.site_settings add constraint site_settings_feature_shape
  check (key not like 'feature.%'
         or (key ~ '^feature\.[a-z][a-z0-9_]{1,40}$'
             and jsonb_typeof(value) = 'object'
             and jsonb_typeof(value -> 'on') = 'boolean'));

create or replace function private.feature_on(p_id text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select (s.value -> 'on') = 'true'::jsonb
       from public.site_settings s
      where s.key = 'feature.' || p_id),
    false);
$$;

comment on function private.feature_on(text) is
  'True when site_settings row feature.<id> has "on": true. Missing row = false (fail closed).';

revoke execute on function private.feature_on(text) from public;
grant execute on function private.feature_on(text) to anon, authenticated;

insert into public.site_settings (key, value) values
  ('feature.experiences',      '{"on": true}'),
  ('feature.stories',          '{"on": true}'),
  ('feature.booking_link',     '{"on": true}'),
  ('feature.proposals',        '{"on": true}'),
  ('feature.ai_drafts',        '{"on": true}'),
  ('feature.ai_assistant',     '{"on": true}'),
  ('feature.teams',            '{"on": true}'),
  ('feature.tips',             '{"on": true}'),
  ('feature.projects',         '{"on": true}'),
  ('feature.academy',          '{"on": true}'),
  ('feature.family_updates',   '{"on": true}'),
  ('feature.training_plans',   '{"on": true}'),
  ('feature.ship_home',        '{"on": true}'),
  ('feature.save_to_travel',   '{"on": true}'),
  ('feature.insurance_rescue', '{"on": true}'),
  ('feature.footage',          '{"on": true}'),
  ('feature.payments_live',    '{"on": false}')
on conflict (key) do nothing;
