-- Tests for migration 20261126000200_profile_links.sql (slice S5, profile links).
-- Run ONLY on a local or test project, after that migration, in the SQL editor or psql as postgres.
-- One transaction that ends with ROLLBACK: nothing below stays. Any failure stops the script with
-- "FAIL: ...". The last line prints "all passed". Every name and link here is invented.

begin;

create function pg_temp.expect_code(p_sql text, p_code text, p_label text) returns void language plpgsql as $$
declare v_msg text;
begin
  begin
    execute p_sql;
  exception when others then
    v_msg := sqlerrm;
  end;
  if v_msg is null then
    raise exception 'FAIL: % (should have been refused)', p_label;
  end if;
  if position(p_code in v_msg) = 0 then
    raise exception 'FAIL: % (refused with "%", expected "%")', p_label, v_msg, p_code;
  end if;
end $$;

create function pg_temp.check(p_ok boolean, p_label text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then
    raise exception 'FAIL: %', p_label;
  end if;
end $$;

create function pg_temp.as_user(p_id uuid, p_aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_id, 'role', 'authenticated', 'aal', p_aal)::text, true);
end $$;

grant execute on function pg_temp.expect_code(text, text, text) to authenticated;
grant execute on function pg_temp.check(boolean, text) to authenticated;

-- Accounts: g1 guide owner, o1 business owner, x1 someone else, a1 admin.
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('5a5a5a5a-0000-4000-8000-0000000000a1', 'pl-guide@example.test', 'authenticated', 'authenticated', '{}'),
  ('5a5a5a5a-0000-4000-8000-0000000000b2', 'pl-owner@example.test', 'authenticated', 'authenticated', '{}'),
  ('5a5a5a5a-0000-4000-8000-0000000000c3', 'pl-other@example.test', 'authenticated', 'authenticated', '{}'),
  ('5a5a5a5a-0000-4000-8000-0000000000d4', 'pl-admin@example.test', 'authenticated', 'authenticated', '{}');
update public.profiles set onboarded_at = now()
where id in ('5a5a5a5a-0000-4000-8000-0000000000a1', '5a5a5a5a-0000-4000-8000-0000000000b2',
             '5a5a5a5a-0000-4000-8000-0000000000c3', '5a5a5a5a-0000-4000-8000-0000000000d4');
update public.profiles set role = 'admin' where id = '5a5a5a5a-0000-4000-8000-0000000000d4';

insert into public.guides (id, owner_id, slug, display_name, base_region, verification_status)
values ('5b5b5b5b-0000-4000-8000-0000000000a1', '5a5a5a5a-0000-4000-8000-0000000000a1', 'pl-test-guide', 'PL Test Guide', 'Arusha', 'approved');
insert into public.providers (id, owner_id, business_name, base_region, business_type, verification_status)
values ('5c5c5c5c-0000-4000-8000-0000000000b2', '5a5a5a5a-0000-4000-8000-0000000000b2', 'PL test lodge', 'Moshi', 'hotel', 'approved');

-- Switch on for parts A to C.
insert into public.site_settings (key, value) values ('feature.profile_links', '{"on": true, "legal": "none"}')
on conflict (key) do update set value = excluded.value;

-- ===========================================================================
-- A. Guides: the new links, in their stored form only
-- ===========================================================================
select pg_temp.as_user('5a5a5a5a-0000-4000-8000-0000000000a1');
set local role authenticated;

update public.guides set
  google_business_url = 'https://maps.app.goo.gl/AbCd1234',
  youtube_url = 'https://www.youtube.com/@pltestguide',
  website = 'https://pltestguide.co.tz/'
where id = '5b5b5b5b-0000-4000-8000-0000000000a1';
select pg_temp.check((select google_business_url = 'https://maps.app.goo.gl/AbCd1234' and youtube_url = 'https://www.youtube.com/@pltestguide'
                        and website = 'https://pltestguide.co.tz/' from public.guides where id = '5b5b5b5b-0000-4000-8000-0000000000a1'),
                     'A1: the owner saves valid links');

update public.guides set google_business_url = 'https://g.page/r/CQ1a2b3c4d5e6EAE' where id = '5b5b5b5b-0000-4000-8000-0000000000a1';
update public.guides set google_business_url = 'https://www.google.com/maps/place/PL+Lodge/@-3.38,36.68,17z/data=!3m1!4b1' where id = '5b5b5b5b-0000-4000-8000-0000000000a1';
update public.guides set google_business_url = 'https://business.google.com/n/123/profile' where id = '5b5b5b5b-0000-4000-8000-0000000000a1';
update public.guides set youtube_url = 'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv' where id = '5b5b5b5b-0000-4000-8000-0000000000a1';

select pg_temp.expect_code($q$update public.guides set google_business_url = 'https://goo.gl/maps/abc' where id = '5b5b5b5b-0000-4000-8000-0000000000a1'$q$,
                           'guides_google_business_url_format', 'A2: other goo.gl short links are refused');
select pg_temp.expect_code($q$update public.guides set google_business_url = 'https://www.google.com/url?q=https://evil.example' where id = '5b5b5b5b-0000-4000-8000-0000000000a1'$q$,
                           'guides_google_business_url_format', 'A3: Google redirects are refused');
select pg_temp.expect_code($q$update public.guides set google_business_url = 'https://www.google.com/maps/place/../../amp/s/evil.example' where id = '5b5b5b5b-0000-4000-8000-0000000000a1'$q$,
                           'guides_google_business_url_format', 'A4: dot segments are refused');
select pg_temp.expect_code($q$update public.guides set google_business_url = 'https://www.google.com/maps/place/x/%2e%2e/url' where id = '5b5b5b5b-0000-4000-8000-0000000000a1'$q$,
                           'guides_google_business_url_format', 'A5: encoded dot segments are refused');
select pg_temp.expect_code($q$update public.guides set google_business_url = 'https://maps.app.goo.gl/AbCd1234?x=1' where id = '5b5b5b5b-0000-4000-8000-0000000000a1'$q$,
                           'guides_google_business_url_format', 'A6: a query is refused (stored form has none)');
select pg_temp.expect_code($q$update public.guides set google_business_url = 'javascript:alert(1)' where id = '5b5b5b5b-0000-4000-8000-0000000000a1'$q$,
                           'guides_google_business_url_format', 'A7: other schemes are refused');
select pg_temp.expect_code($q$update public.guides set youtube_url = 'https://youtu.be/dQw4w9WgXcQ' where id = '5b5b5b5b-0000-4000-8000-0000000000a1'$q$,
                           'guides_youtube_url_format', 'A8: video links are refused');
select pg_temp.expect_code($q$update public.guides set youtube_url = 'https://www.youtube.com/@PLTest' where id = '5b5b5b5b-0000-4000-8000-0000000000a1'$q$,
                           'guides_youtube_url_format', 'A9: handles are stored lower-case');
select pg_temp.expect_code($q$update public.guides set youtube_url = 'https://www.youtube.com/@...' where id = '5b5b5b5b-0000-4000-8000-0000000000a1'$q$,
                           'guides_youtube_url_format', 'A10: a handle of dots only is refused');
select pg_temp.expect_code($q$update public.guides set website = 'https://wa.me/255700000000' where id = '5b5b5b5b-0000-4000-8000-0000000000a1'$q$,
                           'guides_website_format', 'A11: a WhatsApp link is not a website');
select pg_temp.expect_code($q$update public.guides set website = 'https://api.whatsapp.com/send?phone=255700000000' where id = '5b5b5b5b-0000-4000-8000-0000000000a1'$q$,
                           'guides_website_format', 'A12: WhatsApp subdomains are refused');
select pg_temp.expect_code($q$update public.guides set website = 'https://t.me/pltest' where id = '5b5b5b5b-0000-4000-8000-0000000000a1'$q$,
                           'guides_website_format', 'A13: a Telegram link is not a website');
select pg_temp.expect_code($q$update public.guides set website = 'https://bit.ly/abc' where id = '5b5b5b5b-0000-4000-8000-0000000000a1'$q$,
                           'guides_website_format', 'A14: short links are refused');
select pg_temp.expect_code($q$update public.guides set website = 'https://l.facebook.com/l.php?u=x' where id = '5b5b5b5b-0000-4000-8000-0000000000a1'$q$,
                           'guides_website_format', 'A15: the Facebook redirector is refused');
select pg_temp.expect_code($q$update public.guides set website = 'http://pltestguide.co.tz/' where id = '5b5b5b5b-0000-4000-8000-0000000000a1'$q$,
                           'guides_website_format', 'A16: http is refused (stored form is https)');
select pg_temp.expect_code($q$update public.guides set website = 'https://pltestguide.co.tz/"><script>' where id = '5b5b5b5b-0000-4000-8000-0000000000a1'$q$,
                           'guides_website_format', 'A17: quotes and angle brackets are refused');
-- Security review M1, L1, L3: more blocked hosts, the platforms' own hosts, phone numbers, "//" in Google links.
select pg_temp.expect_code(format($q$update public.guides set website = %L where id = '5b5b5b5b-0000-4000-8000-0000000000a1'$q$, u),
                           'guides_website_format', 'A17b: blocked website ' || u)
from unnest(array['https://m.me/pltest', 'https://ig.me/m/pltest', 'https://signal.me/pltest', 'https://invite.viber.com/?g=x',
                  'https://linktr.ee/pltest', 'https://beacons.ai/pltest', 'https://bitly.com/x', 'https://youtu.be/x',
                  'https://www.facebook.com/pltest', 'https://www.instagram.com/pltest/', 'https://www.google.com/url?q=x',
                  'https://google.co.tz/', 'https://www.youtube.com/redirect?q=x', 'https://www.tiktok.com/@pltest',
                  'https://pltestguide.co.tz/contact/255700000000', 'https://pltestguide.co.tz/?p=%2B255700000000']) as u;
select pg_temp.expect_code($q$update public.guides set google_business_url = 'https://www.google.com/maps/place//evil.example' where id = '5b5b5b5b-0000-4000-8000-0000000000a1'$q$,
                           'guides_google_business_url_format', 'A17c: "//" after the host is refused in Google links');
-- A host that only contains a blocked name is fine.
update public.guides set website = 'https://wa.me.example.com/' where id = '5b5b5b5b-0000-4000-8000-0000000000a1';

-- Someone else cannot change the guide's links (row level security: no row is updated).
reset role;
select pg_temp.as_user('5a5a5a5a-0000-4000-8000-0000000000c3');
set local role authenticated;
update public.guides set website = 'https://other.example.com/' where id = '5b5b5b5b-0000-4000-8000-0000000000a1';
reset role;
select pg_temp.check((select website = 'https://wa.me.example.com/' from public.guides where id = '5b5b5b5b-0000-4000-8000-0000000000a1'),
                     'A18: another member cannot change a guide''s links');

-- ===========================================================================
-- B. Businesses: social links with the guides' rules, plus Google and YouTube
-- ===========================================================================
select pg_temp.as_user('5a5a5a5a-0000-4000-8000-0000000000b2');
set local role authenticated;
update public.providers set
  instagram_url = 'https://www.instagram.com/pl.lodge/',
  facebook_url = 'https://www.facebook.com/pl.lodge',
  tiktok_url = 'https://www.tiktok.com/@pl.lodge',
  google_business_url = 'https://g.page/pl-lodge',
  youtube_url = 'https://www.youtube.com/@pllodge'
where id = '5c5c5c5c-0000-4000-8000-0000000000b2';
select pg_temp.check((select instagram_url is not null and facebook_url is not null and tiktok_url is not null
                        and google_business_url is not null and youtube_url is not null
                      from public.providers where id = '5c5c5c5c-0000-4000-8000-0000000000b2'),
                     'B1: the owner saves valid business links');
select pg_temp.expect_code($q$update public.providers set instagram_url = 'https://www.instagram.com/p/' where id = '5c5c5c5c-0000-4000-8000-0000000000b2'$q$,
                           'providers_instagram_url_format', 'B2: reserved Instagram paths are refused');
select pg_temp.expect_code($q$update public.providers set facebook_url = 'https://l.facebook.com/l.php?u=x' where id = '5c5c5c5c-0000-4000-8000-0000000000b2'$q$,
                           'providers_facebook_url_format', 'B3: the Facebook redirector is refused');
select pg_temp.expect_code($q$update public.providers set facebook_url = 'https://www.facebook.com/sharer' where id = '5c5c5c5c-0000-4000-8000-0000000000b2'$q$,
                           'providers_facebook_url_format', 'B4: Facebook share paths are refused');
select pg_temp.expect_code($q$update public.providers set tiktok_url = 'https://vm.tiktok.com/abc/' where id = '5c5c5c5c-0000-4000-8000-0000000000b2'$q$,
                           'providers_tiktok_url_format', 'B5: TikTok short links are refused');
select pg_temp.expect_code($q$update public.providers set google_business_url = 'https://evil.example/g.page/x' where id = '5c5c5c5c-0000-4000-8000-0000000000b2'$q$,
                           'providers_google_business_url_format', 'B6: other hosts are refused for Google');
select pg_temp.expect_code($q$update public.providers set youtube_url = 'https://www.youtube.com/watch?v=abc' where id = '5c5c5c5c-0000-4000-8000-0000000000b2'$q$,
                           'providers_youtube_url_format', 'B7: YouTube videos are refused');
-- L4, N3: the business website has the same block and phone rules, as a trigger that only looks at a
-- website when it is set or changed. providers_website_format is unchanged and stays validated.
update public.providers set website = 'https://pl-lodge.co.tz/' where id = '5c5c5c5c-0000-4000-8000-0000000000b2';
select pg_temp.expect_code($q$update public.providers set website = 'https://wa.me/255700000000' where id = '5c5c5c5c-0000-4000-8000-0000000000b2'$q$,
                           'website_not_allowed', 'B8: a WhatsApp link is not a business website');
select pg_temp.expect_code($q$update public.providers set website = 'https://linktr.ee/pllodge' where id = '5c5c5c5c-0000-4000-8000-0000000000b2'$q$,
                           'website_not_allowed', 'B9: a link-in-bio page is not a business website');
select pg_temp.expect_code($q$update public.providers set website = 'https://pl-lodge.co.tz/call/+255712345678' where id = '5c5c5c5c-0000-4000-8000-0000000000b2'$q$,
                           'website_not_allowed', 'B10: a phone number in the website is refused');
select pg_temp.expect_code($q$update public.providers set website = 'https://www.messenger.com/t/pllodge' where id = '5c5c5c5c-0000-4000-8000-0000000000b2'$q$,
                           'website_not_allowed', 'B10b: Messenger is not a business website');
-- A long booking number is fine.
update public.providers set website = 'https://pl-lodge.co.tz/booking/123456789012' where id = '5c5c5c5c-0000-4000-8000-0000000000b2';
reset role;
select pg_temp.check((select convalidated from pg_constraint where conname = 'providers_website_format'),
                     'B11: providers_website_format is still validated (unchanged)');
-- A website saved before these rules (written here as postgres, past the trigger's check) does not block
-- other saves; changing it to another blocked one does not work.
alter table public.providers disable trigger providers_website_rules;
update public.providers set website = 'https://wa.me/255700000000' where id = '5c5c5c5c-0000-4000-8000-0000000000b2';
alter table public.providers enable trigger providers_website_rules;
select pg_temp.as_user('5a5a5a5a-0000-4000-8000-0000000000b2');
set local role authenticated;
update public.providers set story = 'Rooms near Moshi' where id = '5c5c5c5c-0000-4000-8000-0000000000b2';
update public.providers set website = website, location = 'Moshi town' where id = '5c5c5c5c-0000-4000-8000-0000000000b2';
select pg_temp.expect_code($q$update public.providers set website = 'https://t.me/pllodge' where id = '5c5c5c5c-0000-4000-8000-0000000000b2'$q$,
                           'website_not_allowed', 'B12: changing to another blocked website is refused');
update public.providers set website = 'https://pl-lodge.co.tz/' where id = '5c5c5c5c-0000-4000-8000-0000000000b2';
reset role;
select pg_temp.check((select story = 'Rooms near Moshi' and location = 'Moshi town' and website = 'https://pl-lodge.co.tz/'
                      from public.providers where id = '5c5c5c5c-0000-4000-8000-0000000000b2'),
                     'B13: an old website does not block other saves, and can be corrected');
select pg_temp.expect_code($q$insert into public.providers (owner_id, business_name, base_region, business_type, website)
  values ('5a5a5a5a-0000-4000-8000-0000000000c3', 'PL new cafe', 'Arusha', 'restaurant', 'https://bit.ly/plcafe')$q$,
                           'website_not_allowed', 'B14: a new business with a blocked website is refused');

-- ===========================================================================
-- C. Admin alert when an approved profile changes a link
-- ===========================================================================
delete from public.notification_outbox where event = 'link_changed'
  and payload ->> 'ref' in ('5b5b5b5b-0000-4000-8000-0000000000a1', '5c5c5c5c-0000-4000-8000-0000000000b2');
select pg_temp.as_user('5a5a5a5a-0000-4000-8000-0000000000a1');
set local role authenticated;
update public.guides set youtube_url = 'https://www.youtube.com/@pltestguide2' where id = '5b5b5b5b-0000-4000-8000-0000000000a1';
reset role;
select pg_temp.check((select count(*) >= 1 from public.notification_outbox where event = 'link_changed'
                        and payload ->> 'ref' = '5b5b5b5b-0000-4000-8000-0000000000a1'
                        and payload ->> 'changes' like '%YouTube was%'),
                     'C1: changing YouTube on an approved guide alerts the admins');
-- M3: a second change inside 15 minutes is added to the alert that has not gone out, not dropped.
create temp table pl_alerts (label text primary key, n bigint) on commit drop;
create function pg_temp.guide_alerts(p_where text default 'true') returns bigint language plpgsql as $$
declare v bigint;
begin
  execute format('select count(*) from public.notification_outbox where event = %L and payload ->> %L = %L and %s',
                 'link_changed', 'ref', '5b5b5b5b-0000-4000-8000-0000000000a1', p_where) into v;
  return v;
end $$;
create function pg_temp.guide_changes(p_url text) returns void language plpgsql as $$
begin
  perform pg_temp.as_user('5a5a5a5a-0000-4000-8000-0000000000a1');
  update public.guides set youtube_url = p_url where id = '5b5b5b5b-0000-4000-8000-0000000000a1';
end $$;
grant execute on function pg_temp.as_user(uuid, text) to authenticated;
grant execute on function pg_temp.guide_changes(text) to authenticated;

insert into pl_alerts values ('first', pg_temp.guide_alerts());
set local role authenticated;
select pg_temp.guide_changes('https://www.youtube.com/@pltestguide3');
reset role;
select pg_temp.check(pg_temp.guide_alerts() = (select n from pl_alerts where label = 'first'),
                     'C1b: the second change does not add another alert while the first is pending');
select pg_temp.check((select bool_and(payload -> 'after' ->> 'youtube_url' = 'https://www.youtube.com/@pltestguide3'
                                      and payload -> 'before' ->> 'youtube_url' = 'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv'
                                      and payload ->> 'changes' like '%@pltestguide2, now https://www.youtube.com/@pltestguide3%')
                      from public.notification_outbox where event = 'link_changed'
                        and payload ->> 'ref' = '5b5b5b5b-0000-4000-8000-0000000000a1' and status = 'pending'),
                     'C1c: the pending alert carries the earliest before, the latest after and both changes');

-- N1: an alert the sender has claimed (attempts 1, locked for 2 minutes) is not changed; a second alert is written.
update public.notification_outbox set attempts = 1, locked_until = now() + interval '2 minutes'
 where event = 'link_changed' and payload ->> 'ref' = '5b5b5b5b-0000-4000-8000-0000000000a1' and status = 'pending';
insert into pl_alerts values ('claimed', pg_temp.guide_alerts());
set local role authenticated;
select pg_temp.guide_changes('https://www.youtube.com/@pltestguide4');
reset role;
select pg_temp.check(pg_temp.guide_alerts('attempts = 0 and status = ''pending''') >= 1
                       and pg_temp.guide_alerts() > (select n from pl_alerts where label = 'claimed'),
                     'C1d: a change while the alert is claimed writes a second alert row');
select pg_temp.check(pg_temp.guide_alerts('attempts = 1 and payload -> ''after'' ->> ''youtube_url'' <> ''https://www.youtube.com/@pltestguide3''') = 0,
                     'C1e: the claimed alert is not changed');

-- N2: an alert within 15 minutes of one already sent is held until those 15 minutes are over.
update public.notification_outbox set status = 'sent', sent_at = now() - interval '5 minutes', created_at = now() - interval '6 minutes'
 where event = 'link_changed' and payload ->> 'ref' = '5b5b5b5b-0000-4000-8000-0000000000a1';
insert into pl_alerts values ('sent', pg_temp.guide_alerts());
set local role authenticated;
select pg_temp.guide_changes('https://www.youtube.com/@pltestguide5');
reset role;
select pg_temp.check(pg_temp.guide_alerts('status = ''pending'' and attempts = 0 and locked_until = now() + interval ''10 minutes''') >= 1,
                     'C1f: the new alert is held until 15 minutes after the last one was sent');
select count(*) from public.claim_notifications(100000);
select pg_temp.check(pg_temp.guide_alerts('status = ''pending'' and attempts > 0') = 0,
                     'C1g: the sender does not claim a held alert');
insert into pl_alerts values ('held', pg_temp.guide_alerts());
set local role authenticated;
select pg_temp.guide_changes('https://www.youtube.com/@pltestguide6');
reset role;
select pg_temp.check(pg_temp.guide_alerts() = (select n from pl_alerts where label = 'held'),
                     'C1h: a change while an alert is held does not add another alert');
select pg_temp.check(pg_temp.guide_alerts('status = ''pending'' and payload -> ''after'' ->> ''youtube_url'' = ''https://www.youtube.com/@pltestguide6''
                                           and payload ->> ''changes'' like ''%@pltestguide5, now https://www.youtube.com/@pltestguide6''') >= 1,
                     'C1i: the held alert carries the latest change, with the newest change at the end');

-- After the 15 minutes a change writes a new alert that is not held.
update public.notification_outbox set status = 'sent', sent_at = now() - interval '20 minutes', created_at = now() - interval '21 minutes', locked_until = null
 where event = 'link_changed' and payload ->> 'ref' = '5b5b5b5b-0000-4000-8000-0000000000a1';
set local role authenticated;
select pg_temp.guide_changes('https://www.youtube.com/@pltestguide7');
reset role;
select pg_temp.check(pg_temp.guide_alerts('status = ''pending'' and attempts = 0 and locked_until is null') >= 1,
                     'C1j: after the window a new alert is written and not held');
select pg_temp.as_user('5a5a5a5a-0000-4000-8000-0000000000b2');
set local role authenticated;
update public.providers set google_business_url = 'https://g.page/pl-lodge-2' where id = '5c5c5c5c-0000-4000-8000-0000000000b2';
reset role;
select pg_temp.check((select count(*) >= 1 from public.notification_outbox where event = 'link_changed'
                        and payload ->> 'ref' = '5c5c5c5c-0000-4000-8000-0000000000b2'
                        and payload ->> 'changes' like '%Google was%'),
                     'C2: changing Google on an approved business alerts the admins');

-- ===========================================================================
-- D. Switch off: new links are refused, clearing and the old guide links still work
-- ===========================================================================
update public.site_settings set value = '{"on": false, "legal": "none"}' where key = 'feature.profile_links';

select pg_temp.as_user('5a5a5a5a-0000-4000-8000-0000000000a1');
set local role authenticated;
select pg_temp.expect_code($q$update public.guides set website = 'https://pltestguide.example.com/' where id = '5b5b5b5b-0000-4000-8000-0000000000a1'$q$,
                           'profile_links_off', 'D1: a new website is refused while the switch is off');
select pg_temp.expect_code($q$update public.guides set google_business_url = 'https://g.page/pl-new' where id = '5b5b5b5b-0000-4000-8000-0000000000a1'$q$,
                           'profile_links_off', 'D2: a new Google link is refused while the switch is off');
update public.guides set youtube_url = null where id = '5b5b5b5b-0000-4000-8000-0000000000a1';
update public.guides set instagram_url = 'https://www.instagram.com/pltestguide/' where id = '5b5b5b5b-0000-4000-8000-0000000000a1';
-- Saving the same value again (a form that sends every field) is not a change.
update public.guides set website = website, headline = 'Mountain guide' where id = '5b5b5b5b-0000-4000-8000-0000000000a1';
reset role;
select pg_temp.check((select youtube_url is null and instagram_url = 'https://www.instagram.com/pltestguide/' and headline = 'Mountain guide'
                      from public.guides where id = '5b5b5b5b-0000-4000-8000-0000000000a1'),
                     'D3: clearing a link, the guide''s Instagram and unchanged values still save');

select pg_temp.as_user('5a5a5a5a-0000-4000-8000-0000000000b2');
set local role authenticated;
select pg_temp.expect_code($q$update public.providers set instagram_url = 'https://www.instagram.com/pl.lodge.new/' where id = '5c5c5c5c-0000-4000-8000-0000000000b2'$q$,
                           'profile_links_off', 'D4: business social links are switched too');
update public.providers set tiktok_url = null where id = '5c5c5c5c-0000-4000-8000-0000000000b2';
reset role;

-- Admins (two-step session) are not limited by the switch.
select pg_temp.as_user('5a5a5a5a-0000-4000-8000-0000000000d4', 'aal2');
set local role authenticated;
update public.guides set website = 'https://pltestguide.example.com/' where id = '5b5b5b5b-0000-4000-8000-0000000000a1';
reset role;
select pg_temp.check((select website = 'https://pltestguide.example.com/' from public.guides where id = '5b5b5b5b-0000-4000-8000-0000000000a1'),
                     'D5: an admin can still set a link while the switch is off');

-- A missing switch row reads as off (fail closed).
delete from public.site_settings where key = 'feature.profile_links';
select pg_temp.as_user('5a5a5a5a-0000-4000-8000-0000000000a1');
set local role authenticated;
select pg_temp.expect_code($q$update public.guides set google_business_url = 'https://g.page/pl-missing' where id = '5b5b5b5b-0000-4000-8000-0000000000a1'$q$,
                           'profile_links_off', 'D6: a missing switch row refuses new links');
reset role;

select 'all passed';
rollback;
