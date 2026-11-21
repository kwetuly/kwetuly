// What every payment processor adapter gives the payments core (../index.ts). The core decides money
// state; an adapter only talks to its processor and translates field names. Rules every adapter keeps
// (docs/team/security-review-flutterwave-2026-11-22.md):
//   - configError() refuses live keys and any missing or weak secret; a non-empty answer keeps payments off.
//   - verifyWebhook() checks the processor's signature over the raw body with a timing-safe compare
//     (sameSecret in ../core.ts), under ONE scheme, with no fallback to another header or scheme.
//   - verify() asks the processor's own API; webhook bodies and return URLs are never trusted for status
//     or amounts. If a processor allows several attempts per order, verify() must find a successful one
//     or report attemptsUnclear.
//   - Never log or return names, phone numbers, e-mail, card or account details; log path and HTTP status only.
import type { ProviderTx, WebhookRef } from '../core.ts';

/** A processor API call that answered with an error. `notFound`: it knows no payment for that order. */
export class ProviderHttpError extends Error {
  constructor(message: string, readonly http: number, readonly notFound: boolean) {
    super(message);
  }
}

/** One hosted-checkout order, in Kwetuly's own terms. Amounts are whole shillings. */
export type CheckoutRequest = {
  /** Kwetuly's order id ("RAF" + 32 hex); the processor's merchant reference. */
  orderId: string;
  amountTzs: number;
  currency: 'TZS';
  kind: 'offer_deposit' | 'group_deposit';
  /** Already cleaned by the core. phone: 255XXXXXXXXX or null (only pre-fills mobile money). */
  customer: { email: string; name: string; phone: string | null };
  /** Where the traveller comes back to; nothing in that address is trusted. */
  redirectUrl: string;
  title: string;
  description: string;
  /** How long the hosted page stays open (it must close before the deposit cut-off). */
  sessionMinutes: number;
};

/** The hosted page address. The core checks it against paymentDomains before using it. */
export type CheckoutResult = { paymentUrl: unknown };

/**
 * What the processor reported about a found payment, besides ProviderTx, for the payment row and
 * payment_provider_details. Raw amounts (unknown) are parsed exactly by the core (parseWholeTzs,
 * parseMoney2, parseCurrency); text fields are already plain and short.
 */
export type PaymentDetails = {
  amount: unknown;
  currency: unknown;
  /** The processor's transaction id (used to verify and reconcile), or null. */
  transactionId: string | null;
  /** The processor's own reference (Flutterwave flw_ref), or null. */
  reference: string | null;
  /** Card, mobile money, ... as the processor names it, or null. */
  channel: string | null;
  /** The processor's fee (paid by Kwetuly, never added to the traveller's amount). */
  fee: unknown;
  /** What the processor settles to Kwetuly for this payment. */
  settledAmount: unknown;
};

export type VerifiedPayment = {
  tx: ProviderTx;
  /** null when the processor knows no payment for the order. */
  details: PaymentDetails | null;
  /** The processor showed an attempt that was not successful, but not every attempt could be listed. */
  attemptsUnclear: boolean;
};

export interface PaymentProvider {
  /** Stored in payments.provider and payment_events.provider (both have a CHECK on allowed values). */
  readonly id: string;
  /** Name for logs. */
  readonly name: string;
  /** Payment page domains a traveller may be sent to (subdomains only, see isPaymentUrlOn). */
  readonly paymentDomains: readonly string[];
  /** Empty when ready; otherwise why payments stay off (never contains a secret). */
  configError(): string;
  /** Whether this request is a webhook from this processor (by its headers), not a website or app call. */
  isWebhook(headers: Headers): boolean;
  /** Signature check over the exact raw body. */
  verifyWebhook(headers: Headers, rawBody: string): Promise<boolean>;
  /** Lookup keys only from a parsed webhook body (never amounts or status). */
  readWebhook(body: unknown): WebhookRef;
  /** The allow-listed part of a webhook body kept in payment_events (no personal data). */
  pickPayload(body: unknown): Record<string, unknown> | null;
  /** Creates the hosted payment page. Throws ProviderHttpError (or a timeout) on failure. */
  createCheckout(request: CheckoutRequest): Promise<CheckoutResult>;
  /**
   * The processor's own answer for an order: by transactionId when known, otherwise by orderId.
   * Throws when the processor cannot be asked; `tx.found: false` when it knows no payment.
   */
  verify(orderId: string, transactionId: string | null): Promise<VerifiedPayment>;
}
