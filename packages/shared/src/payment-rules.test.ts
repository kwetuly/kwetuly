import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  centsToUsd,
  decideDeposit,
  depositTzs,
  isAllowedPaymentUrl,
  isOrderId,
  invalidEventKey,
  parseWebhookMode,
  pickPayload,
  successfulAttemptId,
  parseMoney2,
  parseRateHundredths,
  parseWholeTzs,
  readWebhook,
  verifyFlutterwaveWebhook,
  type ProviderTx,
} from './payment-rules';

const ORDER = `RAF${'a1'.repeat(16)}`;
const LIMITS = { sessionMs: 60 * 60_000, graceMs: 10 * 60_000, staleMs: 24 * 3600_000 };
const ok = (over: Partial<Extract<ProviderTx, { found: true }>> = {}): ProviderTx => ({
  found: true,
  status: 'successful',
  txRef: ORDER,
  amount: 260000,
  chargedAmount: 260000,
  currency: 'TZS',
  ...over,
});
const decide = (tx: ProviderTx, stored: 'pending' | 'failed' = 'pending', ageMs = 5 * 60_000) =>
  decideDeposit({ stored, orderId: ORDER, amountTzs: 260000, ageMs, tx, limits: LIMITS });

describe('the Edge Function copy', () => {
  it('is identical to this file', () => {
    const block = (path: URL) => {
      const text = readFileSync(fileURLToPath(path), 'utf8').replace(/\r\n/g, '\n');
      const start = text.indexOf('// BEGIN payment-rules');
      const end = text.indexOf('// END payment-rules');
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeGreaterThan(start);
      return text.slice(start, end);
    };
    const shared = block(new URL('./payment-rules.ts', import.meta.url));
    const edge = block(new URL('../../../supabase/functions/payments/index.ts', import.meta.url));
    expect(edge).toBe(shared);
  });
});

describe('order ids', () => {
  it('accepts only RAF + 32 lower-case hex', () => {
    expect(isOrderId(ORDER)).toBe(true);
    expect(isOrderId(`RAF${'A'.repeat(32)}`)).toBe(false);
    expect(isOrderId('RAF1730000000001234')).toBe(false);
    expect(isOrderId(`${ORDER}x`)).toBe(false);
    expect(isOrderId(42)).toBe(false);
  });
});

describe('amounts', () => {
  it('parses the rate into hundredths without floats', () => {
    expect(parseRateHundredths('2600')).toBe(260000);
    expect(parseRateHundredths('2650.75')).toBe(265075);
    expect(parseRateHundredths('2650.7')).toBe(265070);
    expect(parseRateHundredths(' 2600 ')).toBe(260000);
    for (const bad of ['', '0', '-2600', '2,600', '2600.123', 'abc', '1e3', null, undefined]) expect(parseRateHundredths(bad)).toBeNull();
  });

  it('works out shillings exactly, rounded up to the next 100', () => {
    expect(depositTzs(10000, 260000)).toBe(260000); // USD 100.00 at 2600
    expect(depositTzs(30000, 260000)).toBe(780000);
    expect(depositTzs(12345, 265075)).toBe(327300); // 327235.0875 -> 327300
    expect(depositTzs(1, 260000)).toBe(100);
    expect(depositTzs(50_000_000, 99_999_999)).toBe(499_999_995_000); // large but still exact
    expect(() => depositTzs(10.5, 260000)).toThrow(RangeError);
    expect(() => depositTzs(0, 260000)).toThrow(RangeError);
    expect(() => depositTzs(Number.MAX_SAFE_INTEGER, 260000)).toThrow(RangeError);
  });

  it('writes cents as exact dollars', () => {
    expect(centsToUsd(12345)).toBe('123.45');
    expect(centsToUsd(5)).toBe('0.05');
    expect(centsToUsd(10000)).toBe('100.00');
    expect(() => centsToUsd(1.5)).toThrow(RangeError);
  });

  it('reads whole shillings and 2-decimal amounts only', () => {
    expect(parseWholeTzs(260000)).toBe(260000);
    expect(parseWholeTzs('260,000.00')).toBe(260000);
    expect(parseWholeTzs(260000.5)).toBeNull();
    expect(parseWholeTzs('260000.5')).toBeNull();
    expect(parseWholeTzs(-1)).toBeNull();
    expect(parseWholeTzs(null)).toBeNull();
    expect(parseMoney2(7670)).toBe('7670');
    expect(parseMoney2(14726.4)).toBe('14726.4');
    expect(parseMoney2('14726.40')).toBe('14726.40');
    expect(parseMoney2(0.1 + 0.2)).toBeNull();
    expect(parseMoney2(-3)).toBeNull();
    expect(parseMoney2('1e5')).toBeNull();
  });
});

describe('decideDeposit', () => {
  it('pays only an exact TZS success for this order, charged without a fee to the traveller', () => {
    expect(decide(ok())).toEqual({ status: 'paid', reason: 'paid' });
    expect(decide(ok({ amount: '260000.00', chargedAmount: '260000', currency: 'tzs' })).status).toBe('paid');
  });

  it('holds every other success for review', () => {
    expect(decide(ok({ currency: 'USD' })).reason).toBe('currency_mismatch');
    expect(decide(ok({ currency: undefined })).reason).toBe('currency_mismatch');
    expect(decide(ok({ amount: 259900 })).reason).toBe('amount_mismatch');
    expect(decide(ok({ amount: 260000.5 })).reason).toBe('amount_mismatch');
    expect(decide(ok({ chargedAmount: 267670 })).reason).toBe('fee_charged_to_payer');
    expect(decide(ok({ chargedAmount: 250000 })).reason).toBe('amount_mismatch');
    expect(decide(ok({ chargedAmount: undefined })).reason).toBe('charged_unknown');
    for (const tx of [ok({ currency: 'USD' }), ok({ chargedAmount: 267670 })]) expect(decide(tx).status).toBe('review');
  });

  it('ignores a provider answer for another reference', () => {
    expect(decide(ok({ txRef: `RAF${'b2'.repeat(16)}` }))).toEqual({ status: 'pending', reason: 'reference_mismatch' });
    expect(decide(ok({ txRef: `RAF${'b2'.repeat(16)}` }), 'failed').status).toBe('failed');
  });

  it('sends a success on a given-up order to review', () => {
    expect(decide(ok(), 'failed')).toEqual({ status: 'review', reason: 'paid_after_failed' });
    expect(decide(ok({ amount: 1 }), 'failed').status).toBe('review');
    expect(decide({ found: false }, 'failed').status).toBe('failed');
    expect(decide(ok({ status: 'failed' }), 'failed').status).toBe('failed');
  });

  it('keeps an order open while the hosted page can still be paid', () => {
    expect(decide({ found: false })).toEqual({ status: 'pending', reason: 'open' });
    expect(decide(ok({ status: 'failed' }))).toEqual({ status: 'pending', reason: 'open' });
    expect(decide(ok({ status: 'cancelled' }))).toEqual({ status: 'pending', reason: 'open' });
  });

  it('gives up after the session and grace, or a day for a payment still pending at the provider', () => {
    const after = 71 * 60_000;
    expect(decide({ found: false }, 'pending', after)).toEqual({ status: 'failed', reason: 'expired' });
    expect(decide(ok({ status: 'failed' }), 'pending', after).status).toBe('failed');
    expect(decide(ok({ status: 'pending' }), 'pending', after)).toEqual({ status: 'pending', reason: 'open' });
    expect(decide(ok({ status: 'pending' }), 'pending', 25 * 3600_000)).toEqual({ status: 'failed', reason: 'stale' });
  });

  it('holds an expired order for review when an attempt exists but not all attempts could be listed', () => {
    const run = (tx: ProviderTx) =>
      decideDeposit({ stored: 'pending', orderId: ORDER, amountTzs: 260000, ageMs: 71 * 60_000, tx, limits: LIMITS, attemptsUnclear: true });
    expect(run(ok({ status: 'failed' }))).toEqual({ status: 'review', reason: 'attempts_unclear' });
    expect(run({ found: false })).toEqual({ status: 'failed', reason: 'expired' });
    expect(run(ok())).toEqual({ status: 'paid', reason: 'paid' });
  });
});

describe('isAllowedPaymentUrl', () => {
  it('accepts https pages on Flutterwave subdomains', () => {
    expect(isAllowedPaymentUrl('https://checkout.flutterwave.com/v3/hosted/pay/abc123')).toBe(true);
    // Another domain (e.g. a test-mode host) is refused until it is added after the sandbox shows it.
    expect(isAllowedPaymentUrl('https://checkout-v2.dev-flutterwave.com/x')).toBe(false);
    expect(isAllowedPaymentUrl('https://Checkout.Flutterwave.COM:443/p?x=1#y')).toBe(true);
  });

  it('refuses other schemes, lookalikes, userinfo, ports and odd characters', () => {
    for (const bad of [
      'http://checkout.flutterwave.com/p',
      'javascript:alert(1)//checkout.flutterwave.com',
      '//checkout.flutterwave.com/p',
      'https://flutterwave.com/p',
      'https://flutterwave.com.evil.com/p',
      'https://evilflutterwave.com/p',
      'https://checkout.flutterwave.com@evil.com/p',
      'https://evil.com@checkout.flutterwave.com/p',
      'https://evil.com\\.flutterwave.com/p',
      'https://checkout%2eflutterwave.com/p',
      'https://checkout.flutterwave.com:8443/p',
      'https://checkout.flutterwave.com./p',
      'https://192.168.1.1/p',
      ' https://checkout.flutterwave.com/p',
      'https://checkout.flutterwave.com/a b',
      'https://checkout.flutterwavе.com/p', // Cyrillic е
      `https://checkout.flutterwave.com/${'a'.repeat(2048)}`,
      '',
      null,
      42,
    ]) {
      expect(isAllowedPaymentUrl(bad)).toBe(false);
    }
  });
});

describe('verifyFlutterwaveWebhook', () => {
  const v4 = 'v4-signing-secret-0123456789abcdef0123';
  const v3 = 'v3-secret-hash-0123456789abcdef012345';
  const body = JSON.stringify({ event: 'charge.completed', data: { id: 1, tx_ref: ORDER } });
  const signature = createHmac('sha256', v4).update(body).digest('base64');

  it('v4: accepts only a correct HMAC signature made with the v4 secret', async () => {
    expect(await verifyFlutterwaveWebhook(body, { signature, verifHash: null }, { mode: 'v4', secret: v4 })).toBe(true);
    expect(await verifyFlutterwaveWebhook(`${body} `, { signature, verifHash: null }, { mode: 'v4', secret: v4 })).toBe(false);
    const withV3Key = createHmac('sha256', v3).update(body).digest('base64');
    expect(await verifyFlutterwaveWebhook(body, { signature: withV3Key, verifHash: null }, { mode: 'v4', secret: v4 })).toBe(false);
  });

  it('v4: never falls back to verif-hash, and an empty signature header is invalid', async () => {
    expect(await verifyFlutterwaveWebhook(body, { signature: '', verifHash: v4 }, { mode: 'v4', secret: v4 })).toBe(false);
    expect(await verifyFlutterwaveWebhook(body, { signature: null, verifHash: v4 }, { mode: 'v4', secret: v4 })).toBe(false);
    expect(await verifyFlutterwaveWebhook(body, { signature: '   ', verifHash: null }, { mode: 'v4', secret: v4 })).toBe(false);
  });

  it('v3: accepts only the v3 secret hash in verif-hash, never a signature', async () => {
    expect(await verifyFlutterwaveWebhook(body, { signature: null, verifHash: v3 }, { mode: 'v3', secret: v3 })).toBe(true);
    expect(await verifyFlutterwaveWebhook(body, { signature: null, verifHash: `${v3}x` }, { mode: 'v3', secret: v3 })).toBe(false);
    expect(await verifyFlutterwaveWebhook(body, { signature: null, verifHash: '' }, { mode: 'v3', secret: v3 })).toBe(false);
    const sig3 = createHmac('sha256', v3).update(body).digest('base64');
    expect(await verifyFlutterwaveWebhook(body, { signature: sig3, verifHash: null }, { mode: 'v3', secret: v3 })).toBe(false);
  });

  it('refuses everything without a mode or with a short secret', async () => {
    expect(await verifyFlutterwaveWebhook(body, { signature, verifHash: v3 }, { mode: null, secret: v4 })).toBe(false);
    expect(await verifyFlutterwaveWebhook(body, { signature: null, verifHash: 'short' }, { mode: 'v3', secret: 'short' })).toBe(false);
    expect(parseWebhookMode('v3')).toBe('v3');
    expect(parseWebhookMode('V4')).toBeNull();
    expect(parseWebhookMode(undefined)).toBeNull();
  });
});

describe('invalidEventKey', () => {
  it('gives one key per order per hour', () => {
    const t = Date.parse('2026-11-22T10:15:00Z');
    expect(invalidEventKey(ORDER, t)).toBe(`invalid:${ORDER}:2026-11-22T10`);
    expect(invalidEventKey(ORDER, t + 40 * 60_000)).toBe(invalidEventKey(ORDER, t));
    expect(invalidEventKey(ORDER, t + 50 * 60_000)).not.toBe(invalidEventKey(ORDER, t));
  });
});

describe('successfulAttemptId', () => {
  it('finds a successful attempt for this order only', () => {
    const list = [
      { id: 11, tx_ref: ORDER, status: 'failed' },
      { id: 12, tx_ref: `RAF${'b2'.repeat(16)}`, status: 'successful' },
      { id: 13, tx_ref: ORDER, status: 'successful' },
    ];
    expect(successfulAttemptId(list, ORDER)).toBe('13');
    expect(successfulAttemptId(list.slice(0, 2), ORDER)).toBeNull();
    expect(successfulAttemptId([{ id: '1; x', tx_ref: ORDER, status: 'successful' }], ORDER)).toBeNull();
    expect(successfulAttemptId(null, ORDER)).toBeNull();
  });
});

describe('readWebhook', () => {
  it('reads only the lookup keys', () => {
    expect(readWebhook({ event: 'charge.completed', data: { id: 285959875, tx_ref: ORDER, status: 'successful', amount: 1 } })).toEqual({
      eventKey: 'charge.completed:285959875:successful',
      eventType: 'charge.completed',
      txRef: ORDER,
      transactionId: '285959875',
    });
    expect(readWebhook({ webhook_id: 'wbk_1', type: 'charge.completed', data: { reference: ORDER } }).eventKey).toBe('wbk_1');
  });

  it('drops references and ids that are not ours or not plain', () => {
    const ref = readWebhook({ event: 'charge.completed', data: { id: '1; drop table', tx_ref: 'RAF1' } });
    expect(ref.txRef).toBeNull();
    expect(ref.transactionId).toBeNull();
    expect(readWebhook(null)).toEqual({ eventKey: null, eventType: null, txRef: null, transactionId: null });
    expect(readWebhook([1, 2])).toEqual({ eventKey: null, eventType: null, txRef: null, transactionId: null });
  });
});

describe('pickPayload', () => {
  it('keeps only allow-listed fields: no personal, card or free-text data', () => {
    const kept = pickPayload({
      event: 'charge.completed',
      'event.type': 'CARD_TRANSACTION',
      data: {
        id: 285959875,
        tx_ref: ORDER,
        flw_ref: 'FLW-MOCK-1',
        amount: 260000,
        charged_amount: 260000,
        app_fee: 14726.4,
        currency: 'TZS',
        status: 'successful',
        payment_type: 'card',
        narration: 'Asha Mushi 0712345678',
        processor_response: 'Approved by Asha',
        ip: '197.250.1.1',
        mobile: '255712345678',
        customer: { name: 'Asha', email: 'asha@example.com', phone_number: '255712345678' },
        card: { first_6digits: '539983', last_4digits: '8381' },
      },
    }) as { data: Record<string, unknown> };
    expect(kept.data).toEqual({
      id: 285959875,
      tx_ref: ORDER,
      flw_ref: 'FLW-MOCK-1',
      status: 'successful',
      amount: 260000,
      charged_amount: 260000,
      currency: 'TZS',
      app_fee: 14726.4,
      payment_type: 'card',
    });
    const text = JSON.stringify(kept);
    for (const secret of ['0712345678', '255712345678', 'Asha', 'asha@', '539983', '8381', '197.250']) expect(text).not.toContain(secret);
  });

  it('drops nested objects and odd values', () => {
    expect(pickPayload({ data: { status: { nested: 'x' }, amount: '1<script>' } })).toEqual({ data: { status: null, amount: '1script' } });
    expect(pickPayload(null)).toBeNull();
    expect(pickPayload([1])).toBeNull();
  });
});
