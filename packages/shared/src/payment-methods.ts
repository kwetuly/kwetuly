// Payment methods and providers (payments-engineer, 2026-11-26). One interface for every way of paying
// Kwetuly: manual Lipa numbers now (Walter, 2026-11-26), card and API providers (Flutterwave, AzamPay,
// Selcom) later. Which provider takes each method is an admin setting (site_settings
// 'payments.providers', screen /admin/payments/numbers), never a code change. The database decides
// again in private.provider_for() (supabase/migrations/20261126001000_payment_methods_and_lipa_numbers.sql):
//   - manual_lipa works while feature.payments_manual is on;
//   - hosted providers only while feature.payments_live is also on (private.money_feature_on), and
//     only for deposits until their Edge Function adapter takes fee orders.
// Money state never changes here or in a screen: only an admin confirmation (manual_lipa) or a verified
// provider callback (hosted) on the server does.

export const PAYMENT_PROVIDER_IDS = ['manual_lipa', 'flutterwave', 'azampay', 'selcom', 'pesapal'] as const;
export type PaymentProviderKey = (typeof PAYMENT_PROVIDER_IDS)[number];

export const PAYMENT_METHODS = ['mobile_money', 'bank', 'card'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const LIPA_NETWORKS = ['mpesa', 'mixx', 'airtel', 'halopesa', 'bank'] as const;
export type LipaNetwork = (typeof LIPA_NETWORKS)[number];

/** Brand names, the same in every language. */
export const LIPA_NETWORK_NAMES: Record<Exclude<LipaNetwork, 'bank'>, string> = {
  mpesa: 'M-Pesa',
  mixx: 'Mixx by Yas',
  airtel: 'Airtel Money',
  halopesa: 'HaloPesa',
};

export const PAYMENT_PURPOSES = ['verification', 'business_badge', 'reservation_commission', 'offer_deposit', 'group_deposit'] as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];
/** Deposits belong to a guide or business: paid to Kwetuly's Lipa number they are other people's money. */
export const isDepositPurpose = (p: PaymentPurpose): boolean => p === 'offer_deposit' || p === 'group_deposit';

export type ProviderSettings = Record<PaymentMethod, PaymentProviderKey[]>;
export const DEFAULT_PROVIDER_SETTINGS: ProviderSettings = { mobile_money: ['manual_lipa'], bank: ['manual_lipa'], card: [] };

const isProvider = (v: unknown): v is PaymentProviderKey => typeof v === 'string' && (PAYMENT_PROVIDER_IDS as readonly string[]).includes(v);

/** site_settings 'payments.providers' as stored; anything malformed falls back to the default. */
export function parseProviderSettings(value: unknown): ProviderSettings {
  if (!value || typeof value !== 'object') return DEFAULT_PROVIDER_SETTINGS;
  const v = value as Record<string, unknown>;
  const out = { mobile_money: [], bank: [], card: [] } as ProviderSettings;
  for (const m of PAYMENT_METHODS) {
    const list = v[m];
    if (!Array.isArray(list)) return DEFAULT_PROVIDER_SETTINGS;
    out[m] = [...new Set(list.filter(isProvider))].filter((p) => !(m === 'card' && p === 'manual_lipa'));
  }
  return out;
}

export type PaymentSwitches = { manual: boolean; live: boolean; depositsViaLipa: boolean };

/** What a provider can do. The adapters below add how. */
export type ProviderInfo = {
  id: PaymentProviderKey;
  name: string;
  mode: 'manual' | 'hosted';
  methods: readonly PaymentMethod[];
  /** How a payment becomes paid: an admin checks the statement, or the provider's signed callback. */
  confirmation: 'admin_queue' | 'webhook';
  /** Purposes this provider can take today. */
  purposes: readonly PaymentPurpose[];
  /** Whether code to talk to this provider exists (an Edge Function adapter for hosted ones). */
  built: boolean;
};

export const PROVIDER_INFO: Record<PaymentProviderKey, ProviderInfo> = {
  manual_lipa: { id: 'manual_lipa', name: 'Lipa number', mode: 'manual', methods: ['mobile_money', 'bank'], confirmation: 'admin_queue', purposes: PAYMENT_PURPOSES, built: true },
  flutterwave: { id: 'flutterwave', name: 'Flutterwave', mode: 'hosted', methods: ['mobile_money', 'card', 'bank'], confirmation: 'webhook', purposes: ['offer_deposit', 'group_deposit'], built: true },
  azampay: { id: 'azampay', name: 'AzamPay', mode: 'hosted', methods: ['mobile_money', 'bank'], confirmation: 'webhook', purposes: [], built: false },
  selcom: { id: 'selcom', name: 'Selcom', mode: 'hosted', methods: ['mobile_money', 'card'], confirmation: 'webhook', purposes: [], built: false },
  pesapal: { id: 'pesapal', name: 'Pesapal', mode: 'hosted', methods: ['mobile_money', 'card'], confirmation: 'webhook', purposes: [], built: false },
};

/** Whether a provider may take a payment now (same rule as private.provider_for in the database). */
export function providerUsable(id: PaymentProviderKey, purpose: PaymentPurpose | null, switches: PaymentSwitches): boolean {
  const info = PROVIDER_INFO[id];
  if (purpose && isDepositPurpose(purpose) && id === 'manual_lipa' && !switches.depositsViaLipa) return false;
  if (info.mode === 'manual') return switches.manual;
  return switches.live && info.built && (purpose === null || info.purposes.includes(purpose));
}

/** The provider that takes this method for this purpose now, or null. */
export function providerFor(settings: ProviderSettings, method: PaymentMethod, purpose: PaymentPurpose | null, switches: PaymentSwitches): PaymentProviderKey | null {
  return settings[method].find((id) => providerUsable(id, purpose, switches)) ?? null;
}

/** Whether a payment for this purpose can start by Lipa number now. */
export function lipaOpen(settings: ProviderSettings, purpose: PaymentPurpose, switches: PaymentSwitches): boolean {
  return providerFor(settings, 'mobile_money', purpose, switches) === 'manual_lipa' || providerFor(settings, 'bank', purpose, switches) === 'manual_lipa';
}

// ---------------------------------------------------------------------------
// The provider interface (create, instructions, confirm, refund note), shared by the website and app.
// ---------------------------------------------------------------------------

/** The smallest part of a Supabase client the adapters need. */
import type { PaymentPlatform } from './payment-chooser';

export type RpcClient = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
};

export type StartPayment = {
  purpose: PaymentPurpose;
  /** Business (badge, commission), offer or group member id. Never an amount: the server works it out. */
  subject?: string | null;
  period?: 'month' | 'year' | null;
  accountType?: string | null;
  month?: string | null;
  locale: string;
  /** What the client runs on; only picks the app-store route on the server. */
  platform?: PaymentPlatform;
};

export type StartResult =
  | { kind: 'instructions'; reference: string }
  | { kind: 'redirect'; url: string }
  | { kind: 'error'; code: string };

export type LipaNumber = { id: string; network: LipaNetwork; lipa_number: string; business_name: string; bank_name: string | null; menu_hint: string | null };

export type PaymentProviderAdapter = {
  info: ProviderInfo;
  /** Creates (or reopens) the payment on the server. */
  createPayment(client: RpcClient, request: StartPayment, hosted?: (request: StartPayment) => Promise<StartResult>): Promise<StartResult>;
  /** Manual providers: the numbers to pay to, by network. Hosted providers: null (their own page). */
  instructions(numbers: readonly LipaNumber[]): Record<LipaNetwork, LipaNumber[]> | null;
  /** Dictionary key of the refund line shown to payers (lipa-pay.ts refundNotes). */
  refundNote: 'manual' | 'hosted';
};

/** Short codes for database refusals, for fixed texts on screen (never the raw message). */
export function paymentErrorCode(message: string | null | undefined): string {
  const m = message ?? '';
  const known = ['not_in_app', 'use_website', 'provider_not_live', 'use_hosted_checkout', 'not_configured', 'rate_limited', 'payments_off', 'no_lipa_method', 'crew_fees_not_open', 'checks_first', 'price_not_set', 'billing_off',
    'nothing_to_pay', 'deposits_off', 'rate_not_set', 'rate_too_old', 'deposit_not_allowed', 'claim_waiting', 'order_closed',
    'transaction_format', 'phone_format', 'too_many_claims'];
  const hit = known.find((k) => m.includes(k));
  if (hit) return hit;
  if (/order not found/.test(m)) return 'not_found';
  if (/duplicate key|already pending|payments_one_pending/.test(m)) return 'pending_elsewhere';
  return 'failed';
}

function byNetwork(numbers: readonly LipaNumber[]): Record<LipaNetwork, LipaNumber[]> {
  const out = Object.fromEntries(LIPA_NETWORKS.map((n) => [n, [] as LipaNumber[]])) as Record<LipaNetwork, LipaNumber[]>;
  for (const n of numbers) if ((LIPA_NETWORKS as readonly string[]).includes(n.network)) out[n.network].push(n);
  return out;
}

const manualLipa: PaymentProviderAdapter = {
  info: PROVIDER_INFO.manual_lipa,
  async createPayment(client, r) {
    const { data, error } = await client.rpc('start_payment_order', {
      p_purpose: r.purpose,
      p_subject: r.subject ?? null,
      p_period: r.period ?? null,
      p_account_type: r.accountType ?? null,
      p_month: r.month ?? null,
      p_provider: 'manual_lipa',
      p_platform: r.platform ?? 'web',
    });
    if (error) return { kind: 'error', code: paymentErrorCode(error.message) };
    const row = (Array.isArray(data) ? data[0] : data) as { reference?: unknown } | undefined;
    return typeof row?.reference === 'string' && isPaymentReference(row.reference)
      ? { kind: 'instructions', reference: row.reference }
      : { kind: 'error', code: 'failed' };
  },
  instructions: byNetwork,
  refundNote: 'manual',
};

function hostedAdapter(id: Exclude<PaymentProviderKey, 'manual_lipa'>): PaymentProviderAdapter {
  return {
    info: PROVIDER_INFO[id],
    async createPayment(_client, r, hosted) {
      if (!PROVIDER_INFO[id].built || !PROVIDER_INFO[id].purposes.includes(r.purpose) || !hosted) return { kind: 'error', code: 'not_configured' };
      return hosted(r);
    },
    instructions: () => null,
    refundNote: 'hosted',
  };
}

export const PAYMENT_ADAPTERS: Record<PaymentProviderKey, PaymentProviderAdapter> = {
  manual_lipa: manualLipa,
  flutterwave: hostedAdapter('flutterwave'),
  azampay: hostedAdapter('azampay'),
  selcom: hostedAdapter('selcom'),
  pesapal: hostedAdapter('pesapal'),
};

// ---------------------------------------------------------------------------
// Formats (the database checks the same patterns)
// ---------------------------------------------------------------------------
/** KW + 6 of 23456789ABCDEFGHJKMNPQRSTUVWXYZ. */
export const PAYMENT_REFERENCE_PATTERN = /^KW[2-9A-HJKMNP-Z]{6}$/;
export const isPaymentReference = (v: unknown): v is string => typeof v === 'string' && PAYMENT_REFERENCE_PATTERN.test(v);

/**
 * Transaction ID as typed, for display: upper case, no spaces, no leading or trailing punctuation;
 * null when it cannot be one. The database checks the same pattern.
 */
export function normalizeTransactionId(raw: string | null | undefined): string | null {
  const t = (raw ?? '').replace(/\s/g, '').toUpperCase();
  return /^[A-Z0-9][A-Z0-9._-]{4,38}[A-Z0-9]$/.test(t) && transactionKey(t).length >= 6 ? t : null;
}

/**
 * The key every duplicate check uses (payment_claims.transaction_key): only A-Z and 0-9, so
 * "QK12-AB34CD", "qk12ab34cd." and "QK12AB34CD" are the same transaction (security review H1).
 */
export const transactionKey = (raw: string | null | undefined): string => (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** For the admin look-alike warning only: O read as 0, I and L as 1 (payment_claims.transaction_loose). */
export const transactionLooseKey = (raw: string | null | undefined): string => transactionKey(raw).replace(/O/g, '0').replace(/[IL]/g, '1');

/** Tanzanian mobile number as 255XXXXXXXXX (06.. or 07..), or null. */
export function normalizeTzMobile(raw: string | null | undefined): string | null {
  const d = (raw ?? '').replace(/\D/g, '');
  if (/^255[67]\d{8}$/.test(d)) return d;
  if (/^0[67]\d{8}$/.test(d)) return `255${d.slice(1)}`;
  if (/^[67]\d{8}$/.test(d)) return `255${d}`;
  return null;
}

/** "+255 7** *** 678". */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  return /^255\d{9}$/.test(phone) ? `+255 ${phone[3]}** *** ${phone.slice(-3)}` : `***${phone.slice(-3)}`;
}

/** "TZS 150,000" with whole shillings (bigint-safe numbers or digit strings). */
export function formatTzsAmount(amount: number | string | null | undefined): string {
  const text = typeof amount === 'number' ? (Number.isSafeInteger(amount) ? String(amount) : '') : String(amount ?? '');
  if (!/^\d{1,15}$/.test(text)) return 'TZS';
  return `TZS ${text.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export type PaymentOrderStatus = 'awaiting_payment' | 'submitted' | 'wrong_amount' | 'confirmed' | 'cancelled' | 'received_not_applied';
export type PaymentClaimStatus = 'waiting' | 'confirmed' | 'rejected' | 'wrong_amount';
export type PaymentRejectReason = 'not_found' | 'wrong_reference' | 'wrong_network' | 'duplicate' | 'other';

/** One row of public.my_payment_orders(). */
export type MyPaymentOrder = {
  reference: string;
  purpose: PaymentPurpose;
  account_type: string | null;
  period: 'month' | 'year' | null;
  provider_id: string | null;
  amount_tzs: number;
  amount_usd: number | string | null;
  /** The rate saved on the order (deposits), with its source; never today's rate. */
  usd_tzs_rate: number | string | null;
  rate_source: string | null;
  status: PaymentOrderStatus;
  status_reason: string | null;
  created_at: string;
  confirmed_at: string | null;
  claim_network: LipaNetwork | null;
  claim_transaction_id: string | null;
  claim_phone: string | null;
  claim_status: PaymentClaimStatus | null;
  claim_reason: PaymentRejectReason | null;
  claim_note: string | null;
  received_tzs: number | null;
  claims_count: number;
  refund_due: boolean;
  /** Kwetuly's commission on a deposit from the business's agreement; null = "as agreed". */
  commission_pct: number | string | null;
  commission_tzs: number | null;
};

/**
 * Kwetuly's commission in whole TZS from an amount and a percent text such as "10" or "12.50",
 * rounded half up (the same as the database's round()). BigInt only. null when not computable.
 */
export function commissionTzs(amountTzs: number, pctText: string | number | null | undefined): number | null {
  const m = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(String(pctText ?? '').trim());
  if (!m || !Number.isSafeInteger(amountTzs) || amountTzs <= 0) return null;
  const pct100 = BigInt(m[1]) * BigInt(100) + BigInt((m[2] ?? '').padEnd(2, '0'));
  if (pct100 <= BigInt(0) || pct100 > BigInt(10000)) return null;
  return Number((BigInt(amountTzs) * pct100 + BigInt(5000)) / BigInt(10000));
}

/** "10" or "12.5" for display, from a numeric(5,2) value. */
export const pctText = (pct: string | number): string => String(Number(pct));
