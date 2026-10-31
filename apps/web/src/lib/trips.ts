import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';
import { PLACE_COLUMNS, STOP_COLUMNS, TOUR_COLUMNS, guideSpecialtiesForTour, tourSummary, tourTitle, type Place, type Tour, type TourStop } from '@kwetuly/shared';
import { GUIDE_COLUMNS, type Guide } from './guides';
import { createClient } from './supabase/server';

// "Trip" is the table name; on the site they are tours.
export type Trip = Tour;
export const tripTitle = tourTitle;
export const tripSummary = tourSummary;

function publicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/** Every published tour, Signature Trips first. The catalogue is small, so pages filter it in memory. */
export async function listTours(): Promise<Tour[]> {
  'use cache';
  cacheTag('trips');
  cacheLife('minutes');

  const { data } = await publicClient()
    .from('trips')
    .select(TOUR_COLUMNS)
    .eq('status', 'published')
    .order('is_signature', { ascending: false })
    .order('sort_order', { ascending: true })
    .limit(300);
  return (data ?? []) as unknown as Tour[];
}

async function getPublishedTour(slug: string): Promise<Tour | null> {
  'use cache';
  cacheTag('trips', `trip:${slug}`);
  cacheLife('minutes');

  const { data } = await publicClient().from('trips').select(TOUR_COLUMNS).eq('slug', slug).eq('status', 'published').maybeSingle();
  return (data as unknown as Tour | null) ?? null;
}

/** Published tour for everyone; admins can also preview drafts and archived tours. */
export async function getTripForViewer(slug: string): Promise<Tour | null> {
  const published = await getPublishedTour(slug);
  if (published) return published;
  const supabase = await createClient();
  const { data } = await supabase.from('trips').select(TOUR_COLUMNS).eq('slug', slug).maybeSingle();
  return (data as unknown as Tour | null) ?? null;
}

async function publishedStops(tripId: string): Promise<TourStop[]> {
  'use cache';
  cacheTag('trips', `stops:${tripId}`);
  cacheLife('minutes');

  const { data } = await publicClient().from('trip_stops').select(STOP_COLUMNS).eq('trip_id', tripId).order('position');
  return (data ?? []) as TourStop[];
}

/** Route stops in order. Drafts are read with the admin's session. */
export async function getTourStops(tour: Pick<Tour, 'id' | 'status'>): Promise<TourStop[]> {
  if (tour.status === 'published') return publishedStops(tour.id);
  const supabase = await createClient();
  const { data } = await supabase.from('trip_stops').select(STOP_COLUMNS).eq('trip_id', tour.id).order('position');
  return (data ?? []) as TourStop[];
}

/**
 * "Meet your guides": the guides an admin assigned to this tour, or, when there are none,
 * verified guides whose specialties fit the tour (mountain guides for Kilimanjaro, and so on).
 * Real guides come before sample guides.
 */
export async function getTourGuides(tourId: string, categories: string[]): Promise<{ assigned: boolean; guides: Guide[] }> {
  'use cache';
  cacheTag('trips', 'guides', `tour-guides:${tourId}`);
  cacheLife('minutes');

  const client = publicClient();
  const { data: assigned } = await client
    .from('trip_guides')
    .select(`position, guides(${GUIDE_COLUMNS})`)
    .eq('trip_id', tourId)
    .order('position');
  const chosen = ((assigned ?? []) as unknown as { guides: Guide | null }[])
    .map((row) => row.guides)
    .filter((g): g is Guide => g != null && g.verification_status === 'approved' && g.visibility === 'public');
  if (chosen.length > 0) return { assigned: true, guides: chosen };

  const specialties = guideSpecialtiesForTour(categories);
  if (specialties.length === 0) return { assigned: false, guides: [] };
  const { data } = await client
    .from('guides')
    .select(GUIDE_COLUMNS)
    .eq('verification_status', 'approved')
    .eq('visibility', 'public')
    .overlaps('specialties', specialties)
    .order('is_sample', { ascending: true })
    .order('rating_count', { ascending: false })
    .order('plan', { ascending: false })
    .limit(4);
  return { assigned: false, guides: (data ?? []) as Guide[] };
}

/** Ids of the tours the signed-in visitor has saved (empty when signed out). */
export async function savedTourIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();
  const { data } = await supabase.from('saved_trips').select('trip_id').eq('user_id', user.id);
  return new Set((data ?? []).map((row) => row.trip_id as string));
}

// ---------------------------------------------------------------------------
// Tour operators
// ---------------------------------------------------------------------------
export type TourOperator = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  location: string | null;
  licence_number: string | null;
  licence_authority: string | null;
  licence_checked_at: string | null;
  tripadvisor_url: string | null;
  tripadvisor_rating: number | null;
  tripadvisor_reviews: number | null;
  tripadvisor_checked_at: string | null;
  verified_at: string | null;
  status: 'draft' | 'published' | 'archived';
};

export const OPERATOR_COLUMNS =
  'id, slug, name, logo_url, description, website, contact_email, contact_phone, location, licence_number, licence_authority, licence_checked_at, tripadvisor_url, tripadvisor_rating, tripadvisor_reviews, tripadvisor_checked_at, verified_at, status';

export async function listOperators(): Promise<TourOperator[]> {
  'use cache';
  cacheTag('operators');
  cacheLife('minutes');

  const { data } = await publicClient().from('tour_operators').select(OPERATOR_COLUMNS).eq('status', 'published').order('name');
  return (data ?? []) as TourOperator[];
}

async function getPublishedOperator(slug: string): Promise<TourOperator | null> {
  'use cache';
  cacheTag('operators', `operator:${slug}`);
  cacheLife('minutes');

  const { data } = await publicClient().from('tour_operators').select(OPERATOR_COLUMNS).eq('slug', slug).eq('status', 'published').maybeSingle();
  return (data as TourOperator | null) ?? null;
}

export async function getOperatorForViewer(slug: string): Promise<TourOperator | null> {
  const published = await getPublishedOperator(slug);
  if (published) return published;
  const supabase = await createClient();
  const { data } = await supabase.from('tour_operators').select(OPERATOR_COLUMNS).eq('slug', slug).maybeSingle();
  return (data as TourOperator | null) ?? null;
}

// ---------------------------------------------------------------------------
// Places: guides to the parks and sites tours visit
// ---------------------------------------------------------------------------
export async function listPlaces(): Promise<Place[]> {
  'use cache';
  cacheTag('places');
  cacheLife('minutes');

  const { data } = await publicClient().from('places').select(PLACE_COLUMNS).eq('status', 'published').order('name');
  return (data ?? []) as Place[];
}

/** The place guides linked to a tour's stops, in route order. */
export async function placesForStops(stops: Pick<TourStop, 'place_id'>[]): Promise<Place[]> {
  const ids = [...new Set(stops.map((s) => s.place_id).filter((id): id is string => !!id))];
  if (ids.length === 0) return [];
  const all = await listPlaces();
  return ids.map((id) => all.find((p) => p.id === id)).filter((p): p is Place => !!p);
}

export async function getPlaceForViewer(slug: string): Promise<Place | null> {
  const published = (await listPlaces()).find((p) => p.slug === slug);
  if (published) return published;
  const supabase = await createClient();
  const { data } = await supabase.from('places').select(PLACE_COLUMNS).eq('slug', slug).maybeSingle();
  return (data as Place | null) ?? null;
}

/** Published tours with a stop at this place. */
export async function toursVisiting(placeId: string): Promise<Tour[]> {
  'use cache';
  cacheTag('trips', 'places');
  cacheLife('minutes');

  const { data } = await publicClient().from('trip_stops').select('trip_id').eq('place_id', placeId);
  const ids = new Set((data ?? []).map((row) => row.trip_id as string));
  return (await listTours()).filter((tour) => ids.has(tour.id));
}
