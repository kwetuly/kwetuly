import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { TRIP_CATEGORIES, TRIP_CIRCUITS, TRIP_KINDS } from '@rafrika/shared';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { listTrips, type TripFilters } from '@/lib/trips';
import { TripCard } from '@/components/trip-card';
import { PhotoHero } from '@/components/photo-hero';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.tours.title, description: t.tours.subtitle };
}

type Params = Record<string, string | string[] | undefined>;

function readFilters(params: Params): TripFilters {
  const pick = (key: string) => (typeof params[key] === 'string' ? (params[key] as string) : undefined);
  const circuit = pick('circuit');
  const kind = pick('kind');
  const category = pick('category');
  return {
    circuit: TRIP_CIRCUITS.some((c) => c.id === circuit) ? circuit : undefined,
    kind: TRIP_KINDS.some((k) => k.id === kind) ? kind : undefined,
    category: TRIP_CATEGORIES.some((c) => c.id === category) ? category : undefined,
    signature: pick('signature') === '1' || undefined,
  };
}

function hrefWith(locale: Locale, filters: TripFilters, change: Partial<Record<keyof TripFilters, string | undefined>>) {
  const next: Record<string, string> = {};
  const merged = { ...filters, ...change };
  if (merged.circuit) next.circuit = String(merged.circuit);
  if (merged.kind) next.kind = String(merged.kind);
  if (merged.category) next.category = String(merged.category);
  if (merged.signature) next.signature = '1';
  const qs = new URLSearchParams(next).toString();
  return `/${locale}/tours${qs ? `?${qs}` : ''}`;
}

export default async function ToursPage({ searchParams }: PageProps<'/[lang]/tours'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <>
      <PhotoHero photo={'serengetiHerd'}>
        <div className="mx-auto max-w-7xl px-4 py-16">
          <h1 className="max-w-3xl text-4xl font-extrabold sm:text-6xl">{t.tours.title}</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">{t.tours.subtitle}</p>
        </div>
      </PhotoHero>
      <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-7xl animate-pulse rounded-[5px] bg-surface" />}>
        <Catalogue searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
    </>
  );
}

async function Catalogue({ searchParams, t, locale }: { searchParams: Promise<Params>; t: Dictionary; locale: Locale }) {
  const filters = readFilters(await searchParams);
  const trips = await listTrips(filters);

  const chip = (active: boolean) =>
    `rounded-[5px] px-4 py-2 text-sm font-semibold transition ${active ? 'bg-night text-gold' : 'border border-line bg-white hover:border-leaf'}`;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Link href={hrefWith(locale, filters, { circuit: undefined })} className={chip(!filters.circuit)}>{t.tours.any}</Link>
          {TRIP_CIRCUITS.map((c) => (
            <Link key={c.id} href={hrefWith(locale, filters, { circuit: c.id })} className={chip(filters.circuit === c.id)}>{c[locale]}</Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={hrefWith(locale, filters, { kind: undefined })} className={chip(!filters.kind)}>{t.tours.any}</Link>
          {TRIP_KINDS.map((k) => (
            <Link key={k.id} href={hrefWith(locale, filters, { kind: k.id })} className={chip(filters.kind === k.id)}>{k[locale]}</Link>
          ))}
          <Link
            href={hrefWith(locale, filters, { signature: filters.signature ? undefined : '1' })}
            className={`rounded-[5px] px-4 py-2 text-sm font-bold ${filters.signature ? 'bg-leaf text-white' : 'border border-leaf text-leaf-dark'}`}
          >
            ✦ {t.tours.signature}
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={hrefWith(locale, filters, { category: undefined })} className={chip(!filters.category)}>{t.tours.any}</Link>
          {TRIP_CATEGORIES.map((c) => (
            <Link key={c.id} href={hrefWith(locale, filters, { category: c.id })} className={chip(filters.category === c.id)}>{c[locale]}</Link>
          ))}
        </div>
      </div>

      {trips.length === 0 ? (
        <div className="mt-12">
          <p className="text-lg text-muted">{t.tours.empty}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={`/${locale}/guides`} className="btn">{t.nav.guides}</Link>
            <Link href={`/${locale}/calls`} className="btn-outline">{t.traveler.findCall}</Link>
          </div>
        </div>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} locale={locale} labels={t.tours} />
          ))}
        </div>
      )}
      <p className="mt-10 text-xs text-muted">{t.tours.ttbNote} {t.tours.operatorNote}</p>
    </section>
  );
}
