// Which payment processor the payments Edge Function uses, from the PAYMENTS_PROVIDER secret. An
// unknown or empty value gives no adapter, and payments stay switched off (the core's configError).
//
// Adding a processor (e.g. PesaPal or AzamPay; only after Walter chooses it and the security review):
//   1. providers/<name>.ts exporting a factory that returns a PaymentProvider (./types.ts):
//        id, name, paymentDomains, configError() (refuses live keys), isWebhook(), verifyWebhook()
//        (signature over the raw body, timing-safe, one scheme), readWebhook(), pickPayload()
//        (allow-list, no personal data), createCheckout() (exact whole TZS), verify() (the processor's
//        own API; status mapped so 'successful' / 'pending' mean what decideDeposit expects).
//   2. One line in ADAPTERS below.
//   3. No database change: payments.provider and payment_events.provider accept any lowercase id,
//      and provider_transaction_id any safe id up to 64 characters (the adapter checks the exact shape).
//   4. packages/shared/src/payment-rules.ts: the processor in PAYMENT_PROVIDERS and, when it goes
//      live, ACTIVE_PAYMENT_PROVIDER (name and payment-page domains for the website and the app).
//   5. Its secrets in supabase/functions/.env.example, the privacy page, and the security review.
// Switching: orders still open with the old processor are only re-checked by the adapter they were
// made with (the core filters on payments.provider), so let them settle first (pending up to a day,
// failed re-checked for 3 days) or reconcile them by hand against that processor's export.
import { flutterwaveProvider } from './flutterwave.ts';
import type { PaymentProvider } from './types.ts';

// `allowed`: the core's own gate (test mode, live refused, project checks). Adapters refuse every
// processor call while it answers false, even if a future core edit forgets gateway() (review L1).
const ADAPTERS: Record<string, (allowed: () => boolean) => PaymentProvider> = {
  flutterwave: flutterwaveProvider,
};

/** The adapter named by PAYMENTS_PROVIDER, or null (payments off). */
export function pickProvider(name: string, allowed: () => boolean): PaymentProvider | null {
  return Object.prototype.hasOwnProperty.call(ADAPTERS, name) ? ADAPTERS[name](allowed) : null;
}
