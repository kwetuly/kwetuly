// Provider-neutral deposit rules for the payments Edge Function: order ids, exact money parsing, the
// deposit decision, the payment-page check and timing-safe secret comparison. No processor's field
// names or keys here; those live in providers/<name>.ts.
//
// Copy of the payment-rules block in packages/shared/src/payment-rules.ts (Deno cannot import that
// package). Do not edit here: change the shared file and paste its block; payment-rules.test.ts fails
// if the two differ.
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
