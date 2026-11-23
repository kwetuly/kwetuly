-- ALREADY APPLIED ON LIVE (history version 20261101000249, name stories). Recovered on 2026-11-22 from
-- the live migration history with read-only queries (slice 0). The table, checks, index, trigger and
-- policies are the stored statement; the live columns, constraint names, policy expressions and
-- trigger were compared and match. Only "if not exists" / "drop ... if exists" were added so the file
-- can run twice. Do NOT paste on live again.
--
-- What it does: public.stories (links to YouTube videos and podcast episodes, admin-written, consent
-- date required before publishing) and public.story_guides (which approved guides appear in a story).
--
-- Access rules: anyone reads published stories while feature.stories is on (private.feature_on, from
-- 20261031214101); admins (two-step, private.is_admin) read and write everything. story_guides: anyone
-- reads links of readable stories to approved guides; admins write.
--
-- Undo (deletes every story row):
--   drop table public.story_guides; drop table public.stories;

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('video', 'podcast')),
  provider text not null check (provider in ('youtube', 'spotify', 'apple_podcasts')),
  external_id text not null check (char_length(external_id) between 5 and 60),
  url text not null check (char_length(url) <= 400),
  title text not null check (char_length(title) between 5 and 160),
  summary text check (char_length(summary) <= 600),
  language text not null default 'en' check (language ~ '^[a-z]{2}$'),
  duration_minutes int check (duration_minutes between 1 and 600),
  published boolean not null default false,
  published_on date not null default current_date,
  consent_recorded_on date,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stories_url_safe check (url !~ '[[:space:]"<>\\]'),
  constraint stories_video_is_youtube check (kind <> 'video' or provider = 'youtube'),
  constraint stories_url_allowed check (
    case provider
      when 'youtube' then
        external_id ~ '^[A-Za-z0-9_-]{11}$'
        and (url ~ ('^https://(www\.|m\.)?youtube\.com/(watch\?v=|shorts/|embed/)' || external_id || '([?&][!-~]*)?$')
             or url ~ ('^https://youtu\.be/' || external_id || '(\?[!-~]*)?$'))
      when 'spotify' then
        external_id ~ '^(episode|show)/[A-Za-z0-9]{22}$'
        and url ~ ('^https://open\.spotify\.com/' || external_id || '(\?[!-~]*)?$')
      when 'apple_podcasts' then
        external_id ~ '^id[0-9]{5,12}(\?i=[0-9]{5,20})?$'
        and url ~ '^https://podcasts\.apple\.com/[a-z]{2}/podcast/[A-Za-z0-9%._-]{0,200}/id[0-9]{5,12}(\?i=[0-9]{5,20})?$'
        and url like ('%/' || external_id)
      else false
    end),
  constraint stories_consent_before_publish check (not published or consent_recorded_on is not null)
);

comment on table public.stories is
  'Links to YouTube videos and podcast episodes. Admin write only; public read of published rows while feature.stories is on.';

create index if not exists stories_published_idx on public.stories (published_on desc) where published;

drop trigger if exists stories_updated_at on public.stories;
create trigger stories_updated_at
  before update on public.stories
  for each row execute function public.set_updated_at();

alter table public.stories enable row level security;

drop policy if exists "Anyone reads published stories while the feature is on" on public.stories;
create policy "Anyone reads published stories while the feature is on" on public.stories
  for select to anon, authenticated
  using ((published and (select private.feature_on('stories'))) or (select private.is_admin()));
drop policy if exists "Admins write stories" on public.stories;
create policy "Admins write stories" on public.stories
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create table if not exists public.story_guides (
  story_id uuid not null references public.stories (id) on delete cascade,
  guide_id uuid not null references public.guides (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, guide_id)
);

create index if not exists story_guides_guide_idx on public.story_guides (guide_id);

alter table public.story_guides enable row level security;

drop policy if exists "Anyone reads guide links of readable stories" on public.story_guides;
create policy "Anyone reads guide links of readable stories" on public.story_guides
  for select to anon, authenticated
  using (
    (select private.is_admin())
    or (exists (select 1 from public.stories s where s.id = story_id)
        and exists (select 1 from public.guides g where g.id = guide_id and g.verification_status = 'approved')));
drop policy if exists "Admins write story guide links" on public.story_guides;
create policy "Admins write story guide links" on public.story_guides
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
