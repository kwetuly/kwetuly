-- ALREADY APPLIED ON LIVE (history version 20261101000222, name experience_package_kinds). Recovered on
-- 2026-11-22 from the live migration history with read-only queries (slice 0). The SQL is the stored
-- statement, unchanged; the live guide_packages_kind_check was compared and matches. Do NOT paste on
-- live again (harmless if someone does: idempotent).
--
-- What it does:
--   1. guide_packages.kind may also be 'farm_visit', 'bike_tour' and 'team_building' (on top of the
--      kinds from 20261101000100_host_package_kinds.sql).
--   2. Tags four tours with the new categories from 20261031214103 (farm or retreat), only where the
--      tag is missing. Tours that do not exist are skipped.
--
-- Access rules: unchanged (same table, policies and guard trigger).
--
-- Undo (only after no package uses the three kinds):
--   alter table public.guide_packages drop constraint if exists guide_packages_kind_check;
--   alter table public.guide_packages add constraint guide_packages_kind_check
--     check (kind in ('cultural', 'one_on_one', 'day_trip', 'multi_day', 'food', 'city', 'nature', 'other',
--                     'personal_host', 'investment_visit'));
--   update public.trips set categories = array_remove(categories, 'farm'::public.trip_category)
--     where slug in ('materuni-waterfalls-coffee', 'ngiresi-village-arusha', 'moshi-chagga-town-tour');
--   update public.trips set categories = array_remove(categories, 'retreat'::public.trip_category)
--     where slug = 'chemka-hot-springs';

alter table public.guide_packages drop constraint if exists guide_packages_kind_check;
alter table public.guide_packages add constraint guide_packages_kind_check
  check (kind in ('cultural', 'one_on_one', 'day_trip', 'multi_day', 'food', 'city', 'nature', 'other',
                  'personal_host', 'investment_visit',
                  'farm_visit', 'bike_tour', 'team_building'));

update public.trips t
set categories = array_append(t.categories, x.cat::public.trip_category)
from (values
  ('materuni-waterfalls-coffee', 'farm'),
  ('ngiresi-village-arusha', 'farm'),
  ('moshi-chagga-town-tour', 'farm'),
  ('chemka-hot-springs', 'retreat')
) as x(slug, cat)
where t.slug = x.slug
  and not (x.cat::public.trip_category = any (t.categories));
