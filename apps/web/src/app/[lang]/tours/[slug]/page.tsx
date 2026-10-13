import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft, CalendarDays, Check, Clock, MapPin, ShieldCheck, Sparkles, Video, X } from 'lucide-react';
import { MONTHS, TRIP_CIRCUITS, TRIP_OPERATORS, formatUsd } from '@rafrika/shared';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import { defaultLocale, hasLocale, type Locale } from '@/i18n/config';
import { getTripForViewer, tripSummary, tripTitle, type Trip } from '@/lib/trips';
import { TripCover } from '@/components/trip-card';
import { ShareButtons } from '@/components/share-buttons';
import { photoUrl, tripPhoto } from '@/lib/photos';
import { enquireTrip } from './actions';

type Params = Promise<{ slug: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: PageProps<'/[lang]/tours/[slug]'>): Promise<Metadata> {
  const { slug, lang } = await params;
  const trip = await getTripForViewer(slug);
  if (!trip) notFound();
  const locale = hasLocale(lang) ? lang : defaultLocale;
  return {
    title: tripTitle(trip, locale),
    description: tripSummary(trip, locale),
    openGraph: { images: [photoUrl(tripPhoto(trip.slug, trip.categories), 1200)] },
    robots: trip.status === 'published' ? undefined : { index: false },
  };
}

export default async function TripPage({ params, searchParams }: PageProps<'/[lang]/tours/[slug]'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<div className="pattern-kanga h-80" />}>
      <TripView params={params} searchParams={searchParams} t={t} locale={locale} />
    </Suspense>
  );
}

async function TripView({ params, searchParams, t, locale }: { params: Params; searchParams: Search; t: Dictionary; locale: Locale }) {
  const { slug } = await params;
  const trip = await getTripForViewer(slug);
  if (!trip) notFound();
  const status = await searchParams;
  const tt = t.tours;

  return (
    <>
      <section className="relative text-white">
        <TripCover trip={trip} className="absolute inset-0" sizes="100vw" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-night via-night/60 to-night/10" />
        <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-10">
          <Link href={`/${locale}/tours`} className="inline-flex items-center gap-1 text-sm text-white/80 hover:text-white">
            <ArrowLeft className="size-4" aria-hidden /> {tt.title}
          </Link>
          <div className="mt-16 flex flex-wrap gap-2">
            {trip.is_signature && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1 text-xs font-bold text-night">
                <Sparkles className="size-3" aria-hidden /> {tt.signature}
              </span>
            )}
            {trip.status !== 'published' && <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-sunset">{tt.draft}</span>}
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
              {TRIP_CIRCUITS.find((c) => c.id === trip.circuit)?.[locale]}
            </span>
          </div>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold sm:text-5xl">{tripTitle(trip, locale)}</h1>
          <p className="mt-3 max-w-2xl text-lg text-white/85">{tripSummary(trip, locale)}</p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
            <span className="flex items-center gap-1.5"><Clock className="size-4" aria-hidden /> {trip.days} {trip.days === 1 ? tt.day : tt.days}</span>
            {trip.start_from && <span className="flex items-center gap-1.5"><MapPin className="size-4" aria-hidden /> {tt.startsFrom} {trip.start_from}</span>}
            <span className="flex items-center gap-1.5"><ShieldCheck className="size-4" aria-hidden /> {TRIP_OPERATORS[trip.operated_by][locale]}</span>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-[1fr_380px]">
        <div className="space-y-10">
          {trip.promo_text && <p className="rounded-2xl bg-sand p-4 font-semibold text-sunset-dark">✦ {trip.promo_text}</p>}

          <section>
            <h2 className="text-xl font-bold">{tt.highlights}</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {trip.highlights.map((h) => (
                <li key={h} className="flex gap-2 rounded-2xl bg-surface p-3 text-sm font-medium">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-sunset" aria-hidden /> {h}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold">{tt.itinerary}</h2>
            <ol className="mt-4 space-y-0">
              {trip.itinerary.map((d, i) => (
                <li key={`${d.day}-${i}`} className="relative flex gap-4 pb-6 last:pb-0">
                  <div className="flex flex-col items-center">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunset text-sm font-extrabold text-night">
                      {d.day}
                    </span>
                    {i < trip.itinerary.length - 1 && <span className="w-0.5 flex-1 bg-line" />}
                  </div>
                  <div className="pt-1.5">
                    <h3 className="font-bold">{d.title}</h3>
                    <p className="mt-1 text-sm text-muted">{d.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="text-lg font-bold">{tt.includes}</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {trip.includes.map((x) => (
                  <li key={x} className="flex gap-2"><Check className="size-4 shrink-0 text-forest" aria-hidden /> {x}</li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-lg font-bold">{tt.excludes}</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {trip.excludes.map((x) => (
                  <li key={x} className="flex gap-2"><X className="size-4 shrink-0 text-muted" aria-hidden /> {x}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarDays className="size-5 text-sunset" aria-hidden /> {tt.bestTime}</h2>
              <div className="mt-3 grid grid-cols-6 gap-1.5">
                {MONTHS[locale].map((m, i) => (
                  <span
                    key={m}
                    className={`rounded-lg py-1.5 text-center text-xs font-bold ${trip.best_months.includes(i + 1) ? 'bg-forest text-white' : 'bg-surface text-muted'}`}
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold">{tt.destinations}</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {trip.destinations.map((d) => (
                  <li key={d} className="rounded-full border border-line px-3 py-1 text-sm">{d}</li>
                ))}
              </ul>
            </div>
          </section>

          <ShareButtons path={`/${locale}/tours/${trip.slug}`} title={tripTitle(trip, locale)} text={`${t.share.shareTrip}: ${tripTitle(trip, locale)}`} labels={t.share} />

          <p className="text-xs text-muted">{tt.ttbNote} {tt.operatorNote}</p>
        </div>

        <aside id="enquire" className="h-fit lg:sticky lg:top-24">
          <EnquiryCard trip={trip} status={status} t={t} locale={locale} />
          <Link href={`/${locale}/calls`} className="mt-4 flex items-center gap-2 rounded-2xl border border-line p-4 text-sm font-semibold hover:border-sunset">
            <Video className="size-5 text-sunset" aria-hidden /> {tt.talkToGuide}
          </Link>
        </aside>
      </div>
    </>
  );
}

function EnquiryCard({ trip, status, t, locale }: { trip: Trip; status: Record<string, string | string[] | undefined>; t: Dictionary; locale: Locale }) {
  const tt = t.tours;
  return (
    <div className="overflow-hidden rounded-3xl bg-night text-white shadow-xl">
      <div className="bg-sunset px-6 py-5 text-night">
        <p className="text-sm font-bold uppercase tracking-wide">{trip.price_from_usd != null ? tt.priceFrom : tt.enquireTitle}</p>
        <p className="text-3xl font-extrabold tabular-nums">{trip.price_from_usd != null ? formatUsd(trip.price_from_usd) : tt.priceOnRequest}</p>
      </div>
      <div className="p-6">
        <p className="text-sm text-white/80">{tt.enquireBody}</p>
        {status.sent ? (
          <p className="mt-4 rounded-2xl bg-mint p-4 font-semibold text-forest">✓ {tt.sent}</p>
        ) : (
          <form action={enquireTrip} className="mt-4 space-y-3 text-charcoal">
            {status.error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-800">{t.auth.error}</p>}
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="slug" value={trip.slug} />
            <input type="hidden" name="trip_id" value={trip.id} />
            <input type="hidden" name="trip_title" value={trip.title_en} />
            <input name="name" className="field" placeholder={t.profile.name} required maxLength={120} />
            <input name="contact" className="field" placeholder={t.profile.contact} required maxLength={160} />
            <div className="grid grid-cols-2 gap-2">
              <input name="dates" className="field" placeholder={tt.dates} maxLength={120} />
              <input name="group_size" type="number" min={1} max={99} className="field" placeholder={tt.groupSize} />
            </div>
            <textarea name="message" className="field min-h-20" placeholder={t.profile.message} maxLength={1500} />
            <button className="btn w-full">{tt.send}</button>
          </form>
        )}
      </div>
    </div>
  );
}
