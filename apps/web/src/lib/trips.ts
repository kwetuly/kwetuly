import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';
import type { Locale } from '@/i18n/config';
import { createClient } from './supabase/server';

export type Trip = {
  id: string;
  slug: string;
  title_en: string;
  title_sw: string | null;
  summary_en: string;
  summary_sw: string | null;
  circuit: string;
  kind: 'day_trip' | 'multi_day' | 'combo';
  categories: string[];
  days: number;
  destinations: string[];
  start_from: string | null;
  highlights: string[];
  itinerary: { day: number; title: string; body: string }[];
  includes: string[];
  excludes: string[];
  best_months: number[];
  price_from_usd: number | null;
  operated_by: 'partner' | 'rafrika' | 'guide';
  is_signature: boolean;
  promo_text: string | null;
  status: 'draft' | 'published' | 'archived';
};

export const TRIP_COLUMNS =
  'id, slug, title_en, title_sw, summary_en, summary_sw, circuit, kind, categories, days, destinations, start_from, highlights, itinerary, includes, excludes, best_months, price_from_usd, operated_by, is_signature, promo_text, status';

export const tripTitle = (trip: Trip, locale: Locale) => (locale === 'sw' && trip.title_sw) || trip.title_en;
export const tripSummary = (trip: Trip, locale: Locale) => (locale === 'sw' && trip.summary_sw) || trip.summary_en;

function publicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export type TripFilters = { circuit?: string; kind?: string; category?: string; signature?: boolean };

// Published trips only (enforced by row level security for anonymous visitors).
export async function listTrips(filters: TripFilters): Promise<Trip[]> {
  'use cache';
  cacheTag('trips');
  cacheLife('minutes');

  let query = publicClient()
    .from('trips')
    .select(TRIP_COLUMNS)
    .eq('status', 'published')
    .order('is_signature', { ascending: false })
    .order('sort_order', { ascending: true })
    .limit(100);
  if (filters.circuit) query = query.eq('circuit', filters.circuit);
  if (filters.kind) query = query.eq('kind', filters.kind);
  if (filters.category) query = query.contains('categories', [filters.category]);
  if (filters.signature) query = query.eq('is_signature', true);

  const { data } = await query;
  return (data ?? []) as Trip[];
}

async function getPublishedTrip(slug: string): Promise<Trip | null> {
  'use cache';
  cacheTag('trips', `trip:${slug}`);
  cacheLife('minutes');

  const { data } = await publicClient().from('trips').select(TRIP_COLUMNS).eq('slug', slug).eq('status', 'published').maybeSingle();
  return (data as Trip | null) ?? null;
}

// Published trip for everyone; admins can also preview drafts.
export async function getTripForViewer(slug: string): Promise<Trip | null> {
  const published = await getPublishedTrip(slug);
  if (published) return published;
  const supabase = await createClient();
  const { data } = await supabase.from('trips').select(TRIP_COLUMNS).eq('slug', slug).maybeSingle();
  return (data as Trip | null) ?? null;
}
