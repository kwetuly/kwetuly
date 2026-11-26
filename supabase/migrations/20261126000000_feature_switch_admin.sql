-- Feature switches: admin page /admin/features, admin-only legal state and team preview, change log,
-- money gates, the full switch list. Slice W1-1 / S1 (docs/team/board.md "2026-11-26 Build plan";
-- docs/team/design-2026-11-24.md section 2; security review of W1-1, items M1-M3 and L1-L6).
--
-- NOT APPLIED. Order on live: after 20261122200000_reservation_setup, 20261122300000_reservations and
-- 20261123000000_business_chat (feature.reservation_commission_billing comes from 20261122300000).
-- Walter pastes it himself. Every statement is safe to run twice.
--
-- What it does:
--   1. Public switches stay as they are: site_settings rows feature.<id> = {"on": true|false} and now
--      nothing else (shape check). private.feature_on(id) is unchanged (missing row = off, fail closed).
--   2. Admin-only data moves to private.feature_switch_meta (not exposed by the API, RLS on, no grants):
--      legal ('pending' | 'cleared' | 'none'), legal_checked_on (a real date, not in the future, required
--      for 'cleared'), team_only, who and when. Nobody outside the admin functions can read it, so the
--      legal state of a feature is not public.
--   3. private.feature_visible(id) = feature_on(id), or team_only and the caller is an admin with two-step
--      sign-in (preview). For screens only. MONEY PATHS NEVER USE feature_visible: they use feature_on,
--      money_feature_on or manual_payments_on below. payments_live can never be team_only (check).
--   4. Money gates:
--        private.money_feature_on(id) = feature_on('payments_live') and feature_on(id). For every money
--        path that goes through an API payment provider: split_settlement, mobile_money,
--        marketplace_checkout, instalments, crew_payouts, tips. While payments_live is off they are all off,
--        whatever their own switch says.
--        private.manual_payments_on() = feature_on('payments_manual'). Lipa-number manual payments do NOT
--        depend on payments_live (Walter wants them working now). jobs_contact_fees and
--        crew_verification_fees may be paid by Lipa too; the payer is always the operator or the vouching
--        guide, never the job seeker or the porter (2026-11-21 decision 6). That rule belongs in the
--        function that charges, not in the switch.
--   5. private.feature_switch_log: every change of a public switch (kind 'switch') and of the admin data
--      (kind 'meta'), with who (auth.uid(); null = migration, SQL editor or service role), old and new value,
--      when. Append-only for everyone. Admins read it through admin_feature_log and admin_feature_last_changes.
--   6. Guard on site_settings, decided on the request's role (JWT role anon or authenticated, which includes
--      admins through the API and the admin functions below): no new, deleted or renamed feature.* rows
--      (new switches come by migration), and feature.payments_live can never be switched on. The SQL editor
--      and the service role are not limited: going live with payments stays Walter's own SQL.
--   7. public.admin_set_feature(id, on, legal, legal_checked_on, team_only) and public.admin_feature_rows():
--      security definer (they write and read the private table), admins with two-step sign-in only, known
--      ids only, every value checked; payments_live refuses on and team_only.
--   8. Data (Walter, 2026-11-24 and 2026-11-26: every feature public, Part B included; nothing starts as a
--      team-only preview). Existing rows keep their "on" value. 52 new rows start ON. Two switches are OFF
--      and stay off: payments_live (locked) and reservation_commission_billing (unchanged from
--      20261122300000; it starts billing businesses, so Walter switches it on himself). save_to_travel stays
--      ON. Legal flag per id as in packages/shared/src/features.ts (a test checks the two match).
--
-- Access rules: site_settings keeps "Anyone reads site settings" and "Admins manage site settings"; the
-- guard narrows what API callers may do to feature.* rows. feature_switch_meta and feature_switch_log: no
-- grants to anon or authenticated, read and written only through the security definer functions here.
--
-- Undo (the public switches and their on/off values stay; the admin data and the log are dropped):
--   drop trigger if exists site_settings_feature_guard on public.site_settings;
--   drop trigger if exists site_settings_feature_log on public.site_settings;
--   drop function if exists public.admin_set_feature(text, boolean, text, date, boolean);
--   drop function if exists public.admin_feature_rows();
--   drop function if exists public.admin_feature_log(integer, text);
--   drop function if exists public.admin_feature_last_changes();
--   drop function if exists public.feature_visible(text), private.feature_visible(text);
--   drop function if exists private.money_feature_on(text);
--   drop function if exists private.manual_payments_on();
--   drop table if exists private.feature_switch_meta;   -- its triggers go with it
--   drop table if exists private.feature_switch_log;
--   drop function if exists private.site_settings_feature_guard(), private.site_settings_feature_log(),
--     private.feature_switch_meta_guard(), private.feature_switch_meta_log(),
--     private.feature_switch_log_append_only(), private.request_is_api();
--   then re-create site_settings_feature_shape from 20261031214101_feature_switches.sql.
--   The 52 new rows can stay (nothing reads them until their slice ships) or be deleted by key.

-- ---------------------------------------------------------------------------
-- 1. Public rows: exactly {"on": bool}
-- ---------------------------------------------------------------------------
alter table public.site_settings drop constraint if exists site_settings_feature_shape;
alter table public.site_settings add constraint site_settings_feature_shape
  check (key not like 'feature.%'
         or (key ~ '^feature\.[a-z][a-z0-9_]{1,40}$'
             and jsonb_typeof(value) = 'object'
             and jsonb_typeof(value -> 'on') = 'boolean'
             and (value - 'on') = '{}'::jsonb));

-- True when the current request comes through the API as a visitor or a signed-in user (admins
-- included), from the JWT role, not from current_user, so it also holds inside security definer
-- functions. Null JWT (SQL editor, cron, migrations) or service_role = false.
create or replace function private.request_is_api()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
           nullif(current_setting('request.jwt.claim.role', true), ''),
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
           '') in ('anon', 'authenticated')
      or current_user in ('anon', 'authenticated');
$$;
revoke execute on function private.request_is_api() from public;
grant execute on function private.request_is_api() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Admin-only data per switch
-- ---------------------------------------------------------------------------
create table if not exists private.feature_switch_meta (
  feature_id text primary key check (feature_id ~ '^[a-z][a-z0-9_]{1,40}$'),
  legal text not null default 'none' check (legal in ('pending', 'cleared', 'none')),
  legal_checked_on date,
  team_only boolean not null default false,
  updated_by uuid,   -- auth.uid(); no foreign key, so the record survives a deleted admin account
  updated_at timestamptz not null default now(),
  constraint feature_switch_meta_cleared_date check ((legal = 'cleared') = (legal_checked_on is not null)),
  constraint feature_switch_meta_money_gate check (feature_id <> 'payments_live' or not team_only)
);
alter table private.feature_switch_meta enable row level security;
revoke all on table private.feature_switch_meta from public, anon, authenticated;

create or replace function private.feature_switch_meta_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.legal_checked_on is not null
     and (new.legal_checked_on > (now() at time zone 'Africa/Dar_es_Salaam')::date
          or new.legal_checked_on < date '2026-01-01') then
    raise exception 'legal check date out of range' using errcode = 'P0001';
  end if;
  new.updated_by := (select auth.uid());
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.feature_switch_meta_guard() from public;
drop trigger if exists feature_switch_meta_guard on private.feature_switch_meta;
create trigger feature_switch_meta_guard
  before insert or update on private.feature_switch_meta
  for each row execute function private.feature_switch_meta_guard();

-- ---------------------------------------------------------------------------
-- 3. Preview and money gates
-- ---------------------------------------------------------------------------
-- Screens only. Money paths use feature_on / money_feature_on / manual_payments_on, never this.
-- Security definer only to read the private team_only flag; returns a boolean, nothing else.
create or replace function private.feature_visible(p_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.feature_on(p_id)
    or (p_id <> 'payments_live'
        and exists (select 1 from private.feature_switch_meta m where m.feature_id = p_id and m.team_only)
        and private.is_admin());
$$;
comment on function private.feature_visible(text) is
  'Screens only: feature_on(id), or team_only and an admin with two-step sign-in. Never for money paths.';
revoke execute on function private.feature_visible(text) from public;
grant execute on function private.feature_visible(text) to anon, authenticated;

-- For the website's server code: may the current caller see this feature (on, or an admin preview)?
-- The admin check happens here in the database, not in the browser (security review L3).
create or replace function public.feature_visible(p_id text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.feature_visible(p_id);
$$;
revoke execute on function public.feature_visible(text) from public;
grant execute on function public.feature_visible(text) to anon, authenticated;

create or replace function private.money_feature_on(p_id text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.feature_on('payments_live') and private.feature_on(p_id);
$$;
comment on function private.money_feature_on(text) is
  'Money paths through an API payment provider (split_settlement, mobile_money, marketplace_checkout, instalments, crew_payouts, tips): on only while payments_live is on too.';
revoke execute on function private.money_feature_on(text) from public;
grant execute on function private.money_feature_on(text) to anon, authenticated, service_role;

create or replace function private.manual_payments_on()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.feature_on('payments_manual');
$$;
comment on function private.manual_payments_on() is
  'Lipa-number manual payments. Does not depend on payments_live. Fees for jobs contacts and crew verification are paid by the operator or vouching guide, never the job seeker or porter.';
revoke execute on function private.manual_payments_on() from public;
grant execute on function private.manual_payments_on() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Change log (append-only)
-- ---------------------------------------------------------------------------
create table if not exists private.feature_switch_log (
  id bigint generated always as identity primary key,
  feature_id text not null,
  kind text not null check (kind in ('switch', 'meta')),
  action text not null check (action in ('created', 'changed', 'deleted')),
  old_value jsonb,
  new_value jsonb,
  changed_by uuid,   -- auth.uid(); null = migration, SQL editor or service role. No foreign key on purpose.
  changed_at timestamptz not null default now()
);
create index if not exists feature_switch_log_id_idx on private.feature_switch_log (feature_id, changed_at desc);
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

-- Security definer so the trigger can write the private log; fixed search_path; trigger use only.
create or replace function private.site_settings_feature_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.key like 'feature.%' then
      insert into private.feature_switch_log (feature_id, kind, action, old_value, new_value, changed_by)
      values (substr(new.key, 9), 'switch', 'created', null, new.value, (select auth.uid()));
    end if;
  elsif tg_op = 'UPDATE' then
    if (old.key like 'feature.%' or new.key like 'feature.%')
       and (old.key is distinct from new.key or old.value is distinct from new.value) then
      insert into private.feature_switch_log (feature_id, kind, action, old_value, new_value, changed_by)
      values (substr(new.key, 9), 'switch', 'changed', old.value, new.value, (select auth.uid()));
    end if;
  elsif old.key like 'feature.%' then
    insert into private.feature_switch_log (feature_id, kind, action, old_value, new_value, changed_by)
    values (substr(old.key, 9), 'switch', 'deleted', old.value, null, (select auth.uid()));
  end if;
  return null;
end;
$$;
revoke execute on function private.site_settings_feature_log() from public, anon, authenticated;
drop trigger if exists site_settings_feature_log on public.site_settings;
create trigger site_settings_feature_log
  after insert or update or delete on public.site_settings
  for each row execute function private.site_settings_feature_log();

create or replace function private.feature_switch_meta_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb := jsonb_build_object('legal', new.legal, 'legal_checked_on', new.legal_checked_on, 'team_only', new.team_only);
begin
  if tg_op = 'UPDATE' then
    v_old := jsonb_build_object('legal', old.legal, 'legal_checked_on', old.legal_checked_on, 'team_only', old.team_only);
    if v_old = v_new then
      return null;
    end if;
  end if;
  insert into private.feature_switch_log (feature_id, kind, action, old_value, new_value, changed_by)
  values (new.feature_id, 'meta', case when tg_op = 'INSERT' then 'created' else 'changed' end, v_old, v_new,
          (select auth.uid()));
  return null;
end;
$$;
revoke execute on function private.feature_switch_meta_log() from public, anon, authenticated;
drop trigger if exists feature_switch_meta_log on private.feature_switch_meta;
create trigger feature_switch_meta_log
  after insert or update on private.feature_switch_meta
  for each row execute function private.feature_switch_meta_log();
drop trigger if exists feature_switch_meta_no_delete on private.feature_switch_meta;
create trigger feature_switch_meta_no_delete
  before delete or truncate on private.feature_switch_meta
  for each statement execute function private.feature_switch_log_append_only();

-- ---------------------------------------------------------------------------
-- 5. Guard: what API callers may do to public feature.* rows
-- ---------------------------------------------------------------------------
create or replace function private.site_settings_feature_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.request_is_api() then
    return coalesce(new, old);   -- SQL editor, migrations, service role
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

  -- The money gate: exactly {"on": false} for API callers, whatever the path.
  if new.key = 'feature.payments_live' and new.value is distinct from '{"on": false}'::jsonb then
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
-- 6. Admin functions (security definer: they read and write the private table; admins only)
-- ---------------------------------------------------------------------------
-- Change one switch. null for legal, legal_checked_on or team_only keeps the current value.
create or replace function public.admin_set_feature(
  p_id text, p_on boolean, p_legal text default null, p_legal_checked_on date default null,
  p_team_only boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_old jsonb;
  v_meta private.feature_switch_meta%rowtype;
  v_legal text;
  v_checked date;
  v_team boolean;
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
  if p_id = 'payments_live' and (p_on or coalesce(p_team_only, false)) then
    raise exception 'This switch is locked off' using errcode = 'P0001';
  end if;

  select * into v_meta from private.feature_switch_meta m where m.feature_id = p_id for update;
  v_legal := coalesce(p_legal, v_meta.legal, 'none');
  v_team := coalesce(p_team_only, v_meta.team_only, false);
  if v_legal = 'cleared' then
    v_checked := coalesce(p_legal_checked_on, case when p_legal is null then v_meta.legal_checked_on end);
    if v_checked is null then
      raise exception 'legal check date is required' using errcode = 'P0001';
    end if;
  else
    v_checked := null;
  end if;

  if v_old is distinct from jsonb_build_object('on', p_on) then
    update public.site_settings set value = jsonb_build_object('on', p_on) where key = v_key;
  end if;
  insert into private.feature_switch_meta as m (feature_id, legal, legal_checked_on, team_only)
  values (p_id, v_legal, v_checked, v_team)
  on conflict (feature_id) do update
    set legal = excluded.legal, legal_checked_on = excluded.legal_checked_on, team_only = excluded.team_only
    where (m.legal, m.legal_checked_on, m.team_only)
          is distinct from (excluded.legal, excluded.legal_checked_on, excluded.team_only);

  return jsonb_build_object('on', p_on, 'legal', v_legal, 'legal_checked_on', v_checked, 'team_only', v_team);
end;
$$;
revoke execute on function public.admin_set_feature(text, boolean, text, date, boolean) from public, anon;
grant execute on function public.admin_set_feature(text, boolean, text, date, boolean) to authenticated;

-- Every switch with its admin data: public rows and admin rows together (an id may have only one).
create or replace function public.admin_feature_rows()
returns table (feature_id text, has_row boolean, "on" boolean, legal text, legal_checked_on date, team_only boolean)
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
    select coalesce(substr(s.key, 9), m.feature_id),
           s.key is not null,
           coalesce((s.value -> 'on') = 'true'::jsonb, false),
           coalesce(m.legal, 'none'),
           m.legal_checked_on,
           coalesce(m.team_only, false)
    from (select * from public.site_settings where key like 'feature.%') s
    full join private.feature_switch_meta m on m.feature_id = substr(s.key, 9)
    order by 1;
end;
$$;
revoke execute on function public.admin_feature_rows() from public, anon;
grant execute on function public.admin_feature_rows() to authenticated;

-- The log, newest first, for one switch or all.
create or replace function public.admin_feature_log(p_limit integer default 50, p_id text default null)
returns table (id bigint, feature_id text, kind text, action text, old_value jsonb, new_value jsonb,
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
    select l.id, l.feature_id, l.kind, l.action, l.old_value, l.new_value,
           case when l.changed_by is null then 'Database (migration or SQL editor)'
                when pf.id is null then 'Removed account' else coalesce(pf.full_name, 'Admin') end,
           l.changed_at
    from private.feature_switch_log l
    left join public.profiles pf on pf.id = l.changed_by
    where p_id is null or l.feature_id = p_id
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
    select distinct on (l.feature_id)
           l.feature_id, l.action,
           case when l.changed_by is null then 'Database (migration or SQL editor)'
                when pf.id is null then 'Removed account' else coalesce(pf.full_name, 'Admin') end,
           l.changed_at
    from private.feature_switch_log l
    left join public.profiles pf on pf.id = l.changed_by
    order by l.feature_id, l.changed_at desc, l.id desc;
end;
$$;
revoke execute on function public.admin_feature_last_changes() from public, anon;
grant execute on function public.admin_feature_last_changes() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Data
-- ---------------------------------------------------------------------------
-- New public switches: ON. Existing rows with the same key are left alone.
insert into public.site_settings (key, value) values
  ('feature.spa_reservations',               '{"on": true}'),
  ('feature.guide_invites',                  '{"on": true}'),
  ('feature.google_checklist',               '{"on": true}'),
  ('feature.destination_pages',              '{"on": true}'),
  ('feature.rate_card',                      '{"on": true}'),
  ('feature.verified_reviews',               '{"on": true}'),
  ('feature.quote_pdf',                      '{"on": true}'),
  ('feature.availability',                   '{"on": true}'),
  ('feature.refund_rules',                   '{"on": true}'),
  ('feature.safety_basics',                  '{"on": true}'),
  ('feature.trip_planner',                   '{"on": true}'),
  ('feature.group_matching',                 '{"on": true}'),
  ('feature.farm_page',                      '{"on": true}'),
  ('feature.price_alerts',                   '{"on": true}'),
  ('feature.offline_web',                    '{"on": true}'),
  ('feature.cover_gallery',                  '{"on": true}'),
  ('feature.photo_share',                    '{"on": true}'),
  ('feature.profile_links',                  '{"on": true}'),
  ('feature.local_prices',                   '{"on": true}'),
  ('feature.park_rules',                     '{"on": true}'),
  ('feature.library_picks',                  '{"on": true}'),
  ('feature.vip_hosts',                      '{"on": true}'),
  ('feature.investment_hosts',               '{"on": true}'),
  ('feature.crew_accounts',                  '{"on": true}'),
  ('feature.crew_porter',                    '{"on": true}'),
  ('feature.crew_cook',                      '{"on": true}'),
  ('feature.crew_camp_crew',                 '{"on": true}'),
  ('feature.crew_driver',                    '{"on": true}'),
  ('feature.crew_assistant_guide',           '{"on": true}'),
  ('feature.crew_other',                     '{"on": true}'),
  ('feature.driver_guide',                   '{"on": true}'),
  ('feature.hotel_reps',                     '{"on": true}'),
  ('feature.service_consultant',             '{"on": true}'),
  ('feature.service_concierge',              '{"on": true}'),
  ('feature.service_trip_runner',            '{"on": true}'),
  ('feature.service_photographer',           '{"on": true}'),
  ('feature.service_translator',             '{"on": true}'),
  ('feature.marketplace',                    '{"on": true}'),
  ('feature.marketplace_rentals',            '{"on": true}'),
  ('feature.marketplace_checkout',           '{"on": true}'),
  ('feature.payments_manual',                '{"on": true}'),
  ('feature.split_settlement',               '{"on": true}'),
  ('feature.mobile_money',                   '{"on": true}'),
  ('feature.crew_payouts',                   '{"on": true}'),
  ('feature.instalments',                    '{"on": true}'),
  ('feature.meet_and_greet',                 '{"on": true}'),
  ('feature.transfers_driving',              '{"on": true}'),
  ('feature.sim_listings',                   '{"on": true}'),
  ('feature.operator_channel',               '{"on": true}'),
  ('feature.corporate_groups',               '{"on": true}'),
  ('feature.jobs_contact_fees',              '{"on": true}'),
  ('feature.crew_verification_fees',         '{"on": true}')
on conflict (key) do nothing;

-- Admin data for every switch: legal flag, no team preview. Existing admin rows are left alone.
insert into private.feature_switch_meta (feature_id, legal)
select v.id, v.legal from (values
  ('experiences',                       'none'),
  ('stories',                           'none'),
  ('proposals',                         'none'),
  ('ai_drafts',                         'none'),
  ('ai_assistant',                      'none'),
  ('teams',                             'none'),
  ('projects',                          'none'),
  ('training_plans',                    'none'),
  ('footage',                           'none'),
  ('reservation_commission_billing',    'none'),
  ('spa_reservations',                  'pending'),
  ('booking_link',                      'none'),
  ('family_updates',                    'pending'),
  ('academy',                           'pending'),
  ('guide_invites',                     'none'),
  ('google_checklist',                  'none'),
  ('destination_pages',                 'none'),
  ('rate_card',                         'none'),
  ('verified_reviews',                  'none'),
  ('quote_pdf',                         'none'),
  ('availability',                      'none'),
  ('refund_rules',                      'none'),
  ('safety_basics',                     'pending'),
  ('trip_planner',                      'none'),
  ('group_matching',                    'none'),
  ('farm_page',                         'none'),
  ('price_alerts',                      'pending'),
  ('offline_web',                       'none'),
  ('cover_gallery',                     'none'),
  ('photo_share',                       'none'),
  ('profile_links',                     'none'),
  ('local_prices',                      'none'),
  ('park_rules',                        'none'),
  ('library_picks',                     'none'),
  ('vip_hosts',                         'pending'),
  ('investment_hosts',                  'pending'),
  ('crew_accounts',                     'pending'),
  ('crew_porter',                       'pending'),
  ('crew_cook',                         'pending'),
  ('crew_camp_crew',                    'pending'),
  ('crew_driver',                       'pending'),
  ('crew_assistant_guide',              'pending'),
  ('crew_other',                        'pending'),
  ('driver_guide',                      'pending'),
  ('hotel_reps',                        'pending'),
  ('service_consultant',                'pending'),
  ('service_concierge',                 'pending'),
  ('service_trip_runner',               'pending'),
  ('service_photographer',              'pending'),
  ('service_translator',                'pending'),
  ('marketplace',                       'pending'),
  ('marketplace_rentals',               'pending'),
  ('marketplace_checkout',              'pending'),
  ('payments_live',                     'none'),
  ('save_to_travel',                    'pending'),
  ('payments_manual',                   'pending'),
  ('split_settlement',                  'pending'),
  ('mobile_money',                      'pending'),
  ('tips',                              'pending'),
  ('crew_payouts',                      'pending'),
  ('instalments',                       'pending'),
  ('insurance_rescue',                  'pending'),
  ('meet_and_greet',                    'pending'),
  ('transfers_driving',                 'pending'),
  ('sim_listings',                      'pending'),
  ('operator_channel',                  'pending'),
  ('ship_home',                         'pending'),
  ('corporate_groups',                  'pending'),
  ('jobs_contact_fees',                 'pending'),
  ('crew_verification_fees',            'pending')
) as v(id, legal)
on conflict (feature_id) do nothing;
