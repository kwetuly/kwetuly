import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type TripRequest = {
  id: string;
  traveler_id: string;
  traveler_name: string;
  title: string;
  details: string;
  specialty: string;
  expertise: string[];
  regions: string[];
  start_date: string | null;
  end_date: string | null;
  flexible_dates: boolean;
  adults: number;
  children: number;
  budget_per_person_usd: number | null;
  languages: string[];
  female_guide: boolean;
  status: 'open' | 'booked' | 'closed';
  offers_count: number;
  created_at: string;
};

export type TripOffer = {
  id: string;
  request_id: string;
  offered_by: string;
  guide_id: string | null;
  company_name: string | null;
  price_total_usd: number;
  deposit_percent: number;
  itinerary: string;
  includes: string | null;
  excludes: string | null;
  valid_until: string | null;
  status: 'sent' | 'accepted' | 'declined' | 'withdrawn';
  chat_id: string | null;
  created_at: string;
  guides: { display_name: string; slug: string; photo_url: string | null; rating_avg: number | null; rating_count: number } | null;
};

export const REQUEST_COLUMNS =
  'id, traveler_id, traveler_name, title, details, specialty, expertise, regions, start_date, end_date, flexible_dates, adults, children, budget_per_person_usd, languages, female_guide, status, offers_count, created_at';
export const OFFER_COLUMNS =
  'id, request_id, offered_by, guide_id, company_name, price_total_usd, deposit_percent, itinerary, includes, excludes, valid_until, status, chat_id, created_at, guides(display_name, slug, photo_url, rating_avg, rating_count)';

export const isUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value);
export const offerName = (offer: TripOffer) => offer.guides?.display_name ?? offer.company_name ?? 'Rafrika partner';
export const today = () => new Date().toISOString().slice(0, 10);

// Row-level security decides what the viewer may see: their own requests, or open ones for guides and companies.
export async function getRequest(id: string): Promise<TripRequest | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from('trip_requests').select(REQUEST_COLUMNS).eq('id', id).maybeSingle<TripRequest>();
  return data ?? null;
}

export async function listOffers(requestId: string): Promise<TripOffer[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('trip_offers')
    .select(OFFER_COLUMNS)
    .eq('request_id', requestId)
    .neq('status', 'withdrawn')
    .order('created_at')
    .returns<TripOffer[]>();
  return data ?? [];
}

/** Ids of offers or group-trip spots that already have a paid deposit. */
export async function paidDeposits(column: 'trip_offer_id' | 'group_member_id', ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const supabase = await createClient();
  const { data } = await supabase.from('payments').select(column).in(column, ids).eq('status', 'paid');
  return new Set((data ?? []).map((row) => (row as Record<string, string>)[column]));
}
