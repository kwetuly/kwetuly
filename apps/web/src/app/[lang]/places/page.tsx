import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Landmark } from 'lucide-react';
import { PLACE_KINDS } from '@rafrika/shared';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { listPlaces } from '@/lib/trips';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.tours.placesTitle, description: t.tours.placesSubtitle };
}

export default async function PlacesPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <span className="flex size-14 items-center justify-center rounded-[5px] bg-leaf text-white"><Landmark className="size-7" aria-hidden /></span>
      <h1 className="mt-5 text-4xl font-extrabold">{t.tours.placesTitle}</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">{t.tours.placesSubtitle}</p>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-[5px] bg-surface" />}>
        <List t={t} locale={locale} />
      </Suspense>
    </div>
  );
}

async function List({ t, locale }: { t: Dictionary; locale: Locale }) {
  const places = await listPlaces();
  // Parks and heritage sites first, then lakes, mountains, villages and towns.
  const order = PLACE_KINDS.map((k) => k.id as string);
  const sorted = [...places].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.name.localeCompare(b.name));
  return (
    <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((place) => (
        <li key={place.id}>
          <Link href={`/${locale}/places/${place.slug}`} className="group block h-full rounded-[5px] border border-line bg-white p-5 hover:border-leaf">
            <p className="text-xs font-semibold text-leaf-dark">{PLACE_KINDS.find((k) => k.id === place.kind)?.[locale]}{place.region ? ` · ${place.region}` : ''}</p>
            <h2 className="mt-1 font-bold group-hover:text-leaf-dark">{place.name}</h2>
            <p className="mt-2 line-clamp-3 text-sm text-muted">{place.summary}</p>
            {place.unesco_year && <p className="mt-3 text-xs font-semibold">{t.tours.unesco} · {place.unesco_year}</p>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
