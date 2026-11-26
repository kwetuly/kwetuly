-- Feature switches: admin page /admin/features, change log, optional team-only preview, the switch list.
-- Slice W1-1 / S1 (docs/team/board.md "2026-11-26 Build plan"; docs/team/design-2026-11-24.md section 2).
--
-- NOT APPLIED. Order on live: after 20261122200000_reservation_setup, 20261122300000_reservations and
-- 20261123000000_business_chat (feature.reservation_commission_billing comes from 20261122300000).
-- Walter pastes it himself. Every statement is safe to run twice.
--
-- What it does:
--   1. Keeps one mechanism: site_settings rows feature.<id>. The value may now carry
--      {"on": bool, "legal": "pending"|"cleared"|"none", "legal_checked_on": "YYYY-MM-DD"|null,
--       "team_only": bool} and nothing else; "cleared" needs a date. private.feature_on(id) is unchanged
--      (missing row = off, fail closed).
--   2. private.feature_visible(id): on, or a team-only preview that only admins (two-step) see.
--   3. private.feature_switch_log: every insert, change and delete of a feature.* row, with who (auth.uid(),
--      null = migration or SQL editor), old and new value, when. Append-only for everyone. Admins read it
--      through public.admin_feature_log(limit, id) and public.admin_feature_last_changes().
--   4. Guard on site_settings for signed-in callers (anon/authenticated, which includes admins through
--      the API): no new feature.* rows (new switches come by migration), no deletes, no renames, and
--      feature.payments_live can never be switched on. Database roles
--      (SQL editor, service role) are not limited: going live with payments stays Walter's own SQL.
--   5. public.admin_set_feature(id, on, legal, legal_checked_on, team_only): security invoker, admins with
--      two-step only, known ids only, validates every value, writes the row (the guard and the log apply).
--   6. Data: existing rows keep their "on" value and get "legal" ("pending" for the board's "legal check
--      pending" list), "legal_checked_on": null and "team_only": false. Walter (2026-11-26): every
--      feature is public, Part B included, so nothing starts as a team-only preview; save_to_travel stays
--      ON and listed (legal check pending). feature.payments_live stays off and locked. 52 new rows
--      start ON, each with its legal flag. List and names:
--      packages/shared/src/features.ts (a test checks the two match).
--
-- Access rules: site_settings keeps "Anyone reads site settings" and "Admins manage site settings"; the
-- guard narrows what signed-in callers may do to feature.* rows. feature_switch_log is in the private
-- schema (not exposed by the API), RLS on, no grants; read only through the two admin functions.
--
-- Undo (no data loss for the switches themselves; the log is dropped):
--   drop trigger if exists site_settings_feature_guard on public.site_settings;
--   drop trigger if exists site_settings_feature_log on public.site_settings;
--   drop function if exists public.admin_set_feature(text, boolean, text, date, boolean);
--   drop function if exists public.admin_feature_log(integer, text);
--   drop function if exists public.admin_feature_last_changes();
--   drop function if exists private.feature_visible(text);
--   drop function if exists private.site_settings_feature_guard();
--   drop function if exists private.site_settings_feature_log();
--   drop table if exists private.feature_switch_log;   -- the trigger on it goes with it
--   drop function if exists private.feature_switch_log_append_only();
--   update public.site_settings set value = jsonb_build_object('on', value -> 'on') where key like 'feature.%';
--   then re-create site_settings_feature_shape from 20261031214101_feature_switches.sql.
--   The 52 new rows can stay (nothing reads them until their slice ships) or be deleted by key.

-- ---------------------------------------------------------------------------
-- 1. Shape of feature.* rows
-- ---------------------------------------------------------------------------
alter table public.site_settings drop constraint if exists site_settings_feature_shape;
alter table public.site_settings add constraint site_settings_feature_shape
  check (key not like 'feature.%'
         or (key ~ '^feature\.[a-z][a-z0-9_]{1,40}$'
             and jsonb_typeof(value) = 'object'
             and jsonb_typeof(value -> 'on') = 'boolean'
             and (value - array['on', 'legal', 'legal_checked_on', 'team_only']) = '{}'::jsonb
             and (not (value ? 'legal') or value ->> 'legal' in ('pending', 'cleared', 'none'))
             and (not (value ? 'team_only') or jsonb_typeof(value -> 'team_only') = 'boolean')
             and (not (value ? 'legal_checked_on')
                  or jsonb_typeof(value -> 'legal_checked_on') = 'null'
                  or (jsonb_typeof(value -> 'legal_checked_on') = 'string'
                      and value ->> 'legal_checked_on' ~ '^\d{4}-\d{2}-\d{2}$'))
             and (coalesce(value ->> 'legal', 'none') <> 'cleared'
                  or jsonb_typeof(value -> 'legal_checked_on') = 'string')));

-- ---------------------------------------------------------------------------
-- 2. Team-only preview
-- ---------------------------------------------------------------------------
create or replace function private.feature_visible(p_id text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.feature_on(p_id)
    or (coalesce((select (s.value -> 'team_only') = 'true'::jsonb
                    from public.site_settings s
                   where s.key = 'feature.' || p_id), false)
        and private.is_admin());
$$;
comment on function private.feature_visible(text) is
  'feature_on(id), or the row is team_only and the caller is an admin with two-step sign-in (preview).';
revoke execute on function private.feature_visible(text) from public;
grant execute on function private.feature_visible(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Change log (append-only)
-- ---------------------------------------------------------------------------
create table if not exists private.feature_switch_log (
  id bigint generated always as identity primary key,
  feature_key text not null,
  action text not null check (action in ('created', 'changed', 'deleted')),
  old_value jsonb,
  new_value jsonb,
  changed_by uuid,   -- auth.uid(); null = migration, SQL editor or service role. No foreign key on purpose.
  changed_at timestamptz not null default now()
);
create index if not exists feature_switch_log_key_idx on private.feature_switch_log (feature_key, changed_at desc);
alter table private.feature_switch_log enable row level security;
revoke all on table private.feature_switch_log from public, anon, authenticated;

create or replace function private.feature_switch_log_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'The feature switch log cannot be changed or removed' using errcode = 'P0001';
end;
$$;
revoke execute on function private.feature_switch_log_append_only() from public;
drop trigger if exists feature_switch_log_no_change on private.feature_switch_log;
create trigger feature_switch_log_no_change
  before update or delete on private.feature_switch_log
  for each row execute function private.feature_switch_log_append_only();
drop trigger if exists feature_switch_log_no_truncate on private.feature_switch_log;
create trigger feature_switch_log_no_truncate
  before truncate on private.feature_switch_log
  for each statement execute function private.feature_switch_log_append_only();

-- Writes the log. Security definer only so the trigger can insert into the private log, which signed-in
-- callers cannot touch. Fixed search_path; called by the trigger only.
create or replace function private.site_settings_feature_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.key like 'feature.%' then
      insert into private.feature_switch_log (feature_key, action, old_value, new_value, changed_by)
      values (new.key, 'created', null, new.value, (select auth.uid()));
    end if;
  elsif tg_op = 'UPDATE' then
    if (old.key like 'feature.%' or new.key like 'feature.%')
       and (old.key is distinct from new.key or old.value is distinct from new.value) then
      insert into private.feature_switch_log (feature_key, action, old_value, new_value, changed_by)
      values (new.key, 'changed', old.value, new.value, (select auth.uid()));
    end if;
  elsif old.key like 'feature.%' then
    insert into private.feature_switch_log (feature_key, action, old_value, new_value, changed_by)
    values (old.key, 'deleted', old.value, null, (select auth.uid()));
  end if;
  return null;
end;
$$;
revoke execute on function private.site_settings_feature_log() from public, anon, authenticated;
drop trigger if exists site_settings_feature_log on public.site_settings;
create trigger site_settings_feature_log
  after insert or update or delete on public.site_settings
  for each row execute function private.site_settings_feature_log();

-- ---------------------------------------------------------------------------
-- 4. Guard: what signed-in callers may do to feature.* rows
-- ---------------------------------------------------------------------------
create or replace function private.site_settings_feature_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Database roles (postgres in the SQL editor, service_role) are not limited.
  if current_user not in ('anon', 'authenticated') then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if old.key like 'feature.%' then
      raise exception 'Feature switches are never deleted. Switch it off instead.' using errcode = 'P0001';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.key is distinct from new.key
     and (old.key like 'feature.%' or new.key like 'feature.%') then
    raise exception 'A feature switch cannot be renamed' using errcode = 'P0001';
  end if;

  if new.key not like 'feature.%' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'Unknown feature. New switches are added by a migration.' using errcode = 'P0001';
  end if;

  if new.key = 'feature.payments_live'
     and (new.value -> 'on') = 'true'::jsonb then
    raise exception 'This switch is locked off' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function private.site_settings_feature_guard() from public;
drop trigger if exists site_settings_feature_guard on public.site_settings;
create trigger site_settings_feature_guard
  before insert or update or delete on public.site_settings
  for each row execute function private.site_settings_feature_guard();

-- ---------------------------------------------------------------------------
-- 5. Admin functions
-- ---------------------------------------------------------------------------
-- Change one switch. Security invoker: the admin's own "Admins manage site settings" policy, the guard
-- and the log all apply. null for legal or team_only keeps the current value.
create or replace function public.admin_set_feature(
  p_id text, p_on boolean, p_legal text default null, p_legal_checked_on date default null,
  p_team_only boolean default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_key text;
  v_old jsonb;
  v_legal text;
  v_checked date;
  v_new jsonb;
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  if p_id is null or p_id !~ '^[a-z][a-z0-9_]{1,40}$' then
    raise exception 'unknown feature' using errcode = 'P0001';
  end if;
  if p_on is null then
    raise exception 'on or off is required' using errcode = 'P0001';
  end if;
  if p_legal is not null and p_legal not in ('pending', 'cleared', 'none') then
    raise exception 'legal must be pending, cleared or none' using errcode = 'P0001';
  end if;

  v_key := 'feature.' || p_id;
  select s.value into v_old from public.site_settings s where s.key = v_key for update;
  if not found then
    raise exception 'unknown feature' using errcode = 'P0001';
  end if;
  if p_on and p_id = 'payments_live' then
    raise exception 'This switch is locked off' using errcode = 'P0001';
  end if;

  v_legal := coalesce(p_legal, v_old ->> 'legal', 'none');
  if v_legal = 'cleared' then
    v_checked := coalesce(p_legal_checked_on,
                          case when p_legal is null and v_old ->> 'legal_checked_on' ~ '^\d{4}-\d{2}-\d{2}$'
                               then (v_old ->> 'legal_checked_on')::date end);
    if v_checked is null then
      raise exception 'legal check date is required' using errcode = 'P0001';
    end if;
    if v_checked > (now() at time zone 'Africa/Dar_es_Salaam')::date or v_checked < date '2026-01-01' then
      raise exception 'legal check date out of range' using errcode = 'P0001';
    end if;
  else
    v_checked := null;
  end if;

  v_new := jsonb_build_object(
    'on', p_on,
    'legal', v_legal,
    'legal_checked_on', case when v_checked is null then null else to_char(v_checked, 'YYYY-MM-DD') end,
    'team_only', coalesce(p_team_only, (v_old -> 'team_only') = 'true'::jsonb, false));

  if v_new is distinct from v_old then
    update public.site_settings set value = v_new where key = v_key;
    if not found then
      raise exception 'admins only' using errcode = 'P0001';   -- the update policy refused it
    end if;
  end if;
  return v_new;
end;
$$;
revoke execute on function public.admin_set_feature(text, boolean, text, date, boolean) from public, anon;
grant execute on function public.admin_set_feature(text, boolean, text, date, boolean) to authenticated;

-- The log, newest first, for one switch or all. Security definer to read the private log; admins only.
create or replace function public.admin_feature_log(p_limit integer default 50, p_id text default null)
returns table (id bigint, feature_id text, action text, old_value jsonb, new_value jsonb,
               changed_by_name text, changed_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  return query
    select l.id, substr(l.feature_key, 9), l.action, l.old_value, l.new_value,
           case when l.changed_by is null then 'Database (migration or SQL editor)'
                when pf.id is null then 'Removed account' else coalesce(pf.full_name, 'Admin') end,
           l.changed_at
    from private.feature_switch_log l
    left join public.profiles pf on pf.id = l.changed_by
    where p_id is null or l.feature_key = 'feature.' || p_id
    order by l.changed_at desc, l.id desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;
revoke execute on function public.admin_feature_log(integer, text) from public, anon;
grant execute on function public.admin_feature_log(integer, text) to authenticated;

-- The latest change per switch (who and when), for the rows of the admin page.
create or replace function public.admin_feature_last_changes()
returns table (feature_id text, action text, changed_by_name text, changed_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = 'P0001';
  end if;
  return query
    select distinct on (l.feature_key)
           substr(l.feature_key, 9), l.action,
           case when l.changed_by is null then 'Database (migration or SQL editor)'
                when pf.id is null then 'Removed account' else coalesce(pf.full_name, 'Admin') end,
           l.changed_at
    from private.feature_switch_log l
    left join public.profiles pf on pf.id = l.changed_by
    order by l.feature_key, l.changed_at desc, l.id desc;
end;
$$;
revoke execute on function public.admin_feature_last_changes() from public, anon;
grant execute on function public.admin_feature_last_changes() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Data
-- ---------------------------------------------------------------------------
-- Existing rows: add the legal flag, keep "on" as it is.
update public.site_settings s
   set value = jsonb_build_object(
         'on', s.value -> 'on',
         'legal', coalesce(s.value ->> 'legal', v.legal),
         'legal_checked_on', coalesce(s.value -> 'legal_checked_on', 'null'::jsonb),
         'team_only', coalesce(s.value -> 'team_only', 'false'::jsonb))
  from (values
    ('experiences',                    'none'),
    ('stories',                        'none'),
    ('proposals',                      'none'),
    ('ai_drafts',                      'none'),
    ('ai_assistant',                   'none'),
    ('teams',                          'none'),
    ('projects',                       'none'),
    ('training_plans',                 'none'),
    ('footage',                        'none'),
    ('reservation_commission_billing', 'none'),
    ('booking_link',                   'none'),
    ('family_updates',                 'pending'),
    ('academy',                        'pending'),
    ('payments_live',                  'none'),
    ('save_to_travel',                 'pending'),
    ('tips',                           'pending'),
    ('insurance_rescue',               'pending'),
    ('ship_home',                      'pending')
  ) as v(id, legal)
 where s.key = 'feature.' || v.id
   and not (s.value ? 'legal');

-- New switches: ON (Walter, 2026-11-24). Existing rows with the same key are left alone.
insert into public.site_settings (key, value) values
  ('feature.spa_reservations',       '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.guide_invites',          '{"on": true, "legal": "none", "legal_checked_on": null, "team_only": false}'),
  ('feature.google_checklist',       '{"on": true, "legal": "none", "legal_checked_on": null, "team_only": false}'),
  ('feature.destination_pages',      '{"on": true, "legal": "none", "legal_checked_on": null, "team_only": false}'),
  ('feature.rate_card',              '{"on": true, "legal": "none", "legal_checked_on": null, "team_only": false}'),
  ('feature.verified_reviews',       '{"on": true, "legal": "none", "legal_checked_on": null, "team_only": false}'),
  ('feature.quote_pdf',              '{"on": true, "legal": "none", "legal_checked_on": null, "team_only": false}'),
  ('feature.availability',           '{"on": true, "legal": "none", "legal_checked_on": null, "team_only": false}'),
  ('feature.refund_rules',           '{"on": true, "legal": "none", "legal_checked_on": null, "team_only": false}'),
  ('feature.safety_basics',          '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.trip_planner',           '{"on": true, "legal": "none", "legal_checked_on": null, "team_only": false}'),
  ('feature.group_matching',         '{"on": true, "legal": "none", "legal_checked_on": null, "team_only": false}'),
  ('feature.farm_page',              '{"on": true, "legal": "none", "legal_checked_on": null, "team_only": false}'),
  ('feature.price_alerts',           '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.offline_web',            '{"on": true, "legal": "none", "legal_checked_on": null, "team_only": false}'),
  ('feature.cover_gallery',          '{"on": true, "legal": "none", "legal_checked_on": null, "team_only": false}'),
  ('feature.photo_share',            '{"on": true, "legal": "none", "legal_checked_on": null, "team_only": false}'),
  ('feature.profile_links',          '{"on": true, "legal": "none", "legal_checked_on": null, "team_only": false}'),
  ('feature.local_prices',           '{"on": true, "legal": "none", "legal_checked_on": null, "team_only": false}'),
  ('feature.park_rules',             '{"on": true, "legal": "none", "legal_checked_on": null, "team_only": false}'),
  ('feature.library_picks',          '{"on": true, "legal": "none", "legal_checked_on": null, "team_only": false}'),
  ('feature.vip_hosts',              '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.investment_hosts',       '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.crew_accounts',          '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.crew_porter',            '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.crew_cook',              '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.crew_camp_crew',         '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.crew_driver',            '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.crew_assistant_guide',   '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.crew_other',             '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.driver_guide',           '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.hotel_reps',             '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.service_consultant',     '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.service_concierge',      '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.service_trip_runner',    '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.service_photographer',   '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.service_translator',     '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.marketplace',            '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.marketplace_rentals',    '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.marketplace_checkout',   '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.payments_manual',        '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.split_settlement',       '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.mobile_money',           '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.crew_payouts',           '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.instalments',            '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.meet_and_greet',         '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.transfers_driving',      '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.sim_listings',           '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.operator_channel',       '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.corporate_groups',       '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.jobs_contact_fees',      '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}'),
  ('feature.crew_verification_fees', '{"on": true, "legal": "pending", "legal_checked_on": null, "team_only": false}')
on conflict (key) do nothing;
