import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROVIDER_SETTINGS,
  PAYMENT_PROVIDER_IDS,
  PAYMENT_REFERENCE_PATTERN,
  formatTzsAmount,
  isPaymentReference,
  lipaOpen,
  maskPhone,
  normalizeTransactionId,
  normalizeTzMobile,
  parseProviderSettings,
  paymentErrorCode,
  providerFor,
  commissionTzs,
  transactionKey,
  transactionLooseKey,
} from './payment-methods';
import { depositTzs } from './payment-rules';
import { appMayShowPay, depositTzsFromRateText, canPick, orderMethods, parseMethodRows, STORE_ROUTES, tzsToUsdCents, viewerCurrency, type PaymentMethodRow } from './payment-chooser';
import { LIPA_PAY_TEXT } from './dictionaries/lipa-pay';
import { PAY_CHOOSER_TEXT } from './dictionaries/pay-chooser';

const file = (name: string) => new URL(`../../../supabase/migrations/${name}`, import.meta.url);
const part1 = readFileSync(file('20261126001000_payment_methods_and_lipa_numbers.sql'), 'utf8');
const part2 = readFileSync(file('20261126001100_manual_lipa_orders.sql'), 'utf8');
const part3 = readFileSync(file('20261126001200_payment_method_registry.sql'), 'utf8');
const part4 = readFileSync(file('20261126001300_lipa_close_refund_retention.sql'), 'utf8');
const all = part1 + part2 + part3 + part4;

const on = { manual: true, live: false, depositsViaLipa: true };

describe('migrations', () => {
  it('stay under 60KB each', () => {
    for (const n of ['20261126001000_payment_methods_and_lipa_numbers.sql', '20261126001100_manual_lipa_orders.sql', '20261126001200_payment_method_registry.sql', '20261126001300_lipa_close_refund_retention.sql']) {
      expect(statSync(file(n)).size).toBeLessThan(60 * 1024);
    }
  });
  it('seed no Lipa number and never switch payments_live on', () => {
    // Only the admin function inserts numbers (from its parameters); no literal seed row.
    expect(all).not.toMatch(/insert into public\.payment_numbers[^;]*values\s*\(\s*'/);
    expect(all).not.toMatch(/feature\.payments_live', '\{"on": true\}'/);
  });
  it('use the same reference pattern as the database', () => {
    expect(part2).toContain(`reference ~ '${PAYMENT_REFERENCE_PATTERN.source}'`);
  });
  it('know every provider id the shared code knows', () => {
    for (const id of PAYMENT_PROVIDER_IDS) expect(part3).toContain(`'${id}'`);
  });
  it('confirm only as an admin with an idempotency key and never on one\'s own payment', () => {
    const fn = part2.match(/create or replace function public\.admin_confirm_payment[\s\S]*?\n\$\$;/)![0];
    expect(fn).toContain('private.is_admin()');
    expect(fn).toContain('p_idempotency_key');
    expect(fn).toContain("'own payment'");
    expect(fn).toContain('already_confirmed');
  });
  it('block duplicate transaction IDs over all claims', () => {
    expect(part2).toContain('create unique index if not exists payment_claims_transaction_unique on public.payment_claims (transaction_key);');
  });
  it('give payers no write access to orders or claims', () => {
    expect(part2).toContain('revoke all on public.payment_orders from public, anon, authenticated;');
    expect(part2).toContain('revoke all on public.payment_claims from public, anon, authenticated;');
  });
  it('gate each Lipa charge path with its own switch, and need the payments_live lock (M1)', () => {
    expect(all).not.toMatch(/create or replace function private\.(manual_payments_on|money_feature_on)/);
    expect(part1).toContain("to_regprocedure('private.site_settings_feature_guard()') is null");
    expect(all).not.toMatch(/manual_payments_on\(\)/);
    expect(part3).toContain('private.manual_payments_on(private.payment_feature_id(p_purpose))');
  });
  it('checks duplicates on the normalised key (H1)', () => {
    expect(part2).toContain('payment_claims_transaction_unique on public.payment_claims (transaction_key)');
    expect(part2).toContain("c.transaction_key = v_key");
  });
  it('never extends the badge by paying (M3) and never stores the payer ID on payments (L9)', () => {
    const fn = part2.match(/create or replace function private\.apply_payment_effect[\s\S]*?\n\$\$;/)![0];
    expect(fn).not.toMatch(/badge_valid_until\s*=/);
    expect(fn).toContain('provider_transaction_id = o.reference');
  });
  it('keeps the deposits switch on one marked line', () => {
    expect(part1.match(/^insert into public\.site_settings \(key, value\) values \('feature\.deposits_via_kwetuly_lipa', '\{"on": (true|false)\}'\) on conflict \(key\) do nothing;$/m)).not.toBeNull();
  });
  it('store routes match the shared list', () => {
    for (const r of STORE_ROUTES) expect(part1).toContain(`@ == "${r}"`);
  });
  it('has a rolled-back checks file', () => {
    const checks = new URL('../../../supabase/checks/manual_lipa_payments_tests.sql', import.meta.url);
    expect(existsSync(checks)).toBe(true);
    expect(readFileSync(checks, 'utf8').trim().toLowerCase().endsWith('rollback;')).toBe(true);
  });
});

describe('formats', () => {
  it('references', () => {
    expect(isPaymentReference('KW7F3K9Q')).toBe(true);
    expect(isPaymentReference('KW7F3K9O')).toBe(false);
    expect(isPaymentReference('kw7f3k9q')).toBe(false);
  });
  it('transaction ids', () => {
    expect(normalizeTransactionId(' qk12 abc3de ')).toBe('QK12ABC3DE');
    expect(normalizeTransactionId('ab')).toBeNull();
    expect(normalizeTransactionId('<script>')).toBeNull();
    expect(normalizeTransactionId('-QK12AB34CD')).toBeNull();
    expect(normalizeTransactionId('QK12AB34CD.')).toBeNull();
    expect(normalizeTransactionId('QK12-AB34CD')).toBe('QK12-AB34CD');
  });
  it('one key for punctuation and case (H1)', () => {
    expect(transactionKey('QK12-AB34CD')).toBe('QK12AB34CD');
    expect(transactionKey('qk12.ab34cd')).toBe('QK12AB34CD');
    expect(transactionLooseKey('QKI2-ABO4CD')).toBe(transactionLooseKey('QK12AB04CD'));
    expect(transactionLooseKey('L0O')).toBe('100');
  });
  it('phones', () => {
    expect(normalizeTzMobile('0712 345 678')).toBe('255712345678');
    expect(normalizeTzMobile('+255 612 345 678')).toBe('255612345678');
    expect(normalizeTzMobile('712345678')).toBe('255712345678');
    expect(normalizeTzMobile('0222 123 456')).toBeNull();
    expect(maskPhone('255712345678')).toBe('+255 7** *** 678');
  });
  it('TZS amounts', () => {
    expect(formatTzsAmount(150000)).toBe('TZS 150,000');
    expect(formatTzsAmount('1234567')).toBe('TZS 1,234,567');
    expect(formatTzsAmount(1.5)).toBe('TZS');
  });
  it('USD estimate with integer maths', () => {
    expect(tzsToUsdCents(265000, '2650')).toBe(10000);
    expect(tzsToUsdCents(100000, '2650.75')).toBe(3773);
    expect(tzsToUsdCents(100000, 'abc')).toBeNull();
    expect(tzsToUsdCents(-1, '2650')).toBeNull();
  });
  it('commission in whole shillings, half up', () => {
    expect(commissionTzs(795000, '10')).toBe(79500);
    expect(commissionTzs(1005, '12.50')).toBe(126);
    expect(commissionTzs(1000, '0')).toBeNull();
    expect(commissionTzs(1000, 'x')).toBeNull();
  });
  it('deposit amount matches depositTzs and the database rule', () => {
    expect(depositTzsFromRateText(123456, '2650.75')).toBe(depositTzs(123456, 265075));
    expect(depositTzsFromRateText(100, '2600')).toBe(2600);
    expect(depositTzsFromRateText(100, 'x')).toBeNull();
  });
  it('viewer currency', () => {
    expect(viewerCurrency('TZ', 'en')).toBeNull();
    expect(viewerCurrency('DE', 'en')).toBe('EUR');
    expect(viewerCurrency(null, 'pl')).toBe('PLN');
  });
  it('error codes are fixed', () => {
    expect(paymentErrorCode('rate_limited')).toBe('rate_limited');
    expect(paymentErrorCode('something secret')).toBe('failed');
  });
});

describe('providers', () => {
  it('parse settings safely', () => {
    expect(parseProviderSettings(null)).toEqual(DEFAULT_PROVIDER_SETTINGS);
    expect(parseProviderSettings({ mobile_money: ['evil', 'manual_lipa'], bank: [], card: ['manual_lipa', 'flutterwave'] }))
      .toEqual({ mobile_money: ['manual_lipa'], bank: [], card: ['flutterwave'] });
  });
  it('hosted providers need payments_live', () => {
    const s = { mobile_money: ['flutterwave', 'manual_lipa'], bank: [], card: ['flutterwave'] } as const;
    const settings = { mobile_money: [...s.mobile_money], bank: [], card: [...s.card] };
    expect(providerFor(settings, 'mobile_money', 'offer_deposit', on)).toBe('manual_lipa');
    expect(providerFor(settings, 'card', 'offer_deposit', on)).toBeNull();
    expect(providerFor(settings, 'card', 'offer_deposit', { ...on, live: true })).toBe('flutterwave');
  });
  it('Lipa deposits have their own switch', () => {
    expect(lipaOpen(DEFAULT_PROVIDER_SETTINGS, 'offer_deposit', on)).toBe(true);
    expect(lipaOpen(DEFAULT_PROVIDER_SETTINGS, 'offer_deposit', { ...on, depositsViaLipa: false })).toBe(false);
    expect(lipaOpen(DEFAULT_PROVIDER_SETTINGS, 'verification', { ...on, depositsViaLipa: false })).toBe(true);
  });
});

describe('chooser', () => {
  const rows: PaymentMethodRow[] = parseMethodRows([
    { id: 'flutterwave', display_name: 'Flutterwave', methods: ['card'], badges: ['visa'], sort: 10, state: 'coming_soon', route: 'third_party_in_app', purchase_kind: 'real_world_service' },
    { id: 'manual_lipa', display_name: 'Lipa number', methods: ['mobile_money'], badges: ['mpesa', 'nope'], sort: 0, state: 'live', route: 'third_party_in_app', purchase_kind: 'real_world_service' },
    { id: 'pesapal', display_name: 'Pesapal', methods: ['card'], badges: [], sort: 40, state: 'live', route: 'third_party_in_app', purchase_kind: 'real_world_service' },
    { id: 'evil', display_name: 'x', methods: [], badges: [], sort: 0, state: 'live', route: 'third_party_in_app' },
  ]);
  it('drops unknown rows and badges', () => {
    expect(rows.map((r) => r.id)).toEqual(['flutterwave', 'manual_lipa', 'pesapal']);
    expect(rows[1].badges).toEqual(['mpesa']);
  });
  it('puts the last-used live method first, coming soon last', () => {
    expect(orderMethods(rows, 'pesapal').map((r) => r.id)).toEqual(['pesapal', 'manual_lipa', 'flutterwave']);
    expect(orderMethods(rows, 'flutterwave').map((r) => r.id)).toEqual(['manual_lipa', 'pesapal', 'flutterwave']);
  });
  it('never lets a coming-soon or web-only row be picked', () => {
    expect(canPick(rows[0])).toBe(false);
    expect(canPick(rows[1])).toBe(true);
    expect(canPick({ ...rows[1], route: 'web_only' })).toBe(false);
  });
  it('the app shows no pay button without server rows', () => {
    expect(appMayShowPay([])).toBe(false);
    expect(appMayShowPay(null)).toBe(false);
    expect(appMayShowPay(rows)).toBe(true);
  });
});

describe('payer texts', () => {
  it('every language has the same keys and step count', () => {
    const keys = Object.keys(LIPA_PAY_TEXT.en).sort();
    for (const t of Object.values(LIPA_PAY_TEXT)) {
      expect(Object.keys(t).sort()).toEqual(keys);
      expect(t.stepsMobile).toHaveLength(LIPA_PAY_TEXT.en.stepsMobile.length);
    }
    const chooserKeys = Object.keys(PAY_CHOOSER_TEXT.en).sort();
    for (const t of Object.values(PAY_CHOOSER_TEXT)) expect(Object.keys(t).sort()).toEqual(chooserKeys);
  });
  it('no all caps and no arrows', () => {
    const text = JSON.stringify([LIPA_PAY_TEXT, PAY_CHOOSER_TEXT]);
    expect(text).not.toMatch(/[→➔➜]/);
    expect(text).not.toMatch(/\b[A-Z]{6,}\b/);
  });
});
