'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  ACCOMMODATION_LEVELS,
  FITNESS_LEVELS,
  STOP_KINDS,
  TOUR_GROUP_TYPES,
  TOUR_TYPES,
  TRAVEL_STYLES,
  TRIP_CATEGORIES,
  TRIP_CIRCUITS,
  TRIP_KINDS,
  TRANSFER_MODES,
  tourReadiness,
  type Meal,
  type Tour,
} from '@rafrika/shared';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const STATUSES = ['draft', 'published', 'archived'] as const;
const OPERATED = ['partner', 'rafrika', 'guide'] as const;
const CURRENCIES = ['USD', 'EUR', 'GBP', 'TZS'] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const oneOf = <T extends string>(value: string, ids: readonly T[]): T | null => (ids.includes(value as T) ? (value as T) : null);
const idsOf = <T extends string>(list: readonly { id: T }[]) => list.map((x) => x.id);

/** Admin only. Returns the locale and the admin's user id, or redirects. */
async function requireAdmin(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await getCurrentUser();
  if (user?.role !== 'admin') redirect(`/${locale}`);
  return { locale, userId: user.id };
}

function reader(formData: FormData) {
  const text = (key: string, max: number) => String(formData.get(key) ?? '').trim().slice(0, max);
  const nullable = (key: string, max: number) => text(key, max) || null;
  const int = (key: string, min: number, max: number) => {
    const n = Number.parseInt(text(key, 10), 10);
    return Number.isInteger(n) && n >= min && n <= max ? n : null;
  };
  const num = (key: string, min: number, max: number) => {
    const n = Number.parseFloat(text(key, 14));
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  };
  const date = (key: string) => (DATE.test(text(key, 10)) ? text(key, 10) : null);
  const lines = (key: string, maxLines = 40, maxLength = 200) =>
    text(key, 8000)
      .split('\n')
      .map((l) => l.trim().slice(0, maxLength))
      .filter(Boolean)
      .slice(0, maxLines);
  const all = (key: string) => formData.getAll(key).map(String);
  return { text, nullable, int, num, date, lines, all };
}

/** Only https links are stored, so nothing odd ends up in an href. */
function httpsUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

// Cover photos are shown with next/image, which only loads Unsplash and Rafrika's own storage.
function coverUrl(value: string | null): string | null {
  const url = httpsUrl(value);
  if (!url) return null;
  const supabase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;
  return url.startsWith('https://images.unsplash.com/') || url.startsWith(supabase) ? url : null;
}

export async function saveTour(formData: FormData) {
  const { locale, userId } = await requireAdmin(formData);
  const r = reader(formData);
  const id = r.text('id', 40);
  const back = `/${locale}/admin/trips/${id || 'new'}`;
  const fail = (message: string): never => redirect(`${back}?error=${encodeURIComponent(message)}`);
  // Problems that should not throw away the rest of the admin's work: the value is dropped and the
  // tour is saved, then the warnings are shown.
  const warnings: string[] = [];

  const slug = r.text('slug', 80).toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) fail('The web address (slug) may only use a–z, 0–9 and single dashes.');
  const title = r.text('title_en', 140);
  const summary = r.text('summary_en', 600);
  if (!title || !summary) fail('Title and summary (English) are required.');
  const days = r.int('days', 1, 40) ?? fail('Days must be between 1 and 40.');

  // Price: stored only with the date it was verified.
  const priceVerified = r.date('price_verified_at');
  let price = r.num('price_from', 0, 10_000_000);
  if (price != null && !priceVerified) {
    warnings.push('The price was not saved: add the date it was verified.');
    price = null;
  }

  const sourceChecked = r.date('source_checked_at');
  let sourceUrl = httpsUrl(r.nullable('source_url', 500));
  if (r.text('source_url', 500) && !sourceUrl) warnings.push('The source link was not saved: it must start with https://.');
  if (sourceUrl && !sourceChecked) {
    warnings.push('The source link was not saved: add the date you checked it.');
    sourceUrl = null;
  }

  // Uploaded cover (a path in the public avatars bucket) wins over a typed URL.
  const upload = r.text('cover_upload', 300);
  const cover = upload
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${upload}`
    : coverUrl(r.nullable('cover_url', 500));

  const minGroup = r.int('min_group', 1, 100);
  const maxGroup = r.int('max_group', 1, 200);
  if (minGroup && maxGroup && minGroup > maxGroup) warnings.push('Minimum group size is larger than the maximum; group sizes were not saved.');

  // Itinerary rows: day_n / title_n / body_n, empty rows skipped.
  const itinerary: Tour['itinerary'] = [];
  for (let i = 0; i < 60; i++) {
    const dayTitle = r.text(`it_title_${i}`, 140);
    if (!dayTitle) continue;
    const meals = r.all(`it_meals_${i}`).filter((m): m is Meal => m === 'B' || m === 'L' || m === 'D');
    const activities = r.text(`it_activities_${i}`, 300).split(',').map((a) => a.trim()).filter(Boolean).slice(0, 10);
    itinerary.push({
      day: r.int(`it_day_${i}`, 1, 40) ?? itinerary.length + 1,
      title: dayTitle,
      body: r.text(`it_body_${i}`, 1500),
      ...(r.text(`it_overnight_${i}`, 120) && { overnight: r.text(`it_overnight_${i}`, 120) }),
      ...(meals.length > 0 && { meals }),
      ...(activities.length > 0 && { activities }),
    });
  }
  itinerary.sort((a, b) => Number(a.day) - Number(b.day));

  // Stops: rows with a name and valid coordinates, in the order given.
  type StopRow = Record<string, string | number | null>;
  const stops: StopRow[] = [];
  for (let i = 0; i < 80; i++) {
    const name = r.text(`st_name_${i}`, 120);
    if (!name) continue;
    const lat = r.num(`st_lat_${i}`, -12, 0);
    const lng = r.num(`st_lng_${i}`, 29, 41);
    if (lat == null || lng == null) {
      warnings.push(`Stop “${name}” was not saved: latitude must be between -12 and 0 and longitude between 29 and 41.`);
      continue;
    }
    const source = r.nullable(`st_source_${i}`, 300);
    let distance = r.num(`st_km_${i}`, 0.1, 5000);
    let hours = r.num(`st_hours_${i}`, 0.1, 99);
    if ((distance != null || hours != null) && !source) {
      warnings.push(`Stop “${name}”: distance and time were not saved because no source was given.`);
      distance = hours = null;
    }
    stops.push({
      order: r.num(`st_pos_${i}`, 0, 1000) ?? i + 1,
      day: r.int(`st_day_${i}`, 1, 40),
      name,
      kind: oneOf(r.text(`st_kind_${i}`, 20), idsOf(STOP_KINDS)) ?? 'town',
      lat,
      lng,
      note: r.nullable(`st_note_${i}`, 300),
      transfer_mode: oneOf(r.text(`st_mode_${i}`, 10), Object.keys(TRANSFER_MODES) as (keyof typeof TRANSFER_MODES)[]),
      distance_km: distance,
      transfer_hours: hours,
      distance_source: distance != null || hours != null ? source : null,
      place_id: /^[0-9a-f-]{36}$/.test(r.text(`st_place_${i}`, 40)) ? r.text(`st_place_${i}`, 40) : null,
      elevation_m: r.int(`st_elev_${i}`, -200, 6000),
    });
  }
  stops.sort((a, b) => Number(a.order) - Number(b.order));

  const guideIds = r.all('guide_ids').filter((g) => /^[0-9a-f-]{36}$/.test(g)).slice(0, 12);

  const row = {
    slug,
    title_en: title,
    title_sw: r.nullable('title_sw', 140),
    summary_en: summary,
    summary_sw: r.nullable('summary_sw', 600),
    tour_type: oneOf(r.text('tour_type', 20), idsOf(TOUR_TYPES)) ?? 'operator',
    status: oneOf(r.text('status', 20), STATUSES) ?? 'draft',
    circuit: oneOf(r.text('circuit', 20), idsOf(TRIP_CIRCUITS)) ?? 'northern',
    kind: oneOf(r.text('kind', 20), idsOf(TRIP_KINDS)) ?? 'multi_day',
    categories: r.all('categories').filter((c) => idsOf(TRIP_CATEGORIES).includes(c as never)),
    travel_styles: r.all('travel_styles').filter((c) => idsOf(TRAVEL_STYLES).includes(c as never)),
    days,
    nights: r.int('nights', 0, 40),
    start_from: r.nullable('start_from', 80),
    end_at: r.nullable('end_at', 80),
    destinations: r.lines('destinations', 20, 120),
    highlights: r.lines('highlights', 12, 200),
    itinerary,
    accommodation: oneOf(r.text('accommodation', 20), idsOf(ACCOMMODATION_LEVELS)),
    group_type: oneOf(r.text('group_type', 20), idsOf(TOUR_GROUP_TYPES)),
    min_group: minGroup && maxGroup && minGroup > maxGroup ? null : minGroup,
    max_group: minGroup && maxGroup && minGroup > maxGroup ? null : maxGroup,
    price_from: price,
    price_currency: oneOf(r.text('price_currency', 3), CURRENCIES) ?? 'USD',
    price_conditions: r.nullable('price_conditions', 400),
    price_verified_at: price != null ? priceVerified : null,
    price_valid_until: price != null ? r.date('price_valid_until') : null,
    includes: r.lines('includes', 30, 200),
    excludes: r.lines('excludes', 30, 200),
    best_months: r.all('best_months').map(Number).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12),
    best_time_note: r.nullable('best_time_note', 400),
    fitness: oneOf(r.text('fitness', 20), idsOf(FITNESS_LEVELS)),
    packing: r.lines('packing', 25, 160),
    good_to_know: r.lines('good_to_know', 15, 300),
    cover_url: cover,
    source_url: sourceUrl,
    source_checked_at: sourceUrl ? sourceChecked : null,
    needs_review: formData.get('needs_review') === 'on',
    operated_by: oneOf(r.text('operated_by', 20), OPERATED) ?? 'partner',
    operator_id: /^[0-9a-f-]{36}$/.test(r.text('operator_id', 40)) ? r.text('operator_id', 40) : null,
    promo_text: r.nullable('promo_text', 200),
    sort_order: r.int('sort_order', 0, 10000) ?? 100,
    updated_by: userId,
  };

  // A tour only goes live once everything travellers rely on is there.
  if (row.status === 'published') {
    const missing = tourReadiness({ ...row, id, is_signature: row.tour_type === 'signature' } as unknown as Tour, { stops: stops.length, guides: guideIds.length })
      .filter((item) => item.required && !item.ok)
      .map((item) => item.label);
    if (missing.length > 0) {
      warnings.push(`Saved as a draft, not published. Still missing: ${missing.join(', ')}.`);
      row.status = 'draft';
    }
  }

  const supabase = await createClient();
  let tripId = id;
  if (id) {
    const { error } = await supabase.from('trips').update(row).eq('id', id);
    if (error) fail(error.code === '23505' ? 'Another tour already uses that web address.' : error.message);
  } else {
    const { data, error } = await supabase.from('trips').insert(row).select('id').single();
    if (error || !data) fail(error?.code === '23505' ? 'Another tour already uses that web address.' : (error?.message ?? 'Could not create the tour.'));
    tripId = data!.id;
  }

  // Stops and guides are replaced as a whole: simple, and the lists are short.
  await supabase.from('trip_stops').delete().eq('trip_id', tripId);
  if (stops.length > 0) {
    const { error } = await supabase
      .from('trip_stops')
      .insert(stops.map((stop, index) => ({ ...stop, order: undefined, trip_id: tripId, position: index + 1 })));
    if (error) redirect(`/${locale}/admin/trips/${tripId}?error=${encodeURIComponent(`Stops: ${error.message}`)}`);
  }
  await supabase.from('trip_guides').delete().eq('trip_id', tripId);
  if (guideIds.length > 0) {
    await supabase.from('trip_guides').insert(guideIds.map((guideId, position) => ({ trip_id: tripId, guide_id: guideId, position })));
  }

  // Admin-only: partner terms and how the tour was verified.
  await supabase.from('trip_partners').upsert({
    trip_id: tripId,
    company_name: r.nullable('company_name', 120),
    tala_licence: r.nullable('tala_licence', 60),
    contact: r.nullable('contact', 160),
    commission_note: r.nullable('commission_note', 200),
    verification_note: r.nullable('verification_note', 2000),
  });

  revalidateTag('trips', 'max');
  redirect(`/${locale}/admin/trips/${tripId}?${warnings.length ? `error=${encodeURIComponent(warnings.join(' '))}` : 'saved=1'}`);
}

export async function deleteTour(formData: FormData) {
  const { locale } = await requireAdmin(formData);
  const id = String(formData.get('id') ?? '').slice(0, 40);
  const slug = String(formData.get('slug') ?? '');
  if (String(formData.get('confirm') ?? '').trim() !== slug) {
    redirect(`/${locale}/admin/trips/${id}?error=${encodeURIComponent('Type the web address exactly to delete this tour.')}`);
  }
  const supabase = await createClient();
  await supabase.from('trips').delete().eq('id', id);
  revalidateTag('trips', 'max');
  redirect(`/${locale}/admin/trips?deleted=1`);
}

/** Quick actions from the list: publish, archive, back to draft, or flag for review. */
export async function quickUpdateTour(formData: FormData) {
  const { locale } = await requireAdmin(formData);
  const id = String(formData.get('id') ?? '').slice(0, 40);
  const action = String(formData.get('action') ?? '');
  const supabase = await createClient();
  if (action === 'flag' || action === 'unflag') {
    await supabase.from('trips').update({ needs_review: action === 'flag' }).eq('id', id);
  } else if (action === 'archive' || action === 'draft') {
    await supabase.from('trips').update({ status: action === 'archive' ? 'archived' : 'draft' }).eq('id', id);
  }
  revalidateTag('trips', 'max');
  redirect(`/${locale}/admin/trips#${id}`);
}
