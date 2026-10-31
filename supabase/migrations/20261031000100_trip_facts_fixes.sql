-- DRAFT, NOT APPLIED. Trip fact fixes for the 35 draft tours (public.trips status 'draft', needs_review true).
-- Walter approved "fix the 35 draft tours, then publish them" on 2026-10-31. This file only fixes facts.
-- It does NOT publish anything and does NOT clear needs_review: publishing is a separate one-line step
-- after review. Apply on live only with Walter's approval.
--
-- Source: docs/marketing/trip-library-facts.md (checked 2026-10-30), conflicts A1 #1-#8, #11, #14, #15, #17
-- and B1/B2/B5/B7. Change list with old -> new and sources: docs/marketing/trip-fixes-2026-10-31.md.
-- Rules followed: official sources first (TANAPA for Horombo); camp altitudes that only have OPERATOR
-- figures are stored as approximate (the tour page already prints them with "≈"), using the lower end
-- of the range the facts doc gives; anything the facts doc marks TO VERIFY is left unchanged.
--
-- Data only: no table, column, policy or function changes. Nothing is deleted. Rows touched:
--   public.trips       11 of the 35 drafts: Meru, Lengai, Chemka, calving safari, two Mnemba trips (facts),
--                      Machame and Lemosho (summit-day text names Stella Point); Marangu changes stops only;
--                      Nyerere and the Signature Kili walk (unproven claims removed, section 8)
--   public.trip_stops  19 altitude updates on existing stops, 7 new stops, positions renumbered in 3 climbs
-- Translations: trips only has _en and _sw columns. No _sw column held a wrong number. Only title_sw of
-- Chemka changes (adds the place name "Kikuletwa"). New English good_to_know lines are flagged for
-- localization in the change list.
--
-- Undo: see the commented block at the end of this file (restores every old value, removes the new stops).
--
-- Read-only checks after applying (localhost first):
--   select t.slug, s.position, s.day, s.name, s.elevation_m, s.note from public.trip_stops s
--     join public.trips t on t.id = s.trip_id
--    where t.slug in ('kilimanjaro-machame-7-days','kilimanjaro-lemosho-8-days','kilimanjaro-marangu-6-days','mount-meru-4-days')
--    order by t.slug, s.position;
--   select count(*) from public.trips where status = 'draft' and needs_review;   -- still 35

-- ---------------------------------------------------------------------------
-- 1. Kilimanjaro and Meru stop altitudes (A1 #1, #2, #3, #4)
--    Notes on trip_stops are admin-only (not shown on tour pages), so the source goes there.
-- ---------------------------------------------------------------------------

-- Horombo: OFFICIAL, TANAPA gives 3,720 m (was 3,903 m from terrain data).
update public.trip_stops s
   set elevation_m = 3720,
       note = 'Altitude from TANAPA (Kilimanjaro National Park exhibit), checked 2026-10-30.'
  from public.trips t
 where t.id = s.trip_id and t.slug = 'kilimanjaro-marangu-6-days' and s.name = 'Horombo Hut';

-- Camps with OPERATOR figures only (approximate; lower end of the range in the facts doc).
update public.trip_stops s
   set elevation_m = v.e,
       note = 'Altitude approximate (operator figures, no official camp list); confirm from a dated camp signboard photo. Checked 2026-10-30.'
  from public.trips t,
       (values
         ('Machame Camp', 2835),     -- was 2,589
         ('Shira Cave Camp', 3750),  -- was 2,991
         ('Barranco Camp', 3976),    -- was 4,053
         ('Karanga Camp', 3995),     -- was 4,468
         ('Barafu Camp', 4673),      -- was 4,580
         ('Mweka Gate', 1640),       -- was 1,560
         ('Londorossi Gate', 2250),  -- was 1,380
         ('Shira 1 Camp', 3505),     -- was 3,767 (profile went down from Shira 1 to Shira 2)
         ('Shira 2 Camp', 3810),     -- was 3,676
         ('Mandara Hut', 2700),      -- was 2,317
         ('Kibo Hut', 4703)          -- was 4,517
       ) as v (name, e)
 where t.id = s.trip_id
   and t.slug in ('kilimanjaro-machame-7-days', 'kilimanjaro-lemosho-8-days', 'kilimanjaro-marangu-6-days')
   and s.name = v.name;

update public.trip_stops s
   set elevation_m = v.e,
       note = 'Altitude approximate (operator figures; no TANAPA figure reachable); confirm from a dated hut signboard photo. Checked 2026-10-30.'
  from public.trips t,
       (values
         ('Miriakamba Hut', 2503),   -- was 2,412
         ('Saddle Hut', 3500)        -- was 3,163
       ) as v (name, e)
 where t.id = s.trip_id and t.slug = 'mount-meru-4-days' and s.name = v.name;

-- Socialist Peak: sources give 4,562 to 4,566 m, TANAPA not reachable. One figure everywhere: about 4,560 m.
update public.trip_stops s
   set elevation_m = 4560,
       note = 'About 4,560 m: sources give 4,562 to 4,566 m; replace with the TANAPA figure once confirmed. Checked 2026-10-30.'
  from public.trips t
 where t.id = s.trip_id and t.slug = 'mount-meru-4-days' and s.name = 'Socialist Peak';   -- was 4,510

update public.trips
   set highlights = array_replace(highlights, 'Socialist Peak at 4,566 m', 'Socialist Peak, about 4,560 m')
 where slug = 'mount-meru-4-days';

-- ---------------------------------------------------------------------------
-- 2. Missing stops (A1 #6 Machame and Lemosho, #8 Marangu)
--    Map pins for new stops are approximate positions between the existing pins; the facts doc has no
--    coordinates, so qa-tester / admin re-checks them in /admin/trips. Positions are renumbered by first
--    moving the trip's stops to position + 100 (keeps the unique (trip_id, position) rule happy).
--    Each block runs only once (skips if the new stop already exists).
-- ---------------------------------------------------------------------------

do $$
declare
  v_trip uuid;
begin
  -- Machame 7 days: add Lava Tower (day 3), Stella Point and Mweka Camp (day 6).
  select id into v_trip from public.trips where slug = 'kilimanjaro-machame-7-days';
  if v_trip is not null and not exists (select 1 from public.trip_stops where trip_id = v_trip and name = 'Mweka Camp') then
    update public.trip_stops set position = position + 100 where trip_id = v_trip;
    update public.trip_stops s set position = v.p
      from (values ('Machame Gate', 1), ('Machame Camp', 2), ('Shira Cave Camp', 3), ('Barranco Camp', 5),
                   ('Karanga Camp', 6), ('Barafu Camp', 7), ('Uhuru Peak', 9), ('Mweka Gate', 11)) as v (name, p)
     where s.trip_id = v_trip and s.name = v.name;
    insert into public.trip_stops (trip_id, position, day, name, kind, lat, lng, elevation_m, note) values
      (v_trip, 4, 3, 'Lava Tower', 'activity', -3.0790, 37.3110, 4630,
       'Lunch stop, then down to Barranco. Altitude approximate (operator figure). Map pin approximate. Checked 2026-10-30.'),
      (v_trip, 8, 6, 'Stella Point', 'peak', -3.0805, 37.3600, null,
       'On the crater rim on the way to Uhuru Peak. No altitude in the facts doc yet. Map pin approximate.'),
      (v_trip, 10, 6, 'Mweka Camp', 'camp', -3.1550, 37.3430, 3068,
       'Night after the summit. Altitude approximate (operator figure). Map pin approximate. Checked 2026-10-30.');
  end if;

  -- Lemosho 8 days: add Lava Tower (day 4), Stella Point and Mweka Camp (day 7).
  select id into v_trip from public.trips where slug = 'kilimanjaro-lemosho-8-days';
  if v_trip is not null and not exists (select 1 from public.trip_stops where trip_id = v_trip and name = 'Mweka Camp') then
    update public.trip_stops set position = position + 100 where trip_id = v_trip;
    update public.trip_stops s set position = v.p
      from (values ('Londorossi Gate', 1), ('Mti Mkubwa Camp', 2), ('Shira 1 Camp', 3), ('Shira 2 Camp', 4),
                   ('Barranco Camp', 6), ('Karanga Camp', 7), ('Barafu Camp', 8), ('Uhuru Peak', 10), ('Mweka Gate', 12)) as v (name, p)
     where s.trip_id = v_trip and s.name = v.name;
    insert into public.trip_stops (trip_id, position, day, name, kind, lat, lng, elevation_m, note) values
      (v_trip, 5, 4, 'Lava Tower', 'activity', -3.0790, 37.3110, 4630,
       'Lunch stop, then down to Barranco. Altitude approximate (operator figure). Map pin approximate. Checked 2026-10-30.'),
      (v_trip, 9, 7, 'Stella Point', 'peak', -3.0805, 37.3600, null,
       'On the crater rim on the way to Uhuru Peak. No altitude in the facts doc yet. Map pin approximate.'),
      (v_trip, 11, 7, 'Mweka Camp', 'camp', -3.1550, 37.3430, 3068,
       'Night after the summit. Altitude approximate (operator figure). Map pin approximate. Checked 2026-10-30.');
  end if;

  -- Marangu 6 days: add the day-3 acclimatisation walk and Gilman's Point (day 5).
  select id into v_trip from public.trips where slug = 'kilimanjaro-marangu-6-days';
  if v_trip is not null and not exists (select 1 from public.trip_stops where trip_id = v_trip and name = 'Gilman''s Point') then
    update public.trip_stops set position = position + 100 where trip_id = v_trip;
    update public.trip_stops s set position = case
        when s.name = 'Marangu Gate' and s.day = 1 then 1
        when s.name = 'Mandara Hut' then 2
        when s.name = 'Horombo Hut' then 3
        when s.name = 'Kibo Hut' then 5
        when s.name = 'Uhuru Peak' then 7
        when s.name = 'Marangu Gate' and s.day = 6 then 8
      end
     where s.trip_id = v_trip;
    insert into public.trip_stops (trip_id, position, day, name, kind, lat, lng, elevation_m, note) values
      (v_trip, 4, 3, 'Mawenzi ridge (acclimatisation walk)', 'activity', -3.1050, 37.4650, 4389,
       'Walk up towards Zebra Rocks and the Mawenzi ridge, back to Horombo the same day. Altitude approximate (operator figure). Map pin approximate. Checked 2026-10-30.'),
      (v_trip, 6, 5, 'Gilman''s Point', 'peak', -3.0720, 37.3700, 5669,
       'Crater rim on the way to Uhuru Peak. Altitude approximate (operator figures 5,669 to 5,685 m). Map pin approximate. Checked 2026-10-30.');
  end if;
end $$;

-- Summit-day text now names Stella Point, matching the new stops (English itinerary only; no _sw itinerary exists).
update public.trips
   set itinerary = (
     select jsonb_agg(case when d->>'day' = '6'
                           then jsonb_set(d, '{body}', to_jsonb('Midnight start to Uhuru Peak via Stella Point, descend to Mweka Camp.'::text))
                           else d end order by ord)
       from jsonb_array_elements(itinerary) with ordinality as x(d, ord))
 where slug = 'kilimanjaro-machame-7-days'
   and itinerary @> '[{"day":6,"body":"Midnight start to Uhuru Peak, descend to Mweka Camp."}]';

update public.trips
   set itinerary = (
     select jsonb_agg(case when d->>'day' = '7'
                           then jsonb_set(d, '{body}', to_jsonb('Uhuru Peak at sunrise via Stella Point, descend to Mweka Camp.'::text))
                           else d end order by ord)
       from jsonb_array_elements(itinerary) with ordinality as x(d, ord))
 where slug = 'kilimanjaro-lemosho-8-days'
   and itinerary @> '[{"day":7,"body":"Uhuru Peak at sunrise, descend to Mweka."}]';

-- ---------------------------------------------------------------------------
-- 3. Wrong park in copied "good to know" lines (B2, B7)
--    Meru is in Arusha National Park, not Kilimanjaro National Park.
--    Ol Doinyo Lengai is not in a national park (and not NCAA); no official authority found yet, so the
--    line names none.
-- ---------------------------------------------------------------------------

update public.trips
   set good_to_know = array_replace(good_to_know,
         'Climbs are led by licensed guides with registered porters; Kilimanjaro National Park permits are arranged by your operator.',
         'Climbs are led by licensed guides with registered porters; Arusha National Park permits are arranged by your operator.')
 where slug = 'mount-meru-4-days';

-- ---------------------------------------------------------------------------
-- 4. Safety note for Ol Doinyo Lengai (A1 #15 decision list, B7)
-- ---------------------------------------------------------------------------

update public.trips
   set good_to_know = array_replace(good_to_know,
         'Climbs are led by licensed guides with registered porters; Kilimanjaro National Park permits are arranged by your operator.',
         'Climbs are led by licensed guides; your operator arranges any permits and local fees.')
 where slug = 'ol-doinyo-lengai-natron-3-days';

update public.trips
   set good_to_know = array_append(good_to_know, 'Ol Doinyo Lengai is an active volcano. Your guide checks the latest volcanic activity before every climb and will cancel or turn back if it is not safe.')
 where slug = 'ol-doinyo-lengai-natron-3-days'
   and not ('Ol Doinyo Lengai is an active volcano. Your guide checks the latest volcanic activity before every climb and will cancel or turn back if it is not safe.' = any (good_to_know));

-- ---------------------------------------------------------------------------
-- 5. Chemka and Kikuletwa are the same springs (A1 #11): one trip, both names in the title for search.
--    There is no second (Kikuletwa) trip in public.trips, so nothing is archived. The only other trip
--    that visits the springs, signature-guides-day-off, is already archived.
-- ---------------------------------------------------------------------------

update public.trips
   set title_en = 'Chemka (Kikuletwa) Hot Springs',
       title_sw = 'Chemchemi za Maji Moto Chemka (Kikuletwa)'
 where slug = 'chemka-hot-springs'
   and title_en = 'Chemka Hot Springs';

update public.trip_stops s
   set name = 'Chemka (Kikuletwa) hot springs'
  from public.trips t
 where t.id = s.trip_id and t.slug = 'chemka-hot-springs' and s.name = 'Chemka hot springs';

-- ---------------------------------------------------------------------------
-- 6. Calving season timing (A1 #14). best_months unchanged ({1,2,3}); a note says it is not guaranteed.
-- ---------------------------------------------------------------------------

update public.trips
   set best_time_note = 'Calving usually runs from about late January to March, peaking around February, and the herds are often on the southern plains from about December. Timing shifts with the rains, so nobody can guarantee it.'
 where slug = 'migration-calving-safari-6-days'
   and best_time_note is null;

-- ---------------------------------------------------------------------------
-- 7. Mnemba conservation area fee (A1 #17, B5). OFFICIAL-SECONDHAND: Ministry of Blue Economy and
--    Fisheries fees from 1 September 2025, as reported by The Citizen.
-- ---------------------------------------------------------------------------

update public.trips
   set good_to_know = array_append(good_to_know, 'Mnemba Island Marine Conservation Area charges an entry fee: from 1 September 2025, US$25 per adult and US$10 per child for visitors from outside the East African Community, and US$10 / US$5 for EAC citizens (Zanzibar Ministry of Blue Economy and Fisheries, as reported by The Citizen). Check the current fee with your operator.')
 where slug in ('zanzibar-beach-mnemba-4-days', 'safari-zanzibar-9-days')
   and not exists (select 1 from unnest(good_to_know) g where g like 'Mnemba Island Marine Conservation Area charges%');

-- ---------------------------------------------------------------------------
-- 8. Unproven claims removed (Walter, 2026-10-31: cautious path). Each WHERE matches the live text exactly
--    (checked with read-only SELECTs on 2026-10-31); if the text was edited since, the row is left alone.
-- ---------------------------------------------------------------------------

-- 8a. Nyerere: "Africa's largest national park" is not confirmed by the facts doc. Superlative dropped.
update public.trips
   set summary_en = 'A big wilderness park in southern Tanzania: boat safaris on the Rufiji River, walking safaris and wild dogs, far from the crowds.',
       summary_sw = 'Hifadhi kubwa ya porini kusini mwa Tanzania: safari za boti mto Rufiji, matembezi na mbwa mwitu, mbali na msongamano.'
 where slug = 'nyerere-boat-walking-4-days'
   and summary_en = 'Africa''s largest national park: boat safaris on the Rufiji River, walking safaris and wild dogs, far from the crowds.'
   and summary_sw = 'Hifadhi kubwa zaidi Afrika: safari za boti mto Rufiji, matembezi na mbwa mwitu, mbali na msongamano.';

-- 8b. Meru: the armed ranger escort is OPERATOR practice, TO VERIFY as a TANAPA rule. Claim dropped from
--     the highlight and the day-1 text (English only; Meru has no ranger claim in _sw columns).
update public.trips
   set highlights = array_remove(highlights, 'Armed ranger escort past giraffe and buffalo')
 where slug = 'mount-meru-4-days'
   and 'Armed ranger escort past giraffe and buffalo' = any (highlights);

update public.trips
   set itinerary = (
     select jsonb_agg(case when d->>'day' = '1'
                           then jsonb_set(d, '{body}', to_jsonb('Walk up through the forest and open glades of the lower slopes.'::text))
                           else d end order by ord)
       from jsonb_array_elements(itinerary) with ordinality as x(d, ord))
 where slug = 'mount-meru-4-days'
   and itinerary @> '[{"day":1,"body":"Walk through wildlife areas with a ranger."}]';

-- 8c. Signature Kili walk: "300+ summits" and "hundreds of times" describe an unnamed guide. Dropped.
update public.trips
   set highlights = array_remove(highlights, 'Stories from 300+ summits'),
       summary_en = 'A day hike into Kilimanjaro''s rainforest with a licensed Kilimanjaro guide, plus a personal prep session for your climb.',
       summary_sw = 'Matembezi ya siku msituni Kilimanjaro na mwongozaji mwenye leseni, pamoja na maandalizi binafsi.'
 where slug = 'signature-walk-with-a-kili-guide'
   and 'Stories from 300+ summits' = any (highlights)
   and summary_en = 'A day hike into Kilimanjaro''s rainforest with a guide who has stood on the summit hundreds of times, plus a personal prep session for your climb.'
   and summary_sw = 'Matembezi ya siku msituni Kilimanjaro na mwongozaji aliyefika kileleni mamia ya mara, pamoja na maandalizi binafsi.';

-- 8d. More unproven claims (Walter 2026-10-31: remove 1-3, keep the founder line).
update public.trips
   set summary_en = 'Walking safari with a park ranger, Momella lakes and colobus monkeys in the forest, all close to Arusha town.'
 where slug = 'arusha-national-park-day'
   and summary_en = 'Walking safari with an armed ranger, Momella lakes and colobus monkeys in the forest, all close to Arusha town.';

update public.trips
   set highlights = array_replace(highlights, 'Walking safari with an armed ranger', 'Walking safari')
 where slug = 'nyerere-boat-walking-4-days'
   and 'Walking safari with an armed ranger' = any (highlights);

update public.trips
   set summary_en = 'A full day among giant baobabs and large elephant herds in northern Tanzania.'
 where slug = 'tarangire-day-trip'
   and summary_en = 'A full day among giant baobabs and some of the largest elephant herds in northern Tanzania.';

update public.trips
   set title_en = 'Kwetuly Signature: Walk with a Kilimanjaro Guide',
       title_sw = 'Kwetuly Maalum: Tembea na Mwongozaji wa Kilimanjaro'
 where slug = 'signature-walk-with-a-kili-guide'
   and title_en = 'Kwetuly Signature: Walk with a Kilimanjaro Veteran';

-- ---------------------------------------------------------------------------
-- UNDO (run by hand only if needed; restores the values from before this file)
-- ---------------------------------------------------------------------------
-- begin;
-- delete from public.trip_stops s using public.trips t
--  where t.id = s.trip_id
--    and ((t.slug in ('kilimanjaro-machame-7-days', 'kilimanjaro-lemosho-8-days') and s.name in ('Lava Tower', 'Stella Point', 'Mweka Camp'))
--      or (t.slug = 'kilimanjaro-marangu-6-days' and s.name in ('Mawenzi ridge (acclimatisation walk)', 'Gilman''s Point')));
-- -- positions back to 1..n in the old order (day, then current position):
-- update public.trip_stops s set position = s.position + 100 from public.trips t
--  where t.id = s.trip_id and t.slug in ('kilimanjaro-machame-7-days', 'kilimanjaro-lemosho-8-days', 'kilimanjaro-marangu-6-days');
-- update public.trip_stops s set position = r.rn from (
--   select s2.id, row_number() over (partition by s2.trip_id order by s2.position) as rn
--     from public.trip_stops s2 join public.trips t on t.id = s2.trip_id
--    where t.slug in ('kilimanjaro-machame-7-days', 'kilimanjaro-lemosho-8-days', 'kilimanjaro-marangu-6-days')) r
--  where s.id = r.id;
-- update public.trip_stops s set elevation_m = v.e, note = null from public.trips t, (values
--   ('Horombo Hut', 3903), ('Machame Camp', 2589), ('Shira Cave Camp', 2991), ('Barranco Camp', 4053),
--   ('Karanga Camp', 4468), ('Barafu Camp', 4580), ('Mweka Gate', 1560), ('Londorossi Gate', 1380),
--   ('Shira 1 Camp', 3767), ('Shira 2 Camp', 3676), ('Mandara Hut', 2317), ('Kibo Hut', 4517),
--   ('Miriakamba Hut', 2412), ('Saddle Hut', 3163), ('Socialist Peak', 4510)) as v (name, e)
--  where t.id = s.trip_id and s.name = v.name
--    and t.slug in ('kilimanjaro-machame-7-days', 'kilimanjaro-lemosho-8-days', 'kilimanjaro-marangu-6-days', 'mount-meru-4-days');
-- update public.trips set highlights = array_replace(highlights, 'Socialist Peak, about 4,560 m', 'Socialist Peak at 4,566 m') where slug = 'mount-meru-4-days';
-- update public.trips set itinerary = (select jsonb_agg(case when d->>'day' = '6' then jsonb_set(d, '{body}', to_jsonb('Midnight start to Uhuru Peak, descend to Mweka Camp.'::text)) else d end order by ord)
--   from jsonb_array_elements(itinerary) with ordinality as x(d, ord)) where slug = 'kilimanjaro-machame-7-days';
-- update public.trips set itinerary = (select jsonb_agg(case when d->>'day' = '7' then jsonb_set(d, '{body}', to_jsonb('Uhuru Peak at sunrise, descend to Mweka.'::text)) else d end order by ord)
--   from jsonb_array_elements(itinerary) with ordinality as x(d, ord)) where slug = 'kilimanjaro-lemosho-8-days';
-- update public.trips set good_to_know = array_replace(good_to_know,
--   'Climbs are led by licensed guides with registered porters; Arusha National Park permits are arranged by your operator.',
--   'Climbs are led by licensed guides with registered porters; Kilimanjaro National Park permits are arranged by your operator.') where slug = 'mount-meru-4-days';
-- update public.trips set good_to_know = array_remove(array_replace(good_to_know,
--   'Climbs are led by licensed guides; your operator arranges any permits and local fees.',
--   'Climbs are led by licensed guides with registered porters; Kilimanjaro National Park permits are arranged by your operator.'),
--   'Ol Doinyo Lengai is an active volcano. Your guide checks the latest volcanic activity before every climb and will cancel or turn back if it is not safe.')
--  where slug = 'ol-doinyo-lengai-natron-3-days';
-- update public.trips set title_en = 'Chemka Hot Springs', title_sw = 'Chemchemi za Maji Moto Chemka' where slug = 'chemka-hot-springs';
-- update public.trip_stops s set name = 'Chemka hot springs' from public.trips t where t.id = s.trip_id and t.slug = 'chemka-hot-springs' and s.name = 'Chemka (Kikuletwa) hot springs';
-- update public.trips set best_time_note = null where slug = 'migration-calving-safari-6-days';
-- update public.trips set good_to_know = (select coalesce(array_agg(g order by o), '{}') from unnest(good_to_know) with ordinality u(g, o) where g not like 'Mnemba Island Marine Conservation Area charges%')
--  where slug in ('zanzibar-beach-mnemba-4-days', 'safari-zanzibar-9-days');
-- update public.trips set summary_en = 'Africa''s largest national park: boat safaris on the Rufiji River, walking safaris and wild dogs, far from the crowds.',
--   summary_sw = 'Hifadhi kubwa zaidi Afrika: safari za boti mto Rufiji, matembezi na mbwa mwitu, mbali na msongamano.' where slug = 'nyerere-boat-walking-4-days';
-- update public.trips set highlights = array_append(highlights, 'Armed ranger escort past giraffe and buffalo'),
--   itinerary = (select jsonb_agg(case when d->>'day' = '1' then jsonb_set(d, '{body}', to_jsonb('Walk through wildlife areas with a ranger.'::text)) else d end order by ord)
--     from jsonb_array_elements(itinerary) with ordinality as x(d, ord)) where slug = 'mount-meru-4-days';
-- update public.trips set highlights = array_append(highlights, 'Stories from 300+ summits'),
--   summary_en = 'A day hike into Kilimanjaro''s rainforest with a guide who has stood on the summit hundreds of times, plus a personal prep session for your climb.',
--   summary_sw = 'Matembezi ya siku msituni Kilimanjaro na mwongozaji aliyefika kileleni mamia ya mara, pamoja na maandalizi binafsi.' where slug = 'signature-walk-with-a-kili-guide';
-- commit;
