import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { CircleCheck, Circle } from 'lucide-react';
import {
  ACCOMMODATION_LEVELS,
  FITNESS_LEVELS,
  MONTHS,
  STOP_COLUMNS,
  STOP_KINDS,
  TOUR_COLUMNS,
  TOUR_GROUP_TYPES,
  TOUR_TYPES,
  TRANSFER_MODES,
  TRAVEL_STYLES,
  TRIP_CATEGORIES,
  TRIP_CIRCUITS,
  TRIP_KINDS,
  tourReadiness,
  type Tour,
  type TourStop,
} from '@rafrika/shared';
import { getDictionary, getLocale } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { DirectUpload } from '@/components/direct-upload';
import { tourCoverUrl } from '@/components/trip-card';
import { deleteTour, saveTour } from '../actions';

export const metadata: Metadata = { title: 'Admin: edit tour', robots: { index: false } };

type Partner = { company_name: string | null; tala_licence: string | null; contact: string | null; commission_note: string | null; verification_note: string | null };
type GuideOption = { id: string; display_name: string; specialties: string[]; base_region: string };

export default async function EditTourPage({ params, searchParams }: PageProps<'/[lang]/admin/trips/[id]'>) {
  const locale = await getLocale();
  await getDictionary();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href={`/${locale}/admin/trips`} className="text-sm font-semibold text-forest underline">← All tours</Link>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-[5px] bg-surface" />}>
        <Editor locale={locale} params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const BLANK: Partial<Tour> = {
  tour_type: 'signature',
  status: 'draft',
  circuit: 'northern',
  kind: 'multi_day',
  categories: [],
  travel_styles: [],
  days: 1,
  destinations: [],
  highlights: [],
  itinerary: [],
  includes: [],
  excludes: [],
  best_months: [],
  packing: [],
  price_currency: 'USD',
  operated_by: 'partner',
  needs_review: false,
};

async function Editor({ locale, params, searchParams }: { locale: Locale; params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser(locale);
  if (user.role !== 'admin') redirect(`/${locale}`);
  const [{ id }, status] = await Promise.all([params, searchParams]);
  const isNew = id === 'new';
  const supabase = await createClient();

  const [tourRes, stopsRes, partnerRes, chosenRes, guidesRes, operatorsRes, placesRes] = await Promise.all([
    isNew ? null : supabase.from('trips').select(`${TOUR_COLUMNS}, sort_order`).eq('id', id).maybeSingle(),
    isNew ? null : supabase.from('trip_stops').select(STOP_COLUMNS).eq('trip_id', id).order('position'),
    isNew ? null : supabase.from('trip_partners').select('company_name, tala_licence, contact, commission_note, verification_note').eq('trip_id', id).maybeSingle(),
    isNew ? null : supabase.from('trip_guides').select('guide_id').eq('trip_id', id).order('position'),
    supabase.from('guides').select('id, display_name, specialties, base_region').eq('verification_status', 'approved').order('display_name').limit(300),
    supabase.from('tour_operators').select('id, name, status, verified_at').order('name'),
    supabase.from('places').select('id, name').order('name'),
  ]);
  if (!isNew && !tourRes?.data) notFound();

  const tour = (tourRes?.data ?? BLANK) as Tour & { sort_order?: number };
  const stops = (stopsRes?.data ?? []) as TourStop[];
  const partner = (partnerRes?.data ?? null) as Partner | null;
  const chosen = new Set((chosenRes?.data ?? []).map((row) => row.guide_id as string));
  const guides = (guidesRes.data ?? []) as GuideOption[];
  const operators = (operatorsRes.data ?? []) as { id: string; name: string; status: string; verified_at: string | null }[];
  const places = (placesRes.data ?? []) as { id: string; name: string }[];
  const readiness = isNew ? [] : tourReadiness(tour, { stops: stops.length, guides: chosen.size });

  const itineraryRows = [...tour.itinerary, ...Array.from({ length: 3 }, () => null)];
  const stopRows: (TourStop | null)[] = [...stops, ...Array.from({ length: 4 }, () => null)];
  const lines = (list: string[] | undefined) => (list ?? []).join('\n');

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">{isNew ? 'New tour' : tour.title_en}</h1>
        {!isNew && <Link href={`/${locale}/tours/${tour.slug}`} className="btn-outline ml-auto px-4 py-2 text-sm">Preview →</Link>}
      </div>
      {status.saved && <p className="mt-4 rounded-[5px] bg-mint p-3 text-sm font-semibold text-forest">Saved.</p>}
      {typeof status.error === 'string' && <p className="mt-4 rounded-[5px] bg-red-50 p-3 text-sm text-red-800">{status.error}</p>}

      {readiness.length > 0 && (
        <section className="mt-6 rounded-[5px] border border-line bg-white p-4">
          <h2 className="font-bold">Before publishing</h2>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {readiness.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                {item.ok ? <CircleCheck className="size-4 text-leaf-dark" aria-hidden /> : <Circle className={`size-4 ${item.required ? 'text-red-700' : 'text-muted'}`} aria-hidden />}
                <span className={item.ok ? '' : item.required ? 'font-semibold' : 'text-muted'}>
                  {item.label}{!item.required && ' (optional)'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form action={saveTour} className="mt-6 space-y-6">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={isNew ? '' : tour.id} />

        <Box title="Basics">
          <Grid>
            <Field label="Tour type">
              <select name="tour_type" defaultValue={tour.tour_type} className="field py-2">
                {TOUR_TYPES.map((x) => <option key={x.id} value={x.id}>{x.en}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select name="status" defaultValue={tour.status} className="field py-2">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <Field label="Web address (slug)"><input name="slug" required defaultValue={tour.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" className="field py-2" /></Field>
            <Field label="Title (English)"><input name="title_en" required maxLength={140} defaultValue={tour.title_en} className="field py-2" /></Field>
            <Field label="Title (Kiswahili)"><input name="title_sw" maxLength={140} defaultValue={tour.title_sw ?? ''} className="field py-2" /></Field>
            <Field label="Sort order (lower first)"><input name="sort_order" type="number" min={0} defaultValue={tour.sort_order ?? 100} className="field py-2" /></Field>
          </Grid>
          <Field label="Summary (English, your own words)"><textarea name="summary_en" required maxLength={600} defaultValue={tour.summary_en} className="field min-h-20" /></Field>
          <Field label="Summary (Kiswahili)"><textarea name="summary_sw" maxLength={600} defaultValue={tour.summary_sw ?? ''} className="field min-h-20" /></Field>
          <Grid>
            <Field label="Circuit">
              <select name="circuit" defaultValue={tour.circuit} className="field py-2">
                {TRIP_CIRCUITS.map((x) => <option key={x.id} value={x.id}>{x.en}</option>)}
              </select>
            </Field>
            <Field label="Trip kind">
              <select name="kind" defaultValue={tour.kind} className="field py-2">
                {TRIP_KINDS.map((x) => <option key={x.id} value={x.id}>{x.en}</option>)}
              </select>
            </Field>
            <Field label="Days"><input name="days" type="number" min={1} max={40} required defaultValue={tour.days} className="field py-2" /></Field>
            <Field label="Nights"><input name="nights" type="number" min={0} max={40} defaultValue={tour.nights ?? ''} className="field py-2" /></Field>
            <Field label="Starts in"><input name="start_from" maxLength={80} defaultValue={tour.start_from ?? ''} className="field py-2" /></Field>
            <Field label="Ends in"><input name="end_at" maxLength={80} defaultValue={tour.end_at ?? ''} className="field py-2" /></Field>
          </Grid>
          <Checks label="Categories" name="categories" options={TRIP_CATEGORIES.map((x) => [x.id, x.en])} selected={tour.categories} />
          <Checks label="Travel styles" name="travel_styles" options={TRAVEL_STYLES.map((x) => [x.id, x.en])} selected={tour.travel_styles} />
          <Grid>
            <Field label="Main destinations (one per line)"><textarea name="destinations" defaultValue={lines(tour.destinations)} className="field min-h-24" /></Field>
            <Field label="Highlights (one per line)"><textarea name="highlights" defaultValue={lines(tour.highlights)} className="field min-h-24" /></Field>
          </Grid>
          <Field label="Promo line (optional)"><input name="promo_text" maxLength={200} defaultValue={tour.promo_text ?? ''} className="field py-2" /></Field>
          <Grid>
            <Field label="Cover photo: upload">
              <DirectUpload name="cover_upload" bucket="avatars" userId={user.id} prefix="tour-cover" accept="image/jpeg,image/png,image/webp" labels={{ uploading: 'Uploading…', uploaded: 'Uploaded. Save to use it.', error: 'Upload failed' }} />
            </Field>
            <Field label="…or photo URL (Unsplash or Rafrika storage)"><input name="cover_url" type="url" defaultValue={tour.cover_url ?? ''} className="field py-2" /></Field>
          </Grid>
          {!isNew && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tourCoverUrl(tour, 600)} alt="" className="h-32 w-56 rounded-[5px] object-cover" />
          )}
          <p className="text-xs text-muted">Only use photos you own or have permission to use. Never copy an operator’s photos.</p>
        </Box>

        <Box title="Trip details">
          <Grid>
            <Field label="Accommodation level">
              <Select name="accommodation" value={tour.accommodation} options={ACCOMMODATION_LEVELS.map((x) => [x.id, x.en])} />
            </Field>
            <Field label="Private or group">
              <Select name="group_type" value={tour.group_type} options={TOUR_GROUP_TYPES.map((x) => [x.id, x.en])} />
            </Field>
            <Field label="Fitness level">
              <Select name="fitness" value={tour.fitness} options={FITNESS_LEVELS.map((x) => [x.id, x.en])} />
            </Field>
            <Field label="Minimum group size"><input name="min_group" type="number" min={1} max={100} defaultValue={tour.min_group ?? ''} className="field py-2" /></Field>
            <Field label="Maximum group size"><input name="max_group" type="number" min={1} max={200} defaultValue={tour.max_group ?? ''} className="field py-2" /></Field>
          </Grid>
          <Checks label="Best months" name="best_months" options={MONTHS.en.map((m, i) => [String(i + 1), m])} selected={tour.best_months.map(String)} />
          <Field label="Best time note"><input name="best_time_note" maxLength={400} defaultValue={tour.best_time_note ?? ''} className="field py-2" /></Field>
          <Grid>
            <Field label="Included (one per line)"><textarea name="includes" defaultValue={lines(tour.includes)} className="field min-h-28" /></Field>
            <Field label="Not included (one per line)"><textarea name="excludes" defaultValue={lines(tour.excludes)} className="field min-h-28" /></Field>
          </Grid>
          <Field label="Packing suggestions (one per line)"><textarea name="packing" defaultValue={lines(tour.packing)} className="field min-h-24" /></Field>
          <Field label="Good to know (one per line: visas, health, permits, customs; no prices)"><textarea name="good_to_know" defaultValue={lines(tour.good_to_know)} className="field min-h-24" /></Field>
        </Box>

        <Box title="Price">
          <p className="text-sm text-muted">Only enter a price you have verified (with the operator or your own costing). Leave it empty to show “Price subject to confirmation”.</p>
          <Grid>
            <Field label="Price from"><input name="price_from" type="number" min={0} step="1" defaultValue={tour.price_from ?? ''} className="field py-2" /></Field>
            <Field label="Currency">
              <select name="price_currency" defaultValue={tour.price_currency} className="field py-2">
                {['USD', 'EUR', 'GBP', 'TZS'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Verified on"><input name="price_verified_at" type="date" defaultValue={tour.price_verified_at ?? ''} className="field py-2" /></Field>
            <Field label="Valid until"><input name="price_valid_until" type="date" defaultValue={tour.price_valid_until ?? ''} className="field py-2" /></Field>
          </Grid>
          <Field label="Price conditions (e.g. per person sharing, 2 people, low season)"><input name="price_conditions" maxLength={400} defaultValue={tour.price_conditions ?? ''} className="field py-2" /></Field>
        </Box>

        <Box title="Operator, source and verification">
          <Grid>
            <Field label="Tour operator">
              <select name="operator_id" defaultValue={tour.operator_id ?? ''} className="field py-2">
                <option value="">None</option>
                {operators.map((op) => (
                  <option key={op.id} value={op.id}>{op.name}{op.verified_at ? ' ✓' : ''}{op.status !== 'published' ? ` (${op.status})` : ''}</option>
                ))}
              </select>
            </Field>
            <Field label="Who runs it">
              <select name="operated_by" defaultValue={tour.operated_by} className="field py-2">
                <option value="partner">Licensed partner operator</option>
                <option value="rafrika">Rafrika</option>
                <option value="guide">A Rafrika guide</option>
              </select>
            </Field>
            <Field label="Operator’s own page or enquiry link"><input name="source_url" type="url" defaultValue={tour.source_url ?? ''} className="field py-2" /></Field>
            <Field label="Link checked on"><input name="source_checked_at" type="date" defaultValue={tour.source_checked_at ?? ''} className="field py-2" /></Field>
          </Grid>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="needs_review" defaultChecked={tour.needs_review} className="size-4 accent-leaf" /> Information may be outdated: flag for review (travellers see “Details being re-checked”)
          </label>
          <Field label="Verification notes (admin only: who confirmed what, and when)"><textarea name="verification_note" maxLength={2000} defaultValue={partner?.verification_note ?? ''} className="field min-h-20" /></Field>
          <Grid>
            <Field label="Partner company (admin only)"><input name="company_name" maxLength={120} defaultValue={partner?.company_name ?? ''} className="field py-2" /></Field>
            <Field label="Partner TALA licence no. (admin only)"><input name="tala_licence" maxLength={60} defaultValue={partner?.tala_licence ?? ''} className="field py-2" /></Field>
            <Field label="Partner contact (admin only)"><input name="contact" maxLength={160} defaultValue={partner?.contact ?? ''} className="field py-2" /></Field>
            <Field label="Commission / referral terms (admin only)"><input name="commission_note" maxLength={200} defaultValue={partner?.commission_note ?? ''} className="field py-2" /></Field>
          </Grid>
        </Box>

        <Box title="Day-by-day itinerary">
          <p className="text-sm text-muted">Empty rows are ignored. Save to get more blank rows. For Operator Tours, write your own summary of each day.</p>
          {itineraryRows.map((day, i) => (
            <div key={i} className="grid gap-2 rounded-[5px] border border-line p-3 sm:grid-cols-[80px_1fr]">
              <input name={`it_day_${i}`} type="number" min={1} max={40} defaultValue={day ? Number(day.day) || '' : ''} placeholder="Day" aria-label="Day" className="field py-2" />
              <input name={`it_title_${i}`} maxLength={140} defaultValue={day?.title ?? ''} placeholder="Title" aria-label="Title" className="field py-2" />
              <textarea name={`it_body_${i}`} maxLength={1500} defaultValue={day?.body ?? ''} placeholder="What happens this day" aria-label="Description" className="field min-h-16 sm:col-span-2" />
              <input name={`it_overnight_${i}`} maxLength={120} defaultValue={day?.overnight ?? ''} placeholder="Overnight (camp, lodge or town; leave empty to use the day's camp stop)" aria-label="Overnight" className="field py-2 sm:col-span-2" />
              <input name={`it_activities_${i}`} maxLength={300} defaultValue={(day?.activities ?? []).join(', ')} placeholder="Activities, separated by commas" aria-label="Activities" className="field py-2 sm:col-span-2" />
              <div className="flex flex-wrap gap-4 text-sm sm:col-span-2">
                <span className="font-semibold">Meals included:</span>
                {(['B', 'L', 'D'] as const).map((m) => (
                  <label key={m} className="flex items-center gap-1.5">
                    <input type="checkbox" name={`it_meals_${i}`} value={m} defaultChecked={day?.meals?.includes(m)} className="size-4 accent-leaf" /> {{ B: 'Breakfast', L: 'Lunch', D: 'Dinner' }[m]}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </Box>

        <Box title="Map stops">
          <p className="text-sm text-muted">
            In route order. Coordinates in decimal degrees (e.g. Arusha -3.3869, 36.6830). Distance and time are from the previous stop and need a source
            (e.g. “Driver-guide, Oct 2026” or the operator’s itinerary). Leave them empty if not checked: the page then shows only the straight-line distance.
            Link a place guide to show its facts on the tour page. Clear the name to remove a stop.
          </p>
          {stopRows.map((stop, i) => (
            <div key={i} className="grid gap-2 rounded-[5px] border border-line p-3 sm:grid-cols-6">
              <input name={`st_pos_${i}`} type="number" min={0} defaultValue={stop?.position ?? ''} placeholder="Order" aria-label="Order" className="field py-2" />
              <input name={`st_name_${i}`} maxLength={120} defaultValue={stop?.name ?? ''} placeholder="Place name" aria-label="Place name" className="field py-2 sm:col-span-2" />
              <select name={`st_kind_${i}`} defaultValue={stop?.kind ?? 'town'} aria-label="Kind" className="field py-2">
                {STOP_KINDS.map((k) => <option key={k.id} value={k.id}>{k.en}</option>)}
              </select>
              <input name={`st_day_${i}`} type="number" min={1} max={40} defaultValue={stop?.day ?? ''} placeholder="Day" aria-label="Day" className="field py-2" />
              <select name={`st_mode_${i}`} defaultValue={stop?.transfer_mode ?? ''} aria-label="Arrive by" className="field py-2">
                <option value="">Arrive by…</option>
                {Object.entries(TRANSFER_MODES).map(([key, label]) => <option key={key} value={key}>{label.en}</option>)}
              </select>
              <input name={`st_lat_${i}`} type="number" step="0.0001" defaultValue={stop?.lat ?? ''} placeholder="Latitude" aria-label="Latitude" className="field py-2" />
              <input name={`st_lng_${i}`} type="number" step="0.0001" defaultValue={stop?.lng ?? ''} placeholder="Longitude" aria-label="Longitude" className="field py-2" />
              <input name={`st_km_${i}`} type="number" step="0.1" defaultValue={stop?.distance_km ?? ''} placeholder="km" aria-label="Distance (km)" className="field py-2" />
              <input name={`st_hours_${i}`} type="number" step="0.1" defaultValue={stop?.transfer_hours ?? ''} placeholder="hours" aria-label="Time (hours)" className="field py-2" />
              <input name={`st_source_${i}`} maxLength={300} defaultValue={stop?.distance_source ?? ''} placeholder="Source of distance/time" aria-label="Source" className="field py-2 sm:col-span-2" />
              <select name={`st_place_${i}`} defaultValue={stop?.place_id ?? ''} aria-label="Place guide" className="field py-2 sm:col-span-2">
                <option value="">No place guide</option>
                {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input name={`st_elev_${i}`} type="number" min={-200} max={6000} defaultValue={stop?.elevation_m ?? ''} placeholder="Altitude m (approx.)" aria-label="Altitude in metres" className="field py-2" />
              <input name={`st_note_${i}`} maxLength={300} defaultValue={stop?.note ?? ''} placeholder="Note (optional)" aria-label="Note" className="field py-2 sm:col-span-3" />
            </div>
          ))}
        </Box>

        <Box title="Guides on this tour">
          <p className="text-sm text-muted">Tick the guides who lead this tour. If none are ticked, the page suggests verified guides whose specialties match.</p>
          <div className="grid max-h-80 gap-1 overflow-y-auto rounded-[5px] border border-line p-3 text-sm sm:grid-cols-2">
            {guides.length === 0 && <p className="text-muted">No approved guides yet.</p>}
            {guides.map((g) => (
              <label key={g.id} className="flex items-center gap-2">
                <input type="checkbox" name="guide_ids" value={g.id} defaultChecked={chosen.has(g.id)} className="size-4 accent-leaf" />
                <span>{g.display_name} <span className="text-muted">· {g.specialties.join(', ')} · {g.base_region}</span></span>
              </label>
            ))}
          </div>
        </Box>

        <div className="sticky bottom-4 z-10 flex justify-end">
          <button className="btn shadow-xl">Save tour</button>
        </div>
      </form>

      {!isNew && (
        <form action={deleteTour} className="mt-10 rounded-[5px] border border-red-200 bg-red-50 p-4 text-sm">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={tour.id} />
          <input type="hidden" name="slug" value={tour.slug} />
          <p className="font-bold text-red-800">Delete this tour</p>
          <p className="mt-1 text-red-800">This removes the tour, its stops and saved bookmarks. Archiving keeps it but hides it. Type <code>{tour.slug}</code> to confirm.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input name="confirm" className="field max-w-xs py-2" aria-label="Type the web address to confirm" />
            <button className="rounded-[5px] bg-red-700 px-4 py-2 font-bold text-white">Delete</button>
          </div>
        </form>
      )}
    </>
  );
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-[5px] border border-line bg-white p-5">
      <legend className="px-1 text-lg font-bold">{title}</legend>
      {children}
    </fieldset>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-semibold">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Select({ name, value, options }: { name: string; value: string | null | undefined; options: [string, string][] }) {
  return (
    <select name={name} defaultValue={value ?? ''} className="field py-2">
      <option value="">Not confirmed yet</option>
      {options.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
    </select>
  );
}

function Checks({ label, name, options, selected }: { label: string; name: string; options: [string, string][]; selected: string[] }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
        {options.map(([id, text]) => (
          <label key={id} className="flex items-center gap-1.5">
            <input type="checkbox" name={name} value={id} defaultChecked={selected.includes(id)} className="size-4 accent-leaf" /> {text}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
