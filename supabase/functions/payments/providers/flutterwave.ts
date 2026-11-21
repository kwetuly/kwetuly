// Flutterwave adapter for the payments Edge Function: hosted checkout ("Standard"), Visa and Mastercard
// (3-D Secure) and Tanzanian mobile money (M-Pesa, Mixx by Yas, Airtel Money, HaloPesa), charged in TZS.
// Every Flutterwave name lives here: API base, FLW_* secrets, headers, tx_ref, verif-hash and
// flutterwave-signature, the FLWSECK_TEST- check and the answer's field names. The core
// (../index.ts) only sees the normalized types in ./types.ts.
//
// Secrets (Supabase dashboard, Edge Functions, Secrets; names in supabase/functions/.env.example):
//   FLW_SECRET_KEY        Flutterwave TEST secret key (starts with FLWSECK_TEST-). A live key is refused.
//   FLW_WEBHOOK_MODE      "v3" or "v4": the ONE webhook scheme this Flutterwave account uses (the other is refused).
//   FLW_SECRET_HASH       v3 only: the webhook "secret hash" (header verif-hash), at least 32 random characters.
//   FLW_WEBHOOK_SIGNING_SECRET  v4 only: the key for the flutterwave-signature HMAC, at least 32 characters.
//                         Never the same value as FLW_SECRET_HASH.
import { isOrderId, MIN_WEBHOOK_SECRET_LENGTH, sameSecret, type ProviderTx, type WebhookRef } from '../core.ts';
import { ProviderHttpError, type CheckoutRequest, type CheckoutResult, type PaymentDetails, type PaymentProvider, type VerifiedPayment } from './types.ts';

// Copy of the flutterwave-rules block in packages/shared/src/payment-rules.ts. Do not edit here: change
// the shared file and paste its block; payment-rules.test.ts fails if the two differ.
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

const env = (key: string) => Deno.env.get(key) ?? '';
const FLW_API = 'https://api.flutterwave.com/v3';
const FLW_TIMEOUT_MS = 10_000;

const plain = (v: unknown, max: number) => (typeof v === 'string' || typeof v === 'number' ? String(v).replace(/[^\w.:-]/g, '').slice(0, max) || null : null);

/** The Flutterwave adapter, configured from the FLW_* secrets read once at start-up. */
export function flutterwaveProvider(): PaymentProvider {
  const secretKey = env('FLW_SECRET_KEY');
  const mode = parseWebhookMode(env('FLW_WEBHOOK_MODE'));
  const secret = mode === 'v3' ? env('FLW_SECRET_HASH') : mode === 'v4' ? env('FLW_WEBHOOK_SIGNING_SECRET') : '';

  const configError = () => {
    if (!secretKey.startsWith('FLWSECK_TEST-')) return 'FLW_SECRET_KEY is missing or not a test key';
    if (!mode) return 'FLW_WEBHOOK_MODE must be "v3" or "v4"';
    if (secret.length < MIN_WEBHOOK_SECRET_LENGTH) return `${mode === 'v3' ? 'FLW_SECRET_HASH' : 'FLW_WEBHOOK_SIGNING_SECRET'} is missing or shorter than 32 characters`;
    if (env('FLW_SECRET_HASH') && env('FLW_SECRET_HASH') === env('FLW_WEBHOOK_SIGNING_SECRET')) return 'the v3 and v4 webhook secrets must differ';
    return '';
  };
  const ready = configError() === '';

  // Bearer secret key. Only the path (no query) and the HTTP status are logged, never the answer body
  // (it holds names, phone numbers, e-mail and card details).
  async function flw(path: string, method: 'GET' | 'POST', body?: unknown): Promise<Record<string, unknown>> {
    if (!ready) throw new Error(`Flutterwave ${path.split('?')[0]}: payments switched off`);
    const res = await fetch(`${FLW_API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(FLW_TIMEOUT_MS),
    });
    const answer = (await res.json().catch(() => ({}))) as { status?: unknown; message?: unknown; data?: unknown };
    if (!res.ok || answer.status !== 'success' || !answer.data || typeof answer.data !== 'object') {
      // "No transaction was found for this id/reference" (to verify the exact wording in the sandbox).
      const notFound = typeof answer.message === 'string' && /no transaction|not found/i.test(answer.message);
      throw new ProviderHttpError(`Flutterwave ${path.split('?')[0]}: HTTP ${res.status}${notFound ? ' not found' : ''}`, res.status, notFound);
    }
    return answer.data as Record<string, unknown>;
  }

  // Flutterwave's answer in Kwetuly's own field names (the core never sees tx_ref, charged_amount, ...).
  const read = (data: Record<string, unknown>): ProviderTx => ({
    found: true,
    status: data.status,
    txRef: data.tx_ref,
    amount: data.amount,
    chargedAmount: data.charged_amount,
    currency: data.currency,
  });
  const details = (data: Record<string, unknown>): PaymentDetails => {
    const id = data.id;
    return {
      amount: data.amount,
      currency: data.currency,
      transactionId: (typeof id === 'number' && Number.isSafeInteger(id)) || (typeof id === 'string' && /^\d{1,20}$/.test(id)) ? String(id) : null,
      reference: plain(data.flw_ref, 80),
      channel: plain(data.payment_type, 40),
      fee: data.app_fee,
      // Settlement currency assumed to be the charge currency (TZS); to verify in the sandbox.
      settledAmount: data.amount_settled,
    };
  };
  const found = (data: Record<string, unknown>, attemptsUnclear: boolean): VerifiedPayment => ({ tx: read(data), details: details(data), attemptsUnclear });
  const successful = (data: Record<string, unknown>) => typeof data.status === 'string' && data.status.toLowerCase() === 'successful';

  return {
    id: 'flutterwave',
    name: 'Flutterwave',
    paymentDomains: FLUTTERWAVE_PAYMENT_DOMAINS,
    configError,

    isWebhook: (headers) => headers.get('flutterwave-signature') !== null || headers.get('verif-hash') !== null,

    verifyWebhook: (headers, rawBody) =>
      verifyFlutterwaveWebhook(rawBody, { signature: headers.get('flutterwave-signature'), verifHash: headers.get('verif-hash') }, { mode, secret }),

    readWebhook: readFlutterwaveWebhook,
    pickPayload: pickFlutterwavePayload,

    async createCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
      // Fee bearer: Flutterwave Standard has no documented per-payment "merchant pays" field, so the
      // dashboard setting must be "merchant pays" (Walter). The core enforces it anyway: a payment
      // whose charged_amount is above our amount is held for review, never 'paid' (decideDeposit).
      const data = await flw('/payments', 'POST', {
        tx_ref: request.orderId,
        amount: request.amountTzs,
        currency: request.currency,
        redirect_url: request.redirectUrl,
        payment_options: 'card,mobilemoneytanzania',
        customer: {
          email: request.customer.email,
          name: request.customer.name,
          ...(request.customer.phone ? { phonenumber: request.customer.phone } : {}),
        },
        customizations: { title: request.title, description: request.description },
        meta: { kind: request.kind },
        // Hosted page lifetime (configurations.session_duration, minutes; to verify in the sandbox).
        configurations: { session_duration: request.sessionMinutes, max_retry_attempt: 5 },
      });
      return { paymentUrl: data.link };
    },

    // By transaction id when a signed webhook or an earlier check gave one, otherwise by tx_ref. The
    // hosted page allows several attempts under one tx_ref, and verify-by-reference may answer with one
    // of them only (security-reviewer M4): when that answer is not successful, every attempt on the
    // order is listed and a successful one is used. If the list cannot be read, attemptsUnclear makes an
    // order that would be given up on go to 'review' instead.
    async verify(orderId: string, transactionId: string | null): Promise<VerifiedPayment> {
      try {
        if (transactionId) {
          const data = await flw(`/transactions/${transactionId}/verify`, 'GET');
          if (data.tx_ref === orderId) return found(data, false);
          console.error(`Deposit ${orderId}: transaction id belongs to another reference; checking by reference`);
        }
        const data = await flw(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(orderId)}`, 'GET');
        if (successful(data)) return found(data, false);
        try {
          // All attempts on this order (endpoint and filter to confirm in the sandbox).
          const list = await flw(`/transactions?tx_ref=${encodeURIComponent(orderId)}`, 'GET');
          const id = successfulFlutterwaveAttemptId(list, orderId);
          if (id) {
            const paid = await flw(`/transactions/${id}/verify`, 'GET');
            if (paid.tx_ref === orderId) return found(paid, false);
          }
          return found(data, false);
        } catch (err) {
          console.error(`Deposit ${orderId}: attempts could not be listed (${err instanceof ProviderHttpError ? `HTTP ${err.http}` : 'error'})`);
          return found(data, true);
        }
      } catch (err) {
        if (err instanceof ProviderHttpError && err.notFound) return { tx: { found: false }, details: null, attemptsUnclear: false };
        throw err;
      }
    },
  };
}
