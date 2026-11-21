// Provider-agnostic deposit rules (payments-engineer, 2026-11-22, Flutterwave switch).
//
// The `payments` Edge Function (Deno) cannot import this package, so the block between the BEGIN and
// END lines below is copied into supabase/functions/payments/index.ts word for word.
// payment-rules.test.ts fails if the two copies differ: change this file, then paste the block there.
//
// Money rules: whole US cents and whole shillings only, no floating-point maths on amounts; fees and
// settled amounts are kept as exact decimal strings (numeric(14,2) in the database).

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
