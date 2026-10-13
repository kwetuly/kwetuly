import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

// Trip requests with offers, deposits (Selcom) and chat alerts: the same tables and rules as the website.

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
  guides: { display_name: string; slug: string; rating_avg: number | null; rating_count: number } | null;
};

const REQUEST_COLUMNS =
  'id, traveler_id, traveler_name, title, details, specialty, expertise, regions, start_date, end_date, flexible_dates, adults, children, budget_per_person_usd, languages, female_guide, status, offers_count, created_at';
const OFFER_COLUMNS =
  'id, request_id, offered_by, guide_id, company_name, price_total_usd, deposit_percent, itinerary, includes, excludes, valid_until, status, chat_id, guides(display_name, slug, rating_avg, rating_count)';

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export const today = () => new Date().toISOString().slice(0, 10);
export const offerName = (offer: TripOffer) => offer.guides?.display_name ?? offer.company_name ?? 'Rafrika partner';

export async function listMyRequests(userId: string): Promise<TripRequest[]> {
  const { data, error } = await supabase.from('trip_requests').select(REQUEST_COLUMNS).eq('traveler_id', userId).order('created_at', { ascending: false });
  check(error);
  return (data ?? []) as TripRequest[];
}

// Row-level security only returns open requests to verified guides and companies.
export async function listOpenRequests(userId: string): Promise<TripRequest[]> {
  const { data, error } = await supabase
    .from('trip_requests')
    .select(REQUEST_COLUMNS)
    .eq('status', 'open')
    .neq('traveler_id', userId)
    .order('created_at', { ascending: false })
    .limit(60);
  check(error);
  return (data ?? []) as TripRequest[];
}

export async function listMyOffers(userId: string) {
  const { data, error } = await supabase
    .from('trip_offers')
    .select('id, request_id, status, price_total_usd, trip_requests(title)')
    .eq('offered_by', userId)
    .order('created_at', { ascending: false });
  check(error);
  return (data ?? []) as unknown as { id: string; request_id: string; status: TripOffer['status']; price_total_usd: number; trip_requests: { title: string } | null }[];
}

export async function getRequest(id: string): Promise<TripRequest | null> {
  const { data, error } = await supabase.from('trip_requests').select(REQUEST_COLUMNS).eq('id', id).maybeSingle();
  check(error);
  return data as TripRequest | null;
}

export async function listOffers(requestId: string): Promise<TripOffer[]> {
  const { data, error } = await supabase.from('trip_offers').select(OFFER_COLUMNS).eq('request_id', requestId).neq('status', 'withdrawn').order('created_at');
  check(error);
  return (data ?? []) as unknown as TripOffer[];
}

export async function getMyOffer(requestId: string, userId: string): Promise<TripOffer | null> {
  const { data, error } = await supabase.from('trip_offers').select(OFFER_COLUMNS).eq('request_id', requestId).eq('offered_by', userId).maybeSingle();
  check(error);
  return data as unknown as TripOffer | null;
}

export type NewRequest = Omit<TripRequest, 'id' | 'traveler_id' | 'status' | 'offers_count' | 'created_at'>;

export async function createRequest(userId: string, request: NewRequest): Promise<string> {
  const { data, error } = await supabase.from('trip_requests').insert({ ...request, traveler_id: userId }).select('id').single();
  check(error);
  return data!.id as string;
}

export async function setRequestOpen(id: string, open: boolean) {
  check((await supabase.from('trip_requests').update({ status: open ? 'open' : 'closed' }).eq('id', id)).error);
}

export type OfferInput = {
  price_total_usd: number;
  deposit_percent: number;
  itinerary: string;
  includes: string | null;
  excludes: string | null;
  valid_until: string | null;
  company_name: string | null;
};

// Guides offer as themselves; businesses give a company name. Sending again updates the offer.
export async function sendOffer(requestId: string, userId: string, guideId: string | null, offer: OfferInput, existingId?: string) {
  const { error } = existingId
    ? await supabase.from('trip_offers').update({ ...offer, status: 'sent' }).eq('id', existingId)
    : await supabase.from('trip_offers').insert({ ...offer, request_id: requestId, offered_by: userId, guide_id: guideId });
  check(error);
}

export async function withdrawOffer(offerId: string) {
  check((await supabase.from('trip_offers').update({ status: 'withdrawn' }).eq('id', offerId)).error);
}

export async function answerOffer(offerId: string, accept: boolean) {
  check((await supabase.from('trip_offers').update({ status: accept ? 'accepted' : 'declined' }).eq('id', offerId)).error);
}

export async function offerContacts(offerId: string) {
  const { data, error } = await supabase.rpc('offer_contacts', { p_offer: offerId });
  check(error);
  return ((data ?? []) as { traveler_email: string | null; traveler_phone: string | null; offerer_email: string | null; offerer_phone: string | null }[])[0] ?? null;
}

// ---------------------------------------------------------------------------
// Deposits through Selcom (the `payments` Edge Function). Hidden until Selcom is set up.
// ---------------------------------------------------------------------------
export async function paymentsEnabled(): Promise<boolean> {
  const { data } = await supabase.functions.invoke('payments', { body: { action: 'config' } });
  return Boolean((data as { enabled?: boolean } | null)?.enabled);
}

export async function isDepositPaid(column: 'trip_offer_id' | 'group_member_id', id: string): Promise<boolean> {
  const { count } = await supabase.from('payments').select('id', { count: 'exact', head: true }).eq(column, id).eq('status', 'paid');
  return (count ?? 0) > 0;
}

/** Opens the Selcom payment page; when the traveller comes back, asks Selcom for the result. */
export async function payDeposit(kind: 'offer' | 'group', id: string, locale: string): Promise<'paid' | 'pending' | 'failed' | string> {
  const { data, error } = await supabase.functions.invoke('payments', { body: { action: 'checkout', kind, id, locale } });
  const result = (data ?? {}) as { url?: string; order_id?: string; error?: string };
  if (error || !result.url || !result.order_id) {
    // Error responses carry a code such as "phone_required".
    const body = error && 'context' in error ? await (error.context as Response).json().catch(() => ({})) : {};
    return (body as { error?: string }).error ?? result.error ?? 'gateway_error';
  }
  await WebBrowser.openBrowserAsync(result.url);
  const status = await supabase.functions.invoke('payments', { body: { action: 'status', order_id: result.order_id } });
  return ((status.data ?? {}) as { status?: string }).status ?? 'pending';
}

// ---------------------------------------------------------------------------
// Group chat alerts
// ---------------------------------------------------------------------------
export async function getChatMuted(chatId: string, userId: string): Promise<boolean> {
  const { data } = await supabase.from('group_chat_members').select('muted').eq('chat_id', chatId).eq('user_id', userId).maybeSingle();
  return Boolean(data?.muted);
}

export async function setChatMuted(chatId: string, userId: string, muted: boolean) {
  check((await supabase.from('group_chat_members').update({ muted }).eq('chat_id', chatId).eq('user_id', userId)).error);
}
