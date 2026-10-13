-- Special expertise a guide offers (accessible travel, VIP, record climbs, ...) and an
-- opt-in "female guide" listing. Keep the expertise list in sync with GUIDE_EXPERTISE
-- in packages/shared/src/guides.ts.

alter table public.guides
  add column expertise text[] not null default '{}',
  add column female_guide boolean not null default false;

alter table public.guides
  add constraint guides_expertise_known check (
    expertise <@ array[
      'blind', 'mobility', 'deaf', 'vip', 'record_climbs', 'charity_climbs',
      'solo_women', 'families', 'seniors', 'honeymoon', 'muslim_friendly', 'students'
    ]::text[]
  );

create index guides_expertise_idx on public.guides using gin (expertise);
