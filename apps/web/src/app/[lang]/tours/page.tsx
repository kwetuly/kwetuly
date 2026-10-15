import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Bookmark, Search, UsersRound } from 'lucide-react';
import {
  ACCOMMODATION_LEVELS,
  MONTHS,
  TOUR_DURATIONS,
  TOUR_GROUP_TYPES,
  TOUR_THEMES,
  TOUR_TYPES,
  TRAVEL_STYLES,
  filterTours,
  readTourFilters,
  type TourFilters,
} from '@rafrika/shared';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { listTours, savedTourIds } from '@/lib/trips';
import { listGroupTrips } from '@/lib/groups';
import { today } from '@/lib/today';
import { TripCard } from '@/components/trip-card';
import { GroupTripCard } from '@/components/group-trip-card';
import { PhotoHero } from '@/components/photo-hero';
import { Icon } from '@/components/icon';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.tours.title, description: t.tours.subtitle };
}

type Params = Record<string, string | string[] | undefined>;
type Filters = TourFilters & { saved?: boolean };

function hrefWith(locale: Locale, filters: Filters, change: Partial<Record<keyof Filters, string | number | boolean | undefined>>) {
  const merged = { ...filters, ...change };
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === false || value === '') continue;
    next.set(key, value === true ? '1' : String(value));
  }
  const qs = next.toString();
  return `/${locale}/tours${qs ? `?${qs}` : ''}`;
}

export default async function ToursPage({ searchParams }: PageProps<'/[lang]/tours'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <>
      <PhotoHero photo="serengetiHerd">
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
  const params = await searchParams;
  const get = (key: string) => (typeof params[key] === 'string' ? (params[key] as string) : undefined);
  const filters: Filters = { ...readTourFilters(get), saved: get('saved') === '1' || undefined };
  const tt = t.tours;

  const [all, saved, now, groups] = await Promise.all([listTours(), savedTourIds(), today(), listGroupTrips()]);
  let tours = filterTours(all, filters);
  if (filters.saved) tours = tours.filter((tour) => saved.has(tour.id));
  const hasFilters = Object.values(filters).some((v) => v !== undefined);

  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-[5px] px-4 py-2 text-sm font-semibold transition ${active ? 'bg-night text-white' : 'border border-line bg-white hover:border-leaf'}`;

  // One-tap shortcuts for the trips people ask for most.
  const quick: { label: string; change: Partial<Filters>; active: boolean }[] = [
    { label: TRAVEL_STYLES.find((s) => s.id === 'vip')![locale], change: { style: 'vip' }, active: filters.style === 'vip' },
    { label: TRAVEL_STYLES.find((s) => s.id === 'honeymoon')![locale], change: { style: 'honeymoon' }, active: filters.style === 'honeymoon' },
    { label: TRAVEL_STYLES.find((s) => s.id === 'family')![locale], change: { style: 'family' }, active: filters.style === 'family' },
    { label: TOUR_GROUP_TYPES[1][locale], change: { group: 'group' }, active: filters.group === 'group' },
    { label: TOUR_GROUP_TYPES[0][locale], change: { group: 'private' }, active: filters.group === 'private' },
    { label: TOUR_DURATIONS[0][locale], change: { duration: 'day' }, active: filters.duration === 'day' },
    { label: ACCOMMODATION_LEVELS[0][locale], change: { accommodation: 'budget' }, active: filters.accommodation === 'budget' },
    { label: ACCOMMODATION_LEVELS[2][locale], change: { accommodation: 'luxury' }, active: filters.accommodation === 'luxury' },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <form action={`/${locale}/tours`} className="rounded-[5px] border border-line bg-white p-4">
        {filters.theme && <input type="hidden" name="theme" value={filters.theme} />}
        {filters.saved && <input type="hidden" name="saved" value="1" />}
        <div className="flex gap-2">
          <label className="relative flex-1">
            <span className="sr-only">{tt.search}</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
            <input name="q" type="search" defaultValue={filters.q} placeholder={tt.search} maxLength={80} className="field pl-12" />
          </label>
          <button className="btn shrink-0">{tt.searchButton}</button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
          <FilterSelect name="type" label={tt.type} value={filters.type} any={tt.any} options={TOUR_TYPES.map((x) => [x.id, x[locale]])} />
          <FilterSelect name="style" label={tt.style} value={filters.style} any={tt.any} options={TRAVEL_STYLES.map((x) => [x.id, x[locale]])} />
          <FilterSelect name="accommodation" label={tt.accommodation} value={filters.accommodation} any={tt.any} options={ACCOMMODATION_LEVELS.map((x) => [x.id, x[locale]])} />
          <FilterSelect name="group" label={tt.groupType} value={filters.group} any={tt.any} options={TOUR_GROUP_TYPES.slice(0, 2).map((x) => [x.id, x[locale]])} />
          <FilterSelect name="duration" label={tt.duration} value={filters.duration} any={tt.any} options={TOUR_DURATIONS.map((x) => [x.id, x[locale]])} />
          <FilterSelect name="month" label={tt.month} value={filters.month ? String(filters.month) : undefined} any={tt.anyMonth} options={MONTHS[locale].map((m, i) => [String(i + 1), m])} />
        </div>
      </form>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={hrefWith(locale, filters, { theme: undefined })} className={chip(!filters.theme)}>{tt.any}</Link>
        {TOUR_THEMES.map((theme) => (
          <Link key={theme.id} href={hrefWith(locale, filters, { theme: filters.theme === theme.id ? undefined : theme.id })} className={chip(filters.theme === theme.id)}>
            <Icon name={theme.icon} className={`size-4 ${filters.theme === theme.id ? 'text-gold' : 'text-leaf-dark'}`} /> {theme[locale]}
          </Link>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {quick.map((q) => (
          <Link key={q.label} href={hrefWith(locale, filters, q.active ? Object.fromEntries(Object.keys(q.change).map((k) => [k, undefined])) : q.change)} className={chip(q.active)}>
            {q.label}
          </Link>
        ))}
        <Link href={hrefWith(locale, filters, { saved: !filters.saved })} className={chip(!!filters.saved)}>
          <Bookmark className={`size-4 ${filters.saved ? 'fill-gold text-gold' : 'text-leaf-dark'}`} aria-hidden /> {tt.savedTours}
        </Link>
      </div>

      <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-muted">
          {tours.length} {tours.length === 1 ? tt.tourOne : tt.tourMany}
        </p>
        {hasFilters && <Link href={`/${locale}/tours`} className="text-sm font-semibold text-leaf-dark underline">{tt.clear}</Link>}
      </div>

      {tours.length === 0 ? (
        <div className="mt-6">
          <p className="text-lg text-muted">{filters.saved && saved.size === 0 ? tt.noSaved : tt.empty}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={`/${locale}/guides`} className="btn">{t.nav.guides}</Link>
            <Link href={`/${locale}/calls`} className="btn-outline">{t.traveler.findCall}</Link>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tours.map((trip) => (
            <TripCard key={trip.id} trip={trip} locale={locale} t={t} today={now} />
          ))}
        </div>
      )}

      <section className="mt-14 rounded-[5px] bg-night p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-[5px] bg-leaf">
              <UsersRound className="size-6" aria-hidden />
            </span>
            <div>
              <h2 className="text-2xl font-extrabold">{tt.groupDepartures}</h2>
              <p className="mt-1 max-w-xl text-white/85">{tt.groupDeparturesBody}</p>
            </div>
          </div>
          <Link href={`/${locale}/group-trips`} className="btn">{tt.seeGroupTrips}</Link>
        </div>
        {groups.length > 0 && (
          <div className="mt-6 grid gap-5 text-charcoal md:grid-cols-3">
            {groups.slice(0, 3).map((group) => <GroupTripCard key={group.id} trip={group} locale={locale} t={t} />)}
          </div>
        )}
      </section>

      <p className="mt-10 text-xs text-muted">
        {tt.ttbNote} {tt.operatorNote}{' '}
        <Link href={`/${locale}/operators`} className="font-semibold text-leaf-dark underline">{tt.operatorsTitle}</Link>
      </p>
    </section>
  );
}

function FilterSelect({ name, label, value, any, options }: { name: string; label: string; value?: string; any: string; options: [string, string][] }) {
  return (
    <label className="block text-xs font-semibold text-muted">
      {label}
      <select name={name} defaultValue={value ?? ''} className="field mt-1 py-2 text-sm text-charcoal">
        <option value="">{any}</option>
        {options.map(([id, text]) => (
          <option key={id} value={id}>{text}</option>
        ))}
      </select>
    </label>
  );
}
