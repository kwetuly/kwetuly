-- ALREADY APPLIED ON LIVE (history version 20261031214103, name trip_category_farm_retreat). Recovered
-- on 2026-11-22 from the live migration history with read-only queries (slice 0). Do NOT paste on live
-- again (harmless if someone does: "if not exists").
--
-- What it does: adds the tour categories 'farm' and 'retreat' to public.trip_category.
--
-- One line differs from the live statement, on purpose: 'cycling' is added first (if not exists).
-- On live, 'cycling' came from trip_category_cycling at 20261031183809, before this migration, so live
-- has the order ... event, cycling, farm, retreat. In the repo that file is named 20261101000000 and
-- runs AFTER this one, so without this line a fresh database would get farm, retreat, cycling. The
-- extra line keeps the enum order identical to live; 20261101000000 then does nothing.
--
-- Access rules: unchanged.
--
-- Undo: Postgres cannot drop one enum value. Remove its use instead (data only):
--   update public.trips set categories = array_remove(array_remove(categories, 'farm'::public.trip_category),
--     'retreat'::public.trip_category);

alter type public.trip_category add value if not exists 'cycling';
alter type public.trip_category add value if not exists 'farm';
alter type public.trip_category add value if not exists 'retreat';
