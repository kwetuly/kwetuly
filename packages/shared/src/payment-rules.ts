// Deposit rules (payments-engineer; provider adapters 2026-11-21, Flutterwave chosen, Selcom parked).
//
// The `payments` Edge Function (Deno) cannot import this package, so two blocks below are copied into
// it word for word; payment-rules.test.ts fails if a copy differs (change this file, then paste):
//   - BEGIN/END payment-rules:     provider-neutral rules  -> supabase/functions/payments/core.ts
//   - BEGIN/END flutterwave-rules: Flutterwave field names -> supabase/functions/payments/providers/flutterwave.ts
// Below the blocks (this package only): which processor is active, its name and payment-page domains,
// for the website and the app. Switching processor: docs in supabase/functions/payments/providers/index.ts.
//
// Money rules: whole US cents and whole shillings only, no floating-point maths on amounts; fees and
// settled amounts are kept as exact decimal strings (numeric(14,2) in the database).

// BEGIN payment-rules
/** Order ids Kwetuly creates (sent to the provider as its merchant reference): "RAF" + 32 lower-case hex characters. */
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

/**
 * What the provider's verify call said about one order, in Kwetuly's own field names (the provider
 * adapter maps its fields onto these). `found: false`: the provider knows no payment for it.
 *   - status: the provider's status; after trim and lower case 'successful' means paid, 'pending' means
 *     still open, anything else is not paid. An adapter whose provider uses other words maps them.
 *   - txRef: the order id the provider echoes back (must equal ours, or nothing changes).
 *   - amount: what the order was for; chargedAmount: what the payer was charged; currency: their currency.
 */
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
    | 'attempts_unclear'
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
 *   - 'paid' only when the provider says successful, for this order id, in TZS, for exactly our amount,
 *     and the payer was charged exactly that amount (Kwetuly pays the provider's fee, not the traveller).
 *   - Any other successful payment is held as 'review' for an admin, never 'paid'.
 *   - A successful payment on an order Kwetuly had given up on ('failed') goes to 'review'.
 *   - A failed attempt while the hosted page is still open stays 'pending': the traveller may retry there.
 *   - `attemptsUnclear`: the provider showed an attempt that was not successful, but Kwetuly could not
 *     list every attempt on this order (security-reviewer M4). Instead of giving up on it ('failed'),
 *     it is held as 'review' so an admin checks it against the provider's records.
 */
export function decideDeposit(input: {
  stored: 'pending' | 'failed';
  orderId: string;
  amountTzs: number;
  ageMs: number;
  tx: ProviderTx;
  limits: DepositLimits;
  attemptsUnclear?: boolean;
}): DepositDecision {
  const { stored, orderId, amountTzs, ageMs, tx, limits, attemptsUnclear = false } = input;
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

  let decision: DepositDecision;
  if (tx.found && state === 'pending') {
    decision = ageMs > limits.staleMs ? { status: 'failed', reason: 'stale' } : { status: 'pending', reason: 'open' };
  } else {
    decision = ageMs > limits.sessionMs + limits.graceMs ? { status: 'failed', reason: 'expired' } : { status: 'pending', reason: 'open' };
  }
  if (decision.status === 'failed' && tx.found && attemptsUnclear) return { status: 'review', reason: 'attempts_unclear' };
  return decision;
}

const PAYMENT_URL = /^https:\/\/([A-Za-z0-9.-]+)(?::443)?(?:[/?#][\x21-\x5b\x5d-\x7e]*)?$/;
const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * True only for an https address on a subdomain of one of `domains`, safe to send a payer to.
 * Refuses other schemes, userinfo, ports other than 443, lookalike hosts, IP addresses, trailing dots,
 * spaces, control or non-ASCII characters, backslashes, and anything longer than 2048 characters.
 * Pure string check, so it behaves the same in browsers, React Native, Node and Deno.
 */
export function isPaymentUrlOn(url: unknown, domains: readonly string[]): url is string {
  if (typeof url !== 'string' || url.length === 0 || url.length > 2048) return false;
  const match = PAYMENT_URL.exec(url);
  if (!match) return false;
  const host = match[1].toLowerCase();
  if (host.length > 253 || !host.split('.').every((label) => HOST_LABEL.test(label))) return false;
  return domains.some((domain) => host.endsWith(`.${domain}`));
}

const encoder = new TextEncoder();

export async function sameSecret(a: string, b: string): Promise<boolean> {
  // Compare SHA-256 digests in constant time, so timing says nothing about the secret.
  const [x, y] = await Promise.all([a, b].map(async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(s)))));
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** Shortest webhook secret Kwetuly accepts (Walter sets it in the provider's dashboard). */
export const MIN_WEBHOOK_SECRET_LENGTH = 32;

/**
 * Log key for an unsigned or wrongly signed call naming one of our orders: one row per order per hour at
 * most (security-reviewer M3), so a script cannot fill the callback log.
 */
export function invalidEventKey(txRef: string, nowMs: number): string {
  return `invalid:${txRef}:${new Date(nowMs).toISOString().slice(0, 13)}`;
}

/**
 * What Kwetuly reads from a webhook body: only keys to look the order up with, never its amounts or
 * status. eventKey: stable per delivery (repeats are logged once); txRef: our order id; transactionId:
 * the provider's own transaction id, used to verify.
 */
export type WebhookRef = { eventKey: string | null; eventType: string | null; txRef: string | null; transactionId: string | null };
// END payment-rules

// BEGIN flutterwave-rules
/** Flutterwave's payment page domains. Only subdomains (e.g. "checkout.flutterwave.com") pass, not the bare domain. */
export const FLUTTERWAVE_PAYMENT_DOMAINS: readonly string[] = ['flutterwave.com'];

/**
 * From a list of Flutterwave's transactions for one order (all attempts on the hosted page), the id of
 * a successful one for exactly this tx_ref, or null. Used because verify-by-reference may answer with
 * one attempt only (security-reviewer M4).
 */
export function successfulFlutterwaveAttemptId(list: unknown, orderId: string): string | null {
  if (!Array.isArray(list)) return null;
  for (const item of list.slice(0, 50)) {
    if (!item || typeof item !== 'object') continue;
    const tx = item as Record<string, unknown>;
    const id = tx.id;
    const plainId = (typeof id === 'number' && Number.isSafeInteger(id) && id > 0) || (typeof id === 'string' && /^\d{1,20}$/.test(id)) ? String(id) : null;
    if (plainId && tx.tx_ref === orderId && typeof tx.status === 'string' && tx.status.trim().toLowerCase() === 'successful') return plainId;
  }
  return null;
}

/** Which Flutterwave webhook scheme this account uses. Exactly one is accepted (security-reviewer L1). */
export type WebhookMode = 'v3' | 'v4';
export const parseWebhookMode = (raw: string | null | undefined): WebhookMode | null => (raw === 'v3' || raw === 'v4' ? raw : null);

/**
 * Checks a Flutterwave webhook under ONE scheme, with that scheme's own secret:
 *   - v4: header `flutterwave-signature` = base64 HMAC-SHA256 of the raw body, keyed with the v4 signing secret.
 *   - v3: header `verif-hash` = the v3 secret hash.
 * The other scheme's header is never used, and a header that is present but empty is invalid.
 */
export async function verifyFlutterwaveWebhook(
  rawBody: string,
  headers: { signature: string | null; verifHash: string | null },
  config: { mode: WebhookMode | null; secret: string },
): Promise<boolean> {
  if (!config.mode || config.secret.length < MIN_WEBHOOK_SECRET_LENGTH) return false;
  if (config.mode === 'v4') {
    const given = (headers.signature ?? '').trim();
    if (!given) return false;
    const utf8 = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', utf8.encode(config.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, utf8.encode(rawBody)));
    let binary = '';
    for (const byte of mac) binary += String.fromCharCode(byte);
    return sameSecret(btoa(binary), given);
  }
  const given = headers.verifHash ?? '';
  if (!given) return false;
  return sameSecret(config.secret, given);
}

const plainText = (value: unknown, max: number) =>
  typeof value === 'string' || typeof value === 'number' ? String(value).replace(/[^\w.:-]/g, '').slice(0, max) || null : null;

export function readFlutterwaveWebhook(body: unknown): WebhookRef {
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

// Fields kept in the callback log (security-reviewer L2): an allow-list, everything else is dropped,
// so no name, phone, e-mail, card, account, address, IP or free text is ever stored.
const KEEP_TOP = ['event', 'type', 'webhook_id', 'id', 'timestamp', 'event.type'];
const KEEP_DATA = ['id', 'tx_ref', 'reference', 'flw_ref', 'status', 'amount', 'charged_amount', 'currency', 'app_fee', 'merchant_fee', 'amount_settled', 'payment_type', 'created_at'];

const keepValue = (value: unknown) =>
  typeof value === 'number' || typeof value === 'boolean' ? value : typeof value === 'string' ? value.replace(/[^\w .:+-]/g, '').slice(0, 64) : null;

/**
 * The part of a Flutterwave callback that is safe to keep: a few top-level keys and, under `data`, only
 * amounts, references, status, type and time. Values are plain numbers or short plain text.
 */
export function pickFlutterwavePayload(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const root = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of KEEP_TOP) if (key in root) out[key] = keepValue(root[key]);
  const data = root.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const kept: Record<string, unknown> = {};
    for (const key of KEEP_DATA) if (key in (data as Record<string, unknown>)) kept[key] = keepValue((data as Record<string, unknown>)[key]);
    out.data = kept;
  }
  return out;
}
// END flutterwave-rules

// ---------------------------------------------------------------------------
// The processor, in one place for the website and the app (not copied into the Edge Function, which
// picks its adapter from PAYMENTS_PROVIDER). Labels and domains only: no keys, no amounts.
// ---------------------------------------------------------------------------
export type PaymentProviderInfo = {
  /** Same id as payments.provider in the database and PAYMENTS_PROVIDER in the Edge Function. */
  id: string;
  /** Name shown to travellers (privacy page, Pay box) and admins. */
  name: string;
  /** Where an admin checks a payment by hand. */
  console: string;
  /** Payment page domains a traveller may be sent to (subdomains only). */
  paymentDomains: readonly string[];
};

/** Processors with an adapter in supabase/functions/payments/providers. */
export const PAYMENT_PROVIDERS = {
  flutterwave: { id: 'flutterwave', name: 'Flutterwave', console: 'Flutterwave dashboard', paymentDomains: FLUTTERWAVE_PAYMENT_DOMAINS },
} as const satisfies Record<string, PaymentProviderInfo>;

export type PaymentProviderId = keyof typeof PAYMENT_PROVIDERS;

/** The processor deposits use now. Must be the same as PAYMENTS_PROVIDER in the payments Edge Function. */
export const ACTIVE_PAYMENT_PROVIDER: PaymentProviderInfo = PAYMENT_PROVIDERS.flutterwave;

/** The active processor's name, e.g. for "{provider}" in the payments texts. */
export const PAYMENT_PROVIDER_NAME = ACTIVE_PAYMENT_PROVIDER.name;

/** Every known processor's payment-page domains (analytics strips query strings on all of them). */
export const ALL_PAYMENT_DOMAINS: readonly string[] = Object.values(PAYMENT_PROVIDERS).flatMap((p) => [...p.paymentDomains]);

/**
 * True only for an https payment page of the active processor (see isPaymentUrlOn). The website and the
 * app check the Edge Function's answer again with this before sending a traveller there.
 */
export function isAllowedPaymentUrl(url: unknown, domains: readonly string[] = ACTIVE_PAYMENT_PROVIDER.paymentDomains): url is string {
  return isPaymentUrlOn(url, domains);
}

/** Where an admin checks a payment row by hand, by its `provider` column (older rows may be 'selcom', parked). */
export function paymentConsoleName(provider: string | null | undefined): string {
  if (provider === 'selcom') return 'Selcom portal';
  if (!provider) return ACTIVE_PAYMENT_PROVIDER.console;
  return Object.prototype.hasOwnProperty.call(PAYMENT_PROVIDERS, provider)
    ? PAYMENT_PROVIDERS[provider as PaymentProviderId].console
    : `${provider} dashboard`;
}
