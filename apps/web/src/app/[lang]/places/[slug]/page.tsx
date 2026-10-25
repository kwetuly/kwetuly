import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft, Footprints, Landmark, PawPrint, Sparkles } from 'lucide-react';
import { PLACE_KINDS, STOP_KINDS, type TourStop } from '@kwetuly/shared';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { getPlaceForViewer, toursVisiting } from '@/lib/trips';
import { today } from '@/lib/today';
import { TripCard } from '@/components/trip-card';
import { TourMap } from '@/components/tour-map';
import { PlaceFacts, PlaceSource } from '@/components/tour-extras';

export async function generateMetadata({ params }: PageProps<'/[lang]/places/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const place = await getPlaceForViewer(slug);
  if (!place) notFound();
  return pageMeta({ path: `/places/${place.slug}`, title: place.name, description: place.summary, noindex: place.status !== 'published' });
}

export default async function PlacePage({ params }: PageProps<'/[lang]/places/[slug]'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-80 max-w-5xl animate-pulse rounded-[5px] bg-surface" />}>
      <PlaceView params={params} t={t} locale={locale} />
    </Suspense>
  );
}

async function PlaceView({ params, t, locale }: { params: Promise<{ slug: string }>; t: Dictionary; locale: Locale }) {
  const { slug } = await params;
  const place = await getPlaceForViewer(slug);
  if (!place) notFound();
  const [tours, now] = await Promise.all([toursVisiting(place.id), today()]);
  const tt = t.tours;
  const kinds = Object.fromEntries(STOP_KINDS.map((k) => [k.id, k[locale]]));
  const pin: TourStop[] =
    place.lat != null && place.lng != null
      ? [{ id: place.id, position: 1, day: null, name: place.name, kind: 'park', lat: Number(place.lat), lng: Number(place.lng), note: null, transfer_mode: null, distance_km: null, transfer_hours: null, distance_source: null, place_id: place.id, elevation_m: null }]
      : [];

  const list = (icon: typeof PawPrint, label: string, items: string[]) =>
    items.length > 0 && (
      <section>
        <h2 className="flex items-center gap-2 text-lg font-bold">{icon === PawPrint ? <PawPrint className="size-5 text-leaf-dark" aria-hidden /> : <Footprints className="size-5 text-leaf-dark" aria-hidden />} {label}</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {items.map((x) => <li key={x} className="rounded-[5px] border border-line bg-white px-3 py-1 text-sm">{x}</li>)}
        </ul>
      </section>
    );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href={`/${locale}/places`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-charcoal">
        <ArrowLeft className="size-4 text-leaf-dark" aria-hidden /> {tt.placesTitle}
      </Link>
      <div className="mt-6 flex items-start gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-[5px] bg-leaf text-white"><Landmark className="size-7" aria-hidden /></span>
        <div>
          <p className="text-sm font-semibold text-leaf-dark">{PLACE_KINDS.find((k) => k.id === place.kind)?.[locale]}{place.region ? ` · ${place.region}` : ''}</p>
          <h1 className="text-3xl font-extrabold sm:text-4xl">{place.name}</h1>
        </div>
      </div>
      <p className="mt-5 max-w-3xl text-lg text-muted">{place.summary}</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          <PlaceFacts place={place} t={t} locale={locale} />
          {place.known_for.length > 0 && (
            <section>
              <h2 className="text-lg font-bold">{tt.knownFor}</h2>
              <ul className="mt-3 space-y-1.5 text-sm">
                {place.known_for.map((x) => (
                  <li key={x} className="flex gap-2"><Sparkles className="mt-0.5 size-4 shrink-0 text-leaf-dark" aria-hidden /> {x}</li>
                ))}
              </ul>
            </section>
          )}
          {list(PawPrint, tt.wildlifeLabel, place.wildlife)}
          {list(Footprints, tt.placeActivities, place.activities)}
          <PlaceSource place={place} t={t} locale={locale} />
        </div>
        {pin.length > 0 && (
          <TourMap stops={pin} labels={{ day: tt.dayLabel, kinds, altitude: tt.altitude, view3d: tt.view3d, view2d: tt.view2d }} title={place.name} />
        )}
      </div>

      <h2 className="mt-12 text-2xl font-extrabold">{tt.toursHere} {place.name}</h2>
      {tours.length === 0 ? (
        <p className="mt-3 text-muted">{tt.empty}</p>
      ) : (
        <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tours.map((tour) => <TripCard key={tour.id} trip={tour} locale={locale} t={t} today={now} />)}
        </div>
      )}
    </div>
  );
}
