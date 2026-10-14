import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Plus, UsersRound } from 'lucide-react';
import { GUIDE_SPECIALTIES } from '@rafrika/shared';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { PhotoHero } from '@/components/photo-hero';
import { GroupTripCard } from '@/components/group-trip-card';
import { listGroupTrips } from '@/lib/groups';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.groups.title, description: t.groups.subtitle };
}

export default async function GroupTripsPage({ searchParams }: PageProps<'/[lang]/group-trips'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <>
      <PhotoHero photo="saddleHikers">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-14">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-sunset">
            <UsersRound className="size-7" aria-hidden />
          </span>
          <h1 className="mt-5 text-4xl font-extrabold sm:text-5xl">{t.groups.title}</h1>
          <p className="mt-3 max-w-2xl text-lg text-white/85">{t.groups.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/${locale}/group-trips/new`} className="btn"><Plus className="size-4" aria-hidden /> {t.groups.start}</Link>
            <Link href={`/${locale}/group-trips/mine`} className="btn-dark bg-white/15 backdrop-blur hover:bg-white hover:text-night">{t.groups.mine}</Link>
          </div>
        </div>
      </PhotoHero>
      <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-6xl animate-pulse rounded-3xl bg-surface" />}>
        <List searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
    </>
  );
}

async function List({ searchParams, t, locale }: { searchParams: Promise<Record<string, string | string[] | undefined>>; t: Dictionary; locale: Locale }) {
  const raw = (await searchParams).type;
  const type = typeof raw === 'string' && GUIDE_SPECIALTIES.some((s) => s.id === raw) ? raw : undefined;
  const trips = await listGroupTrips(type);
  const chip = (active: boolean) =>
    `rounded-[15px] px-4 py-2 text-sm font-semibold ${active ? 'bg-night text-white' : 'border border-line bg-white hover:border-sunset'}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap gap-2">
        <Link href={`/${locale}/group-trips`} className={chip(!type)}>{t.tours.any}</Link>
        {GUIDE_SPECIALTIES.map((s) => (
          <Link key={s.id} href={`/${locale}/group-trips?type=${s.id}`} className={chip(type === s.id)}>{s[locale]}</Link>
        ))}
      </div>
      {trips.length === 0 ? (
        <div className="mt-10">
          <p className="text-lg text-muted">{t.groups.none}</p>
          <Link href={`/${locale}/guides`} className="btn-outline mt-5">{t.nav.guides}</Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => <GroupTripCard key={trip.id} trip={trip} locale={locale} t={t} />)}
        </div>
      )}
    </div>
  );
}
