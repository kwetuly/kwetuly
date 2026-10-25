-- Brand rename Rafrika -> Kwetuly (Walter, 2026-10-24). Written so it does not break the site.
--
-- The live database is shared by code that still says "rafrika" (localhost site, app builds already
-- on phones) and code that will say "kwetuly". So this migration only ADDS and SYNCS; nothing that old
-- code uses is removed. A later, separate "contract" migration removes the old names once every
-- client is on the new code (see the end of this file).
--
-- A. business_agreements.kwetuly_pct: a new real column next to rafrika_pct, filled from it, and kept
--    equal to it by a trigger on every insert and update. Old code reading or writing rafrika_pct and
--    new code reading or writing kwetuly_pct both keep working, in any order.
--    (A generated column was not used: it cannot be written to, so either old or new admin forms would fail.)
-- B. Messaging: the masked-original hand-over setting is renamed rafrika.orig_* -> kwetuly.orig_*.
--    The before-trigger now writes the new name and the after-trigger reads the new name first and
--    the old name as a fallback, so a statement in flight while this runs still keeps its original.
-- C. Server functions whose fallback names or error texts said "Rafrika" are redefined word-for-word
--    from their latest versions, with only that word changed:
--      public.set_hub_author            (20261012000500)
--      private.mask_message             (20261012001100)
--      private.after_message            (20261012001100)
--      private.on_trip_offer_changed    (20261014000100)
--      private.snapshot_member_price    (20261016001600)
--      public.complete_onboarding       (20261016001500)
--      public.handle_new_user           (20261016001800)
--    No app code matches on these texts (it matches the 'invite_code_invalid' code, which is unchanged).
--    CREATE OR REPLACE keeps the existing grants and revokes.
-- D. Stored text: "Rafrika" -> "Kwetuly" (also RAFRIKA and rafrika) in content Kwetuly itself wrote:
--    the trip and tour catalogue, places, travel news, tour operators, shop products, site settings,
--    sample guides and their packages, sample business listings and the shop listing; and the
--    "Rafrika" / "Rafrika partner" fallback names stored on hub posts, hub replies and chat members.
--    Whole words only. Never changed: url, path, website, email, phone, source_*, licence_* and slug
--    columns. Tour operators: description only; travel news: title and body only where source_name is
--    null, plus body where it contains Kwetuly's own "never applies for visas" sentence; shop listing: only the merch listing owned by an admin. Preview it first with the read-only
--    supabase/checks/brand_rename_dry_run.sql.
--    Text written by users (messages, reviews, requests...) is not rewritten; a final check only
--    COUNTS remaining "rafrika" text per column and reports it as a NOTICE.
--    Both words have 7 letters, so no length check can fail.
--
-- E. The enum value public.trip_operator 'rafrika' is renamed to 'kwetuly'. The code already says
--    'kwetuly' (shared Trip type and admin trip form), and no SQL function uses the literal, so existing
--    rows simply read 'kwetuly' from now on. Until this runs, saving a trip as "operated by Kwetuly"
--    from the new admin form fails; nothing else is affected.
--
-- Undo (before the contract step): drop trigger business_agreements_sync_pct on public.business_agreements;
--   drop function private.sync_agreement_pct(); alter table public.business_agreements drop column kwetuly_pct;
--   alter type public.trip_operator rename value 'kwetuly' to 'rafrika';
--   re-run the function bodies from the migrations listed in C; text rows: the same replace() the other way
--   round on the same tables (only rows that now contain Kwetuly; there were none before this migration).

-- ---------------------------------------------------------------------------
-- A. business_agreements.kwetuly_pct, kept in step with rafrika_pct
-- ---------------------------------------------------------------------------
alter table public.business_agreements
  add column kwetuly_pct numeric(5, 2) not null default 0 check (kwetuly_pct between 0 and 100);

-- Copy without touching updated_at (it shows when the agreement itself last changed).
alter table public.business_agreements disable trigger business_agreements_updated_at;
update public.business_agreements set kwetuly_pct = rafrika_pct;
alter table public.business_agreements enable trigger business_agreements_updated_at;

alter table public.business_agreements
  add constraint business_agreements_kwetuly_guide_total check (kwetuly_pct + guide_pct <= 100);

-- Whichever name the caller wrote wins, and the other column is set to the same value.
-- Insert: a non-zero kwetuly_pct wins (new code); otherwise rafrika_pct (old code, or both 0).
-- Update: the column that changed wins; if both changed, kwetuly_pct wins.
create or replace function private.sync_agreement_pct()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.kwetuly_pct is distinct from 0 then
      new.rafrika_pct := new.kwetuly_pct;
    else
      new.kwetuly_pct := new.rafrika_pct;
    end if;
  elsif new.kwetuly_pct is distinct from old.kwetuly_pct then
    new.rafrika_pct := new.kwetuly_pct;
  elsif new.rafrika_pct is distinct from old.rafrika_pct then
    new.kwetuly_pct := new.rafrika_pct;
  end if;
  return new;
end;
$$;

revoke execute on function private.sync_agreement_pct() from public, anon, authenticated;

create trigger business_agreements_sync_pct
  before insert or update on public.business_agreements
  for each row execute function private.sync_agreement_pct();

comment on column public.business_agreements.rafrika_pct is
  'Deprecated: old name of kwetuly_pct, kept equal by trigger business_agreements_sync_pct. Dropped in the contract migration.';
comment on column public.business_agreements.kwetuly_pct is
  'Kwetuly''s share of the sale amount, percent.';

-- ---------------------------------------------------------------------------
-- B + C. Messaging functions
-- ---------------------------------------------------------------------------
create or replace function private.mask_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unlocked boolean;
  v_masked text;
  v_match text;
begin
  select contact_unlocked into v_unlocked from public.conversations where id = new.conversation_id;
  if coalesce(v_unlocked, false) then
    return new;
  end if;

  v_masked := new.body;
  -- emails
  v_masked := regexp_replace(v_masked, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[contact hidden]', 'g');
  -- WhatsApp / Telegram / social links
  v_masked := regexp_replace(v_masked, '(https?://)?(wa\.me|chat\.whatsapp\.com|api\.whatsapp\.com|t\.me|instagram\.com|facebook\.com)\S*', '[contact hidden]', 'gi');
  -- phone numbers: digit runs (with spaces, dots, dashes, brackets) containing 9+ digits.
  -- Dates like 2027-06-19 (8 digits) and prices stay visible.
  for v_match in select (regexp_matches(v_masked, '\+?\d[\d\s.\-()]{6,}\d', 'g'))[1] loop
    if length(regexp_replace(v_match, '\D', '', 'g')) >= 9 then
      v_masked := replace(v_masked, v_match, '[contact hidden]');
    end if;
  end loop;

  if v_masked <> new.body then
    -- Hand the original to the after-insert trigger, which stores it for admins.
    perform set_config('kwetuly.orig_' || replace(new.id::text, '-', ''), new.body, true);
    new.masked := true;
    new.body := v_masked;
  end if;
  return new;
end;
$$;

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

  select coalesce(g.display_name, p.full_name, 'Kwetuly') into v_sender
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
-- C. Other functions with a "Rafrika" fallback or message
-- ---------------------------------------------------------------------------
create or replace function public.set_hub_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select coalesce(g.display_name, p.full_name, 'Kwetuly'), g.slug
    into new.author_name, new.author_slug
  from public.profiles p
  left join public.guides g on g.owner_id = p.id
  where p.id = new.author_id;
  return new;
end;
$$;

create or replace function private.on_trip_offer_changed()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  req public.trip_requests;
  v_from text;
  v_chat uuid;
  v_phone text;
begin
  select * into req from public.trip_requests where id = new.request_id;
  select coalesce(g.display_name, new.company_name) into v_from from (select 1) x
    left join public.guides g on g.id = new.guide_id;
  v_from := coalesce(v_from, new.company_name, 'Kwetuly partner');
  v_phone := case when new.guide_id is not null then private.guide_phone(new.guide_id) end;

  update public.trip_requests
  set offers_count = (select count(*) from public.trip_offers o where o.request_id = new.request_id and o.status in ('sent', 'accepted'))
  where id = new.request_id;

  if tg_op = 'INSERT' then
    perform private.notify_user('offer_new', req.traveler_id,
      jsonb_build_object('title', req.title, 'from', v_from, 'price', new.price_total_usd, 'link', '/requests/' || req.id));
    return new;
  end if;

  if new.status = 'accepted' and old.status <> 'accepted' then
    update public.trip_requests set status = 'booked' where id = new.request_id;
    update public.trip_offers set status = 'declined'
    where request_id = new.request_id and id <> new.id and status = 'sent';

    -- A private chat for the traveller and the guide/company (the traveller can invite companions).
    insert into public.group_chats (name, created_by) values (left(req.title, 80), req.traveler_id)
    returning id into v_chat;
    insert into public.group_chat_members (chat_id, user_id, display_name)
    values (v_chat, new.offered_by, left(v_from, 120))
    on conflict do nothing;
    update public.trip_offers set chat_id = v_chat where id = new.id;

    perform private.notify_user('offer_accepted', new.offered_by,
      jsonb_build_object('title', req.title, 'name', req.traveler_name, 'link', '/requests/' || req.id), v_phone);
  elsif new.status = 'declined' and old.status = 'sent' then
    perform private.notify_user('offer_declined', new.offered_by,
      jsonb_build_object('title', req.title, 'link', '/requests'), null, '{email,push}');
  end if;
  return new;
end;
$$;

create or replace function private.snapshot_member_price()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_api boolean := current_user in ('anon', 'authenticated');
  v_trip_status text;
  v_trip_price integer;
begin
  if new.status is distinct from 'accepted' then
    new.price_per_person_usd := null;
    return new;
  end if;

  if tg_op = 'INSERT' or old.status is distinct from 'accepted' then
    select t.status::text, t.price_per_person_usd into v_trip_status, v_trip_price
    from public.group_trips t where t.id = new.group_trip_id;
    -- A trip waiting for review may have a new price or deposit nobody has checked yet.
    if v_api and v_trip_status is distinct from 'approved' then
      raise exception 'This group trip is waiting for Kwetuly''s review. You can accept people once it is approved.'
        using errcode = 'check_violation';
    end if;
    -- Take the price only once: a price already saved on the row stays.
    if tg_op = 'INSERT' or old.price_per_person_usd is null then
      new.price_per_person_usd := v_trip_price;
    else
      new.price_per_person_usd := old.price_per_person_usd;
    end if;
  elsif v_api then
    -- Signed-in users, admins included, cannot change the price an accepted member pays.
    new.price_per_person_usd := old.price_per_person_usd;
  elsif new.price_per_person_usd is distinct from old.price_per_person_usd then
    raise notice 'group_trip_members %: price per person changed from % to % by %',
      new.id, old.price_per_person_usd, new.price_per_person_usd, current_user;
  end if;
  return new;
end;
$$;

create or replace function public.complete_onboarding(p_role text, p_phone text, p_full_name text, p_invite_code text default null)
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
    raise exception 'invite_code_invalid' using errcode = 'P0001', hint = 'A valid invite code is needed while Kwetuly is invite-only.';
  end if;
  update public.profiles
  set role = p_role::public.user_role,
      phone = p_phone,
      full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
      onboarded_at = now()
  where id = v_uid and onboarded_at is null;
end;
$$;

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
    -- Email/password sign-ups must bring a valid code; the sign-up is rolled back otherwise.
    if not invited and coalesce(new.raw_app_meta_data ->> 'provider', '') = 'email' then
      raise exception 'invite_code_invalid' using errcode = 'P0001', hint = 'A valid invite code is needed while Kwetuly is invite-only.';
    end if;
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
-- D. Stored text written by Kwetuly
-- Keep the targets, column rules and match pattern identical to supabase/checks/brand_rename_dry_run.sql,
-- which an admin runs first to see exactly which rows and columns will change.
-- - Whole words only (\m...\M), so values such as "safarafrika.com" are never changed. The one known
--   joined form, the hashtag #RafrikaGuides in the signature trips, is replaced explicitly.
-- - Never changed: columns whose names contain url, path, website, email or phone, and source_*,
--   licence_* and slug columns.
-- - Shop listing: only the real Kwetuly shop (business_type 'merch' owned by an admin profile), never
--   a business that chose 'merch' itself.
-- ---------------------------------------------------------------------------
do $$
declare
  -- table, row filter (only rows Kwetuly itself wrote), columns ('' = every eligible text column)
  targets constant text[][] := array[
    array['trips',          'true', ''],
    array['trip_stops',     'true', ''],
    array['places',         'true', ''],
    array['travel_news',    'source_name is null', 'title,body'],
    -- Kwetuly's own sentence inside a sourced item: "Rafrika never applies for visas on your behalf."
    array['travel_news',    'source_name is not null and body like ''%never applies for visas%''', 'body'],
    array['tour_operators', 'true', 'description'],
    array['shop_products',  'true', ''],
    array['site_settings',  'true', ''],
    array['providers',      'is_sample or (business_type = ''merch'' and owner_id in (select p.id from public.profiles p where p.role = ''admin''))', ''],
    array['guides',         'is_sample', ''],
    array['guide_packages', 'guide_id in (select g.id from public.guides g where g.is_sample)', '']
  ];
  -- %1$s is the text expression to rewrite.
  rewrite constant text :=
    'regexp_replace(regexp_replace(regexp_replace(replace(%1$s, ''#RafrikaGuides'', ''#KwetulyGuides''),'
    ' ''\mRafrika\M'', ''Kwetuly'', ''g''), ''\mRAFRIKA\M'', ''KWETULY'', ''g''), ''\mrafrika\M'', ''kwetuly'', ''g'')';
  match_pattern constant text := '%1$I::text ~ ''\m(Rafrika|RAFRIKA|rafrika)\M|#RafrikaGuides''';
  t text[];
  col record;
  sets text;
  hits text;
  n bigint;
begin
  foreach t slice 1 in array targets loop
    sets := null;
    hits := null;
    for col in
      select c.column_name, c.data_type
      from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = t[1]
        and c.is_generated = 'NEVER'
        and c.column_name !~ '(url|path|website|email|phone)'
        and c.column_name !~ '^(source|licence)_'
        and c.column_name <> 'slug'
        and (t[3] = '' or c.column_name = any (string_to_array(t[3], ',')))
        and (c.data_type in ('text', 'character varying', 'jsonb')
             or (c.data_type = 'ARRAY' and c.udt_name in ('_text', '_varchar')))
    loop
      sets := concat_ws(', ', sets, format('%I = ', col.column_name) || case
        when col.data_type = 'jsonb' then
          format(rewrite, format('%I::text', col.column_name)) || '::jsonb'
        when col.data_type = 'ARRAY' then
          'array(select ' || format(rewrite, 'u.x') || format(' from unnest(%I) with ordinality as u(x, i) order by u.i)', col.column_name)
        else
          format(rewrite, format('%I', col.column_name))
      end);
      hits := concat_ws(' or ', hits, format(match_pattern, col.column_name));
    end loop;

    if sets is not null then
      execute format('update public.%I set %s where (%s) and (%s)', t[1], sets, t[2], hits);
      get diagnostics n = row_count;
      raise notice 'brand rename: % row(s) updated in public.%', n, t[1];
    end if;
  end loop;
end;
$$;

-- Fallback names that the old functions stored.
update public.hub_posts set author_name = 'Kwetuly' where author_name = 'Rafrika';
update public.hub_replies set author_name = 'Kwetuly' where author_name = 'Rafrika';
update public.group_chat_members set display_name = 'Kwetuly partner' where display_name = 'Rafrika partner';

-- ---------------------------------------------------------------------------
-- E. Trip operator code
alter type public.trip_operator rename value 'rafrika' to 'kwetuly';

-- Report (read-only): any "rafrika" left in text columns of public tables, for a person to look at.
-- Only counts are printed, never the text itself (it may be personal).
do $$
declare
  col record;
  n bigint;
begin
  for col in
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and tb.table_type = 'BASE TABLE'
      and (c.data_type in ('text', 'character varying', 'jsonb')
           or (c.data_type = 'ARRAY' and c.udt_name in ('_text', '_varchar')))
  loop
    execute format('select count(*) from public.%I where %I::text ilike ''%%rafrika%%''', col.table_name, col.column_name) into n;
    if n > 0 then
      raise notice 'brand rename: % row(s) in public.%.% still contain "rafrika"', n, col.table_name, col.column_name;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Later, separate CONTRACT migration (not part of this file). Run it only when the website is
-- deployed with kwetuly_pct AND no app build that reads rafrika_pct is still in use:
--   drop trigger business_agreements_sync_pct on public.business_agreements;
--   drop function private.sync_agreement_pct();
--   alter table public.business_agreements drop column rafrika_pct;   -- also drops its two checks
--   and redefine private.after_message() without the 'rafrika.orig_' fallback.
-- ---------------------------------------------------------------------------
