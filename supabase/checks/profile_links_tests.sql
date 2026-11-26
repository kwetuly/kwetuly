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
reset role;

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
