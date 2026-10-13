import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type GroupTrip = {
  id: string;
  organizer_id: string;
  guide_id: string | null;
  company_name: string | null;
  title: string;
  description: string;
  specialty: string;
  region: string;
  meeting_point: string | null;
  start_date: string;
  end_date: string;
  price_per_person_usd: number;
  min_people: number;
  max_people: number;
  languages: string[];
  includes: string | null;
  seats_taken: number;
  status: 'pending' | 'approved' | 'rejected';
  cancelled: boolean;
  guides: { display_name: string; slug: string; photo_url: string | null; rating_avg: number | null; rating_count: number } | null;
};

export type GroupMember = {
  id: string;
  traveler_id: string;
  traveler_name: string;
  traveler_contact: string;
  seats: number;
  message: string | null;
  status: 'requested' | 'accepted' | 'declined' | 'cancelled';
  created_at: string;
};

const COLUMNS =
  'id, organizer_id, guide_id, company_name, title, description, specialty, region, meeting_point, start_date, end_date, price_per_person_usd, min_people, max_people, languages, includes, seats_taken, status, cancelled, guides(display_name, slug, photo_url, rating_avg, rating_count)';

export const spotsLeft = (trip: GroupTrip) => Math.max(trip.max_people - trip.seats_taken, 0);

function publicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// Approved, upcoming group trips that are still open, soonest first.
export async function listGroupTrips(specialty?: string): Promise<GroupTrip[]> {
  'use cache';
  cacheTag('groups');
  cacheLife('minutes');

  const today = new Date().toISOString().slice(0, 10);
  let query = publicClient()
    .from('group_trips')
    .select(COLUMNS)
    .eq('status', 'approved')
    .eq('cancelled', false)
    .gte('start_date', today)
    .order('start_date', { ascending: true })
    .limit(60);
  if (specialty) query = query.eq('specialty', specialty);
  const { data } = await query;
  return (data ?? []) as unknown as GroupTrip[];
}

// One trip as the signed-in viewer may see it: public trips for everyone, and the
// organiser's own pending or rejected trips for the organiser and admins.
export async function getGroupTripForViewer(id: string): Promise<GroupTrip | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from('group_trips').select(COLUMNS).eq('id', id).maybeSingle();
  return (data as unknown as GroupTrip | null) ?? null;
}
