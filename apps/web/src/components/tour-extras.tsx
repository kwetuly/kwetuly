import Link from 'next/link';
import { BedDouble, CircleAlert, ExternalLink, Footprints, Landmark, Mountain, PawPrint, Sparkles, Utensils } from 'lucide-react';
import { PLACE_KINDS, altitudeProfile, overnightFor, type ItineraryDay, type Place, type TourStop } from '@rafrika/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';

const dateFormat = (locale: Locale) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const metres = (n: number) => `${Math.round(n).toLocaleString('en-US')} m`;

/** Altitude along the route for tours that climb: one point per stop, summit in gold. */
export function AltitudeProfile({ stops, t }: { stops: TourStop[]; t: Dictionary }) {
  const profile = altitudeProfile(stops);
  if (!profile) return null;
  const tt = t.tours;
  const W = 640;
  const H = 220;
  const pad = { l: 52, r: 16, t: 20, b: 34 };
  const top = Math.ceil(profile.max / 500) * 500;
  const bottom = Math.max(0, Math.floor(profile.min / 500) * 500);
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / (profile.stops.length - 1);
  const y = (m: number) => pad.t + ((top - m) * (H - pad.t - pad.b)) / (top - bottom);
  const line = profile.stops.map((s, i) => `${x(i)},${y(s.elevation_m)}`).join(' ');
  const area = `${pad.l},${H - pad.b} ${line} ${x(profile.stops.length - 1)},${H - pad.b}`;
  const grid = [];
  for (let m = bottom; m <= top; m += top - bottom > 2500 ? 1000 : 500) grid.push(m);

  return (
    <section>
      <h2 className="flex items-center gap-2 text-xl font-bold"><Mountain className="size-5 text-leaf-dark" aria-hidden /> {tt.altitudeProfile}</h2>
      <figure className="mt-4 rounded-[5px] border border-line bg-white p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${tt.altitudeProfile}: ${profile.stops.map((s) => `${s.name} ${metres(s.elevation_m)}`).join(', ')}`}>
          {grid.map((m) => (
            <g key={m}>
              <line x1={pad.l} x2={W - pad.r} y1={y(m)} y2={y(m)} stroke="#e7e5e0" />
              <text x={pad.l - 6} y={y(m) + 4} textAnchor="end" fontSize="11" fill="#5f6b66">{m.toLocaleString('en-US')}</text>
            </g>
          ))}
          <polygon points={area} fill="#1d951a" fillOpacity="0.12" />
          <polyline points={line} fill="none" stroke="#1d951a" strokeWidth="3" strokeLinejoin="round" />
          {profile.stops.map((s, i) => {
            const peak = s.elevation_m === profile.max;
            return (
              <g key={s.id}>
                <rect x={x(i) - 10} y={y(s.elevation_m) - 10} width="20" height="20" rx="4" fill={peak ? '#ffb627' : '#1d951a'} stroke="#fff" strokeWidth="2" />
                <text x={x(i)} y={y(s.elevation_m) + 4} textAnchor="middle" fontSize="10" fontWeight="800" fill={peak ? '#2b3631' : '#fff'}>{s.position}</text>
                <text x={x(i)} y={H - pad.b + 16} textAnchor="middle" fontSize="10" fill="#5f6b66">{s.day ? `${tt.dayLabel} ${s.day}` : ''}</text>
              </g>
            );
          })}
        </svg>
        <figcaption className="mt-2 text-xs text-muted">
          {tt.altitude}: {metres(profile.min)} → {metres(profile.max)}. {tt.altitudeNote}
        </figcaption>
      </figure>
    </section>
  );
}

/** Extra detail under each itinerary day: overnight, meals, activities, highest point and the day's map stops. */
export function DayDetails({ day, stops, t }: { day: ItineraryDay; stops: TourStop[]; t: Dictionary }) {
  const tt = t.tours;
  const dayStops = stops.filter((s) => String(s.day) === String(day.day));
  const overnight = overnightFor(day, stops);
  const highest = Math.max(...dayStops.map((s) => s.elevation_m ?? -Infinity));
  const mealNames = { B: tt.breakfast, L: tt.lunch, D: tt.dinner };
  const facts: { icon: typeof BedDouble; text: string }[] = [];
  if (overnight) facts.push({ icon: BedDouble, text: `${tt.overnight}: ${overnight}` });
  if (day.meals?.length) facts.push({ icon: Utensils, text: `${tt.meals}: ${day.meals.map((m) => mealNames[m]).join(', ')}` });
  if (day.activities?.length) facts.push({ icon: Footprints, text: `${tt.dayActivities}: ${day.activities.join(', ')}` });
  if (Number.isFinite(highest) && highest > 2500) facts.push({ icon: Mountain, text: `${tt.altitude} ≈ ${metres(highest)}` });
  if (facts.length === 0 && dayStops.length === 0) return null;
  return (
    <div className="mt-2 space-y-2">
      {facts.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-charcoal">
          {facts.map((f) => (
            <li key={f.text} className="flex items-center gap-1"><f.icon className="size-3.5 text-leaf-dark" aria-hidden /> {f.text}</li>
          ))}
        </ul>
      )}
      {dayStops.length > 0 && (
        <p className="flex flex-wrap gap-1.5">
          {dayStops.map((s) => (
            <button key={s.id} type="button" data-map-stop={s.position} className="inline-flex items-center gap-1 rounded-[5px] bg-mint px-2 py-0.5 text-xs font-semibold text-forest hover:underline">
              {s.position}. {s.name}
            </button>
          ))}
        </p>
      )}
    </div>
  );
}

export function PlaceFacts({ place, t, locale }: { place: Place; t: Dictionary; locale: Locale }) {
  const tt = t.tours;
  const facts: [string, string][] = [];
  facts.push([PLACE_KINDS.find((k) => k.id === place.kind)?.[locale] ?? place.kind, place.region ?? '']);
  if (place.area_km2) facts.push([tt.area, `${Number(place.area_km2).toLocaleString('en-US')} km²`]);
  if (place.established) facts.push([tt.established, String(place.established)]);
  if (place.unesco_year) facts.push([tt.unesco, String(place.unesco_year)]);
  if (place.highest_point) facts.push([tt.highestPoint, place.highest_point]);
  if (place.managed_by) facts.push([tt.managedBy, place.managed_by]);
  return (
    <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
      {facts.map(([label, value]) => (
        <div key={label} className="rounded-[5px] bg-surface px-3 py-2">
          <dt className="text-xs text-muted">{label}</dt>
          <dd className="font-semibold">{value || '–'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PlaceSource({ place, t, locale }: { place: Place; t: Dictionary; locale: Locale }) {
  const tt = t.tours;
  if (!place.source_url) return <p className="text-xs text-muted">{tt.writtenByGuides}</p>;
  return (
    <p className="text-xs text-muted">
      {tt.factsFrom}{' '}
      <a href={place.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-leaf-dark underline">
        {place.source_name ?? new URL(place.source_url).hostname} <ExternalLink className="size-3" aria-hidden />
      </a>
      {place.source_checked_at && ` · ${tt.lastChecked}: ${dateFormat(locale).format(new Date(place.source_checked_at))}`}
    </p>
  );
}

function Chips({ icon: Icon, label, items }: { icon: typeof PawPrint; label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-bold text-muted"><Icon className="size-3.5 text-leaf-dark" aria-hidden /> {label}</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((x) => <li key={x} className="rounded-[5px] border border-line px-2 py-0.5 text-xs">{x}</li>)}
      </ul>
    </div>
  );
}

/** "About the places you visit": a short guide to each park or site, with facts and their source. */
export function PlaceGuides({ places, t, locale }: { places: Place[]; t: Dictionary; locale: Locale }) {
  if (places.length === 0) return null;
  const tt = t.tours;
  return (
    <section>
      <h2 className="flex items-center gap-2 text-xl font-bold"><Landmark className="size-5 text-leaf-dark" aria-hidden /> {tt.aboutPlaces}</h2>
      <div className="mt-4 space-y-4">
        {places.map((place) => (
          <article key={place.id} className="space-y-3 rounded-[5px] border border-line bg-white p-4">
            <h3 className="text-lg font-bold">{place.name}</h3>
            <p className="text-sm text-muted">{place.summary}</p>
            <PlaceFacts place={place} t={t} locale={locale} />
            {place.known_for.length > 0 && (
              <ul className="space-y-1 text-sm">
                {place.known_for.map((x) => (
                  <li key={x} className="flex gap-2"><Sparkles className="mt-0.5 size-4 shrink-0 text-leaf-dark" aria-hidden /> {x}</li>
                ))}
              </ul>
            )}
            <Chips icon={PawPrint} label={tt.wildlifeLabel} items={place.wildlife} />
            <Chips icon={Footprints} label={tt.placeActivities} items={place.activities} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <PlaceSource place={place} t={t} locale={locale} />
              <Link href={`/${locale}/places/${place.slug}`} className="text-sm font-semibold text-leaf-dark underline">{tt.moreAboutPlace}</Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function GoodToKnow({ items, t }: { items: string[] | undefined; t: Dictionary }) {
  if (!items?.length) return null;
  return (
    <section className="rounded-[5px] border border-gold bg-gold/10 p-4">
      <h2 className="flex items-center gap-2 text-lg font-bold"><CircleAlert className="size-5 text-charcoal" aria-hidden /> {t.tours.goodToKnow}</h2>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
        {items.map((x) => <li key={x}>{x}</li>)}
      </ul>
    </section>
  );
}
