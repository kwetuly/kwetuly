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
/** Whether Selcom is set up, and the shillings-per-dollar rate for "≈ TSh" prices (null until set). */
export async function paymentsConfig(): Promise<{ enabled: boolean; rate: number | null }> {
  const { data } = await supabase.functions.invoke('payments', { body: { action: 'config' } });
  const result = (data ?? {}) as { enabled?: boolean; rate?: number | null };
  return { enabled: Boolean(result.enabled), rate: typeof result.rate === 'number' && result.rate > 0 ? result.rate : null };
}

export async function paymentsEnabled(): Promise<boolean> {
  return (await paymentsConfig()).enabled;
}

/** `review`: Selcom reported a payment Rafrika must check by hand; treat it as "being checked", never as unpaid. */
export type DepositState = { paid: boolean; review: boolean; paidAt: string | null; paidOut: boolean; amountUsd: number | null };

/** Where a deposit is: not paid, being checked, held by Rafrika, or paid to the guide. */
export async function depositState(column: 'trip_offer_id' | 'group_member_id', id: string): Promise<DepositState> {
  const { data } = await supabase
    .from('payments')
    .select('status, paid_at, payout_done, amount_usd')
    .eq(column, id)
    .in('status', ['paid', 'review'])
    .order('created_at', { ascending: false })
    .limit(10);
  const rows = (data ?? []) as { status: 'paid' | 'review'; paid_at: string | null; payout_done: boolean; amount_usd: number }[];
  const paid = rows.find((row) => row.status === 'paid');
  if (paid) return { paid: true, review: false, paidAt: paid.paid_at, paidOut: paid.payout_done, amountUsd: Number(paid.amount_usd) };
  const review = rows[0];
  return { paid: false, review: Boolean(review), paidAt: null, paidOut: false, amountUsd: review ? Number(review.amount_usd) : null };
}

// Reasons the Edge Function gives when a deposit cannot be paid online at all: the Pay box is hidden.
const NOT_PAYABLE = new Set(['not_found', 'not_accepted', 'no_deposit', 'not_approved', 'already_paid', 'bad_request']);

/**
 * Whether the traveller can pay this deposit now: 'pay', 'review' (a payment is being checked), or
 * 'hidden' (unapproved guide or business, admin-made offer, unapproved or cancelled group).
 * If the check itself fails, show the box; checkout runs the same rules again.
 */
export async function depositPayable(kind: 'offer' | 'group', id: string): Promise<'pay' | 'review' | 'hidden'> {
  const { data } = await supabase.functions.invoke('payments', { body: { action: 'check', kind, id } });
  const error = ((data ?? {}) as { error?: string }).error;
  if (error === 'under_review') return 'review';
  return error && NOT_PAYABLE.has(error) ? 'hidden' : 'pay';
}

/** Lowest live offer on each of the traveller's requests. */
export async function lowestOffers(requestIds: string[]): Promise<Record<string, number>> {
  if (!requestIds.length) return {};
  const { data } = await supabase.from('trip_offers').select('request_id, price_total_usd').in('request_id', requestIds).in('status', ['sent', 'accepted']);
  const lowest: Record<string, number> = {};
  for (const row of (data ?? []) as { request_id: string; price_total_usd: number }[]) {
    lowest[row.request_id] = Math.min(lowest[row.request_id] ?? Infinity, row.price_total_usd);
  }
  return lowest;
}

/** Deposits paid to this guide or company, or being checked by Rafrika (newest first), for the Guide Hub ledger. */
export async function listMyDeposits(userId: string) {
  const { data, error } = await supabase
    .from('payments')
    .select('id, description, amount_tzs, amount_usd, status, paid_at, payout_done, created_at')
    .eq('payee_user_id', userId)
    .in('status', ['paid', 'review'])
    .order('created_at', { ascending: false })
    .limit(50);
  check(error);
  return (data ?? []) as {
    id: string;
    description: string;
    amount_tzs: number;
    amount_usd: number;
    status: 'paid' | 'review';
    paid_at: string | null;
    payout_done: boolean;
    created_at: string;
  }[];
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
