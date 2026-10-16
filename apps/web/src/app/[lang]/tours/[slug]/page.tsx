import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Backpack,
  Bed,
  Bookmark,
  CalendarDays,
  Check,
  Clock,
  ExternalLink,
  Gauge,
  MapPin,
  RefreshCw,
  Route,
  Sparkles,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  ACCOMMODATION_LEVELS,
  FITNESS_LEVELS,
  MONTHS,
  STOP_KINDS,
  TOUR_GROUP_TYPES,
  TOUR_THEMES,
  TRANSFER_MODES,
  TRAVEL_STYLES,
  TRIP_CIRCUITS,
  EVENTS,
  formatPrice,
  hasRecordedCheck,
  straightLineKm,
  tourMatchesTheme,
  verifiedPrice,
  type TourStop,
} from '@rafrika/shared';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import { defaultLocale, hasLocale, type Locale } from '@/i18n/config';
import { getTourGuides, getTourStops, getTripForViewer, listTours, placesForStops, savedTourIds, tripSummary, tripTitle, type Trip } from '@/lib/trips';
import type { Guide } from '@/lib/guides';
import { today } from '@/lib/today';
import { TourTypeBadge, TripCard, TripCover, durationText, tourCoverUrl } from '@/components/trip-card';
import { GuideAvatar, languageName, specialtyName } from '@/components/guide-card';
import { RatingSummary } from '@/components/stars';
import { TourMap } from '@/components/tour-map';
import { OperatorLogo } from '@/components/operator-logo';
import { AltitudeProfile, DayDetails, GoodToKnow, PlaceGuides } from '@/components/tour-extras';
import { TrackView } from '@/components/recently-viewed';
import { ShareButtons } from '@/components/share-buttons';
import { LogEvent } from '@/components/analytics';
import { JsonLd } from '@/components/json-ld';
import { StickyCta } from '@/components/sticky-cta';
import { SITE_URL } from '@/lib/site';
import { enquireTrip, toggleSavedTour } from './actions';
import { PrefillContact } from '@/components/prefill-contact';
import { SubmitButton } from '@/components/submit-button';

type Params = Promise<{ slug: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: PageProps<'/[lang]/tours/[slug]'>): Promise<Metadata> {
  const { slug, lang } = await params;
  const trip = await getTripForViewer(slug);
  if (!trip) notFound();
  const locale = hasLocale(lang) ? lang : defaultLocale;
  return pageMeta({
    path: `/tours/${trip.slug}`,
    title: tripTitle(trip, locale),
    description: tripSummary(trip, locale),
    image: tourCoverUrl(trip),
    noindex: trip.status !== 'published',
  });
}

export default async function TripPage({ params, searchParams }: PageProps<'/[lang]/tours/[slug]'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<div className="pattern-kanga h-80" />}>
      <TripView params={params} searchParams={searchParams} t={t} locale={locale} />
    </Suspense>
  );
}

const dateFormat = (locale: Locale) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

async function TripView({ params, searchParams, t, locale }: { params: Params; searchParams: Search; t: Dictionary; locale: Locale }) {
  const { slug } = await params;
  const trip = await getTripForViewer(slug);
  if (!trip) notFound();
  const [status, stops, team, saved, now] = await Promise.all([searchParams, getTourStops(trip), getTourGuides(trip.id, trip.categories), savedTourIds(), today()]);
  const places = await placesForStops(stops);
  const tt = t.tours;
  const title = tripTitle(trip, locale);
  const operator = trip.tour_operators;
  const kinds = Object.fromEntries(STOP_KINDS.map((k) => [k.id, k[locale]]));

  return (
    <>
      {trip.status === 'published' && (
        <TrackView item={{ href: `/${locale}/tours/${trip.slug}`, title, subtitle: durationText(trip, tt), image: tourCoverUrl(trip, 300) }} />
      )}
      <LogEvent event={EVENTS.tourViewed} props={{ tour: trip.slug, tour_type: trip.tour_type, locale }} />
      {status.sent && <LogEvent event={EVENTS.enquirySent} props={{ kind: 'tour', tour: trip.slug, locale }} />}
      {!status.sent && <StickyCta target="enquire" label={tt.enquireTitle} track="tour_sticky_enquire" />}
      {trip.status === 'published' && <TourJsonLd trip={trip} title={title} stops={stops} locale={locale} now={now} listTitle={tt.title} />}
      <section className="relative text-white">
        <TripCover trip={trip} className="absolute inset-0" sizes="100vw" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-shade via-shade/60 to-shade/10" />
        <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-10">
          <Link href={`/${locale}/tours`} className="inline-flex items-center gap-1 text-sm text-white/80 hover:text-white">
            <ArrowLeft className="size-4 text-gold" aria-hidden /> {tt.title}
          </Link>
          <div className="mt-16 flex flex-wrap gap-2">
            <TourTypeBadge trip={trip} locale={locale} />
            {trip.status !== 'published' && <span className="rounded-[5px] bg-white px-3 py-1 text-xs font-bold text-leaf-dark">{tt.draft}</span>}
            {trip.needs_review && (
              <span className="inline-flex items-center gap-1 rounded-[5px] bg-white px-3 py-1 text-xs font-bold text-charcoal">
                <RefreshCw className="size-3" aria-hidden /> {tt.needsReview}
              </span>
            )}
            <span className="rounded-[5px] bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
              {TRIP_CIRCUITS.find((c) => c.id === trip.circuit)?.[locale]}
            </span>
          </div>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold sm:text-5xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-lg text-white/85">{tripSummary(trip, locale)}</p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
            <span className="flex items-center gap-1.5"><Clock className="size-4 text-gold" aria-hidden /> {durationText(trip, tt)}</span>
            {trip.start_from && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4 text-gold" aria-hidden /> {trip.start_from}
                {trip.end_at && trip.end_at !== trip.start_from && ` → ${trip.end_at}`}
              </span>
            )}
            {operator && (
              <span className="flex items-center gap-1.5">
                <BadgeCheck className="size-4 text-gold" aria-hidden /> {operator.name}
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-10">
          <SourceNote trip={trip} t={t} locale={locale} />
          {trip.promo_text && <p className="rounded-[5px] bg-sand p-4 font-semibold text-leaf-dark">✦ {trip.promo_text}</p>}

          <Facts trip={trip} t={t} locale={locale} />

          {trip.highlights.length > 0 && (
            <section>
              <h2 className="text-xl font-bold">{tt.highlights}</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {trip.highlights.map((h) => (
                  <li key={h} className="flex gap-2 rounded-[5px] bg-surface p-3 text-sm font-medium">
                    <Sparkles className="mt-0.5 size-4 shrink-0 text-leaf-dark" aria-hidden /> {h}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {stops.length > 0 && (
            <section id="map" className="scroll-mt-28">
              <h2 className="flex items-center gap-2 text-xl font-bold"><Route className="size-5 text-leaf-dark" aria-hidden /> {tt.map}</h2>
              <div className="mt-4">
                <TourMap stops={stops} labels={{ day: tt.dayLabel, kinds, altitude: tt.altitude, view3d: tt.view3d, view2d: tt.view2d }} title={`${tt.map}: ${title}`} />
              </div>
              <p className="mt-2 text-xs text-muted">{tt.mapHelp}</p>
              <StopList stops={stops} t={t} locale={locale} kinds={kinds} />
              <p className="mt-3 text-xs text-muted">{tt.mapNote}</p>
            </section>
          )}

          <AltitudeProfile stops={stops} t={t} />

          <section>
            <h2 className="text-xl font-bold">{tt.itinerary}</h2>
            <ol className="mt-4 space-y-0">
              {trip.itinerary.map((d, i) => (
                <li key={`${d.day}-${i}`} className="relative flex gap-4 pb-6 last:pb-0">
                  <div className="flex flex-col items-center">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-[5px] bg-leaf text-sm font-extrabold text-white">{d.day}</span>
                    {i < trip.itinerary.length - 1 && <span className="w-0.5 flex-1 bg-line" />}
                  </div>
                  <div className="pt-1.5">
                    <h3 className="font-bold">{d.title}</h3>
                    <p className="mt-1 text-sm text-muted">{d.body}</p>
                    {/* Day trips split one day into parts; show that day's stops once. */}
                    {(i === 0 || trip.itinerary[i - 1].day !== d.day) && <DayDetails day={d} stops={stops} t={t} />}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <PlaceGuides places={places} t={t} locale={locale} />

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
              <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarDays className="size-5 text-leaf-dark" aria-hidden /> {tt.bestTime}</h2>
              <div className="mt-3 grid grid-cols-6 gap-1.5">
                {MONTHS[locale].map((m, i) => (
                  <span key={m} className={`rounded-[5px] py-1.5 text-center text-xs font-bold ${trip.best_months.includes(i + 1) ? 'bg-forest text-white' : 'bg-surface text-muted'}`}>
                    {m}
                  </span>
                ))}
              </div>
              {trip.best_time_note && <p className="mt-2 text-sm text-muted">{trip.best_time_note}</p>}
            </div>
            {trip.packing.length > 0 && (
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold"><Backpack className="size-5 text-leaf-dark" aria-hidden /> {tt.packing}</h2>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {trip.packing.map((x) => (
                    <li key={x} className="flex gap-2"><Check className="size-4 shrink-0 text-forest" aria-hidden /> {x}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <GoodToKnow items={trip.good_to_know} t={t} />

          <MeetGuides guides={team.guides} assigned={team.assigned} t={t} locale={locale} />

          {trip.destinations.length > 0 && (
            <section>
              <h2 className="text-lg font-bold">{tt.destinations}</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {trip.destinations.map((d) => (
                  <li key={d} className="rounded-[5px] border border-line px-3 py-1 text-sm">{d}</li>
                ))}
              </ul>
            </section>
          )}

          <ShareButtons path={`/${locale}/tours/${trip.slug}`} title={title} text={`${t.share.shareTrip}: ${title}`} labels={t.share} />

          <p className="text-xs text-muted">
            {tt.ttbNote} {tt.operatorNote}
          </p>
        </div>

        <aside id="enquire" className="h-fit scroll-mt-24 space-y-4 lg:sticky lg:top-24">
          <EnquiryCard trip={trip} status={status} t={t} locale={locale} now={now} guides={team.guides} />
          <form action={toggleSavedTour}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="slug" value={trip.slug} />
            <input type="hidden" name="trip_id" value={trip.id} />
            <input type="hidden" name="saved" value={saved.has(trip.id) ? '1' : ''} />
            <button className="btn-outline w-full">
              <Bookmark className={`size-4 ${saved.has(trip.id) ? 'fill-gold text-gold' : ''}`} aria-hidden /> {saved.has(trip.id) ? tt.saved : tt.save}
            </button>
          </form>
          {operator && (
            <Link href={`/${locale}/operators/${operator.slug}`} className="flex items-center gap-3 rounded-[5px] border border-line bg-white p-4 hover:border-leaf">
              <OperatorLogo name={operator.name} logo={operator.logo_url} />
              <span className="min-w-0 text-sm">
                <span className="block text-xs text-muted">{tt.operator}</span>
                <strong className="flex items-center gap-1">
                  {operator.name}
                  {operator.verified_at && <BadgeCheck className="size-4 shrink-0 text-leaf-dark" aria-label={tt.verified} />}
                </strong>
                {operator.location && <span className="block text-xs text-muted">{operator.location}</span>}
              </span>
            </Link>
          )}
          <Link href={`/${locale}/calls`} className="flex items-center gap-2 rounded-[5px] border border-line p-4 text-sm font-semibold hover:border-leaf">
            <Video className="size-5 text-leaf-dark" aria-hidden /> {tt.talkToGuide}
          </Link>
        </aside>
      </div>
      <Suspense fallback={null}>
        <RelatedTours trip={trip} t={t} locale={locale} now={now} />
      </Suspense>
    </>
  );
}

// Who wrote this tour and where the facts come from.
function SourceNote({ trip, t, locale }: { trip: Trip; t: Dictionary; locale: Locale }) {
  const tt = t.tours;
  if (trip.tour_type === 'signature') {
    return (
      <p className="flex items-center gap-2 rounded-[5px] border border-gold bg-gold/10 p-4 text-sm font-semibold">
        <Sparkles className="size-4 shrink-0 text-charcoal" aria-hidden /> {tt.signatureNote}
      </p>
    );
  }
  return (
    <div className="rounded-[5px] border border-line bg-surface p-4 text-sm">
      <p>{tt.operatorTourNote}</p>
      {trip.source_url && (
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold">{tt.source}:</span>
          <a href={trip.source_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-semibold text-leaf-dark underline">
            {trip.tour_operators?.name ?? tt.sourceLink} <ExternalLink className="size-3.5" aria-hidden />
          </a>
          {trip.source_checked_at && (
            <span className="text-muted">{tt.lastChecked}: {dateFormat(locale).format(new Date(trip.source_checked_at))}</span>
          )}
        </p>
      )}
    </div>
  );
}

// Key facts at a glance. Anything not yet confirmed says "On request" rather than guessing.
function Facts({ trip, t, locale }: { trip: Trip; t: Dictionary; locale: Locale }) {
  const tt = t.tours;
  const onRequest = <span className="text-muted">{tt.onRequest}</span>;
  const themes = TOUR_THEMES.filter((x) => tourMatchesTheme(trip, x.id)).map((x) => x[locale]);
  const styles = TRAVEL_STYLES.filter((x) => trip.travel_styles.includes(x.id)).map((x) => x[locale]);
  const groupRange =
    trip.min_group || trip.max_group ? `${trip.min_group ?? 1}–${trip.max_group ?? '…'} ${tt.people}` : null;
  const facts: { icon: typeof Clock; label: string; value: ReactNode }[] = [
    { icon: Clock, label: tt.duration, value: durationText(trip, tt) },
    { icon: MapPin, label: `${tt.start} / ${tt.end}`, value: trip.start_from ? `${trip.start_from} → ${trip.end_at ?? trip.start_from}` : onRequest },
    { icon: Sparkles, label: tt.category, value: [...themes, ...styles].join(', ') || onRequest },
    { icon: Bed, label: tt.accommodation, value: ACCOMMODATION_LEVELS.find((x) => x.id === trip.accommodation)?.[locale] ?? onRequest },
    {
      icon: Users,
      label: tt.groupType,
      value: (
        <>
          {TOUR_GROUP_TYPES.find((x) => x.id === trip.group_type)?.[locale] ?? onRequest}
          {groupRange && <span className="block text-xs text-muted">{tt.groupRange}: {groupRange}</span>}
        </>
      ),
    },
    { icon: Gauge, label: tt.fitness, value: FITNESS_LEVELS.find((x) => x.id === trip.fitness)?.[locale] ?? onRequest },
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {facts.map((f) => (
        <div key={f.label} className="flex gap-3 rounded-[5px] border border-line bg-white p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[5px] bg-leaf text-white">
            <f.icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 text-sm">
            <dt className="text-xs font-semibold text-muted">{f.label}</dt>
            <dd className="font-semibold">{f.value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

// Numbered stops with the leg from the previous stop: a checked distance and time when we have one,
// otherwise only the straight-line distance, clearly labelled.
function StopList({ stops, t, locale, kinds }: { stops: TourStop[]; t: Dictionary; locale: Locale; kinds: Record<string, string> }) {
  const tt = t.tours;
  return (
    <ol className="mt-4 divide-y divide-line rounded-[5px] border border-line bg-white">
      {stops.map((stop, i) => {
        const previous = stops[i - 1];
        const crow = previous ? Math.round(straightLineKm({ lat: Number(previous.lat), lng: Number(previous.lng) }, { lat: Number(stop.lat), lng: Number(stop.lng) })) : 0;
        return (
          <li key={stop.id} className="flex gap-3 p-3 text-sm">
            <button type="button" data-map-stop={stop.position} aria-label={stop.name} className={`flex size-7 shrink-0 items-center justify-center rounded-[5px] text-xs font-extrabold ${stop.kind === 'peak' ? 'bg-gold text-charcoal' : 'bg-leaf text-white'}`}>
              {stop.position}
            </button>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                <button type="button" data-map-stop={stop.position} className="text-left hover:text-leaf-dark hover:underline">{stop.name}</button>{' '}
                <span className="font-normal text-muted">· {kinds[stop.kind]}{stop.day ? ` · ${tt.dayLabel} ${stop.day}` : ''}{stop.elevation_m != null ? ` · ≈ ${stop.elevation_m.toLocaleString('en-US')} m` : ''}</span>
              </p>
              {previous && crow > 0 && (
                <p className="mt-0.5 text-xs text-muted">
                  {stop.distance_km || stop.transfer_hours ? (
                    <>
                      {stop.transfer_mode && `${TRANSFER_MODES[stop.transfer_mode][locale]}: `}
                      {stop.distance_km && `${Math.round(Number(stop.distance_km))} km`}
                      {stop.distance_km && stop.transfer_hours && ' · '}
                      {stop.transfer_hours && `≈ ${Number(stop.transfer_hours)} h`}
                      {stop.distance_source && ` (${tt.source}: ${stop.distance_source})`}
                    </>
                  ) : (
                    <>≈ {crow} km {tt.straightLine} · {tt.transferTbc}</>
                  )}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function MeetGuides({ guides, assigned, t, locale }: { guides: Guide[]; assigned: boolean; t: Dictionary; locale: Locale }) {
  const tt = t.tours;
  if (guides.length === 0) return null;
  return (
    <section>
      <h2 className="text-xl font-bold">{tt.meetGuides}</h2>
      <p className="mt-1 text-sm text-muted">{assigned ? tt.meetGuidesIntro : tt.suggestedGuides}</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {guides.map((g) => (
          <li key={g.id}>
            <Link href={`/${locale}/guides/${g.slug}`} className="group flex gap-3 rounded-[5px] border border-line bg-white p-3 hover:border-leaf">
              <GuideAvatar guide={g} size={56} />
              <div className="min-w-0 text-sm">
                <p className="flex items-center gap-1 font-bold group-hover:text-leaf-dark">
                  {g.display_name}
                  {g.verification_status === 'approved' && hasRecordedCheck(g) && <BadgeCheck className="size-4 shrink-0 text-leaf-dark" aria-label={t.guides.verified} />}
                </p>
                <p className="truncate text-xs text-muted">{g.specialties.slice(0, 2).map((s) => specialtyName(s, locale)).join(', ')}</p>
                <p className="truncate text-xs text-muted">
                  {g.languages.map(languageName).join(', ')}
                  {g.years_experience != null && ` · ${g.years_experience} ${tt.yearsShort}`}
                </p>
                <div className="mt-1"><RatingSummary avg={g.rating_avg} count={g.rating_count} labels={t.reviews} /></div>
                <span className="mt-1 inline-block text-xs font-semibold text-leaf-dark underline">{tt.viewProfile}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Three more published tours on the same theme, so the page never ends in a dead end.
async function RelatedTours({ trip, t, locale, now }: { trip: Trip; t: Dictionary; locale: Locale; now: Date }) {
  const all = (await listTours()).filter((x) => x.slug !== trip.slug);
  const themes = TOUR_THEMES.filter((x) => tourMatchesTheme(trip, x.id)).map((x) => x.id);
  const score = (x: Trip) => themes.filter((id) => tourMatchesTheme(x, id)).length * 2 + (x.circuit === trip.circuit ? 1 : 0);
  const related = all.map((x) => ({ x, s: score(x) })).filter((r) => r.s > 0).sort((a, b) => b.s - a.s).slice(0, 3).map((r) => r.x);
  if (related.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16">
      <h2 className="text-2xl font-extrabold tracking-tight">{t.tours.related}</h2>
      <div className="mt-5 grid gap-5 md:grid-cols-3">
        {related.map((x) => (
          <TripCard key={x.id} trip={x} locale={locale} t={t} today={now} />
        ))}
      </div>
    </section>
  );
}

function EnquiryCard({ trip, status, t, locale, now, guides }: { trip: Trip; status: Record<string, string | string[] | undefined>; t: Dictionary; locale: Locale; now: Date; guides: Guide[] }) {
  const tt = t.tours;
  const price = verifiedPrice(trip, now);
  const date = dateFormat(locale);
  return (
    <div className="overflow-hidden rounded-[5px] bg-night text-white shadow-xl">
      <div className="bg-leaf px-6 py-5 text-white">
        {price ? (
          <>
            <p className="text-sm font-bold">{tt.priceFrom}</p>
            <p className="text-3xl font-extrabold tabular-nums">{formatPrice(price.amount, price.currency)}</p>
            {trip.price_conditions && <p className="mt-1 text-sm text-white/90">{trip.price_conditions}</p>}
            <p className="mt-2 text-xs text-white/85">
              {tt.priceVerified}: {date.format(new Date(trip.price_verified_at!))}
              {trip.price_valid_until && ` · ${tt.priceValidUntil} ${date.format(new Date(trip.price_valid_until))}`}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-bold">{tt.enquireTitle}</p>
            <p className="text-2xl font-extrabold">{tt.priceTbc}</p>
          </>
        )}
      </div>
      <div className="p-6">
        <p className="text-sm text-white/80">{tt.enquireBody}</p>
        {status.sent ? (
          <>
            <p className="mt-4 rounded-[5px] bg-mint p-4 font-semibold text-forest">✓ {tt.sent}</p>
            <p className="mt-3 text-sm text-white">
              {t.travel.reminder}{' '}
              <Link href={`/${locale}/travel-info`} className="font-semibold underline">{t.travel.reminderLink}</Link>
            </p>
          </>
        ) : (
          <form action={enquireTrip} className="mt-4 space-y-3 text-charcoal">
            {status.error && <p className="rounded-[5px] bg-red-50 p-3 text-sm text-red-800">{t.auth.error}</p>}
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="slug" value={trip.slug} />
            <input type="hidden" name="trip_id" value={trip.id} />
            <input type="hidden" name="trip_title" value={trip.title_en} />
            <input name="name" className="field" placeholder={t.profile.name} aria-label={t.profile.name} autoComplete="name" required maxLength={120} />
            <PrefillContact />
            <input name="contact" className="field" placeholder={t.profile.contact} aria-label={t.profile.contact} required maxLength={160} />
            <div className="grid grid-cols-2 gap-2">
              <input name="dates" className="field" placeholder={tt.dates} aria-label={tt.dates} maxLength={120} />
              <input name="group_size" type="number" min={1} max={99} className="field" placeholder={tt.groupSize} aria-label={tt.groupSize} />
            </div>
            {guides.length > 0 && (
              <select name="guide" defaultValue="" className="field" aria-label={tt.meetGuides}>
                <option value="">{tt.meetGuides}: {tt.any}</option>
                {guides.map((g) => (
                  <option key={g.id} value={g.display_name}>{g.display_name}</option>
                ))}
              </select>
            )}
            <textarea name="message" className="field min-h-20" placeholder={t.profile.message} aria-label={t.profile.message} maxLength={1500} />
            <SubmitButton className="btn w-full" data-track="tour_send_enquiry">{tt.send}</SubmitButton>
            <p className="text-xs leading-relaxed text-white">{t.ux.whatNextTour}</p>
            <p className="text-xs leading-relaxed text-white">{t.ux.privacyTour}</p>
            <p className="text-xs leading-relaxed text-white">
              {t.travel.reminder}{' '}
              <Link href={`/${locale}/travel-info`} className="font-semibold underline">{t.travel.reminderLink}</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

// Structured data for published tours. The price is only included while it is verified and valid.
function TourJsonLd({ trip, title, stops, locale, now, listTitle }: { trip: Trip; title: string; stops: TourStop[]; locale: Locale; now: Date; listTitle: string }) {
  const url = `${SITE_URL}/${locale}/tours/${trip.slug}`;
  const price = verifiedPrice(trip, now);
  return (
    <JsonLd
      data={[
        {
          '@context': 'https://schema.org',
          '@type': 'TouristTrip',
          name: title,
          description: tripSummary(trip, locale),
          url,
          image: tourCoverUrl(trip),
          touristType: trip.travel_styles,
          provider: trip.tour_operators ? { '@type': 'Organization', name: trip.tour_operators.name } : { '@type': 'Organization', name: 'Rafrika' },
          itinerary: stops.length
            ? { '@type': 'ItemList', itemListElement: stops.map((s, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'Place', name: s.name, geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lng } } })) }
            : undefined,
          offers: price
            ? { '@type': 'Offer', price: price.amount, priceCurrency: price.currency, url, priceValidUntil: trip.price_valid_until ?? undefined }
            : undefined,
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Rafrika', item: `${SITE_URL}/${locale}` },
            { '@type': 'ListItem', position: 2, name: listTitle, item: `${SITE_URL}/${locale}/tours` },
            { '@type': 'ListItem', position: 3, name: title },
          ],
        },
      ]}
    />
  );
}
