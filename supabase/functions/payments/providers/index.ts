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
//   3. A migration adding the id to the CHECKs on payments.provider and payment_events.provider
//      (20261122100000_flutterwave_provider.sql allows only 'selcom' and 'flutterwave').
//   4. packages/shared/src/payment-rules.ts: the processor in PAYMENT_PROVIDERS and, when it goes
//      live, ACTIVE_PAYMENT_PROVIDER (name and payment-page domains for the website and the app).
//   5. Its secrets in supabase/functions/.env.example, the privacy page, and the security review.
// Switching: orders still open with the old processor are only re-checked by the adapter they were
// made with (the core filters on payments.provider), so let them settle first (pending up to a day,
// failed re-checked for 3 days) or reconcile them by hand against that processor's export.
import { flutterwaveProvider } from './flutterwave.ts';
import type { PaymentProvider } from './types.ts';

const ADAPTERS: Record<string, () => PaymentProvider> = {
  flutterwave: flutterwaveProvider,
};

/** The adapter named by PAYMENTS_PROVIDER, or null (payments off). */
export function pickProvider(name: string): PaymentProvider | null {
  return Object.prototype.hasOwnProperty.call(ADAPTERS, name) ? ADAPTERS[name]() : null;
}
