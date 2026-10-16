-- Invite-only soft launch, enforced in the database (approved by Walter, 2026-10-16).
--
-- Until now the invite code was only checked by the website's forms (env SIGNUP_INVITE_CODES), so the
-- app and anyone calling auth signUp / complete_onboarding with the public key could skip it.
-- From this migration:
--   * Invite codes live in private.invite_codes as SHA-256 hashes only (never plaintext, never in a
--     migration). Admins add them on /admin/invites (the code is shown once), see uses, deactivate.
--   * site_settings 'invite_only' = {"enabled": true} turns the gate on. Set it to false (or delete the
--     row) at public launch and sign-up works for everyone again; no code release needed.
--   * While the gate is on, no account becomes onboarded without a valid code:
--       - email sign-ups (website and app) send the code as sign-up metadata 'invite_code';
--         handle_new_user redeems it. Without a valid code the account is created as a traveller
--         with onboarded_at = null, and the person must finish the welcome step with a code.
--       - complete_onboarding (the welcome step, also used after Google / Facebook / Apple) needs
--         p_invite_code unless this account already redeemed one.
--   * Accounts that are already onboarded are not touched.
--
-- Why not a Supabase "before user created" auth hook: it would block account creation itself, but it
-- needs Walter to configure it in the dashboard, and Google / Facebook / Apple sign-ups arrive without
-- any metadata, so the hook would have to either reject every new social account or let them all
-- through. Checking at onboarding covers email and social sign-ups the same way, is one migration,
-- and is switched off with one site setting.
--
-- Known limit (for security review): an account that has not finished onboarding can still sign in
-- and use the API as a traveller, like social accounts before the welcome step. The website and app
-- send such accounts to the welcome step; database policies do not check onboarded_at yet.
--
-- Undo:
--   drop function public.admin_invite_codes(), public.admin_create_invite_code(text, text, integer),
--     public.admin_set_invite_code_active(uuid, boolean);
--   drop function public.complete_onboarding(text, text, text, text); re-create
--     public.complete_onboarding(text, text, text) and public.handle_new_user() from
--     20261013000400_onboarding_phone.sql (with its grants);
--   drop function private.redeem_invite(text, uuid), private.hash_invite(text), private.invite_only();
--   drop table private.invite_code_uses, private.invite_codes;
--   delete from public.site_settings where key = 'invite_only';
-- (Dropping the tables deletes the codes and the record of who used which code: Walter's approval.)

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table private.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash bytea not null unique,
  label text not null default '' check (char_length(label) <= 80),
  active boolean not null default true,
  uses integer not null default 0 check (uses >= 0),
  max_uses integer check (max_uses is null or max_uses between 1 and 100000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Which account used which code (one per account). Removed with the account.
create table private.invite_code_uses (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code_id uuid not null references private.invite_codes (id) on delete cascade,
  used_at timestamptz not null default now()
);
create index invite_code_uses_code on private.invite_code_uses (code_id);

alter table private.invite_codes enable row level security;
alter table private.invite_code_uses enable row level security;

-- The private schema is not exposed by the API, but anon/authenticated have usage on it, so grant
-- nothing by default and only the columns admins need. The hash column is never readable.
revoke all on private.invite_codes from public, anon, authenticated;
revoke all on private.invite_code_uses from public, anon, authenticated;
grant select (id, label, active, uses, max_uses, created_at) on private.invite_codes to authenticated;
grant insert (code_hash, label, max_uses) on private.invite_codes to authenticated;
grant update (active) on private.invite_codes to authenticated;

create policy "Admins read invite codes" on private.invite_codes
  for select to authenticated using (private.is_admin());
create policy "Admins add invite codes" on private.invite_codes
  for insert to authenticated with check (private.is_admin());
create policy "Admins switch invite codes on and off" on private.invite_codes
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
-- invite_code_uses: no policies, so only trusted server code (the functions below) reads or writes it.

-- ---------------------------------------------------------------------------
-- Helpers (private, not callable through the API)
-- ---------------------------------------------------------------------------
create or replace function private.invite_only()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select (value ->> 'enabled') = 'true' from public.site_settings where key = 'invite_only'), false);
$$;

-- Codes are case-insensitive and ignore spaces around them.
create or replace function private.hash_invite(p_code text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.sha256(pg_catalog.convert_to(lower(btrim(p_code)), 'UTF8'));
$$;

-- Uses one place on an active code and records it for the account. False if the code is wrong,
-- switched off or used up. The row lock on update keeps max_uses exact when two people race.
create or replace function private.redeem_invite(p_code text, p_user uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_user is null or p_code is null or char_length(btrim(p_code)) = 0 or char_length(p_code) > 200 then
    return false;
  end if;
  update private.invite_codes
  set uses = uses + 1
  where code_hash = private.hash_invite(p_code)
    and active
    and (max_uses is null or uses < max_uses)
  returning id into v_id;
  if v_id is null then
    return false;
  end if;
  insert into private.invite_code_uses (user_id, code_id) values (p_user, v_id);
  return true;
end;
$$;

revoke execute on function private.invite_only() from public, anon, authenticated;
revoke execute on function private.hash_invite(text) from public, anon, authenticated;
revoke execute on function private.redeem_invite(text, uuid) from public, anon, authenticated;
-- Admins' insert function below hashes as the signed-in admin.
grant execute on function private.hash_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- New accounts: redeem the code sent with an email sign-up.
-- Same as 20261013000400 otherwise. Never raises because of the code, so sign-up itself keeps working.
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

-- ---------------------------------------------------------------------------
-- The welcome step now takes the invite code. Old callers that send three arguments reach this
-- function through the default and get 'invite_code_invalid' while the gate is on.
-- ---------------------------------------------------------------------------
drop function public.complete_onboarding(text, text, text);

create function public.complete_onboarding(p_role text, p_phone text, p_full_name text, p_invite_code text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if p_role not in ('traveler', 'guide', 'provider') then
    raise exception 'Unknown account type';
  end if;
  if p_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Phone number must be in international format';
  end if;
  perform 1 from public.profiles where id = v_uid and onboarded_at is null for update;
  if not found then
    raise exception 'Account already set up';
  end if;
  if private.invite_only()
     and not exists (select 1 from private.invite_code_uses where user_id = v_uid)
     and not private.redeem_invite(p_invite_code, v_uid) then
    raise exception 'invite_code_invalid' using errcode = 'P0001', hint = 'A valid invite code is needed while Rafrika is invite-only.';
  end if;
  update public.profiles
  set role = p_role::public.user_role,
      phone = p_phone,
      full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
      onboarded_at = now()
  where id = v_uid and onboarded_at is null;
end;
$$;

revoke execute on function public.complete_onboarding(text, text, text, text) from public, anon;
grant execute on function public.complete_onboarding(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin functions. SECURITY INVOKER: they run as the signed-in admin, so the column grants and the
-- admin-only policies above (private.is_admin(), two-step session) decide what they can do.
-- ---------------------------------------------------------------------------
create or replace function public.admin_invite_codes()
returns table (id uuid, label text, active boolean, uses integer, max_uses integer, created_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.label, c.active, c.uses, c.max_uses, c.created_at
  from private.invite_codes c
  order by c.created_at desc;
$$;

-- The website generates the code and shows it once; only its hash is stored.
create or replace function public.admin_create_invite_code(p_code text, p_label text, p_max_uses integer)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.is_admin() then
    raise exception 'Admins only';
  end if;
  if p_code is null or char_length(btrim(p_code)) < 10 or char_length(btrim(p_code)) > 64 then
    raise exception 'Invite codes need 10 to 64 characters';
  end if;
  insert into private.invite_codes (code_hash, label, max_uses)
  values (private.hash_invite(p_code), left(coalesce(btrim(p_label), ''), 80), p_max_uses)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_set_invite_code_active(p_id uuid, p_active boolean)
returns void
language sql
security invoker
set search_path = ''
as $$
  update private.invite_codes set active = coalesce(p_active, false) where id = p_id;
$$;

revoke execute on function public.admin_invite_codes() from public, anon;
revoke execute on function public.admin_create_invite_code(text, text, integer) from public, anon;
revoke execute on function public.admin_set_invite_code_active(uuid, boolean) from public, anon;
grant execute on function public.admin_invite_codes() to authenticated;
grant execute on function public.admin_create_invite_code(text, text, integer) to authenticated;
grant execute on function public.admin_set_invite_code_active(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- The switch. On for the soft launch; admins change it on /admin/invites.
-- ---------------------------------------------------------------------------
insert into public.site_settings (key, value) values ('invite_only', '{"enabled": true}')
on conflict (key) do nothing;
