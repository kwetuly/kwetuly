// Deposits through a payment processor's hosted checkout. Travellers are charged in Tanzanian
// shillings; card numbers are typed only on the processor's own page, Kwetuly never sees them.
// This file is the provider-neutral core: routing, sign-in, database writes, the deposit decision,
// limits and the sweeper. Everything processor-specific is in providers/<name>.ts (today
// providers/flutterwave.ts), behind the PaymentProvider interface in providers/types.ts; the adapter is
// picked from PAYMENTS_PROVIDER by providers/index.ts.
//
//   POST { action: "config" }                       → { enabled, rate, rate100, provider } (anyone; Pay box, ≈ TSh prices)
//   POST { action: "check", kind, id } + user token  → { ok } or { error } (can this deposit be paid now?)
//   POST { action: "checkout", kind: "offer"|"group", id, locale } + user token → { url, order_id }
//   POST { action: "status", order_id } + user token → { status } (asks the processor, updates the row)
//   POST { action: "sweep" } + header x-kwetuly-sweep → counts only (pg_cron, 20261122100000_flutterwave_provider.sql)
//   POST from the processor (a webhook, recognised by the adapter from its headers)
//        → signature checked first (401 if wrong), logged masked in payment_events, then the order is
//          re-checked with the processor's verify API. The webhook body's amount and status are never used.
//
// Money state changes only here, on the server, after the processor's verify answer. The return URL and
// the app never change a status. Every change records status_source and updated_at (who and when).
//
// Secrets (Supabase dashboard, Edge Functions, Secrets; names in supabase/functions/.env.example).
// Without all of them payments stay switched off:
//   PAYMENTS_PROVIDER     a processor with an adapter in providers/index.ts: "flutterwave". Anything else
//                         (Selcom is parked) keeps payments off.
//   KWETULY_ENV           must be "test". Live is refused by this build (LIVE_ALLOWED below) until
//                         Walter approves live keys and the live switch; that needs a code change and review.
//   the adapter's own     e.g. FLW_* for Flutterwave (providers/flutterwave.ts); a live key is refused there.
//   USD_TZS_RATE          shillings per US dollar used to price deposits, e.g. "2600" or "2650.75".
//   USD_TZS_RATE_SOURCE   where that rate comes from, e.g. "BoT mean 2026-11-21" (saved on every order).
//   PAYMENTS_SWEEP_SECRET at least 32 random characters; the same value is in Vault as payments_sweep_secret.
//   SITE_URL              required, no default: the test site, e.g. "https://staging.kwetuly.com" or
//                         "http://localhost:3000". Travellers come back there after paying.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  centsToUsd,
  decideDeposit,
  depositTzs,
  invalidEventKey,
  isOrderId,
  isPaymentUrlOn,
  parseCurrency,
  parseMoney2,
  parseRateHundredths,
  parseWholeTzs,
  sameSecret,
  type DepositLimits,
} from './core.ts';
import { pickProvider } from './providers/index.ts';
import { ProviderHttpError, type PaymentDetails, type PaymentProvider, type VerifiedPayment } from './providers/types.ts';

const env = (key: string, fallback = '') => Deno.env.get(key) ?? fallback;
const SITE_URL = env('SITE_URL').replace(/\/$/, '');

// The live Supabase project. Test keys are never used there.
const LIVE_PROJECT_REF = 'zsymxfommlxqqfywekuy';
// Live payments are not built into this version: Walter approves live keys, the live switch, the
// payout account and the fee setting first, and the legal questions (holding deposits) are answered.
const LIVE_ALLOWED = false;
const PROJECT_REF = (() => {
  try {
    return new URL(env('SUPABASE_URL')).hostname.split('.')[0];
  } catch {
    return '';
  }
})();

const PROVIDER: PaymentProvider | null = pickProvider(env('PAYMENTS_PROVIDER'));
const RATE100 = parseRateHundredths(env('USD_TZS_RATE'));
const RATE_SOURCE = `env:${env('USD_TZS_RATE_SOURCE').replace(/[^\w .:/()-]/g, '').trim()}`.slice(0, 60);

// Mode guard. A configuration error switches payments off (config answers enabled: false, every other
// action 503, no processor call); it never falls back to a default.
const CONFIG_ERROR = (() => {
  if (!PROVIDER) return 'PAYMENTS_PROVIDER is not a processor with an adapter (providers/index.ts)';
  const mode = env('KWETULY_ENV');
  if (mode === 'live' && !LIVE_ALLOWED) return 'live payments are not switched on in this build';
  if (mode !== 'test') return 'KWETULY_ENV must be "test"';
  if (!PROJECT_REF) return 'SUPABASE_URL has no project ref';
  if (PROJECT_REF === LIVE_PROJECT_REF) return 'test keys in the live project';
  const providerError = PROVIDER.configError();
  if (providerError) return providerError;
  if (env('PAYMENTS_SWEEP_SECRET').length < 32) return 'PAYMENTS_SWEEP_SECRET is missing or shorter than 32 characters';
  if (!/^(https:\/\/[a-z0-9.-]+|http:\/\/localhost(:\d{2,5})?)$/i.test(SITE_URL)) return 'SITE_URL is missing or not https (or http://localhost)';
  if (SITE_URL === 'https://kwetuly.com' || SITE_URL === 'https://www.kwetuly.com') return 'SITE_URL is the live site; use the test site';
  if (RATE100 === null) return 'USD_TZS_RATE is missing or not a plain rate';
  if (RATE_SOURCE.length <= 'env:'.length + 2) return 'USD_TZS_RATE_SOURCE is missing';
  return '';
})();
const enabled = () => CONFIG_ERROR === '';
// The adapter, only once every check above passed. Every processor call goes through this.
const gateway = (): PaymentProvider => {
  if (!enabled() || !PROVIDER) throw new Error('payments switched off');
  return PROVIDER;
};
// The provider column value for rows this build makes and re-checks ('' while switched off; no row is touched then).
const PROVIDER_ID = PROVIDER?.id ?? '';
// Logged once per start-up: mode, provider and project only, never keys.
console.log(`payments: provider ${env('PAYMENTS_PROVIDER') || 'unset'}, mode ${env('KWETULY_ENV') || 'unset'}, project ${PROJECT_REF || 'unknown'}${CONFIG_ERROR ? `; switched off: ${CONFIG_ERROR}` : ''}`);

// Hosted page lifetime sent to the processor, in minutes.
const SESSION_MINUTES = 60;
const LIMITS: DepositLimits = { sessionMs: SESSION_MINUTES * 60_000, graceMs: 10 * 60_000, staleMs: 24 * 3600_000 };
// An open order's page is offered again only while it has at least 10 minutes left.
const LINK_REUSE_MS = (SESSION_MINUTES - 10) * 60_000;
// Failed orders are re-checked for this long (one Kwetuly gave up on may still be paid); after that the
// daily reconciliation against the processor's transaction export covers them.
const FAILED_RECHECK_MS = 3 * 24 * 3600_000;
const PAYER_MIN_INTERVAL_MS = 5_000;
const CHECKOUT_MIN_INTERVAL_S = 10;
const CHECKOUT_FAILED_CHECKS = 5;
const MAX_BODY_BYTES = 16 * 1024;
// Sweeper (pg_cron every 5 minutes).
const SWEEP_DEADLINE_MS = 45_000;
const SWEEP_MIN_AGE_MS = 2 * 60_000;
const SWEEP_INTERVAL_MS = 4 * 60_000;
const SWEEP_FAILED_INTERVAL_MS = 6 * 3600_000;
const SWEEP_BACKOFF_MS = 2 * 60_000;
const SWEEP_BATCH = 25;
const SWEEP_FAILED_BATCH = 10;

const str = (v: unknown) => (typeof v === 'string' ? v : '');
// Error the database deposit guard raises (private.guard_new_payment): mapped to 'no_deposit'.
const DEPOSIT_GUARD = { code: 'P0001', hint: 'kwetuly_deposit_guard' };
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// Tanzanian mobile number as 255XXXXXXXXX, or null. Optional: only pre-fills mobile money on the hosted page.
function tzPhone(raw: string | null) {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (/^0[67]\d{8}$/.test(digits)) return `255${digits.slice(1)}`;
  if (/^255[67]\d{8}$/.test(digits)) return digits;
  return null;
}
const cleanText = (raw: string, max: number, fallback: string) =>
  Array.from(raw.normalize('NFC').replace(/\p{C}/gu, ' ').replace(/\s+/g, ' ').trim() || fallback).slice(0, max).join('').trim() || fallback;
const cleanEmail = (raw: string | undefined) => (raw && /^[^\s\p{C}]{3,254}$/u.test(raw) && /^[^@]+@[^@]+\.[^@]+$/.test(raw) ? raw : 'payments@kwetuly.com');
// Plain short text for references an adapter reports (it cleans them too; this is the core's own limit).
const plain = (v: unknown, max: number) => (typeof v === 'string' || typeof v === 'number' ? String(v).replace(/[^\w.:-]/g, '').slice(0, max) || null : null);

const admin = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
type Admin = ReturnType<typeof admin>;

// ---------------------------------------------------------------------------
// Status changes
// ---------------------------------------------------------------------------
type Source = 'checkout' | 'payer_check' | 'webhook' | 'sweeper';

class DbError extends Error {
  constructor(message: string, readonly code: string, readonly constraint = '') {
    super(message);
  }
}
// The unique index a 23505 came from (security-reviewer L5), read from Postgres' message text.
const constraintOf = (error: { message?: string; details?: string } | null) =>
  /unique constraint "([a-z0-9_]+)"/.exec(`${error?.message ?? ''} ${error?.details ?? ''}`)?.[1] ?? '';
const ONE_PAID_INDEXES = ['payments_one_paid_offer', 'payments_one_paid_member'];

// Conditional change: only from `from`, so a repeated or parallel check never changes a row twice.
async function setStatus(db: Admin, id: string, from: string, patch: Record<string, unknown>, source: Source) {
  const { data, error } = await db.from('payments').update({ ...patch, status_source: source }).eq('id', id).eq('status', from).select('id');
  if (error) throw new DbError(`Deposit ${id}: status update failed (${error.code})`, error.code ?? '', constraintOf(error));
  return (data?.length ?? 0) > 0;
}

async function readStatus(db: Admin, id: string) {
  const { data, error } = await db.from('payments').select('status').eq('id', id).single();
  if (error || !data) throw new Error(`Deposit ${id}: status re-read failed (${error?.code ?? 'missing'})`);
  return data.status as string;
}

// Moves a row and returns its real status afterwards. If another path changed it first and the processor
// has just reported the money taken (`completed`), a row now 'failed' goes on to 'review'.
async function moveStatus(db: Admin, id: string, from: string, patch: Record<string, unknown>, source: Source, completed?: Record<string, unknown>): Promise<string> {
  if (await setStatus(db, id, from, patch, source)) return String(patch.status);
  const now = await readStatus(db, id);
  if (now === 'failed' && completed) {
    console.error(`Deposit ${id}: paid at the processor while being marked failed; held for review`);
    if (await setStatus(db, id, 'failed', { ...completed, status: 'review', status_reason: 'paid_after_failed' }, source)) return 'review';
    return readStatus(db, id);
  }
  return now;
}

type PaymentTarget = { trip_offer_id: string | null; group_member_id: string | null; payee_user_id: string | null };

// Is the trip still going ahead, to the same approved payee? A deposit that arrives after the trip or
// spot was closed must be refunded, not passed on: it is held as 'review'.
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
    const { data } = await db.from('trip_offers').select('status, offered_by, guide_id, trip_requests!inner(status)').eq('id', payment.trip_offer_id).maybeSingle();
    const request = data?.trip_requests as unknown as { status: string } | undefined;
    if (data?.status !== 'accepted' || data.offered_by !== payment.payee_user_id || !request || request.status === 'closed') return false;
    return offererApproved(db, data.offered_by, data.guide_id);
  }
  return false;
}

// Another order for the same deposit already paid? Then this one is a double payment: review (refund).
async function otherPaid(db: Admin, payment: PaymentTarget & { id: string }) {
  const target = payment.trip_offer_id ? 'trip_offer_id' : 'group_member_id';
  const value = payment.trip_offer_id ?? payment.group_member_id;
  if (!value) return false;
  const { data, error } = await db.from('payments').select('id').eq(target, value).eq('status', 'paid').neq('id', payment.id).limit(1);
  if (error) throw new DbError(`Deposit ${payment.id}: paid-twice check failed (${error.code})`, error.code ?? '');
  return (data?.length ?? 0) > 0;
}

// The processor's own answer for an order (providers/<name>.ts verify): by transaction id when a signed
// webhook or an earlier check gave one, otherwise by our order id. When the processor could not list
// every attempt on the order, `attemptsUnclear` makes an order that would be given up on go to 'review'.
const verifyAtProvider = (orderId: string, transactionId: string | null): Promise<VerifiedPayment> => gateway().verify(orderId, transactionId);

// What the processor reported, saved on the payment row with a paid or review status (payer, payee and
// admins can read these). Exact whole shillings, no floats.
function settledFields(details: PaymentDetails | null): Record<string, unknown> {
  if (!details) return {};
  return {
    provider_amount: parseWholeTzs(details.amount),
    provider_reference: plain(details.reference, 80),
    provider_channel: plain(details.channel, 40),
    provider_transaction_id: details.transactionId !== null && /^[\w.:-]{1,80}$/.test(details.transactionId) ? details.transactionId : null,
  };
}

// The provider's fee and settled amount: admins only (payment_provider_details, security-reviewer L6).
async function saveProviderDetails(db: Admin, paymentId: string, details: PaymentDetails | null) {
  if (!details) return;
  const currency = parseCurrency(details.currency);
  const fee = parseMoney2(details.fee);
  const settledAmount = parseMoney2(details.settledAmount);
  const { error } = await db.from('payment_provider_details').upsert({
    payment_id: paymentId,
    provider_fee: fee,
    provider_fee_currency: fee === null ? null : currency,
    // Settlement currency assumed to be the charge currency (TZS); to verify in the sandbox per processor.
    provider_settled_amount: settledAmount,
    provider_settled_currency: settledAmount === null ? null : currency,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error(`Deposit ${paymentId}: provider details not saved (${error.code})`);
}

const withoutTxId = (patch: Record<string, unknown>) => Object.fromEntries(Object.entries(patch).filter(([key]) => key !== 'provider_transaction_id'));

// moveStatus with the unique indexes handled one by one (security-reviewer L5):
//   payments_one_paid_offer / _member: another order for this deposit is already paid: 'review' (paid_twice);
//   payments_provider_tx_unique: this processor transaction is already on another order: 'review'
//   without the transaction id (duplicate_transaction), so a retry does not hit the same index again.
async function moveChecked(db: Admin, id: string, from: string, patch: Record<string, unknown>, source: Source, completed?: Record<string, unknown>): Promise<string> {
  try {
    return await moveStatus(db, id, from, patch, source, completed);
  } catch (err) {
    if (!(err instanceof DbError) || err.code !== '23505') throw err;
    if (err.constraint === 'payments_provider_tx_unique') {
      console.error(`Deposit ${id}: provider transaction already recorded on another order; held for review`);
      const review = { ...withoutTxId(patch), status: 'review', status_reason: 'duplicate_transaction', paid_at: null };
      return moveStatus(db, id, from, review, source, completed ? withoutTxId(completed) : undefined);
    }
    if (patch.status === 'paid' && ONE_PAID_INDEXES.includes(err.constraint)) {
      console.error(`Deposit ${id}: second paid order for the same deposit; held for review`);
      return moveStatus(db, id, from, { ...patch, status: 'review', status_reason: 'paid_twice', paid_at: null }, source, completed);
    }
    throw err;
  }
}

type Claim = { column: 'last_checked_at' | 'payer_checked_at'; ms: number };

// Ask the processor for the real result and record it. Used by the webhook, the sweeper, checkout, the
// return page and the app. Safe to repeat: every change is conditional on the stored status.
async function refresh(db: Admin, orderId: string, opts: { claim?: Claim; source: Source; transactionId?: string | null }): Promise<{ status: string } | null> {
  const { data: payment } = await db
    .from('payments')
    .select('id, status, amount_tzs, trip_offer_id, group_member_id, payee_user_id, created_at, provider_transaction_id')
    .eq('order_id', orderId)
    .eq('provider', PROVIDER_ID)
    .maybeSingle();
  if (!payment) return null;
  const stored = { status: payment.status as string };
  if (payment.status !== 'pending' && payment.status !== 'failed') return stored;
  const age = Date.now() - new Date(payment.created_at).getTime();
  if (payment.status === 'failed' && age > FAILED_RECHECK_MS && opts.source !== 'webhook') return stored;

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

  let verified: VerifiedPayment;
  try {
    verified = await verifyAtProvider(orderId, opts.transactionId ?? payment.provider_transaction_id ?? null);
  } catch (err) {
    // A pending order the processor has not answered about for a day is given up on (still re-checked 3 days).
    if (payment.status === 'pending' && age > LIMITS.staleMs) {
      console.error(`Deposit ${orderId}: no answer from the processor for over a day; marked failed`);
      return { status: await moveStatus(db, payment.id, 'pending', { status: 'failed', status_reason: 'stale' }, opts.source) };
    }
    if (claimedAt && opts.claim?.column === 'last_checked_at' && payment.status === 'pending') {
      await db.from('payments').update({ last_checked_at: new Date(Date.now() - SWEEP_BACKOFF_MS).toISOString() }).eq('id', payment.id).eq('last_checked_at', claimedAt);
    }
    throw err;
  }

  const decision = decideDeposit({
    stored: payment.status,
    orderId,
    amountTzs: Number(payment.amount_tzs),
    ageMs: age,
    tx: verified.tx,
    limits: LIMITS,
    attemptsUnclear: verified.attemptsUnclear,
  });
  if (decision.reason === 'reference_mismatch') {
    console.error(`Deposit ${orderId}: the processor answered for another reference; nothing changed`);
    return stored;
  }
  const settled = settledFields(verified.details);
  const completed = verified.tx.found && String(verified.tx.status).toLowerCase() === 'successful' ? settled : undefined;

  if (payment.status === 'failed') {
    if (decision.status !== 'review') return stored;
    console.error(`Deposit ${orderId}: paid at the processor after it was marked failed; held for review`);
    const now = await moveChecked(db, payment.id, 'failed', { ...settled, status: 'review', status_reason: decision.reason }, opts.source);
    await saveProviderDetails(db, payment.id, verified.details);
    return { status: now };
  }

  let { status, reason }: { status: string; reason: string } = decision;
  if (status === 'paid') {
    if (!(await depositTargetOpen(db, payment))) {
      status = 'review';
      reason = 'trip_closed';
    } else if (await otherPaid(db, payment)) {
      status = 'review';
      reason = 'paid_twice';
    }
  }
  if (status === 'review') console.error(`Deposit ${orderId}: held for review (${reason})`);
  if (status === 'pending') return { status };
  const patch = {
    ...(completed ? settled : {}),
    status,
    status_reason: reason,
    paid_at: status === 'paid' ? new Date().toISOString() : null,
  };
  const now = await moveChecked(db, payment.id, 'pending', patch, opts.source, completed);
  if (completed) await saveProviderDetails(db, payment.id, verified.details);
  return { status: now };
}

// ---------------------------------------------------------------------------
// Sweeper: hosted payment links cannot be cancelled, and a webhook can be lost. Every 5 minutes pg_cron
// asks this function to re-check pending orders (closing expired ones) and recent failed ones (a late
// payment goes to 'review'). Answers counts only, never order ids or amounts.
// ---------------------------------------------------------------------------
// Timing-safe (sameSecret compares SHA-256 digests); a short expected secret or an empty header never passes.
const sameSecretText = async (expected: string, given: string) => expected.length >= 32 && given !== '' && (await sameSecret(expected, given));

async function sweep(db: Admin) {
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const [pending, failed] = await Promise.all([
    db
      .from('payments')
      .select('order_id, status')
      .eq('provider', PROVIDER_ID)
      .eq('status', 'pending')
      .lt('created_at', iso(now - SWEEP_MIN_AGE_MS))
      .or(`last_checked_at.is.null,last_checked_at.lt."${iso(now - SWEEP_INTERVAL_MS)}"`)
      .order('created_at', { ascending: true })
      .limit(SWEEP_BATCH),
    db
      .from('payments')
      .select('order_id, status')
      .eq('provider', PROVIDER_ID)
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
  // Payment links are only needed while an order is open (at most the session length).
  await db.from('payment_checkout_links').delete().lt('created_at', iso(now - 24 * 3600_000));
  return counts;
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------
// Amounts in whole US cents, so nothing is rounded before the shillings are worked out.
// cutoffAt: when (ms since 1970) the last day to start this deposit ends, at midnight Tanzania time, or
// null when no date limits it (undated offer without valid_until). The hosted page closes by then.
type Order = { payee: string; description: string; cents: number; offerId?: string; memberId?: string; cutoffAt: number | null };

// The last day a new deposit can be started is this many days before the trip's start date (Tanzania
// date): only if start_date >= today + 8. So no deposit is taken inside the 7-day no-refund window
// (Walter, 2026-11-07). Same number as c_last_day_before_start in private.guard_new_payment(); change both.
const DEPOSIT_LAST_DAY_BEFORE_START = 8;
// The date in Tanzania (UTC+3 all year) `days` from today, e.g. "2026-11-30".
const tanzaniaDate = (days = 0) => new Date(Date.now() + 3 * 3600_000 + days * 24 * 3600_000).toISOString().slice(0, 10);
// Midnight in Tanzania at the start of `date` + `days`, in ms since 1970.
const tanzaniaMidnight = (date: string, days: number) => Date.parse(`${date}T00:00:00+03:00`) + days * 24 * 3600_000;
// The last day to start a deposit is start_date - 8, so it ends at midnight starting start_date - 7.
const startCutoff = (startDate: string) => tanzaniaMidnight(startDate, 1 - DEPOSIT_LAST_DAY_BEFORE_START);
// A hosted page never gets less than this; closer to the cut-off no new order is made ('no_deposit').
const MIN_SESSION_MINUTES = 5;
// Page lifetime in whole minutes: 60, or less so the page closes before the cut-off. null: too close.
function sessionMinutes(cutoffAt: number | null) {
  if (cutoffAt === null) return SESSION_MINUTES;
  const left = Math.floor((cutoffAt - Date.now()) / 60_000);
  if (left < MIN_SESSION_MINUTES) return null;
  return Math.min(SESSION_MINUTES, left);
}

// Deposits go only to approved, real (not sample) guides offering as themselves, or to owners of an
// approved, non-sample business listing. Same test as private.guard_new_payment().
async function offererApproved(db: Admin, userId: string, guideId: string | null) {
  if (guideId) {
    const { data } = await db
      .from('guides')
      .select('id')
      .eq('id', guideId)
      .eq('owner_id', userId)
      .eq('verification_status', 'approved')
      .eq('is_sample', false)
      .maybeSingle();
    return Boolean(data);
  }
  const { data } = await db.from('providers').select('id').eq('owner_id', userId).eq('verification_status', 'approved').eq('is_sample', false).limit(1);
  return (data ?? []).length > 0;
}

// Same rules as private.guard_new_payment() (security-reviewer M1), so `check` hides the Pay box and
// checkout refuses before anything is saved; the database refuses again if this code is ever skipped.
async function loadOrder(db: Admin, userId: string, kind: string, id: string): Promise<Order | string> {
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
    // A closed request takes no deposit ('booked', the normal state after accepting, stays payable).
    if (request.status === 'closed') return 'no_deposit';
    // A dated request: only if it starts on or after today + 8 days (Tanzania date); started trips too.
    if (request.start_date && request.start_date < earliestStart) return 'no_deposit';
    // Flexible or no dates: only until the offer's valid_until (inclusive), if the guide set one.
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
    if (trip.status !== 'approved' || trip.cancelled || trip.organizer_kind === 'traveller') return 'no_deposit';
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

async function check(db: Admin, userId: string, kind: string, id: string) {
  const order = await loadOrder(db, userId, kind, id);
  if (typeof order === 'string') return json({ error: order });
  const settled = await settledError(db, order);
  return settled ? json({ error: settled }) : json({ ok: true });
}

async function checkout(db: Admin, user: { id: string; email?: string }, body: Record<string, unknown>) {
  const order = await loadOrder(db, user.id, str(body.kind), str(body.id));
  if (typeof order === 'string') return json({ error: order }, order === 'not_found' ? 404 : 400);
  // The hosted page must close before the last day to start this deposit ends: 60 minutes, or less.
  const session = sessionMinutes(order.cutoffAt);
  if (session === null) return json({ error: 'no_deposit' }, 400);
  const target = order.offerId ? 'trip_offer_id' : 'group_member_id';
  const targetId = (order.offerId ?? order.memberId)!;

  // One checkout per offer or member every 10 seconds, claimed atomically (double clicks, scripts).
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

  // One open order per deposit. A hosted payment link cannot be cancelled, so an open order is
  // re-checked; while its page is still fresh the traveller is sent back to the same page, otherwise
  // they wait until it expires (the sweeper then closes it).
  const { data: open, error: openError } = await db.from('payments').select('id, order_id').eq(target, targetId).eq('status', 'pending');
  if (openError) return json({ error: 'save_failed' }, 500);
  for (const earlier of open ?? []) {
    try {
      const current = await refresh(db, earlier.order_id, { source: 'checkout' });
      if (current?.status === 'paid') return json({ error: 'already_paid' }, 409);
      if (current?.status === 'review') return json({ error: 'under_review' }, 409);
      if (current?.status === 'pending') {
        const { data: link } = await db.from('payment_checkout_links').select('url, created_at').eq('payment_id', earlier.id).maybeSingle();
        if (link && Date.now() - new Date(link.created_at).getTime() < LINK_REUSE_MS && isPaymentUrlOn(link.url, gateway().paymentDomains)) {
          return json({ url: link.url, order_id: earlier.order_id, reused: true });
        }
        return json({ error: 'pending_order', order_id: earlier.order_id }, 409);
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'earlier order check failed');
      return json({ error: 'pending_order', order_id: earlier.order_id }, 409);
    }
  }

  // An order Kwetuly gave up on may still have been paid. Ask about the newest failed ones first.
  const { data: recent, error: recentError } = await db
    .from('payments')
    .select('order_id')
    .eq(target, targetId)
    .eq('status', 'failed')
    .eq('provider', PROVIDER_ID)
    .gt('created_at', new Date(Date.now() - FAILED_RECHECK_MS).toISOString())
    .order('created_at', { ascending: false })
    .limit(CHECKOUT_FAILED_CHECKS);
  if (recentError) return json({ error: 'save_failed' }, 500);
  for (const row of recent ?? []) {
    try {
      const now = await refresh(db, row.order_id, { source: 'checkout' });
      if (now?.status === 'review') return json({ error: 'under_review' }, 409);
      if (now?.status === 'paid') return json({ error: 'already_paid' }, 409);
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'failed order re-check failed');
      return json({ error: 'gateway_error' }, 502);
    }
  }

  const rate100 = RATE100!;
  const tzs = depositTzs(order.cents, rate100);
  const orderId = `RAF${crypto.randomUUID().replace(/-/g, '')}`;
  const locale = str(body.locale);
  const lang = /^[a-z]{2}$/.test(locale) ? locale : 'en';

  const { data: inserted, error } = await db
    .from('payments')
    .insert({
      user_id: user.id,
      payee_user_id: order.payee,
      kind: order.offerId ? 'offer_deposit' : 'group_deposit',
      trip_offer_id: order.offerId ?? null,
      group_member_id: order.memberId ?? null,
      description: order.description,
      amount_usd: centsToUsd(order.cents),
      amount_tzs: tzs,
      usd_tzs_rate: centsToUsd(rate100), // hundredths as an exact decimal, e.g. 265075 -> "2650.75"
      rate_source: RATE_SOURCE,
      order_id: orderId,
      provider: PROVIDER_ID,
      status_source: 'checkout',
    })
    .select('id')
    .single();
  if (error || !inserted) {
    if (error?.code === '23505') return json({ error: 'pending_order' }, 409);
    // private.guard_new_payment refused it (trip within 8 days or started, request closed, offer
    // expired, payee not approved, amount mismatch, already paid or in review). Only that is 'no_deposit'.
    if (error?.code === DEPOSIT_GUARD.code && error.hint === DEPOSIT_GUARD.hint) {
      const now = await settledError(db, order);
      return now ? json({ error: now }, 409) : json({ error: 'no_deposit' }, 400);
    }
    console.error(`Deposit ${orderId}: insert failed (${error?.code ?? 'no row'})`);
    return json({ error: 'save_failed' }, 500);
  }

  const { data: profile } = await db.from('profiles').select('full_name, phone').eq('id', user.id).single();
  const phone = tzPhone(profile?.phone ?? null);
  try {
    // Exact whole shillings in TZS. The processor's fee is paid by Kwetuly: a payment whose charged amount
    // is above ours is held for review, never 'paid' (decideDeposit).
    const provider = gateway();
    const { paymentUrl: url } = await provider.createCheckout({
      orderId,
      amountTzs: tzs,
      currency: 'TZS',
      kind: order.offerId ? 'offer_deposit' : 'group_deposit',
      customer: {
        email: cleanEmail(user.email),
        name: cleanText(profile?.full_name ?? '', 60, 'Kwetuly traveller'),
        phone,
      },
      redirectUrl: `${SITE_URL}/${lang}/payments/return?order=${orderId}`,
      title: 'Kwetuly deposit',
      description: cleanText(order.description, 100, 'Kwetuly deposit'),
      sessionMinutes: session,
    });
    if (!isPaymentUrlOn(url, provider.paymentDomains)) throw new Error('Payment page not allowed');
    const { error: linkError } = await db.from('payment_checkout_links').insert({ payment_id: inserted.id, url });
    if (linkError) console.error(`Deposit ${orderId}: link not saved (${linkError.code})`);
    return json({ url, order_id: orderId });
  } catch (err) {
    // The link may still exist at the processor (a timeout after it was made): the sweeper re-checks failed
    // orders for 3 days, so a payment on it reaches 'review'.
    const why = err instanceof ProviderHttpError ? `HTTP ${err.http}` : err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError') ? 'timeout' : err instanceof Error && err.message === 'Payment page not allowed' ? 'payment page not allowed' : 'other error';
    console.error(`Deposit ${orderId}: create payment failed (${why})`);
    await moveStatus(db, inserted.id, 'pending', { status: 'failed', status_reason: 'gateway_error' }, 'checkout').catch((e) => console.error(e instanceof Error ? e.message : e));
    return json({ error: 'gateway_error' }, 502);
  }
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------
async function webhook(db: Admin, raw: string, headers: Headers) {
  const provider = gateway();
  const valid = await provider.verifyWebhook(headers, raw);
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // not JSON
  }
  const ref = provider.readWebhook(parsed);
  const base = { provider: provider.id, event_type: ref.eventType, tx_ref: ref.txRef, provider_transaction_id: ref.transactionId };

  if (!valid) {
    // Logged only when it names one of our orders, and at most once per order per hour (M3), so a
    // script cannot fill the log. No body is kept for an unsigned call.
    if (ref.txRef) {
      const { data: known } = await db.from('payments').select('id').eq('order_id', ref.txRef).maybeSingle();
      if (known) {
        await db
          .from('payment_events')
          .upsert({ ...base, event_key: invalidEventKey(ref.txRef, Date.now()), signature_valid: false }, { onConflict: 'provider,event_key', ignoreDuplicates: true });
      }
    }
    console.error('payments webhook: signature missing or wrong; refused');
    return json({ error: 'signature' }, 401);
  }

  const eventKey = ref.eventKey ?? `nokey:${crypto.randomUUID()}`;
  const { error: logError } = await db
    .from('payment_events')
    .upsert({ ...base, event_key: eventKey, signature_valid: true, payload: provider.pickPayload(parsed) }, { onConflict: 'provider,event_key', ignoreDuplicates: true });
  if (logError) console.error(`payments webhook: log failed (${logError.code})`);

  if (!ref.txRef) return json({ ok: true });
  try {
    // Signed, so not throttled: a failed attempt and a success can arrive seconds apart. Repeats are
    // harmless; every change is conditional on the stored status.
    const result = await refresh(db, ref.txRef, { source: 'webhook', transactionId: ref.transactionId });
    await db
      .from('payment_events')
      .update({ processed_at: new Date().toISOString(), result_status: result?.status ?? 'unknown_order' })
      .eq('provider', provider.id)
      .eq('event_key', eventKey);
    return json({ ok: true });
  } catch (err) {
    // 500 so the processor retries (if retries are on); the sweeper covers it too.
    console.error(err instanceof Error ? err.message : 'webhook refresh failed');
    return json({ error: 'retry' }, 500);
  }
}

// Reads at most `max` bytes of the body; null when it is larger.
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

  // A webhook is recognised by the adapter from its own headers (Flutterwave: flutterwave-signature or verif-hash).
  const isWebhook = PROVIDER?.isWebhook(req.headers) ?? false;

  let body: Record<string, unknown> = {};
  if (!isWebhook) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed;
    } catch {
      // not JSON: an empty request
    }
    if (body.action === 'config') {
      return json({ enabled: enabled(), rate: enabled() ? RATE100! / 100 : null, rate100: enabled() ? RATE100 : null, provider: enabled() ? PROVIDER_ID : null });
    }
  }
  if (!enabled()) return json({ error: 'not_configured' }, 503);
  const db = admin();

  if (isWebhook) return webhook(db, raw, req.headers);

  if (body.action === 'sweep') {
    if (!(await sameSecretText(env('PAYMENTS_SWEEP_SECRET'), req.headers.get('x-kwetuly-sweep') ?? ''))) return json({ error: 'forbidden' }, 403);
    try {
      return json(await sweep(db));
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'sweep failed');
      return json({ error: 'sweep_failed' }, 500);
    }
  }

  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } };
  const user = auth?.user;
  if (!user) return json({ error: 'sign_in' }, 401);

  if (body.action === 'check') return check(db, user.id, str(body.kind), str(body.id));
  if (body.action === 'checkout') return checkout(db, user, body);

  if (body.action === 'status') {
    const orderId = str(body.order_id);
    if (!isOrderId(orderId)) return json({ error: 'not_found' }, 404);
    const { data: own } = await db.from('payments').select('id, status').eq('order_id', orderId).eq('user_id', user.id).maybeSingle();
    if (!own) return json({ error: 'not_found' }, 404);
    try {
      const result = await refresh(db, orderId, { claim: { column: 'payer_checked_at', ms: PAYER_MIN_INTERVAL_MS }, source: 'payer_check' });
      return json({ status: result?.status ?? own.status });
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'status refresh failed');
      const { data: now } = await db.from('payments').select('status').eq('id', own.id).maybeSingle();
      return json({ status: now?.status ?? own.status });
    }
  }
  return json({ error: 'bad_request' }, 400);
});
