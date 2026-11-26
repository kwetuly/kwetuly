-- NOT APPLIED ON LIVE YET. Walter pastes it in the Supabase SQL editor.
-- Board slice W1-3 (2026-11-26 build plan): host sign-up links on the website and the app show only
-- while these admin switches are on. Walter's decision of 2026-11-24: legal-check items sit behind
-- switches that stay ON for now (docs/legal/vip-and-investment-hosts.md is with the advocate).
--
-- What it does: adds the two switch rows as on, unless they already exist. The W1-1 migration
-- (20261126000000) seeds the same rows; "on conflict do nothing" keeps whichever ran first, so the two
-- can run in either order and running this twice is harmless.
--   feature.vip_hosts         concierge / VIP host ("personal trip host") sign-up
--   feature.investment_hosts  investment visit host sign-up
--
-- Access rules: unchanged (site_settings: "Anyone reads site settings", "Admins manage site settings").
-- Data: no personal data.
--
-- Undo (hides the host links and makes /hosts not found):
--   delete from public.site_settings where key in ('feature.vip_hosts', 'feature.investment_hosts');

insert into public.site_settings (key, value)
values
  ('feature.vip_hosts', '{"on": true}'),
  ('feature.investment_hosts', '{"on": true}')
on conflict (key) do nothing;
