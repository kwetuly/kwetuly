// Deposits through Flutterwave hosted checkout ("Standard"): Visa and Mastercard (with 3-D Secure) and
// Tanzanian mobile money (M-Pesa, Mixx by Yas, Airtel Money, HaloPesa). Travellers are charged in
// Tanzanian shillings. Card numbers are typed only on Flutterwave's own page; Kwetuly never sees them.
//
//   POST { action: "config" }                       → { enabled, rate, rate100 } (anyone; Pay box, ≈ TSh prices)
//   POST { action: "check", kind, id } + user token  → { ok } or { error } (can this deposit be paid now?)
//   POST { action: "checkout", kind: "offer"|"group", id, locale } + user token → { url, order_id }
//   POST { action: "status", order_id } + user token → { status } (asks Flutterwave, updates the row)
//   POST { action: "sweep" } + header x-kwetuly-sweep → counts only (pg_cron, 20261122100000_flutterwave_provider.sql)
//   POST from Flutterwave (webhook: header flutterwave-signature or verif-hash)
//        → signature checked first (401 if wrong), logged masked in payment_events, then the order is
//          re-checked with Flutterwave's verify endpoint. The webhook body's amount and status are never used.
//
// Money state changes only here, on the server, after Flutterwave's verify answer. The return URL and
// the app never change a status. Every change records status_source and updated_at (who and when).
//
// Secrets (Supabase dashboard, Edge Functions, Secrets; names in supabase/functions/.env.example).
// Without all of them payments stay switched off:
//   PAYMENTS_PROVIDER     must be "flutterwave". Anything else (Selcom is parked) keeps payments off.
//   KWETULY_ENV           must be "test". Live is refused by this build (LIVE_ALLOWED below) until
//                         Walter approves live keys and the live switch; that needs a code change and review.
//   FLW_SECRET_KEY        Flutterwave TEST secret key (starts with FLWSECK_TEST-). A live key is refused.
//   FLW_SECRET_HASH       the webhook "secret hash" set in the Flutterwave dashboard, at least 32 random characters.
//   USD_TZS_RATE          shillings per US dollar used to price deposits, e.g. "2600" or "2650.75".
//   USD_TZS_RATE_SOURCE   where that rate comes from, e.g. "BoT mean 2026-11-21" (saved on every order).
//   PAYMENTS_SWEEP_SECRET at least 32 random characters; the same value is in Vault as payments_sweep_secret.
//   SITE_URL              e.g. "https://kwetuly.com" (default).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const env = (key: string, fallback = '') => Deno.env.get(key) ?? fallback;
const SITE_URL = env('SITE_URL', 'https://kwetuly.com').replace(/\/$/, '');
const FLW_API = 'https://api.flutterwave.com/v3';

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

// ---------------------------------------------------------------------------
// Copy of packages/shared/src/payment-rules.ts (Deno cannot import that package). Do not edit here:
// change the shared file and paste its block; payment-rules.test.ts fails if the two differ.
// ---------------------------------------------------------------------------
// BEGIN payment-rules
/** Order ids Kwetuly creates (sent to the provider as tx_ref): "RAF" + 32 lower-case hex characters. */
export const ORDER_ID_PATTERN = /^RAF[0-9a-f]{32}$/;
export const isOrderId = (value: unknown): value is string => typeof value === 'string' && ORDER_ID_PATTERN.test(value);

/** "2600" -> 260000, "2650.75" -> 265075 (shillings per US dollar, in hundredths). null when not a plain positive rate. */
export function parseRateHundredths(raw: string | null | undefined): number | null {
  const match = /^\s*(\d{1,6})(?:\.(\d{1,2}))?\s*$/.exec(raw ?? '');
  if (!match) return null;
  const value = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return value > 0 ? value : null;
}

/**
 * Deposit in whole shillings from whole US cents and the rate in hundredths, rounded UP to the next
 * 100 shillings: ceil(cents x rate100 / 1 000 000) x 100. Integer maths only.
 */
export function depositTzs(cents: number, rate100: number): number {
  if (!Number.isSafeInteger(cents) || !Number.isSafeInteger(rate100) || cents <= 0 || rate100 <= 0) {
    throw new RangeError('depositTzs: whole positive numbers only');
  }
  const product = cents * rate100;
  if (!Number.isSafeInteger(product)) throw new RangeError('depositTzs: amount too large');
  const rest = product % 1_000_000;
  const hundreds = (product - rest) / 1_000_000 + (rest === 0 ? 0 : 1);
  return hundreds * 100;
}

/** Whole US cents as an exact decimal string for numeric(10,2), e.g. 12345 -> "123.45". */
export function centsToUsd(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError('centsToUsd: whole cents only');
  return `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

/** A whole-shilling amount the provider reported (number, or text such as "260000" or "260000.00"); null otherwise. */
export function parseWholeTzs(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isSafeInteger(raw) && raw >= 0 ? raw : null;
  if (typeof raw !== 'string') return null;
  const text = raw.replace(/,/g, '').trim();
  return /^\d{1,12}(\.0{1,2})?$/.test(text) ? parseInt(text, 10) : null;
}

/** An amount with at most 2 decimals as exact text for numeric(14,2) (fees, settled amounts); null otherwise. */
export function parseMoney2(raw: unknown): string | null {
  let text: string;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 0) return null;
    text = String(raw);
  } else if (typeof raw === 'string') {
    text = raw.replace(/,/g, '').trim();
  } else {
    return null;
  }
  return /^\d{1,12}(\.\d{1,2})?$/.test(text) ? text : null;
}

/** A 3-letter currency code, upper case; null otherwise. */
export const parseCurrency = (raw: unknown): string | null =>
  typeof raw === 'string' && /^[A-Za-z]{3}$/.test(raw.trim()) ? raw.trim().toUpperCase() : null;

/** What the provider's verify call said about one order. `found: false`: the provider knows no payment for it. */
export type ProviderTx =
  | { found: false }
  | { found: true; status: unknown; txRef: unknown; amount: unknown; chargedAmount: unknown; currency: unknown };

export type DepositDecision = {
  status: 'paid' | 'review' | 'failed' | 'pending';
  reason:
    | 'paid'
    | 'amount_mismatch'
    | 'currency_mismatch'
    | 'fee_charged_to_payer'
    | 'charged_unknown'
    | 'paid_after_failed'
    | 'still_failed'
    | 'reference_mismatch'
    | 'expired'
    | 'stale'
    | 'open';
};

export type DepositLimits = {
  /** How long the hosted payment page stays open (sent to the provider). */
  sessionMs: number;
  /** Extra time after the session before an unpaid order is given up on. */
  graceMs: number;
  /** A payment the provider still reports as pending (mobile money push) is given up on after this. */
  staleMs: number;
};

/**
 * Decides a stored order's next status from the provider's verify answer. Never trusts a webhook body
 * or a return URL: only the server's own verify call is passed in here.
 *   - 'paid' only when the provider says successful, for this tx_ref, in TZS, for exactly our amount,
 *     and the payer was charged exactly that amount (Kwetuly pays the provider's fee, not the traveller).
 *   - Any other successful payment is held as 'review' for an admin, never 'paid'.
 *   - A successful payment on an order Kwetuly had given up on ('failed') goes to 'review'.
 *   - A failed attempt while the hosted page is still open stays 'pending': the traveller may retry there.
 */
export function decideDeposit(input: {
  stored: 'pending' | 'failed';
  orderId: string;
  amountTzs: number;
  ageMs: number;
  tx: ProviderTx;
  limits: DepositLimits;
}): DepositDecision {
  const { stored, orderId, amountTzs, ageMs, tx, limits } = input;
  if (tx.found && tx.txRef !== orderId) return { status: stored, reason: 'reference_mismatch' };
  const state = tx.found && typeof tx.status === 'string' ? tx.status.trim().toLowerCase() : '';
  const successful = tx.found && state === 'successful';

  if (stored === 'failed') return successful ? { status: 'review', reason: 'paid_after_failed' } : { status: 'failed', reason: 'still_failed' };

  if (successful) {
    if (parseCurrency(tx.currency) !== 'TZS') return { status: 'review', reason: 'currency_mismatch' };
    if (parseWholeTzs(tx.amount) !== amountTzs) return { status: 'review', reason: 'amount_mismatch' };
    const charged = parseWholeTzs(tx.chargedAmount);
    if (charged === null) return { status: 'review', reason: 'charged_unknown' };
    if (charged > amountTzs) return { status: 'review', reason: 'fee_charged_to_payer' };
    if (charged !== amountTzs) return { status: 'review', reason: 'amount_mismatch' };
    return { status: 'paid', reason: 'paid' };
  }

  if (tx.found && state === 'pending') {
    return ageMs > limits.staleMs ? { status: 'failed', reason: 'stale' } : { status: 'pending', reason: 'open' };
  }
  return ageMs > limits.sessionMs + limits.graceMs ? { status: 'failed', reason: 'expired' } : { status: 'pending', reason: 'open' };
}

/** Provider payment page domains. Only subdomains (e.g. "checkout.flutterwave.com") pass, not the bare domain. */
export const FLUTTERWAVE_PAYMENT_DOMAINS: readonly string[] = ['flutterwave.com'];

const PAYMENT_URL = /^https:\/\/([A-Za-z0-9.-]+)(?::443)?(?:[/?#][\x21-\x5b\x5d-\x7e]*)?$/;
const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * True only for an https address on a subdomain of one of `domains`, safe to send a payer to.
 * Refuses other schemes, userinfo, ports other than 443, lookalike hosts, IP addresses, trailing dots,
 * spaces, control or non-ASCII characters, backslashes, and anything longer than 2048 characters.
 * Pure string check, so it behaves the same in browsers, React Native, Node and Deno.
 */
export function isAllowedPaymentUrl(url: unknown, domains: readonly string[] = FLUTTERWAVE_PAYMENT_DOMAINS): url is string {
  if (typeof url !== 'string' || url.length === 0 || url.length > 2048) return false;
  const match = PAYMENT_URL.exec(url);
  if (!match) return false;
  const host = match[1].toLowerCase();
  if (host.length > 253 || !host.split('.').every((label) => HOST_LABEL.test(label))) return false;
  return domains.some((domain) => host.endsWith(`.${domain}`));
}

const encoder = new TextEncoder();

async function sameSecret(a: string, b: string): Promise<boolean> {
  // Compare SHA-256 digests in constant time, so timing says nothing about the secret.
  const [x, y] = await Promise.all([a, b].map(async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(s)))));
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** Shortest secret hash Kwetuly accepts for webhooks (Walter sets it in the Flutterwave dashboard). */
export const MIN_WEBHOOK_SECRET_LENGTH = 32;

/**
 * Checks a Flutterwave webhook.
 *   - `flutterwave-signature` header (current docs): base64 HMAC-SHA256 of the raw body with the secret hash.
 *   - Otherwise `verif-hash` header (v3 docs): must equal the secret hash.
 * When a signature header is present it must be valid; there is no fallback to verif-hash then.
 */
export async function verifyFlutterwaveWebhook(
  rawBody: string,
  headers: { signature: string | null; verifHash: string | null },
  secretHash: string,
): Promise<boolean> {
  if (secretHash.length < MIN_WEBHOOK_SECRET_LENGTH) return false;
  if (headers.signature) {
    const key = await crypto.subtle.importKey('raw', encoder.encode(secretHash), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody)));
    let binary = '';
    for (const byte of mac) binary += String.fromCharCode(byte);
    return sameSecret(btoa(binary), headers.signature.trim());
  }
  if (headers.verifHash) return sameSecret(secretHash, headers.verifHash);
  return false;
}

/** What Kwetuly reads from a webhook body: only keys to look the order up with, never its amounts or status. */
export type WebhookRef = { eventKey: string | null; eventType: string | null; txRef: string | null; transactionId: string | null };

const plainText = (value: unknown, max: number) =>
  typeof value === 'string' || typeof value === 'number' ? String(value).replace(/[^\w.:-]/g, '').slice(0, max) || null : null;

export function readWebhook(body: unknown): WebhookRef {
  const root = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const data = root.data && typeof root.data === 'object' && !Array.isArray(root.data) ? (root.data as Record<string, unknown>) : {};
  const eventType = plainText(root.event ?? root.type, 60);
  const ref = data.tx_ref ?? data.reference;
  const txRef = isOrderId(ref) ? ref : null;
  const rawId = data.id;
  const transactionId =
    (typeof rawId === 'number' && Number.isSafeInteger(rawId) && rawId > 0) || (typeof rawId === 'string' && /^\d{1,20}$/.test(rawId)) ? String(rawId) : null;
  // A stable key per delivery, so repeats are logged once: the provider's webhook id when it sends one,
  // otherwise event type + transaction id + reported status.
  const eventKey =
    plainText(root.webhook_id ?? root.id, 120) ??
    (eventType && (transactionId || txRef) ? `${eventType}:${transactionId ?? txRef}:${plainText(data.status, 20) ?? ''}`.slice(0, 120) : null);
  return { eventKey, eventType, txRef, transactionId };
}

const SENSITIVE_EXACT = new Set(['ip', 'pan', 'bin', 'cvv', 'cvc', 'pin', 'otp']);
const SENSITIVE_PARTS = ['phone', 'email', 'name', 'card', 'digit', 'fingerprint', 'address', 'account', 'msisdn', 'token', 'expiry', 'customer', 'bvn', 'nin'];

const sensitiveKey = (key: string) => {
  const k = key.toLowerCase();
  return SENSITIVE_EXACT.has(k) || SENSITIVE_PARTS.some((part) => k.includes(part));
};

function maskLeaf(value: unknown): unknown {
  if (value === null || value === undefined || typeof value === 'boolean') return value;
  const text = String(value);
  return text.length >= 6 ? `***${text.slice(-2)}` : '***';
}

/**
 * A copy of a provider payload that is safe to keep in the callback log: phone numbers, e-mail, names,
 * card details, account numbers, addresses, IPs and tokens are masked (at most the last 2 characters
 * stay); long text is cut; depth and list length are capped.
 */
export function maskPayload(value: unknown, masked = false, depth = 0): unknown {
  if (depth > 6) return '[cut]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => maskPayload(item, masked, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 60)) {
      out[key.slice(0, 60)] = maskPayload(item, masked || sensitiveKey(key), depth + 1);
    }
    return out;
  }
  if (masked) return maskLeaf(value);
  return typeof value === 'string' ? value.slice(0, 200) : value;
}
// END payment-rules

const RATE100 = parseRateHundredths(env('USD_TZS_RATE'));
const RATE_SOURCE = `env:${env('USD_TZS_RATE_SOURCE').replace(/[^\w .:/()-]/g, '').trim()}`.slice(0, 60);

// Mode guard. A configuration error switches payments off (config answers enabled: false, every other
// action 503, no Flutterwave call); it never falls back to a default.
const CONFIG_ERROR = (() => {
  if (env('PAYMENTS_PROVIDER') !== 'flutterwave') return 'PAYMENTS_PROVIDER is not "flutterwave"';
  const mode = env('KWETULY_ENV');
  if (mode === 'live' && !LIVE_ALLOWED) return 'live payments are not switched on in this build';
  if (mode !== 'test') return 'KWETULY_ENV must be "test"';
  if (!PROJECT_REF) return 'SUPABASE_URL has no project ref';
  if (PROJECT_REF === LIVE_PROJECT_REF) return 'test keys in the live project';
  if (!env('FLW_SECRET_KEY').startsWith('FLWSECK_TEST-')) return 'FLW_SECRET_KEY is missing or not a test key';
  if (env('FLW_SECRET_HASH').length < MIN_WEBHOOK_SECRET_LENGTH) return 'FLW_SECRET_HASH is missing or shorter than 32 characters';
  if (RATE100 === null) return 'USD_TZS_RATE is missing or not a plain rate';
  if (RATE_SOURCE.length <= 'env:'.length + 2) return 'USD_TZS_RATE_SOURCE is missing';
  return '';
})();
const enabled = () => CONFIG_ERROR === '';
// Logged once per start-up: mode, provider and project only, never keys.
console.log(`payments: provider ${env('PAYMENTS_PROVIDER') || 'unset'}, mode ${env('KWETULY_ENV') || 'unset'}, project ${PROJECT_REF || 'unknown'}${CONFIG_ERROR ? `; switched off: ${CONFIG_ERROR}` : ''}`);

// Hosted page lifetime sent to Flutterwave (configurations.session_duration, minutes; to verify in the sandbox).
const SESSION_MINUTES = 60;
const LIMITS: DepositLimits = { sessionMs: SESSION_MINUTES * 60_000, graceMs: 10 * 60_000, staleMs: 24 * 3600_000 };
// An open order's page is offered again only while it has at least 10 minutes left.
const LINK_REUSE_MS = (SESSION_MINUTES - 10) * 60_000;
// Failed orders are re-checked for this long (one Kwetuly gave up on may still be paid); after that the
// daily reconciliation against Flutterwave's transaction export covers them.
const FAILED_RECHECK_MS = 3 * 24 * 3600_000;
const PAYER_MIN_INTERVAL_MS = 5_000;
const CHECKOUT_MIN_INTERVAL_S = 10;
const CHECKOUT_FAILED_CHECKS = 5;
const FLW_TIMEOUT_MS = 10_000;
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
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// ---------------------------------------------------------------------------
// Flutterwave client: bearer secret key. Only the path (no query) and the HTTP status are logged,
// never the answer body (it holds names, phone numbers, e-mail and card details).
// ---------------------------------------------------------------------------
class FlwError extends Error {
  constructor(message: string, readonly http: number, readonly notFound: boolean) {
    super(message);
  }
}

async function flw(path: string, method: 'GET' | 'POST', body?: unknown): Promise<Record<string, unknown>> {
  if (!enabled()) throw new Error(`Flutterwave ${path.split('?')[0]}: payments switched off`);
  const res = await fetch(`${FLW_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${env('FLW_SECRET_KEY')}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(FLW_TIMEOUT_MS),
  });
  const answer = (await res.json().catch(() => ({}))) as { status?: unknown; message?: unknown; data?: unknown };
  if (!res.ok || answer.status !== 'success' || !answer.data || typeof answer.data !== 'object') {
    // "No transaction was found for this id/reference" (to verify the exact wording in the sandbox).
    const notFound = typeof answer.message === 'string' && /no transaction|not found/i.test(answer.message);
    throw new FlwError(`Flutterwave ${path.split('?')[0]}: HTTP ${res.status}${notFound ? ' not found' : ''}`, res.status, notFound);
  }
  return answer.data as Record<string, unknown>;
}

// Flutterwave wants 255XXXXXXXXX. Optional: only pre-fills mobile money on the hosted page.
function tzPhone(raw: string | null) {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (/^0[67]\d{8}$/.test(digits)) return `255${digits.slice(1)}`;
  if (/^255[67]\d{8}$/.test(digits)) return digits;
  return null;
}
const cleanText = (raw: string, max: number, fallback: string) =>
  Array.from(raw.normalize('NFC').replace(/\p{C}/gu, ' ').replace(/\s+/g, ' ').trim() || fallback).slice(0, max).join('').trim() || fallback;
const cleanEmail = (raw: string | undefined) => (raw && /^[^\s\p{C}]{3,254}$/u.test(raw) && /^[^@]+@[^@]+\.[^@]+$/.test(raw) ? raw : 'payments@kwetuly.com');
const plain = (v: unknown, max: number) => (typeof v === 'string' || typeof v === 'number' ? String(v).replace(/[^\w.:-]/g, '').slice(0, max) || null : null);

const admin = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
type Admin = ReturnType<typeof admin>;

// ---------------------------------------------------------------------------
// Status changes
// ---------------------------------------------------------------------------
type Source = 'checkout' | 'payer_check' | 'webhook' | 'sweeper';

class DbError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
  }
}

// Conditional change: only from `from`, so a repeated or parallel check never changes a row twice.
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

// Moves a row and returns its real status afterwards. If another path changed it first and Flutterwave
// has just reported the money taken (`completed`), a row now 'failed' goes on to 'review'.
async function moveStatus(db: Admin, id: string, from: string, patch: Record<string, unknown>, source: Source, completed?: Record<string, unknown>): Promise<string> {
  if (await setStatus(db, id, from, patch, source)) return String(patch.status);
  const now = await readStatus(db, id);
  if (now === 'failed' && completed) {
    console.error(`Deposit ${id}: paid at Flutterwave while being marked failed; held for review`);
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

// Flutterwave's own answer for an order: by transaction id when a signed webhook or an earlier check gave
// one, otherwise by our reference (tx_ref).
async function verifyAtProvider(orderId: string, transactionId: string | null): Promise<{ tx: ProviderTx; data: Record<string, unknown> | null }> {
  const read = (data: Record<string, unknown>): ProviderTx => ({
    found: true,
    status: data.status,
    txRef: data.tx_ref,
    amount: data.amount,
    chargedAmount: data.charged_amount,
    currency: data.currency,
  });
  try {
    if (transactionId) {
      const data = await flw(`/transactions/${transactionId}/verify`, 'GET');
      if (data.tx_ref === orderId) return { tx: read(data), data };
      console.error(`Deposit ${orderId}: transaction id belongs to another reference; checking by reference`);
    }
    const data = await flw(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(orderId)}`, 'GET');
    return { tx: read(data), data };
  } catch (err) {
    if (err instanceof FlwError && err.notFound) return { tx: { found: false }, data: null };
    throw err;
  }
}

// What Flutterwave reported, saved with a paid or review status. Exact decimals, no floats.
function settledFields(data: Record<string, unknown> | null) {
  if (!data) return {};
  const currency = parseCurrency(data.currency);
  const fee = parseMoney2(data.app_fee);
  const settledAmount = parseMoney2(data.amount_settled);
  const id = data.id;
  return {
    provider_amount: parseWholeTzs(data.amount),
    provider_reference: plain(data.flw_ref, 80),
    provider_channel: plain(data.payment_type, 40),
    provider_transaction_id: (typeof id === 'number' && Number.isSafeInteger(id)) || (typeof id === 'string' && /^\d{1,20}$/.test(id)) ? String(id) : null,
    provider_fee: fee,
    provider_fee_currency: fee === null ? null : currency,
    // Settlement currency is assumed to be the charge currency (TZS); to verify in the sandbox.
    provider_settled_amount: settledAmount,
    provider_settled_currency: settledAmount === null ? null : currency,
  };
}

type Claim = { column: 'last_checked_at' | 'payer_checked_at'; ms: number };

// Ask Flutterwave for the real result and record it. Used by the webhook, the sweeper, checkout, the
// return page and the app. Safe to repeat: every change is conditional on the stored status.
async function refresh(db: Admin, orderId: string, opts: { claim?: Claim; source: Source; transactionId?: string | null }): Promise<{ status: string } | null> {
  const { data: payment } = await db
    .from('payments')
    .select('id, status, amount_tzs, trip_offer_id, group_member_id, payee_user_id, created_at, provider_transaction_id')
    .eq('order_id', orderId)
    .eq('provider', 'flutterwave')
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

  let verified: Awaited<ReturnType<typeof verifyAtProvider>>;
  try {
    verified = await verifyAtProvider(orderId, opts.transactionId ?? payment.provider_transaction_id ?? null);
  } catch (err) {
    // A pending order Flutterwave has not answered about for a day is given up on (still re-checked 3 days).
    if (payment.status === 'pending' && age > LIMITS.staleMs) {
      console.error(`Deposit ${orderId}: no answer from Flutterwave for over a day; marked failed`);
      return { status: await moveStatus(db, payment.id, 'pending', { status: 'failed', status_reason: 'stale' }, opts.source) };
    }
    if (claimedAt && opts.claim?.column === 'last_checked_at' && payment.status === 'pending') {
      await db.from('payments').update({ last_checked_at: new Date(Date.now() - SWEEP_BACKOFF_MS).toISOString() }).eq('id', payment.id).eq('last_checked_at', claimedAt);
    }
    throw err;
  }

  const decision = decideDeposit({ stored: payment.status, orderId, amountTzs: payment.amount_tzs, ageMs: age, tx: verified.tx, limits: LIMITS });
  if (decision.reason === 'reference_mismatch') {
    console.error(`Deposit ${orderId}: Flutterwave answered for another reference; nothing changed`);
    return stored;
  }
  const settled = settledFields(verified.data);
  const completed = verified.tx.found && String(verified.tx.status).toLowerCase() === 'successful' ? settled : undefined;

  if (payment.status === 'failed') {
    if (decision.status !== 'review') return stored;
    console.error(`Deposit ${orderId}: paid at Flutterwave after it was marked failed; held for review`);
    return { status: await moveStatus(db, payment.id, 'failed', { ...settled, status: 'review', status_reason: decision.reason }, opts.source) };
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
  try {
    return { status: await moveStatus(db, payment.id, 'pending', patch, opts.source, completed) };
  } catch (err) {
    // 23505 on 'paid': a parallel check marked another order for this deposit paid a moment ago.
    if (status !== 'paid' || !(err instanceof DbError) || err.code !== '23505') throw err;
    console.error(`Deposit ${orderId}: second paid order for the same deposit; held for review`);
    return { status: await moveStatus(db, payment.id, 'pending', { ...patch, status: 'review', status_reason: 'paid_twice', paid_at: null }, opts.source, completed) };
  }
}

// ---------------------------------------------------------------------------
// Sweeper: hosted payment links cannot be cancelled, and a webhook can be lost. Every 5 minutes pg_cron
// asks this function to re-check pending orders (closing expired ones) and recent failed ones (a late
// payment goes to 'review'). Answers counts only, never order ids or amounts.
// ---------------------------------------------------------------------------
async function sameSecretText(expected: string, given: string) {
  if (expected.length < 32 || given === '') return false;
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
      .eq('provider', 'flutterwave')
      .eq('status', 'pending')
      .lt('created_at', iso(now - SWEEP_MIN_AGE_MS))
      .or(`last_checked_at.is.null,last_checked_at.lt."${iso(now - SWEEP_INTERVAL_MS)}"`)
      .order('created_at', { ascending: true })
      .limit(SWEEP_BATCH),
    db
      .from('payments')
      .select('order_id, status')
      .eq('provider', 'flutterwave')
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
type Order = { payee: string; description: string; cents: number; offerId?: string; memberId?: string };

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
      cents: offer.price_total_usd * offer.deposit_percent, // whole dollars x percent = cents
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
    if (trip.status !== 'approved' || trip.cancelled || trip.organizer_kind === 'traveller') return 'no_deposit';
    // Charge the price saved on the member row when they were accepted, not today's price.
    const price = member.price_per_person_usd as number | null;
    if (!trip.deposit_percent || !price) return 'no_deposit';
    if (!(await offererApproved(db, trip.organizer_id, trip.guide_id))) return 'not_approved';
    return {
      payee: trip.organizer_id,
      description: `Deposit: ${trip.title} (${member.seats})`.slice(0, 200),
      cents: price * member.seats * trip.deposit_percent,
      memberId: member.id,
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

  // One open order per deposit. A Flutterwave payment link cannot be cancelled, so an open order is
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
        if (link && Date.now() - new Date(link.created_at).getTime() < LINK_REUSE_MS && isAllowedPaymentUrl(link.url)) {
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
    .eq('provider', 'flutterwave')
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
      provider: 'flutterwave',
      status_source: 'checkout',
    })
    .select('id')
    .single();
  if (error || !inserted) {
    if (error?.code === '23505') return json({ error: 'pending_order' }, 409);
    console.error(`Deposit ${orderId}: insert failed (${error?.code ?? 'no row'})`);
    return json({ error: 'save_failed' }, 500);
  }

  const { data: profile } = await db.from('profiles').select('full_name, phone').eq('id', user.id).single();
  const phone = tzPhone(profile?.phone ?? null);
  try {
    // Fee bearer: Flutterwave Standard has no documented per-payment "merchant pays" field, so the
    // dashboard setting must be "merchant pays" (Walter). The server enforces it anyway: a payment
    // whose charged_amount is above our amount is held for review, never 'paid' (decideDeposit).
    const data = await flw('/payments', 'POST', {
      tx_ref: orderId,
      amount: tzs,
      currency: 'TZS',
      redirect_url: `${SITE_URL}/${lang}/payments/return?order=${orderId}`,
      payment_options: 'card,mobilemoneytanzania',
      customer: {
        email: cleanEmail(user.email),
        name: cleanText(profile?.full_name ?? '', 60, 'Kwetuly traveller'),
        ...(phone ? { phonenumber: phone } : {}),
      },
      customizations: { title: 'Kwetuly deposit', description: cleanText(order.description, 100, 'Kwetuly deposit') },
      meta: { kind: order.offerId ? 'offer_deposit' : 'group_deposit' },
      configurations: { session_duration: SESSION_MINUTES, max_retry_attempt: 5 },
    });
    const url = data.link;
    if (!isAllowedPaymentUrl(url)) throw new Error('Payment page not allowed');
    const { error: linkError } = await db.from('payment_checkout_links').insert({ payment_id: inserted.id, url });
    if (linkError) console.error(`Deposit ${orderId}: link not saved (${linkError.code})`);
    return json({ url, order_id: orderId });
  } catch (err) {
    // The link may still exist at Flutterwave (a timeout after it was made): the sweeper re-checks failed
    // orders for 3 days, so a payment on it reaches 'review'.
    const why = err instanceof FlwError ? `HTTP ${err.http}` : err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError') ? 'timeout' : err instanceof Error && err.message === 'Payment page not allowed' ? 'payment page not allowed' : 'other error';
    console.error(`Deposit ${orderId}: create payment failed (${why})`);
    await moveStatus(db, inserted.id, 'pending', { status: 'failed', status_reason: 'gateway_error' }, 'checkout').catch((e) => console.error(e instanceof Error ? e.message : e));
    return json({ error: 'gateway_error' }, 502);
  }
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------
async function webhook(db: Admin, raw: string, signature: string | null, verifHash: string | null) {
  const valid = await verifyFlutterwaveWebhook(raw, { signature, verifHash }, env('FLW_SECRET_HASH'));
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // not JSON
  }
  const ref = readWebhook(parsed);
  const base = { provider: 'flutterwave', event_type: ref.eventType, tx_ref: ref.txRef, provider_transaction_id: ref.transactionId };

  if (!valid) {
    // Logged only when it names one of our orders (ids are unguessable), so random traffic cannot fill
    // the log. No body is kept for an unsigned call.
    if (ref.txRef) {
      const { data: known } = await db.from('payments').select('id').eq('order_id', ref.txRef).maybeSingle();
      if (known) await db.from('payment_events').insert({ ...base, event_key: `invalid:${crypto.randomUUID()}`, signature_valid: false });
    }
    console.error('payments webhook: signature missing or wrong; refused');
    return json({ error: 'signature' }, 401);
  }

  const eventKey = ref.eventKey ?? `nokey:${crypto.randomUUID()}`;
  const { error: logError } = await db
    .from('payment_events')
    .upsert({ ...base, event_key: eventKey, signature_valid: true, payload: maskPayload(parsed) }, { onConflict: 'provider,event_key', ignoreDuplicates: true });
  if (logError) console.error(`payments webhook: log failed (${logError.code})`);

  if (!ref.txRef) return json({ ok: true });
  try {
    // Signed, so not throttled: a failed attempt and a success can arrive seconds apart. Repeats are
    // harmless; every change is conditional on the stored status.
    const result = await refresh(db, ref.txRef, { source: 'webhook', transactionId: ref.transactionId });
    await db
      .from('payment_events')
      .update({ processed_at: new Date().toISOString(), result_status: result?.status ?? 'unknown_order' })
      .eq('provider', 'flutterwave')
      .eq('event_key', eventKey);
    return json({ ok: true });
  } catch (err) {
    // 500 so Flutterwave retries (if retries are on); the sweeper covers it too.
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

  const signature = req.headers.get('flutterwave-signature');
  const verifHash = req.headers.get('verif-hash');
  const isWebhook = signature !== null || verifHash !== null;

  let body: Record<string, unknown> = {};
  if (!isWebhook) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed;
    } catch {
      // not JSON: an empty request
    }
    if (body.action === 'config') return json({ enabled: enabled(), rate: enabled() ? RATE100! / 100 : null, rate100: enabled() ? RATE100 : null });
  }
  if (!enabled()) return json({ error: 'not_configured' }, 503);
  const db = admin();

  if (isWebhook) return webhook(db, raw, signature, verifHash);

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
