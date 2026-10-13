-- Work with travel agents and tour companies.
-- 1. Guides can say they take work from agents and companies (freelance / white-label).
-- 2. Jobs gain a "handover" kind: a company with more clients than it can handle passes
--    a trip to verified guides, with group size, languages and type of trip.
-- 3. Interest forms accept every site language (they only allowed en/sw).

alter table public.guides
  add column open_to_partners boolean not null default false;

alter table public.jobs
  add column kind text not null default 'crew' check (kind in ('crew', 'handover')),
  add column group_size integer check (group_size between 1 and 200),
  add column languages text[] not null default '{}',
  add column specialty public.guide_specialty;

alter table public.interest_signups drop constraint interest_signups_locale_check;
alter table public.interest_signups
  add constraint interest_signups_locale_check check (locale in ('en', 'sw', 'fr', 'it', 'de', 'pl', 'zh'));
