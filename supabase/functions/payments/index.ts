// Deposits through Selcom Checkout: mobile money (M-Pesa, Mixx by Yas, Airtel Money, HaloPesa) through
// checkout/create-order-minimal, and cards through checkout/create-order with payment_methods "CARD" and
// the billing fields Selcom requires for cards (docs/payments/selcom-sandbox-plan.md, section 8).
// Card numbers are typed on Selcom's own page; Kwetuly never sees or stores them.
//
//   POST { action: "config" }                          → { enabled, rate, methods } (anyone; Pay button,
//                                                         ≈ TSh prices, which pay options to show)
//   POST { action: "check", kind, id } + user token     → { ok } or { error } (can this deposit be paid now?)
//   POST { action: "checkout", kind: "offer"|"group", id, method?: "mobile_money"|"card",
//          billing?: { firstname, lastname, address_1, address_2?, city, state_or_region,
//                      postcode_or_pobox, country } } + user token → { url, order_id }
//        method defaults to "mobile_money" (older website and app builds send none). billing is required
//        for "card" only; it is passed to Selcom and never stored or logged.
//   POST { action: "status", order_id } + user token   → { status }    (asks Selcom, updates the row)
//   POST { action: "sweep" } + header x-kwetuly-sweep   → counts only   (pg_cron every minute, see
//                                                         20261107000100_payments_sweeper.sql)
//   POST from Selcom (webhook, has order_id)           → re-checks the order with Selcom, never trusts the body
//
// Secrets (Supabase dashboard → Edge Functions → Secrets). Without them payments stay switched off:
//   KWETULY_ENV      "test" or "live", required. Anything else (or unset) keeps payments switched off.
//                    test: SELCOM_LIVE unset or "0", and NOT the live Supabase project.
//                    live: SELCOM_LIVE = "1", KWETULY_LIVE_PROJECT_REF set, and this IS the live project.
//   SELCOM_LIVE      "1" for real money (Selcom's live gateway); unset or "0" for the test gateway.
//                    Any other value is a configuration error: payments stay switched off.
//   KWETULY_LIVE_PROJECT_REF  must equal LIVE_PROJECT_REF below when set; required for live.
//   SELCOM_VENDOR, SELCOM_API_KEY, SELCOM_API_SECRET   from the Selcom merchant account
//   USD_TZS_RATE     shillings per US dollar used to price deposits, e.g. "2600"
//   PAYMENTS_SWEEP_SECRET  at least 32 random characters; the same value is in Vault as
//                    payments_sweep_secret. Without it every sweep call is refused.
//   SELCOM_CARDS     "1" once Selcom has switched cards on for the merchant account; unset or "0" offers
//                    mobile money only. Any other value means cards off (logged at start-up); mobile
//                    money is not affected (security-reviewer L7).
//   SITE_URL         e.g. "https://kwetuly.com" (default)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const env = (key: string, fallback = '') => Deno.env.get(key) ?? fallback;
const SITE_URL = env('SITE_URL', 'https://kwetuly.com').replace(/\/$/, '');
const RATE = Number(env('USD_TZS_RATE'));
const RATE_SOURCE = 'env:USD_TZS_RATE';

// The live Supabase project (.mcp.json, docs/devops/kwetuly-hosting-plan.md, docs/team/board.md "live").
// If the live project ever changes, change it here and in KWETULY_LIVE_PROJECT_REF together.
const LIVE_PROJECT_REF = 'zsymxfommlxqqfywekuy';
// The project ref is the first label of SUPABASE_URL's host. A custom Supabase domain would not match
// (then live refuses to run, which is safe; to verify if a custom domain is ever bought).
const PROJECT_REF = (() => {
  try {
    return new URL(env('SUPABASE_URL')).hostname.split('.')[0];
  } catch {
    return '';
  }
})();
const KWETULY_ENV = env('KWETULY_ENV');
const SELCOM_LIVE = env('SELCOM_LIVE');
const LIVE_REF_SECRET = env('KWETULY_LIVE_PROJECT_REF');
const SELCOM_CARDS = env('SELCOM_CARDS');
// Mode guard: live Selcom only in the live project, test Selcom only outside it, and nothing at all
// unless the mode is set explicitly. A configuration error switches payments off (config answers
// enabled: false, every other action 503, no Selcom call); it never falls back to a default mode.
const CONFIG_ERROR = (() => {
  if (KWETULY_ENV !== 'test' && KWETULY_ENV !== 'live') return 'KWETULY_ENV must be "test" or "live"';
  if (SELCOM_LIVE !== '' && SELCOM_LIVE !== '0' && SELCOM_LIVE !== '1') return 'SELCOM_LIVE must be unset, "0" or "1"';
  if (LIVE_REF_SECRET !== '' && LIVE_REF_SECRET !== LIVE_PROJECT_REF) return 'KWETULY_LIVE_PROJECT_REF does not match the live project ref in the code';
  if (!PROJECT_REF) return 'SUPABASE_URL has no project ref';
  if (KWETULY_ENV === 'live') {
    if (SELCOM_LIVE !== '1') return 'KWETULY_ENV=live needs SELCOM_LIVE=1';
    if (LIVE_REF_SECRET !== LIVE_PROJECT_REF) return 'KWETULY_ENV=live needs KWETULY_LIVE_PROJECT_REF';
    if (PROJECT_REF !== LIVE_PROJECT_REF) return 'KWETULY_ENV=live outside the live project';
  } else {
    if (SELCOM_LIVE === '1') return 'KWETULY_ENV=test with SELCOM_LIVE=1';
    if (PROJECT_REF === LIVE_PROJECT_REF) return 'KWETULY_ENV=test in the live project';
  }
  return '';
})();
const LIVE = CONFIG_ERROR === '' && KWETULY_ENV === 'live';
// Cards only with exactly "1". A wrong value switches cards off, not payments (L7).
const CARDS_ON = SELCOM_CARDS === '1';
const CARDS_CONFIG_WARNING = SELCOM_CARDS !== '' && SELCOM_CARDS !== '0' && SELCOM_CARDS !== '1' ? 'SELCOM_CARDS must be unset, "0" or "1"; cards off' : '';
const API = `https://${LIVE ? 'apigw' : 'apigwtest'}.selcommobile.com/v1/`;
// Logged once per start-up. Mode, host and project ref only; never keys.
console.log(
  `payments: mode ${KWETULY_ENV || 'unset'}, Selcom gateway ${new URL(API).host}, project ${PROJECT_REF || 'unknown'}` +
    (CONFIG_ERROR ? `; switched off: ${CONFIG_ERROR}` : '') +
    (CARDS_CONFIG_WARNING ? `; ${CARDS_CONFIG_WARNING}` : ''),
);

// Selcom closes an unpaid order after this many minutes (sent as `expiry` on create-order).
const ORDER_EXPIRY_MINUTES = 60;
// Selcom states that mean the order can no longer be paid. EXPIRED covers orders past their expiry.
const FAILED_STATES = ['CANCELLED', 'CANCELED', 'USERCANCELLED', 'USERCANCELED', 'REJECTED', 'EXPIRED'];
const enabled = () =>
  CONFIG_ERROR === '' && Boolean(env('SELCOM_VENDOR') && env('SELCOM_API_KEY') && env('SELCOM_API_SECRET') && RATE > 0);
// Pay options offered. Cards only behind the same mode guard and only when switched on explicitly.
type PayMethod = 'mobile_money' | 'card';
const methods = (): PayMethod[] => (!enabled() ? [] : CARDS_ON ? ['mobile_money', 'card'] : ['mobile_money']);

// The last day a new deposit can be started is this many days before the trip's start date (Tanzania
// date): a deposit is allowed only if start_date >= today + DEPOSIT_LAST_DAY_BEFORE_START. So no deposit
// is ever taken inside the 7-day no-refund window (Walter, 2026-11-07). Applies to group trips and to
// offers on requests with a start date. Same number as c_last_day_before_start in
// private.guard_new_payment(); change both together (candidate for site_settings later).
const DEPOSIT_LAST_DAY_BEFORE_START = 8;

// Webhook hardening.
// Order ids we create: "RAF" + 32 lower-case hex characters (a random UUID without dashes). Anything
// else is dropped before any database lookup. Payments were never switched on in any project, so no
// older-format ids exist; each project is checked before payments are switched on (plan, section 6).
const ORDER_ID = /^RAF[0-9a-f]{32}$/;
const MAX_BODY_BYTES = 8 * 1024;
// Payment page host allowlist (security-reviewer M-A). A copy of isSelcomPaymentUrl in
// packages/shared/src/payments.ts (Deno cannot import that package); keep the two the same, the
// shared tests cover the rules. Exact payment page host TO VERIFY IN THE SANDBOX (plan, 4.2): Selcom's
// docs show only a placeholder, so any subdomain of Selcom's own domains is accepted until then.
const SELCOM_PAYMENT_DOMAINS = ['selcommobile.com', 'selcom.net'];
const PAYMENT_URL = /^https:\/\/([A-Za-z0-9.-]+)(?::443)?(?:[/?#][\x21-\x5b\x5d-\x7e]*)?$/;
const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
function isSelcomPaymentUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length === 0 || url.length > 2048) return false;
  const match = PAYMENT_URL.exec(url);
  if (!match) return false;
  const host = match[1].toLowerCase();
  if (host.length > 253 || !host.split('.').every((label) => HOST_LABEL.test(label))) return false;
  return SELCOM_PAYMENT_DOMAINS.some((domain) => host.endsWith(`.${domain}`));
}

// A webhook asks Selcom about the same order at most once in this time.
const WEBHOOK_MIN_INTERVAL_MS = 45_000;
// Failed orders older than this are no longer re-checked by the sweeper or the payer (Selcom orders expire
// after 60 minutes; anything later is caught by the daily reconciliation against Selcom's records).
// A Selcom webhook for such an order is still checked once (under the webhook claim) and logged:
// Selcom calls back only on success, so it may be real money that must reach 'review'.
const FAILED_RECHECK_MS = 3 * 24 * 3600_000;
// The payer's own status checks (return page, app) ask Selcom at most once in this time per order.
const PAYER_MIN_INTERVAL_MS = 5_000;
// Checkout: at most one per offer or member in this many seconds (public.claim_deposit_checkout, L2).
const CHECKOUT_MIN_INTERVAL_S = 10;
// Checkout re-asks Selcom about at most this many recent failed orders for the same deposit (M1 c).
const CHECKOUT_FAILED_CHECKS = 5;
// Every Selcom call gives up after this long.
const SELCOM_TIMEOUT_MS = 10_000;
// A sweep starts no new check after this long (pg_cron's HTTP call waits 60 s).
const SWEEP_DEADLINE_MS = 45_000;
// When a Selcom status call throws for a pending order, the claim is moved back by this much (from a
// 2-minute window), so the next sweep retries after about 1 minute rather than at once.
const SWEEP_BACKOFF_MS = 60_000;
// Sweeper (pg_cron every minute). Pending orders at least SWEEP_MIN_AGE_MS old are asked about at
// most once every SWEEP_INTERVAL_MS; failed orders from the last 3 days once every
// SWEEP_FAILED_INTERVAL_MS (one Kwetuly gave up on may still have been paid at Selcom).
const SWEEP_MIN_AGE_MS = 2 * 60_000;
const SWEEP_INTERVAL_MS = 2 * 60_000;
const SWEEP_FAILED_INTERVAL_MS = 6 * 3600_000;
const SWEEP_BATCH = 25;
const SWEEP_FAILED_BATCH = 10;
// An order not settled at Selcom this long after it was made is given up on (failed). It is still
// re-checked as a failed order for 3 days, so a late success still reaches 'review'.
// To verify with Selcom: what order-status reports after the expiry we send (PENDING or EXPIRED),
// and how long an order can stay INPROGRESS.
const STALE_PENDING_MS = 24 * 3600_000;
// An order Selcom says it does not know (never created there, for example create-order timed out before
// Selcom saved it) cannot be paid once our expiry has passed: given up on after that, not after a day.
// To verify with Selcom: the HTTP status / resultcode order-status gives for an unknown order_id.
const unknownOrder = (err: unknown) =>
  err instanceof SelcomError && (err.http === 404 || /not ?found|no ?record|does not exist|invalid order/i.test(err.result));
// Error the database deposit guard raises (private.guard_new_payment): mapped to 'no_deposit'.
const DEPOSIT_GUARD = { code: 'P0001', hint: 'kwetuly_deposit_guard' };
const str = (v: unknown) => (typeof v === 'string' ? v : '');
// The date in Tanzania (UTC+3 all year, no daylight saving) `days` from today, e.g. "2026-11-15".
const tanzaniaDate = (days = 0) => new Date(Date.now() + 3 * 3600_000 + days * 24 * 3600_000).toISOString().slice(0, 10);
// Whole US cents as an exact decimal string for numeric(10,2), e.g. 12345 -> "123.45". No floats.
const centsToUsd = (cents: number) => `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
// Past its expiry (plus a few minutes' grace) Selcom no longer takes money for an order.
const expired = (createdAt: string) => Date.now() - new Date(createdAt).getTime() > (ORDER_EXPIRY_MINUTES + 5) * 60_000;

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

class SelcomError extends Error {
  constructor(message: string, readonly http: number, readonly resultcode: string, readonly result: string) {
    super(message);
  }
}

async function selcom(path: string, method: 'GET' | 'POST' | 'DELETE', data: Fields) {
  // Second lock behind the check in Deno.serve: no Selcom call ever leaves with a configuration error.
  if (!enabled()) throw new Error(`Selcom ${path}: payments switched off`);
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
  const res = await fetch(url, {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(SELCOM_TIMEOUT_MS),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || (body.resultcode && body.resultcode !== '000')) {
    // Only the HTTP status, resultcode and result go to the logs: never the body (it can hold
    // phone numbers, names, billing addresses and payment links).
    const safe = (v: unknown, max: number) => (typeof v === 'string' || typeof v === 'number' ? String(v).replace(/[^\w .:-]/g, '').slice(0, max) : 'none');
    const code = safe(body.resultcode, 10);
    const result = safe(body.result, 40);
    throw new SelcomError(`Selcom ${path}: HTTP ${res.status} resultcode=${code} result=${result}`, res.status, code, result);
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

// Is the trip this deposit belongs to still going ahead for this traveller? A deposit that arrives after
// the group trip was cancelled or taken down, the member left or was removed, the offer is no longer
// accepted or its trip request was closed, must be refunded rather than passed on: it is held as
// 'review', never 'paid'. (A trip that has simply started is not closed here: an order created on the
// last day may be paid after midnight.)
// The payee must also still be the organiser or offerer, and still an approved, non-sample guide or
// business owner: a guide suspended or taken down after the order was made is not paid automatically.
type PaymentTarget = { trip_offer_id: string | null; group_member_id: string | null; payee_user_id: string | null };

async function depositTargetOpen(db: Admin, payment: PaymentTarget) {
  if (payment.group_member_id) {
    const { data } = await db
      .from('group_trip_members')
      .select('status, group_trips!inner(status, cancelled, organizer_id, guide_id)')
      .eq('id', payment.group_member_id)
      .maybeSingle();
    const trip = data?.group_trips as unknown as { status: string; cancelled: boolean; organizer_id: string; guide_id: string | null } | undefined;
    if (!data || data.status !== 'accepted' || !trip || trip.status !== 'approved' || trip.cancelled) return false;
    if (trip.organizer_id !== payment.payee_user_id) return false;
    return offererApproved(db, trip.organizer_id, trip.guide_id);
  }
  if (payment.trip_offer_id) {
    const { data } = await db
      .from('trip_offers')
      .select('status, offered_by, guide_id, trip_requests!inner(status)')
      .eq('id', payment.trip_offer_id)
      .maybeSingle();
    const request = data?.trip_requests as unknown as { status: string } | undefined;
    if (data?.status !== 'accepted' || data.offered_by !== payment.payee_user_id || !request || request.status === 'closed') return false;
    return offererApproved(db, data.offered_by, data.guide_id);
  }
  return false;
}

// Which server path changed a deposit's status (payments.status_source, with updated_at: who and when).
type Source = 'checkout' | 'payer_check' | 'webhook' | 'sweeper';
// What Selcom reported for a completed order (saved with the status change).
type Settled = { provider_amount: number | null; provider_reference: string | null; provider_channel: string | null };

// Conditional status change: only from `from`, so a repeated or parallel check never changes a row twice.
// Errors are thrown, never ignored: a status Selcom reported must not be lost silently.
// Returns whether this call changed the row.
class DbError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
  }
}

async function setStatus(db: Admin, id: string, from: string, patch: Record<string, unknown>, source: Source) {
  const { data, error } = await db.from('payments').update({ ...patch, status_source: source }).eq('id', id).eq('status', from).select('id');
  if (error) throw new DbError(`Deposit ${id}: status update failed (${error.code})`, error.code ?? '');
  return (data?.length ?? 0) > 0;
}

async function readStatus(db: Admin, id: string) {
  const { data, error } = await db.from('payments').select('status').eq('id', id).single();
  if (error || !data) throw new Error(`Deposit ${id}: status re-read failed (${error?.code ?? 'missing'})`);
  return data.status as string;
}

// Moves a row from `from` to patch.status and returns the row's real status afterwards.
// If another path changed the row first (0 rows updated), the row is read again. When Selcom has just
// reported the order COMPLETED (`completed` given) and the row is now 'failed' (for example a parallel
// checkout gave up on it), it goes straight on to 'review': money Selcom took is never left as failed.
async function moveStatus(db: Admin, id: string, from: string, patch: Record<string, unknown>, source: Source, completed?: Settled): Promise<string> {
  if (await setStatus(db, id, from, patch, source)) return String(patch.status);
  const now = await readStatus(db, id);
  if (now === 'failed' && completed) {
    console.error(`Deposit ${id}: Selcom reports it paid while it was being marked failed; held for review`);
    if (await setStatus(db, id, 'failed', { status: 'review', ...completed }, source)) return 'review';
    return readStatus(db, id);
  }
  return now;
}

// Ask Selcom for the real result and record it (used by the webhook, the sweeper, checkout, the return
// page and the app). A completed order is marked paid only when Selcom reports exactly the shillings we
// asked for and the trip is still going ahead; anything else is held as 'review' for an admin, never
// 'paid'. Failed orders are checked too: one we cancelled or gave up on can still have been paid at
// Selcom; it goes to 'review' (admins are alerted by the payments_review trigger).
// The answer is always the row's real status after this call.
//
// `claim`: Selcom is asked about an order at most once in `ms`, claimed atomically on `column`, so parallel
// callers make one call. Webhooks and the sweeper claim last_checked_at (45 s / 2 min / 6 h); the payer's
// own checks claim payer_checked_at (5 s), a separate column, so a payer check never makes a webhook
// that arrives a moment later skip its call. Unclaimed (checkout only): asks Selcom every time, without
// a per-order throttle; checkout itself is throttled per offer or member (claim_deposit_checkout, 10 s).
// If the Selcom call throws for a pending order claimed on last_checked_at, the claim is moved back so
// the next sweep retries in about a minute (not at once, not after the full window).
// `state` in the answer is Selcom's payment_status seen by this call ('' when Selcom reported none),
// or null when Selcom was not asked.
type Refreshed = { status: string; state: string | null };
type Claim = { column: 'last_checked_at' | 'payer_checked_at'; ms: number };

async function refresh(db: Admin, orderId: string, opts: { claim?: Claim; source: Source }): Promise<Refreshed | null> {
  const { data: payment } = await db
    .from('payments')
    .select('id, status, amount_tzs, trip_offer_id, group_member_id, payee_user_id, created_at')
    .eq('order_id', orderId)
    .maybeSingle();
  if (!payment) return null;
  const stored = { status: payment.status as string, state: null };
  if (payment.status !== 'pending' && payment.status !== 'failed') return stored;
  // Long-failed orders are not asked about again by the sweeper or the payer; reconciliation with
  // Selcom's records covers them. A webhook for one is checked once (Selcom calls back only on success).
  if (payment.status === 'failed' && Date.now() - new Date(payment.created_at).getTime() > FAILED_RECHECK_MS) {
    if (opts.source !== 'webhook') return stored;
    console.error(`Deposit ${orderId}: Selcom webhook for a failed order older than 3 days; checking once`);
  }
  let claimedAt: string | null = null;
  if (opts.claim) {
    claimedAt = new Date().toISOString();
    const cutoff = new Date(Date.now() - opts.claim.ms).toISOString();
    const col = opts.claim.column;
    const { data: claimed, error } = await db
      .from('payments')
      .update({ [col]: claimedAt })
      .eq('id', payment.id)
      .eq('status', payment.status)
      .or(`${col}.is.null,${col}.lt."${cutoff}"`)
      .select('id');
    if (error) throw new Error(`Deposit ${orderId}: throttle claim failed (${error.code})`);
    if (!claimed?.length) return stored;
  }
  const age = Date.now() - new Date(payment.created_at).getTime();
  let result: Awaited<ReturnType<typeof selcom>>;
  try {
    result = await selcom('checkout/order-status', 'GET', { order_id: orderId });
  } catch (err) {
    const why = err instanceof Error ? err.message : 'error';
    // A pending order Selcom does not know, past our expiry, or one Selcom has not answered about for a
    // day, is given up on (failed), so it no longer blocks a new Pay attempt. It stays re-checkable for
    // 3 days, and the daily reconciliation with Selcom's records covers it after that.
    if (payment.status === 'pending' && ((unknownOrder(err) && expired(payment.created_at)) || age > STALE_PENDING_MS)) {
      console.error(`Deposit ${orderId}: ${unknownOrder(err) ? 'unknown to Selcom past its expiry' : 'no answer from Selcom for over a day'}; marked failed (${why})`);
      return { status: await moveStatus(db, payment.id, 'pending', { status: 'failed' }, opts.source), state: null };
    }
    // Back off (only if nobody claimed it since). Failed orders keep the full claim: one that never
    // reached Selcom (gateway error) would otherwise be asked about every minute for 3 days.
    if (claimedAt && opts.claim?.column === 'last_checked_at' && payment.status === 'pending') {
      await db
        .from('payments')
        .update({ last_checked_at: new Date(Date.now() - SWEEP_BACKOFF_MS).toISOString() })
        .eq('id', payment.id)
        .eq('last_checked_at', claimedAt);
    }
    throw err;
  }
  const order = result.data?.[0] ?? {};
  const state = String(order.payment_status ?? '').toUpperCase();
  // Shillings are whole numbers. Selcom's amount is accepted only as a whole number (optionally ".00");
  // anything else (fractions, text) is treated as unknown, which holds a completed order for review.
  const rawAmount = String(order.amount ?? '').replace(/,/g, '').trim();
  const providerAmount = /^\d{1,12}(\.0{1,2})?$/.test(rawAmount) ? parseInt(rawAmount, 10) : null;
  const settled: Settled = {
    provider_amount: providerAmount,
    provider_reference: order.reference ?? order.transid ?? null,
    provider_channel: order.channel ?? null,
  };
  const completed = state === 'COMPLETED' ? settled : undefined;

  if (payment.status === 'failed') {
    if (!completed) return { status: 'failed', state };
    console.error(`Deposit ${orderId}: Selcom reports it paid after it was marked failed; held for review`);
    return { status: await moveStatus(db, payment.id, 'failed', { status: 'review', ...settled }, opts.source), state };
  }

  let status = completed ? 'paid' : FAILED_STATES.includes(state) ? 'failed' : 'pending';
  if (status === 'paid') {
    // Selcom's order-status answer does not always include a currency. The order was created in TZS,
    // so only a currency Selcom actually reports can disagree; a missing one is not a mismatch.
    const currency = order.currency ? String(order.currency).toUpperCase() : null;
    if (providerAmount === null || providerAmount !== payment.amount_tzs || (currency !== null && currency !== 'TZS')) {
      status = 'review';
      console.error(`Deposit ${orderId}: Selcom amount or currency does not match the order; held for review`);
    } else if (!(await depositTargetOpen(db, payment))) {
      status = 'review';
      console.error(`Deposit ${orderId}: paid after the trip or spot was closed; held for review (refund)`);
    } else if (await otherPaid(db, payment)) {
      status = 'review';
      console.error(`Deposit ${orderId}: another order for the same deposit is already paid; held for review (refund)`);
    }
  } else if (status === 'pending') {
    // Still open at Selcom. Past the expiry we sent, an order Selcom reports as PENDING (or does not
    // report at all) can no longer be paid: failed. Anything still unsettled a day later (for example
    // INPROGRESS) is given up on too. Both stay re-checkable as failed orders for 3 days.
    if (((state === 'PENDING' || state === '') && expired(payment.created_at)) || age > STALE_PENDING_MS) {
      status = 'failed';
      console.error(`Deposit ${orderId}: still ${state || 'unknown'} at Selcom after ${Math.round(age / 60_000)} min; marked failed (to verify against Selcom's order lifetime)`);
    }
  }
  if (status === 'pending') return { status, state };
  const patch = { status, ...settled, paid_at: status === 'paid' ? new Date().toISOString() : null };
  try {
    return { status: await moveStatus(db, payment.id, 'pending', patch, opts.source, completed), state };
  } catch (err) {
    // 23505 on 'paid': a parallel check marked another order for this deposit paid a moment ago (one paid
    // row per offer or member, unique index). Selcom still took this money: hold it for review (refund).
    if (status !== 'paid' || !(err instanceof DbError) || err.code !== '23505') throw err;
    console.error(`Deposit ${orderId}: second paid order for the same deposit; held for review (refund)`);
    return { status: await moveStatus(db, payment.id, 'pending', { ...patch, status: 'review', paid_at: null }, opts.source, completed), state };
  }
}

// Is another order for the same offer or member already paid? (Two payable orders should never exist,
// but if Selcom took money twice the second is held for review and refunded, never 'paid' twice.)
async function otherPaid(db: Admin, payment: PaymentTarget & { id: string }) {
  const target = payment.trip_offer_id ? 'trip_offer_id' : 'group_member_id';
  const value = payment.trip_offer_id ?? payment.group_member_id;
  if (!value) return false;
  const { data, error } = await db.from('payments').select('id').eq(target, value).eq('status', 'paid').neq('id', payment.id).limit(1);
  if (error) throw new DbError(`Deposit ${payment.id}: paid-twice check failed (${error.code})`, error.code ?? '');
  return (data?.length ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Sweeper: Selcom calls back only on success, so this closes failed, cancelled and expired orders and
// catches successes whose webhook was lost or skipped. Called by pg_cron (private.sweep_payments) with
// the shared secret; answers counts only, never order ids or amounts.
// ---------------------------------------------------------------------------
async function sweepAuthorized(req: Request) {
  const expected = env('PAYMENTS_SWEEP_SECRET');
  const given = req.headers.get('x-kwetuly-sweep') ?? '';
  if (expected.length < 32 || given === '') return false;
  // Compare SHA-256 digests in constant time, so the answer time says nothing about the secret.
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([expected, given].map(async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))));
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function sweep(db: Admin) {
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const [pending, failed] = await Promise.all([
    db
      .from('payments')
      .select('order_id, status')
      .eq('status', 'pending')
      .lt('created_at', iso(now - SWEEP_MIN_AGE_MS))
      .or(`last_checked_at.is.null,last_checked_at.lt."${iso(now - SWEEP_INTERVAL_MS)}"`)
      .order('created_at', { ascending: true })
      .limit(SWEEP_BATCH),
    db
      .from('payments')
      .select('order_id, status')
      .eq('status', 'failed')
      .gt('created_at', iso(now - FAILED_RECHECK_MS))
      .or(`last_checked_at.is.null,last_checked_at.lt."${iso(now - SWEEP_FAILED_INTERVAL_MS)}"`)
      .order('last_checked_at', { ascending: true, nullsFirst: true })
      .limit(SWEEP_FAILED_BATCH),
  ]);
  if (pending.error || failed.error) throw new Error(`sweep: listing failed (${pending.error?.code ?? failed.error?.code})`);
  const counts = { checked: 0, changed: 0, errors: 0, left: 0 };
  const rows = [...(pending.data ?? []), ...(failed.data ?? [])];
  for (const [i, row] of rows.entries()) {
    // Stop in time: pg_cron's HTTP call gives up after 60 s. The rest wait for the next minute.
    if (Date.now() - now > SWEEP_DEADLINE_MS) {
      counts.left = rows.length - i;
      break;
    }
    try {
      const ms = row.status === 'pending' ? SWEEP_INTERVAL_MS : SWEEP_FAILED_INTERVAL_MS;
      const result = await refresh(db, row.order_id, { claim: { column: 'last_checked_at', ms }, source: 'sweeper' });
      counts.checked++;
      if (result && result.status !== row.status) counts.changed++;
    } catch (err) {
      counts.errors++;
      console.error(err instanceof Error ? err.message : 'sweep refresh failed');
    }
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------
// Amounts in whole US cents, so nothing is rounded before the shillings are worked out.
// cutoffAt: when (ms since 1970) the last day to pay this deposit ends, at midnight Tanzania time, or
// null when no date limits it (undated offer without valid_until). The Selcom order expires by then (L6).
type Order = { payee: string; description: string; cents: number; offerId?: string; memberId?: string; cutoffAt: number | null };

// Midnight in Tanzania (UTC+3, no daylight saving) at the start of `date` + `days`, in ms since 1970.
const tanzaniaMidnight = (date: string, days: number) => Date.parse(`${date}T00:00:00+03:00`) + days * 24 * 3600_000;
// The last day to start a deposit is start_date - 8, so it ends at midnight starting start_date - 7.
const startCutoff = (startDate: string) => tanzaniaMidnight(startDate, 1 - DEPOSIT_LAST_DAY_BEFORE_START);
// An order never gets less than this; closer to the cut-off no new order is made ('no_deposit').
const MIN_ORDER_MINUTES = 5;
// Order expiry in whole minutes: 60, or less so that the order closes before the cut-off. null: too close.
function orderExpiryMinutes(cutoffAt: number | null) {
  if (cutoffAt === null) return ORDER_EXPIRY_MINUTES;
  const left = Math.floor((cutoffAt - Date.now()) / 60_000);
  if (left < MIN_ORDER_MINUTES) return null;
  return Math.min(ORDER_EXPIRY_MINUTES, left);
}

// Deposits go only to approved guides (offering as themselves) or to owners of an approved,
// non-sample business listing.
async function offererApproved(db: Admin, userId: string, guideId: string | null) {
  if (guideId) {
    // Sample guides (test data) never take real deposits.
    const { data } = await db.from('guides').select('id').eq('id', guideId).eq('owner_id', userId).eq('verification_status', 'approved').eq('is_sample', false).maybeSingle();
    return Boolean(data);
  }
  const { data } = await db.from('providers').select('id').eq('owner_id', userId).eq('verification_status', 'approved').eq('is_sample', false).limit(1);
  return (data ?? []).length > 0;
}

async function loadOrder(db: Admin, userId: string, kind: string, id: string): Promise<Order | string> {
  // The earliest start date that can still take a new deposit (Tanzania date), e.g. today + 8 days.
  const earliestStart = tanzaniaDate(DEPOSIT_LAST_DAY_BEFORE_START);
  if (kind === 'offer') {
    const { data: offer } = await db
      .from('trip_offers')
      .select('id, status, offered_by, guide_id, price_total_usd, deposit_percent, valid_until, trip_requests!inner(traveler_id, title, status, start_date, flexible_dates)')
      .eq('id', id)
      .maybeSingle();
    const request = offer?.trip_requests as unknown as
      | { traveler_id: string; title: string; status: string; start_date: string | null; flexible_dates: boolean }
      | undefined;
    if (!offer || request?.traveler_id !== userId) return 'not_found';
    if (offer.status !== 'accepted') return 'not_accepted';
    if (!offer.deposit_percent) return 'no_deposit';
    // Same rules as private.guard_new_payment() (Walter, 2026-11-07, option a):
    // * a closed request takes no deposit ('booked', the normal state after accepting, stays payable);
    // * a request with a start date: only if it starts on or after today + 8 days (Tanzania date);
    // * flexible or empty dates: only until the offer's valid_until (inclusive), if the guide set one.
    if (request.status === 'closed') return 'no_deposit';
    if (request.start_date && request.start_date < earliestStart) return 'no_deposit';
    if ((request.flexible_dates || !request.start_date) && offer.valid_until && offer.valid_until < tanzaniaDate()) return 'no_deposit';
    if (!(await offererApproved(db, offer.offered_by, offer.guide_id))) return 'not_approved';
    const cutoffs = [
      ...(request.start_date ? [startCutoff(request.start_date)] : []),
      ...((request.flexible_dates || !request.start_date) && offer.valid_until ? [tanzaniaMidnight(offer.valid_until, 1)] : []),
    ];
    return {
      payee: offer.offered_by,
      description: `Deposit: ${request.title}`.slice(0, 200),
      cents: offer.price_total_usd * offer.deposit_percent, // whole dollars x percent = cents
      offerId: offer.id,
      cutoffAt: cutoffs.length ? Math.min(...cutoffs) : null,
    };
  }
  if (kind === 'group') {
    const { data: member } = await db
      .from('group_trip_members')
      .select('id, status, seats, traveler_id, price_per_person_usd, group_trips!inner(organizer_id, guide_id, organizer_kind, status, cancelled, start_date, title, deposit_percent)')
      .eq('id', id)
      .maybeSingle();
    const trip = member?.group_trips as unknown as
      | { organizer_id: string; guide_id: string | null; organizer_kind: string; status: string; cancelled: boolean; start_date: string; title: string; deposit_percent: number }
      | undefined;
    if (!member || member.traveler_id !== userId || !trip) return 'not_found';
    if (member.status !== 'accepted') return 'not_accepted';
    // Only approved, running groups organised by a guide or a business take deposits; never traveller-run groups.
    if (trip.status !== 'approved' || trip.cancelled || trip.organizer_kind === 'traveller') return 'no_deposit';
    // The last day to start a deposit is 8 days before the start date (Tanzania date), so no deposit is
    // taken inside the 7-day no-refund window. After that the traveller pays the organiser directly.
    // Same rule as private.guard_new_payment().
    if (trip.start_date < earliestStart) return 'no_deposit';
    // Charge the price saved on the member row when they were accepted, not today's price.
    const price = member.price_per_person_usd as number | null;
    if (!trip.deposit_percent || !price) return 'no_deposit';
    if (!(await offererApproved(db, trip.organizer_id, trip.guide_id))) return 'not_approved';
    return {
      payee: trip.organizer_id,
      description: `Deposit: ${trip.title} (${member.seats})`.slice(0, 200),
      cents: price * member.seats * trip.deposit_percent,
      memberId: member.id,
      cutoffAt: startCutoff(trip.start_date),
    };
  }
  return 'bad_request';
}

// Is a payment for this deposit already done or being checked?
async function settledError(db: Admin, order: Order) {
  const target = order.offerId ? 'trip_offer_id' : 'group_member_id';
  const settled = await db.from('payments').select('status').eq(target, (order.offerId ?? order.memberId)!).in('status', ['paid', 'review']);
  if (settled.data?.some((p) => p.status === 'paid')) return 'already_paid';
  if (settled.data?.length) return 'under_review';
  return null;
}

// Can the traveller pay this deposit now? Lets the website and app hide the Pay box instead of
// showing an error (unapproved guide or business, admin-made offer, unapproved or cancelled group,
// trip starting within 8 days, closed or expired offer).
async function check(db: Admin, userId: string, kind: string, id: string) {
  const order = await loadOrder(db, userId, kind, id);
  if (typeof order === 'string') return json({ error: order });
  const settled = await settledError(db, order);
  return settled ? json({ error: settled }) : json({ ok: true });
}

// Card billing details. Selcom rejects card orders without them; the minimum it marks mandatory is
// collected (address_2 optional), checked for length and characters, sent to Selcom and never stored
// or logged. Phone is the profile phone (billing.phone), e-mail and name come from the account.
type Billing = Record<'firstname' | 'lastname' | 'address_1' | 'address_2' | 'city' | 'state_or_region' | 'postcode_or_pobox' | 'country', string>;
const BILLING_LIMITS: [keyof Billing, number, boolean][] = [
  ['firstname', 60, true],
  ['lastname', 60, true],
  ['address_1', 100, true],
  ['address_2', 100, false],
  ['city', 60, true],
  ['state_or_region', 60, true],
  ['postcode_or_pobox', 20, true],
  ['country', 2, true],
];

function readBilling(raw: unknown): Billing | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {} as Billing;
  for (const [key, max, required] of BILLING_LIMITS) {
    // Letters (any script), digits, spaces and common address punctuation; no control characters and
    // no '&' or '=' (they would blur the signed "field=value&..." string).
    const value = str((raw as Record<string, unknown>)[key]).normalize('NFC').replace(/\s+/g, ' ').trim();
    if (required && !value) return null;
    if (value.length > max || !/^[\p{L}\p{M}\p{N} .,'’()\/#-]*$/u.test(value)) return null;
    out[key] = value;
  }
  out.country = out.country.toUpperCase();
  return /^[A-Z]{2}$/.test(out.country) ? out : null;
}

// Free text sent in a signed Selcom field (buyer_name, buyer_remarks): the same rule as billing, but
// cleaned instead of refused (the payer cannot always change a name or trip title). '&', '=' and
// control or invisible format characters (\p{C}) become spaces, so the signed "field=value&..." string
// cannot be blurred (security-reviewer L5). Cut by characters, not UTF-16 units, so no half emoji.
function signedText(raw: string, max: number, fallback: string) {
  const clean = raw.normalize('NFC').replace(/[&=\p{C}]/gu, ' ').replace(/\s+/g, ' ').trim();
  return Array.from(clean || fallback).slice(0, max).join('').trim() || fallback;
}
// An e-mail address with '&', '=', spaces or control characters is not sent; Selcom gets ours instead.
const signedEmail = (raw: string | undefined) => (raw && /^[^\s&=\p{C}]{3,254}$/u.test(raw) && raw.includes('@') ? raw : 'payments@kwetuly.com');

async function checkout(db: Admin, user: { id: string; email?: string }, body: Record<string, unknown>) {
  const kind = str(body.kind);
  const locale = str(body.locale) || 'en';
  const method: PayMethod = body.method === undefined || body.method === 'mobile_money' ? 'mobile_money' : body.method === 'card' ? 'card' : ('' as PayMethod);
  if (!method) return json({ error: 'bad_request' }, 400);
  if (!methods().includes(method)) return json({ error: 'method_unavailable' }, 400);
  const billing = method === 'card' ? readBilling(body.billing) : null;
  if (method === 'card' && !billing) return json({ error: 'billing_required' }, 400);

  const order = await loadOrder(db, user.id, kind, str(body.id));
  if (typeof order === 'string') return json({ error: order }, order === 'not_found' ? 404 : 400);
  // The Selcom order must close before the last day to pay ends (L6): 60 minutes, or less on that day.
  const expiry = orderExpiryMinutes(order.cutoffAt);
  if (expiry === null) return json({ error: 'no_deposit' }, 400);

  const { data: profile } = await db.from('profiles').select('full_name, phone').eq('id', user.id).single();
  const phone = selcomPhone(profile?.phone ?? null);
  if (!phone) return json({ error: 'phone_required' }, 400);

  const target = order.offerId ? 'trip_offer_id' : 'group_member_id';
  const targetId = (order.offerId ?? order.memberId)!;

  // One checkout per offer or member every CHECKOUT_MIN_INTERVAL_S seconds (L2), claimed atomically in
  // the database, so a double click or a script cannot make parallel Selcom calls for the same deposit.
  const { data: claimed, error: claimError } = await db.rpc('claim_deposit_checkout', {
    p_kind: order.offerId ? 'offer_deposit' : 'group_deposit',
    p_target: targetId,
    p_seconds: CHECKOUT_MIN_INTERVAL_S,
  });
  if (claimError) {
    console.error(`Deposit checkout: throttle claim failed (${claimError.code})`);
    return json({ error: 'save_failed' }, 500);
  }
  if (claimed !== true) return json({ error: 'pending_order' }, 409);

  const settled = await settledError(db, order);
  if (settled) return json({ error: settled }, 409);

  // Never leave two payable orders open: settle or cancel the earlier one at Selcom first (M1).
  const { data: open, error: openError } = await db.from('payments').select('id, order_id').eq(target, targetId).eq('status', 'pending');
  if (openError) return json({ error: 'save_failed' }, 500);
  for (const earlier of open ?? []) {
    try {
      // Unclaimed: always asks Selcom (the checkout claim above throttles this).
      let current = await refresh(db, earlier.order_id, { source: 'checkout' });
      if (current?.status === 'pending') {
        // (a) Only an idle order (Selcom says PENDING, or reports no state) is cancelled. INPROGRESS (a
        // payment under way) or any other state: never cancelled, the traveller waits.
        if (current.state !== 'PENDING' && current.state !== '') return json({ error: 'pending_order', order_id: earlier.order_id }, 409);
        let cancelled = false;
        try {
          await selcom('checkout/cancel-order', 'DELETE', { order_id: earlier.order_id });
          cancelled = true;
        } catch (err) {
          // (b) Selcom refuses to cancel an expired or a completed order. Ask Selcom again and record
          // what it says, as for any check: COMPLETED -> paid or review; CANCELLED, EXPIRED and the
          // other failed states -> failed; PENDING (or no state) past our expiry -> failed. Anything
          // else stays pending and the traveller waits.
          console.error(`Deposit ${earlier.order_id}: cancel refused (${err instanceof SelcomError ? `HTTP ${err.http} resultcode=${err.resultcode}` : 'no answer'}); re-checking`);
          current = await refresh(db, earlier.order_id, { source: 'checkout' });
        }
        if (cancelled && current) current = { status: await moveStatus(db, earlier.id, 'pending', { status: 'failed' }, 'checkout'), state: current.state };
      }
      if (current?.status === 'paid') return json({ error: 'already_paid' }, 409);
      if (current?.status === 'review') return json({ error: 'under_review' }, 409);
      if (current?.status === 'pending') return json({ error: 'pending_order', order_id: earlier.order_id }, 409);
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'earlier order check failed');
      return json({ error: 'pending_order', order_id: earlier.order_id }, 409);
    }
  }

  // (c) An order Kwetuly gave up on (failed) may still have been paid at Selcom. Before a new order, ask
  // Selcom about the newest failed orders for this deposit from the last 3 days (without the sweeper's
  // claim). One that is COMPLETED goes to 'review' and no new order is made.
  const since = new Date(Date.now() - FAILED_RECHECK_MS).toISOString();
  const { data: recent, error: recentError } = await db
    .from('payments')
    .select('order_id')
    .eq(target, targetId)
    .eq('status', 'failed')
    .gt('created_at', since)
    .order('created_at', { ascending: false })
    .limit(CHECKOUT_FAILED_CHECKS);
  if (recentError) return json({ error: 'save_failed' }, 500);
  for (const row of recent ?? []) {
    try {
      const now = await refresh(db, row.order_id, { source: 'checkout' });
      if (now?.status === 'review') return json({ error: 'under_review' }, 409);
      if (now?.status === 'paid') return json({ error: 'already_paid' }, 409);
    } catch (err) {
      // Selcom does not know the order (it never reached Selcom): it cannot have been paid.
      if (unknownOrder(err)) continue;
      // No answer: no new order until Selcom can say the earlier one was not paid.
      console.error(err instanceof Error ? err.message : 'failed order re-check failed');
      return json({ error: 'gateway_error' }, 502);
    }
  }

  // Integer maths: cents x (shillings per dollar) / 100 = shillings, rounded up to the next 100 shillings:
  //   ceil(cents x rate / 10 000) x 100.
  // The rate is taken in hundredths so a rate such as 2650.75 stays exact (same result, no fractions).
  const rate100 = Math.round(RATE * 100);
  const tzs = Math.ceil((order.cents * rate100) / 1_000_000) * 100;
  // Unguessable: 122 random bits. 35 characters; Selcom's order_id length limit is to verify.
  const orderId = `RAF${crypto.randomUUID().replace(/-/g, '')}`;
  const lang = /^[a-z]{2}$/.test(locale) ? locale : 'en';

  const { error } = await db.from('payments').insert({
    user_id: user.id,
    payee_user_id: order.payee,
    kind: order.offerId ? 'offer_deposit' : 'group_deposit',
    trip_offer_id: order.offerId ?? null,
    group_member_id: order.memberId ?? null,
    description: order.description,
    amount_usd: centsToUsd(order.cents),
    amount_tzs: tzs,
    usd_tzs_rate: rate100 / 100,
    rate_source: RATE_SOURCE,
    pay_method: method,
    order_id: orderId,
  });
  // 23505: another checkout for this deposit started at the same moment (only one pending order is allowed).
  // P0001 + hint kwetuly_deposit_guard: private.guard_new_payment refused it (trip closed or starting
  // within 8 days, request closed, offer expired, member no longer accepted, payee not approved,
  // amount does not match, or a paid or in-review payment already exists for it (M2)). Only that is
  // 'no_deposit', unless a paid or in-review payment now exists; every other error is a generic save error.
  if (error) {
    if (error.code === '23505') return json({ error: 'pending_order' }, 409);
    if (error.code === DEPOSIT_GUARD.code && error.hint === DEPOSIT_GUARD.hint) {
      const now = await settledError(db, order);
      return now ? json({ error: now }, 409) : json({ error: 'no_deposit' }, 400);
    }
    console.error(`Deposit ${orderId}: insert failed (${error.code})`);
    return json({ error: 'save_failed' }, 500);
  }

  // Fields both order calls share. Deposits are always charged in TZS (a foreign card is converted by
  // the card's bank; whether Selcom can take USD on this merchant account is to verify).
  const common: Fields = {
    vendor: env('SELCOM_VENDOR'),
    order_id: orderId,
    buyer_email: signedEmail(user.email),
    buyer_name: signedText(profile?.full_name ?? '', 60, 'Kwetuly traveller'),
    buyer_phone: phone,
    amount: tzs,
    currency: 'TZS',
    redirect_url: btoa(`${SITE_URL}/${lang}/payments/return?order=${orderId}`),
    cancel_url: btoa(`${SITE_URL}/${lang}/payments/return?order=${orderId}&cancelled=1`),
    webhook: btoa(`${env('SUPABASE_URL')}/functions/v1/payments`),
    buyer_remarks: signedText(order.description, 100, 'Kwetuly deposit'),
    merchant_remarks: 'Kwetuly deposit',
    no_of_items: 1,
    expiry,
  };
  try {
    // Mobile money: create-order-minimal (Selcom: not for cards). Cards: create-order with
    // payment_methods CARD and the billing.* fields Selcom marks mandatory. Flat "billing.x" keys as in
    // Selcom's samples, also listed that way in Signed-Fields (to verify in the sandbox). No buyer_userid
    // or gateway_buyer_uuid: Kwetuly does not use Selcom's stored cards.
    const result =
      method === 'card' && billing
        ? await selcom('checkout/create-order', 'POST', {
            ...common,
            payment_methods: 'CARD',
            'billing.firstname': billing.firstname,
            'billing.lastname': billing.lastname,
            'billing.address_1': billing.address_1,
            ...(billing.address_2 ? { 'billing.address_2': billing.address_2 } : {}),
            'billing.city': billing.city,
            'billing.state_or_region': billing.state_or_region,
            'billing.postcode_or_pobox': billing.postcode_or_pobox,
            'billing.country': billing.country,
            'billing.phone': phone,
          })
        : await selcom('checkout/create-order-minimal', 'POST', common);
    const encoded = result.data?.[0]?.payment_gateway_url;
    if (!encoded) throw new Error('No payment page returned');
    // create-order-minimal returns the page address in base64 (documented). For create-order the
    // sample shows a plain address: accept either (to verify in the sandbox). Only https pages on a
    // Selcom host (M-A): anything else is never sent to the payer; they get gateway_error.
    const decoded = /^https?:\/\//i.test(encoded) ? encoded : atob(encoded);
    if (!isSelcomPaymentUrl(decoded)) throw new Error('Payment page not allowed');
    return json({ url: decoded, order_id: orderId });
  } catch (err) {
    // The order may still exist at Selcom (for example a timeout after Selcom created it): the sweeper
    // keeps re-checking failed orders for 3 days, so a payment made on it reaches 'review'.
    // Logged: HTTP status and resultcode only, or one fixed reason (L4). Never Selcom's text or body.
    console.error(`Deposit ${orderId}: create-order failed (${createOrderFailure(err)})`);
    const { data: row } = await db.from('payments').select('id').eq('order_id', orderId).maybeSingle();
    if (row) await moveStatus(db, row.id, 'pending', { status: 'failed' }, 'checkout').catch((e) => console.error(e instanceof Error ? e.message : e));
    return json({ error: 'gateway_error' }, 502);
  }
}

// The only things logged when create-order fails (L4).
function createOrderFailure(err: unknown) {
  if (err instanceof SelcomError) return `HTTP ${err.http} resultcode=${err.resultcode}`;
  if (err instanceof Error) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') return 'timeout';
    if (err.message === 'No payment page returned') return 'no payment page';
    if (err.message === 'Payment page not allowed') return 'payment page not allowed';
    if (err.name === 'InvalidCharacterError') return 'payment page not base64';
    if (err.name === 'TypeError') return 'network error';
  }
  return 'other error';
}

// ---------------------------------------------------------------------------
// Reads at most `max` bytes of the body; null when it is larger (the rest is not read).
async function readCapped(req: Request, max: number): Promise<string | null> {
  if (Number(req.headers.get('content-length') ?? '0') > max) return null;
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(all);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const raw = await readCapped(req, MAX_BODY_BYTES);
  if (raw === null) return json({ error: 'too_large' }, 413);
  let body: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed;
  } catch {
    // not JSON: treated as an empty request
  }

  if (body.action === 'config') return json({ enabled: enabled(), rate: RATE > 0 ? RATE : null, methods: methods() });
  if (!enabled()) return json({ error: 'not_configured' }, 503);

  // Sweeper (pg_cron). Only with the shared secret; the same 403 for a missing, short or wrong one.
  if (body.action === 'sweep') {
    if (!(await sweepAuthorized(req))) return json({ error: 'forbidden' }, 403);
    try {
      return json(await sweep(admin()));
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'sweep failed');
      return json({ error: 'sweep_failed' }, 500);
    }
  }

  // Selcom webhook: no user token; we only use the order id and ask Selcom for the truth.
  // The order id must look like one of ours before the database is touched. The answer is the same
  // for every webhook, so it tells a caller nothing about which order ids exist.
  if (body.action === undefined && 'order_id' in body) {
    const orderId = str(body.order_id);
    if (ORDER_ID.test(orderId)) {
      try {
        await refresh(admin(), orderId, { claim: { column: 'last_checked_at', ms: WEBHOOK_MIN_INTERVAL_MS }, source: 'webhook' });
      } catch (err) {
        console.error(err instanceof Error ? err.message : 'webhook refresh failed');
      }
    }
    return json({ ok: true });
  }
  const db = admin();

  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } };
  const user = auth?.user;
  if (!user) return json({ error: 'sign_in' }, 401);

  if (body.action === 'check') return check(db, user.id, str(body.kind), str(body.id));
  if (body.action === 'checkout') return checkout(db, user, body);

  if (body.action === 'status') {
    const orderId = str(body.order_id);
    if (!ORDER_ID.test(orderId)) return json({ error: 'not_found' }, 404);
    const { data: own } = await db.from('payments').select('id, status').eq('order_id', orderId).eq('user_id', user.id).maybeSingle();
    if (!own) return json({ error: 'not_found' }, 404);
    try {
      // At most one Selcom call per order every 5 seconds from the payer; within that, the stored status.
      const result = await refresh(db, orderId, { claim: { column: 'payer_checked_at', ms: PAYER_MIN_INTERVAL_MS }, source: 'payer_check' });
      return json({ status: result?.status ?? own.status });
    } catch (err) {
      // Selcom could not be reached, or never created this order: report the row's real status now.
      console.error(err instanceof Error ? err.message : 'status refresh failed');
      const { data: now } = await db.from('payments').select('status').eq('id', own.id).maybeSingle();
      return json({ status: now?.status ?? own.status });
    }
  }
  return json({ error: 'bad_request' }, 400);
});
