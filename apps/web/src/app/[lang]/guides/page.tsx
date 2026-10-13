import type { Metadata } from 'next';
import { Suspense } from 'react';
import { GUIDE_LANGUAGES, GUIDE_SPECIALTIES, REGIONS } from '@rafrika/shared';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { GuideSearch } from '@/components/guide-search';
import { GuideCard } from '@/components/guide-card';
import { listGuides, type GuideFilters } from '@/lib/guides';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.guides.title };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Only accept known values, so URL parameters never reach the database query unchecked.
function readFilters(params: Awaited<SearchParams>): GuideFilters {
  const pick = (key: string) => (typeof params[key] === 'string' ? (params[key] as string) : undefined);
  const specialty = pick('specialty');
  const language = pick('language');
  const region = pick('region');
  return {
    specialty: GUIDE_SPECIALTIES.some((s) => s.id === specialty) ? specialty : undefined,
    language: GUIDE_LANGUAGES.some((l) => l.code === language) ? language : undefined,
    region: (REGIONS as readonly string[]).includes(region ?? '') ? region : undefined,
  };
}

export default async function GuidesPage({ searchParams }: PageProps<'/[lang]/guides'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">{t.guides.title}</h1>
      <Suspense fallback={<div className="mt-6 h-40 animate-pulse rounded-brand bg-surface" />}>
        <Results searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams, t, locale }: { searchParams: SearchParams; t: Dictionary; locale: Locale }) {
  const filters = readFilters(await searchParams);
  const guides = await listGuides(filters);

  return (
    <>
      <div className="mt-6">
        <GuideSearch locale={locale} t={t} defaults={filters} showRegion />
      </div>
      {guides.length === 0 ? (
        <p className="mt-10 text-muted">{t.guides.empty}</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((g) => (
            <GuideCard key={g.id} guide={g} locale={locale} t={t} />
          ))}
        </div>
      )}
    </>
  );
}
