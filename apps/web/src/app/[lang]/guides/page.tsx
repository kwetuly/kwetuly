import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { X } from 'lucide-react';
import { GUIDE_EXPERTISE, GUIDE_LANGUAGES, GUIDE_SPECIALTIES, MENU, REGIONS } from '@rafrika/shared';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { GuideSearch } from '@/components/guide-search';
import { GuideCard } from '@/components/guide-card';
import { Icon } from '@/components/icon';
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
  const expertise = pick('expertise');
  return {
    specialty: GUIDE_SPECIALTIES.some((s) => s.id === specialty) ? specialty : undefined,
    language: GUIDE_LANGUAGES.some((l) => l.code === language) ? language : undefined,
    region: (REGIONS as readonly string[]).includes(region ?? '') ? region : undefined,
    expertise: GUIDE_EXPERTISE.some((e) => e.id === expertise) ? expertise : undefined,
    female: pick('female') === '1' || undefined,
    partners: pick('partners') === '1' || undefined,
  };
}

// When the visitor came from a menu item (e.g. Special trips → VIP), show that item as the page heading.
function menuHeading(filters: GuideFilters) {
  const candidates = [
    filters.expertise && `/guides?expertise=${filters.expertise}`,
    filters.female && '/guides?female=1',
    filters.partners && '/guides?partners=1',
    filters.specialty && `/guides?specialty=${filters.specialty}`,
  ].filter(Boolean);
  const items = MENU.flatMap((s) => s.items);
  return candidates.map((href) => items.find((i) => i.href === href)).find(Boolean);
}

export default async function GuidesPage({ searchParams }: PageProps<'/[lang]/guides'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Suspense fallback={<div className="mt-6 h-40 animate-pulse rounded-brand bg-surface" />}>
        <Results searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams, t, locale }: { searchParams: SearchParams; t: Dictionary; locale: Locale }) {
  const filters = readFilters(await searchParams);
  const guides = await listGuides(filters);
  const heading = menuHeading(filters);
  const filtered = Object.values(filters).some(Boolean);

  return (
    <>
      {heading ? (
        <div className="flex items-start gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sunset to-gold text-white shadow-lg">
            <Icon name={heading.icon} className="size-7" />
          </span>
          <div>
            <h1 className="text-3xl font-bold">{heading.label[locale]}</h1>
            <p className="mt-1 text-muted">{heading.blurb[locale]}</p>
          </div>
        </div>
      ) : (
        <h1 className="text-3xl font-bold">{t.guides.title}</h1>
      )}

      <div className="mt-6">
        <GuideSearch locale={locale} t={t} defaults={filters} full />
      </div>

      <section id="languages" className="mt-6 scroll-mt-24">
        <h2 className="text-sm font-bold text-muted">{t.guides.byLanguage}</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {GUIDE_LANGUAGES.map((l) => (
            <li key={l.code}>
              <Link
                href={`/${locale}/guides?language=${l.code}`}
                className={`inline-block rounded-[15px] px-3 py-1.5 text-sm font-semibold ${
                  filters.language === l.code ? 'bg-night text-white' : 'border border-line bg-white hover:border-sunset'
                }`}
              >
                {l.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {filtered && (
        <Link href={`/${locale}/guides`} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-sunset">
          <X className="size-4" aria-hidden /> {t.guides.clear}
        </Link>
      )}

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
