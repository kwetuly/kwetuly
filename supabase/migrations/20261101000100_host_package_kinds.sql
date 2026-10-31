-- DRAFT, NOT APPLIED. Host package kinds and the cycling tag (board 2026-10-31 DECIDED: "Bike, village
-- and hosts"). Apply on live only with Walter's approval, and only after
-- 20261101000000_trip_category_cycling.sql (the new enum value must be committed first).
-- Design notes: docs/tech/bike-village-hosts-fit.md sections 3 and 5,
-- docs/guides/bike-village-hosts-2026-10-31.md.
--
-- What it does:
--   1. guide_packages.kind may also be 'personal_host' (VIP personal trip host) and 'investment_visit'
--      (investment visit host). The kind is a text column with an inline CHECK
--      (20261016000100_guide_packages.sql line 9; Postgres named it guide_packages_kind_check), not an
--      enum, so the check is dropped and added again with the two extra values. Existing rows all pass
--      the wider check, so nothing is rewritten. Hosts are guides with a package of one of these kinds;
--      no new account type, business type or guide_specialty (that enum is also the trip type on trip
--      requests and group trips).
--   2. The Mto wa Mbu village and bike tour (slug mto-wa-mbu-village-bike) also gets the category
--      'cycling'. Its existing categories are kept and stay first (the card icon uses the first one);
--      'cycling' is appended only when it is not there yet.
--
-- Approval of the new kinds: they are not in SIMPLE_PACKAGE_KINDS (apps/web/src/lib/admin-queue.ts), so
-- an owner's package of these kinds is approved one by one, as for any non-simple kind. The existing
-- guard public.guard_guide_package() is unchanged: owners can still only set draft or pending.
--
-- Access rules: unchanged (same table, same policies, same guard trigger).
--
-- Frontend before real use: PACKAGE_KINDS in packages/shared/src/packages.ts needs the two kinds with
-- 7-language labels, plus form help text in English and Kiswahili. Until then labels show empty
-- (the lookups use ?.), and the owner form cannot pick these kinds.
--
-- Idempotent: "drop constraint if exists" + add; the category update only touches the row when
-- 'cycling' is missing.
--
-- Undo (only after no row uses the new kinds; the samples from 20261101000200 do, so remove or convert
-- them first, e.g. update public.guide_packages set kind = 'other' where kind in ('personal_host',
-- 'investment_visit'), which is a content change on approved packages done as admin):
--   alter table public.guide_packages drop constraint if exists guide_packages_kind_check;
--   alter table public.guide_packages add constraint guide_packages_kind_check
--     check (kind in ('cultural', 'one_on_one', 'day_trip', 'multi_day', 'food', 'city', 'nature', 'other'));
--   update public.trips set categories = array_remove(categories, 'cycling'::public.trip_category)
--   where slug = 'mto-wa-mbu-village-bike';

alter table public.guide_packages drop constraint if exists guide_packages_kind_check;
alter table public.guide_packages add constraint guide_packages_kind_check
  check (kind in ('cultural', 'one_on_one', 'day_trip', 'multi_day', 'food', 'city', 'nature', 'other',
                  'personal_host', 'investment_visit'));

update public.trips
set categories = array_append(categories, 'cycling'::public.trip_category)
where slug = 'mto-wa-mbu-village-bike'
  and not ('cycling'::public.trip_category = any (categories));

do $$
begin
  if not exists (select 1 from public.trips where slug = 'mto-wa-mbu-village-bike') then
    raise notice 'host_package_kinds: tour mto-wa-mbu-village-bike not found; cycling tag not added';
  end if;
end;
$$;
