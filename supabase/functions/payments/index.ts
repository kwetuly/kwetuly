// Deposits through Selcom Checkout (M-Pesa, Tigo Pesa, Airtel Money, Halopesa and cards).
//
//   POST { action: "config" }                          → { enabled, rate } (anyone; Pay button and ≈ TSh prices)
//   POST { action: "checkout", kind: "offer"|"group", id } + user token → { url, order_id }
//   POST { action: "status", order_id } + user token   → { status }    (asks Selcom, updates the row)
//   POST from Selcom (webhook, has order_id)           → re-checks the order with Selcom, never trusts the body
//
// Secrets (Supabase dashboard → Edge Functions → Secrets). Without them payments stay switched off:
//   SELCOM_VENDOR, SELCOM_API_KEY, SELCOM_API_SECRET   from the Selcom merchant account
//   SELCOM_LIVE      "1" for real money; anything else uses Selcom's test gateway
//   USD_TZS_RATE     shillings per US dollar used to price deposits, e.g. "2600"
//   SITE_URL         e.g. "https://rafrika.com" (default)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const env = (key: string, fallback = '') => Deno.env.get(key) ?? fallback;
const SITE_URL = env('SITE_URL', 'https://rafrika.com').replace(/\/$/, '');
const API = `https://${env('SELCOM_LIVE') === '1' ? 'apigw' : 'apigwtest'}.selcommobile.com/v1/`;
const RATE = Number(env('USD_TZS_RATE'));
const enabled = () => Boolean(env('SELCOM_VENDOR') && env('SELCOM_API_KEY') && env('SELCOM_API_SECRET') && RATE > 0);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// ---------------------------------------------------------------------------
// Selcom request signing: HMAC-SHA256 over "timestamp=…&field=value…" with the API secret.
// ---------------------------------------------------------------------------
type Fields = Record<string, string | number>;

async function selcom(path: string, method: 'GET' | 'POST' | 'DELETE', data: Fields) {
  // ISO 8601 in Tanzania time, e.g. 2026-10-14T09:30:00+03:00
  const timestamp = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 19) + '+03:00';
  const signed = `timestamp=${timestamp}` + Object.entries(data).map(([k, v]) => `&${k}=${v}`).join('');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env('SELCOM_API_SECRET')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed)))));
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `SELCOM ${btoa(env('SELCOM_API_KEY'))}`,
    'Digest-Method': 'HS256',
    Digest: digest,
    'Signed-Fields': Object.keys(data).join(','),
    Timestamp: timestamp,
    'Cache-Control': 'no-cache',
  };
  const url = method === 'POST' ? `${API}${path}` : `${API}${path}?${new URLSearchParams(Object.entries(data).map(([k, v]) => [k, String(v)]))}`;
  const res = await fetch(url, { method, headers, body: method === 'POST' ? JSON.stringify(data) : undefined });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || (body.resultcode && body.resultcode !== '000')) {
    throw new Error(`Selcom ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  }
  return body as { data?: Record<string, string>[] };
}

// Selcom wants 255XXXXXXXXX.
function selcomPhone(raw: string | null) {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (/^0[67]\d{8}$/.test(digits)) return `255${digits.slice(1)}`;
  return digits.length >= 9 ? digits : null;
}

const admin = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
type Admin = ReturnType<typeof admin>;

// Ask Selcom for the real result and record it (used by the webhook, the return page and the app).
// A completed order is marked paid only when Selcom reports exactly the shillings we asked for, in TZS;
// anything else is held as 'review' for an admin to check, never 'paid'.
async function refresh(db: Admin, orderId: string) {
  const { data: payment } = await db.from('payments').select('id, status, amount_tzs').eq('order_id', orderId).maybeSingle();
  if (!payment) return null;
  if (payment.status !== 'pending') return payment.status as string;
  const result = await selcom('checkout/order-status', 'GET', { order_id: orderId });
  const order = result.data?.[0] ?? {};
  const state = String(order.payment_status ?? '').toUpperCase();
  let status = state === 'COMPLETED' ? 'paid' : ['CANCELLED', 'USERCANCELLED', 'REJECTED'].includes(state) ? 'failed' : 'pending';
  if (status === 'paid') {
    const amount = Number(String(order.amount ?? '').replace(/,/g, ''));
    const currency = String(order.currency ?? 'TZS').toUpperCase();
    if (!Number.isFinite(amount) || amount !== payment.amount_tzs || currency !== 'TZS') {
      status = 'review';
      console.error(`Deposit ${orderId}: Selcom amount or currency does not match the order; held for review`);
    }
  }
  if (status !== 'pending') {
    await db
      .from('payments')
      .update({
        status,
        provider_reference: order.reference ?? order.transid ?? null,
        provider_channel: order.channel ?? null,
        paid_at: status === 'paid' ? new Date().toISOString() : null,
      })
      .eq('id', payment.id)
      .eq('status', 'pending');
  }
  return status;
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------
type Order = { payee: string; description: string; usd: number; offerId?: string; memberId?: string };

// Deposits go only to approved guides (offering as themselves) or to owners of an approved,
// non-sample business listing.
async function offererApproved(db: Admin, userId: string, guideId: string | null) {
  if (guideId) {
    const { data } = await db.from('guides').select('id').eq('id', guideId).eq('owner_id', userId).eq('verification_status', 'approved').maybeSingle();
    return Boolean(data);
  }
  const { data } = await db.from('providers').select('id').eq('owner_id', userId).eq('verification_status', 'approved').eq('is_sample', false).limit(1);
  return (data ?? []).length > 0;
}

async function loadOrder(db: Admin, userId: string, kind: string, id: string): Promise<Order | string> {
  if (kind === 'offer') {
    const { data: offer } = await db
      .from('trip_offers')
      .select('id, status, offered_by, guide_id, price_total_usd, deposit_percent, trip_requests!inner(traveler_id, title)')
      .eq('id', id)
      .maybeSingle();
    const request = offer?.trip_requests as unknown as { traveler_id: string; title: string } | undefined;
    if (!offer || request?.traveler_id !== userId) return 'not_found';
    if (offer.status !== 'accepted') return 'not_accepted';
    if (!offer.deposit_percent) return 'no_deposit';
    if (!(await offererApproved(db, offer.offered_by, offer.guide_id))) return 'not_approved';
    return {
      payee: offer.offered_by,
      description: `Deposit: ${request.title}`.slice(0, 200),
      usd: Math.round(offer.price_total_usd * offer.deposit_percent) / 100,
      offerId: offer.id,
    };
  }
  if (kind === 'group') {
    const { data: member } = await db
      .from('group_trip_members')
      .select('id, status, seats, traveler_id, price_per_person_usd, group_trips!inner(organizer_id, guide_id, organizer_kind, status, cancelled, title, deposit_percent)')
      .eq('id', id)
      .maybeSingle();
    const trip = member?.group_trips as unknown as
      | { organizer_id: string; guide_id: string | null; organizer_kind: string; status: string; cancelled: boolean; title: string; deposit_percent: number }
      | undefined;
    if (!member || member.traveler_id !== userId || !trip) return 'not_found';
    if (member.status !== 'accepted') return 'not_accepted';
    // Only approved, running groups organised by a guide or a business take deposits; never traveller-run groups.
    if (trip.status !== 'approved' || trip.cancelled || trip.organizer_kind === 'traveller') return 'no_deposit';
    // Charge the price saved on the member row when they were accepted, not today's price.
    const price = member.price_per_person_usd as number | null;
    if (!trip.deposit_percent || !price) return 'no_deposit';
    if (!(await offererApproved(db, trip.organizer_id, trip.guide_id))) return 'not_approved';
    return {
      payee: trip.organizer_id,
      description: `Deposit: ${trip.title} (${member.seats})`.slice(0, 200),
      usd: Math.round(price * member.seats * trip.deposit_percent) / 100,
      memberId: member.id,
    };
  }
  return 'bad_request';
}

async function checkout(db: Admin, user: { id: string; email?: string }, kind: string, id: string, locale: string) {
  const order = await loadOrder(db, user.id, kind, id);
  if (typeof order === 'string') return json({ error: order }, order === 'not_found' ? 404 : 400);

  const target = order.offerId ? 'trip_offer_id' : 'group_member_id';
  const targetId = (order.offerId ?? order.memberId)!;
  const settled = await db.from('payments').select('status').eq(target, targetId).in('status', ['paid', 'review']);
  if (settled.data?.some((p) => p.status === 'paid')) return json({ error: 'already_paid' }, 409);
  if (settled.data?.length) return json({ error: 'under_review' }, 409);

  // Never leave two payable orders open: settle or cancel the earlier one at Selcom first.
  const { data: open } = await db.from('payments').select('order_id').eq(target, targetId).eq('status', 'pending');
  for (const earlier of open ?? []) {
    try {
      const state = await refresh(db, earlier.order_id);
      if (state === 'paid') return json({ error: 'already_paid' }, 409);
      if (state === 'review') return json({ error: 'under_review' }, 409);
      if (state === 'pending') {
        await selcom('checkout/cancel-order', 'DELETE', { order_id: earlier.order_id });
        await db.from('payments').update({ status: 'failed' }).eq('order_id', earlier.order_id).eq('status', 'pending');
      }
    } catch (err) {
      console.error(err);
      return json({ error: 'pending_order', order_id: earlier.order_id }, 409);
    }
  }

  const { data: profile } = await db.from('profiles').select('full_name, phone').eq('id', user.id).single();
  const phone = selcomPhone(profile?.phone ?? null);
  if (!phone) return json({ error: 'phone_required' }, 400);

  const tzs = Math.ceil((order.usd * RATE) / 100) * 100; // round up to 100 shillings
  const orderId = `RAF${Date.now()}${Math.floor(Math.random() * 9000 + 1000)}`;
  const lang = /^[a-z]{2}$/.test(locale) ? locale : 'en';

  const { error } = await db.from('payments').insert({
    user_id: user.id,
    payee_user_id: order.payee,
    kind: order.offerId ? 'offer_deposit' : 'group_deposit',
    trip_offer_id: order.offerId ?? null,
    group_member_id: order.memberId ?? null,
    description: order.description,
    amount_usd: order.usd,
    amount_tzs: tzs,
    order_id: orderId,
  });
  // 23505: another checkout for this deposit started at the same moment (only one pending order is allowed).
  if (error) return error.code === '23505' ? json({ error: 'pending_order' }, 409) : json({ error: 'save_failed' }, 500);

  try {
    const result = await selcom('checkout/create-order-minimal', 'POST', {
      vendor: env('SELCOM_VENDOR'),
      order_id: orderId,
      buyer_email: user.email ?? 'payments@rafrika.com',
      buyer_name: (profile?.full_name ?? 'Rafrika traveller').slice(0, 60),
      buyer_phone: phone,
      amount: tzs,
      currency: 'TZS',
      redirect_url: btoa(`${SITE_URL}/${lang}/payments/return?order=${orderId}`),
      cancel_url: btoa(`${SITE_URL}/${lang}/payments/return?order=${orderId}&cancelled=1`),
      webhook: btoa(`${env('SUPABASE_URL')}/functions/v1/payments`),
      buyer_remarks: order.description.slice(0, 100),
      merchant_remarks: 'Rafrika deposit',
      no_of_items: 1,
    });
    const encoded = result.data?.[0]?.payment_gateway_url;
    if (!encoded) throw new Error('No payment page returned');
    return json({ url: atob(encoded), order_id: orderId });
  } catch (err) {
    await db.from('payments').update({ status: 'failed' }).eq('order_id', orderId);
    console.error(err);
    return json({ error: 'gateway_error' }, 502);
  }
}

// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;

  if (body.action === 'config') return json({ enabled: enabled(), rate: RATE > 0 ? RATE : null });
  if (!enabled()) return json({ error: 'not_configured' }, 503);
  const db = admin();

  // Selcom webhook: no user token; we only use the order id and ask Selcom for the truth.
  if (!body.action && body.order_id) {
    try {
      await refresh(db, String(body.order_id));
    } catch (err) {
      console.error(err);
    }
    return json({ ok: true });
  }

  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } };
  const user = auth?.user;
  if (!user) return json({ error: 'sign_in' }, 401);

  if (body.action === 'checkout') return checkout(db, user, body.kind, body.id, body.locale ?? 'en');

  if (body.action === 'status') {
    const { data: own } = await db.from('payments').select('id').eq('order_id', body.order_id).eq('user_id', user.id).maybeSingle();
    if (!own) return json({ error: 'not_found' }, 404);
    try {
      return json({ status: await refresh(db, body.order_id) });
    } catch (err) {
      console.error(err);
      return json({ status: 'pending' });
    }
  }
  return json({ error: 'bad_request' }, 400);
});
