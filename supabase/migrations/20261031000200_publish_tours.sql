-- DRAFT, NOT APPLIED. Publish the 35 reviewed draft tours (Walter approved "fix, then publish", 2026-10-31).
-- Apply on live only with Walter's approval, and only AFTER 20261031000100_trip_facts_fixes.sql has been
-- applied and checked (qa-tester: climb profiles, new stop pins, the change list in
-- docs/marketing/trip-fixes-2026-10-31.md).
--
-- What it does: status 'draft' -> 'published' (public.publish_status is {draft, published, archived};
-- RLS on trips, trip_stops and trip_guides shows rows to the public when status = 'published') and
-- needs_review -> false, for exactly the 35 slugs below, and only while they are still draft. Archived
-- trips (northern-circuit-7-days, signature-guides-day-off) are not in the list and are not touched.
-- If the count is not 35 the whole migration fails and nothing changes.
--
-- Undo: update public.trips set status = 'draft', needs_review = true where slug in (<the same 35 slugs>);

do $$
declare
  v_count int;
begin
  update public.trips
     set status = 'published',
         needs_review = false
   where status = 'draft'
     and slug in (
       'arusha-national-park-day', 'arusha-town-culture-tanzanite', 'bagamoyo-history-day',
       'changuu-prison-island-tortoises', 'chemka-hot-springs', 'dar-es-salaam-city-markets',
       'jozani-forest-red-colobus', 'kili-cultural-immersion-10-days', 'kili-safari-zanzibar-15-days',
       'kilimanjaro-lemosho-8-days', 'kilimanjaro-machame-7-days', 'kilimanjaro-marangu-6-days',
       'kilwa-kisiwani-3-days', 'kondoa-rock-art-2-days', 'lake-eyasi-hadzabe-2-days',
       'lushoto-irente-viewpoint-walk', 'mahale-chimpanzees-5-days', 'materuni-waterfalls-coffee',
       'migration-calving-safari-6-days', 'mikumi-2-days', 'moshi-chagga-town-tour',
       'mount-meru-4-days', 'mto-wa-mbu-village-bike', 'ngiresi-village-arusha',
       'nyerere-boat-walking-4-days', 'ol-doinyo-lengai-natron-3-days', 'ruaha-wilderness-5-days',
       'safari-zanzibar-9-days', 'serengeti-ngorongoro-4-days', 'signature-afcon-2027-fan-days',
       'signature-spice-stone-sea', 'signature-walk-with-a-kili-guide', 'tarangire-day-trip',
       'zanzibar-beach-mnemba-4-days', 'zanzibar-stone-town-spice'
     );
  get diagnostics v_count = row_count;
  if v_count <> 35 then
    raise exception 'publish_tours: expected 35 draft tours, found %; nothing published', v_count;
  end if;
end $$;
