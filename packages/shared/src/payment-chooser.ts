// The payment-method chooser (website sheet and app modal), payments-engineer 2026-11-26.
// Rows come from public.payment_methods_for(purpose, platform): the SERVER decides each method's state
// (live or coming_soon) and the app-store route; screens only show them and never enable a row the
// server did not call live. The order Walter set in /admin/payments/methods is kept, with the viewer's
// last-used live method first (remembered per viewer, safe to fail).
import { LIPA_NETWORK_NAMES, PAYMENT_METHODS, PAYMENT_PROVIDER_IDS, type LipaNetwork, type PaymentMethod, type PaymentProviderKey } from './payment-methods';

export type PaymentPlatform = 'web' | 'ios' | 'android';
export const PURCHASE_KINDS = ['real_world_service', 'physical_goods', 'digital_feature'] as const;
export type PurchaseKind = (typeof PURCHASE_KINDS)[number];
// From docs/legal/app-store-payment-rules-2026-11.md ("per-platform policy values"). Applied in the app
// only; the website is not limited by store rules. web_only: the app shows no price, button, link,
// webview or wording that leads to paying.
export const STORE_ROUTES = ['third_party_in_app', 'store_billing', 'web_only', 'not_offered'] as const;
export type StoreRoute = (typeof STORE_ROUTES)[number];
/** Item types in site_settings 'payments.store_policy' (the order purposes and the research rows). */
export const STORE_ITEM_TYPES = ['offer_deposit', 'group_deposit', 'accommodation_reservation', 'marketplace_item', 'tip_person', 'verification',
  'crew_verification', 'business_badge', 'reservation_commission', 'profile_boost', 'subscription_premium', 'donation_cause', 'jobs_contact_fee'] as const;

export type MethodBadge = LipaNetwork | 'visa' | 'mastercard';
export const METHOD_BADGES: readonly MethodBadge[] = ['mixx', 'mpesa', 'airtel', 'halopesa', 'bank', 'visa', 'mastercard'];
/** Brand names, the same in every language ('bank' is translated on screen). */
export const METHOD_BADGE_NAMES: Record<Exclude<MethodBadge, 'bank'>, string> = {
  ...LIPA_NETWORK_NAMES,
  mixx: 'Mixx by Yas',
  visa: 'Visa',
  mastercard: 'Mastercard',
};

/** One row of public.payment_methods_for(). */
export type PaymentMethodRow = {
  id: PaymentProviderKey;
  display_name: string;
  methods: PaymentMethod[];
  badges: MethodBadge[];
  sort: number;
  state: 'live' | 'coming_soon';
  route: StoreRoute;
  purchase_kind: PurchaseKind;
};

const isProviderKey = (v: unknown): v is PaymentProviderKey => typeof v === 'string' && (PAYMENT_PROVIDER_IDS as readonly string[]).includes(v);

/** Server rows, cleaned; unknown shapes are dropped (never shown as live). */
export function parseMethodRows(data: unknown): PaymentMethodRow[] {
  const rows = Array.isArray(data) ? data : [];
  const out: PaymentMethodRow[] = [];
  for (const raw of rows) {
    const r = raw as Partial<PaymentMethodRow> | null;
    if (!r || !isProviderKey(r.id) || typeof r.display_name !== 'string') continue;
    if (r.state !== 'live' && r.state !== 'coming_soon') continue;
    if (!(STORE_ROUTES as readonly string[]).includes(String(r.route))) continue;
    out.push({
      id: r.id,
      display_name: r.display_name,
      methods: (Array.isArray(r.methods) ? r.methods : []).filter((m): m is PaymentMethod => (PAYMENT_METHODS as readonly string[]).includes(m)),
      badges: (Array.isArray(r.badges) ? r.badges : []).filter((b): b is MethodBadge => (METHOD_BADGES as readonly string[]).includes(b)),
      sort: typeof r.sort === 'number' ? r.sort : 50,
      state: r.state,
      route: r.route as StoreRoute,
      purchase_kind: (PURCHASE_KINDS as readonly string[]).includes(String(r.purchase_kind)) ? (r.purchase_kind as PurchaseKind) : 'digital_feature',
    });
  }
  return out;
}

/** Live rows first, the viewer's last-used live method first of all, then the admin's order. */
export function orderMethods(rows: readonly PaymentMethodRow[], lastUsed: string | null | undefined): PaymentMethodRow[] {
  const rank = (r: PaymentMethodRow) => (r.state === 'live' ? (r.id === lastUsed ? 0 : 1) : 2);
  return [...rows].sort((a, b) => rank(a) - rank(b) || a.sort - b.sort || a.id.localeCompare(b.id));
}

/** Only these may be picked: the server said live and the store route allows paying here. */
export const canPick = (r: PaymentMethodRow): boolean => r.state === 'live' && r.route === 'third_party_in_app';

/**
 * Whether the app may show a Pay button for this purpose: only when the server returned at least one
 * row (an empty list means the store policy says web_only or not_offered: show nothing, not even a
 * disabled button or "on the website" text). Until the answer arrives the app shows no button.
 */
export const appMayShowPay = (rows: readonly PaymentMethodRow[] | null | undefined): boolean => !!rows && rows.length > 0;

export const LAST_METHOD_KEY = 'kwetuly.lastPaymentMethod';
export const isLastMethod = (v: unknown): v is PaymentProviderKey => isProviderKey(v);

/**
 * Whole US cents from whole shillings and a rate text such as "2650" or "2650.7500" (TZS per USD),
 * rounded half up. BigInt only. A display estimate, never a charged amount. null when not computable.
 */
export function tzsToUsdCents(tzs: number | string, rateText: string | null | undefined): number | null {
  let amount: bigint | null = null;
  if (typeof tzs === 'number') amount = Number.isSafeInteger(tzs) && tzs > 0 ? BigInt(tzs) : null;
  else if (/^\d{1,15}$/.test(tzs)) amount = BigInt(tzs);
  const m = /^(\d{1,6})(?:\.(\d{1,4}))?$/.exec((rateText ?? '').trim());
  if (amount === null || !m) return null;
  const rate10k = BigInt(m[1]) * BigInt(10000) + BigInt((m[2] ?? '').padEnd(4, '0'));
  if (rate10k <= BigInt(0)) return null;
  return Number((amount * BigInt(100) * BigInt(10000) + rate10k / BigInt(2)) / rate10k);
}

/**
 * Deposit in whole shillings from whole US cents and the admin rate text (up to 4 decimals), the same
 * rule as private.guard_new_payment: ceil(cents x rate x 100 / 1 000 000) x 100. BigInt only. Display
 * only: the server computes and saves the real amount.
 */
export function depositTzsFromRateText(cents: number, rateText: string | null | undefined): number | null {
  const m = /^(\d{1,6})(?:\.(\d{1,4}))?$/.exec((rateText ?? '').trim());
  if (!m || !Number.isSafeInteger(cents) || cents <= 0) return null;
  const rate10k = BigInt(m[1]) * BigInt(10000) + BigInt((m[2] ?? '').padEnd(4, '0'));
  if (rate10k <= BigInt(0)) return null;
  const product = BigInt(cents) * rate10k;
  const hundreds = product / BigInt(100_000_000) + (product % BigInt(100_000_000) === BigInt(0) ? BigInt(0) : BigInt(1));
  return Number(hundreds * BigInt(100));
}

/** Local-currency estimate text ("12.34") from whole US cents and a per-USD rate text; BigInt only. */
export function estimateFromCents(cents: number, perUsdText: string | null | undefined): string | null {
  const m = /^(\d{1,6})(?:\.(\d{1,6}))?$/.exec((perUsdText ?? '').trim());
  if (!m || !Number.isSafeInteger(cents) || cents <= 0) return null;
  const rate1m = BigInt(m[1]) * BigInt(1_000_000) + BigInt((m[2] ?? '').padEnd(6, '0'));
  if (rate1m <= BigInt(0)) return null;
  const minor = (BigInt(cents) * rate1m + BigInt(500_000)) / BigInt(1_000_000);
  return `${minor / BigInt(100)}.${String(minor % BigInt(100)).padStart(2, '0')}`;
}

/** "12.34" from whole cents. */
export const centsText = (cents: number): string => `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;

/**
 * The viewer's own currency for a local estimate, from the country (geo header) or the language.
 * null for Tanzania or when unknown. The estimate needs a rate the admin typed (shown with its source);
 * none is invented.
 */
export function viewerCurrency(country: string | null | undefined, locale: string): string | null {
  const byCountry: Record<string, string> = {
    US: 'USD', GB: 'GBP', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', IE: 'EUR',
    PL: 'PLN', CN: 'CNY', KE: 'KES', UG: 'UGX', RW: 'RWF', ZA: 'ZAR', IN: 'INR', CH: 'CHF', CA: 'CAD', AU: 'AUD',
  };
  const byLocale: Record<string, string> = { fr: 'EUR', it: 'EUR', de: 'EUR', pl: 'PLN', zh: 'CNY' };
  const c = (country ?? '').toUpperCase();
  if (c === 'TZ') return null;
  return byCountry[c] ?? byLocale[locale] ?? null;
}
