import { describe, expect, it } from 'vitest';
import { isPaymentPath, redactText, redactUrl, redactUrlProps } from './analytics';

const ORDER = 'RAF0123456789abcdef0123456789abcdef';

describe('redactUrl', () => {
  it('strips the order id from the payment return page', () => {
    expect(redactUrl(`https://kwetuly.com/en/payments/return?order=${ORDER}`)).toBe('https://kwetuly.com/en/payments/return');
    expect(redactUrl(`https://kwetuly.com/sw/payments/return?order=${ORDER}&cancelled=1#top`)).toBe('https://kwetuly.com/sw/payments/return');
    expect(redactUrl(`/en/payments/return?order=${ORDER}`)).toBe('/en/payments/return');
  });
  it('strips query strings from Selcom pages', () => {
    expect(redactUrl('https://apigw.selcommobile.com/v1/checkout/pay?token=abc')).toBe('https://apigw.selcommobile.com/v1/checkout/pay');
    expect(redactUrl('https://checkout.selcom.net/pay/xyz?t=1')).toBe('https://checkout.selcom.net/pay/xyz');
  });
  it('leaves other addresses and plain text alone', () => {
    expect(redactUrl('https://kwetuly.com/en/tours?q=kili&utm_source=x')).toBe('https://kwetuly.com/en/tours?q=kili&utm_source=x');
    expect(redactUrl('https://kwetuly.com/en/paymentsinfo?x=1')).toBe('https://kwetuly.com/en/paymentsinfo?x=1');
    expect(redactUrl('https://notselcom.net.example/?a=1')).toBe('https://notselcom.net.example/?a=1');
    expect(redactUrl('cta_clicked')).toBe('cta_clicked');
  });
});

describe('redactText', () => {
  it('cuts the query string after a payment address inside any text', () => {
    expect(redactText(`en/payments/return?order=${ORDER}`)).toBe('en/payments/return');
    expect(redactText(`page kwetuly.com/en/payments/return?order=${ORDER}&cancelled=1 loaded`)).toBe('page kwetuly.com/en/payments/return loaded');
    expect(redactText('went to checkout.selcom.net/pay/x?t=secret then back')).toBe('went to checkout.selcom.net/pay/x then back');
  });
  it('leaves other text alone', () => {
    expect(redactText('/en/tours?q=kili')).toBe('/en/tours?q=kili');
    expect(redactText('what?')).toBe('what?');
  });
});

describe('redactUrlProps', () => {
  it('redacts every string value and keeps the rest', () => {
    expect(
      redactUrlProps({ $current_url: `https://kwetuly.com/en/payments/return?order=${ORDER}`, $referrer: 'https://checkout.selcom.net/p?t=1', n: 3, locale: 'en' }),
    ).toEqual({ $current_url: 'https://kwetuly.com/en/payments/return', $referrer: 'https://checkout.selcom.net/p', n: 3, locale: 'en' });
    expect(redactUrlProps(undefined)).toBeUndefined();
  });
  it('redacts nested web-vitals-shaped events, arrays and keys', () => {
    const event = {
      $web_vitals_LCP_event: {
        name: 'LCP',
        value: 1234.5,
        $current_url: `https://kwetuly.com/en/payments/return?order=${ORDER}`,
        attribution: {
          url: `https://kwetuly.com/en/payments/return?order=${ORDER}`,
          element: 'main > h1',
          navigationEntry: { name: `https://kwetuly.com/en/payments/return?order=${ORDER}#x`, type: 'navigate' },
        },
        entries: [{ name: `/en/payments/return?order=${ORDER}` }, 'checkout.selcom.net/pay?t=1'],
      },
      [`/en/payments/return?order=${ORDER}`]: true,
    };
    const out = redactUrlProps(event)!;
    expect(JSON.stringify(out)).not.toContain(ORDER);
    expect(JSON.stringify(out)).not.toContain('t=1');
    expect(out).toEqual({
      $web_vitals_LCP_event: {
        name: 'LCP',
        value: 1234.5,
        $current_url: 'https://kwetuly.com/en/payments/return',
        attribution: {
          url: 'https://kwetuly.com/en/payments/return',
          element: 'main > h1',
          navigationEntry: { name: 'https://kwetuly.com/en/payments/return', type: 'navigate' },
        },
        entries: [{ name: '/en/payments/return' }, 'checkout.selcom.net/pay'],
      },
      '/en/payments/return': true,
    });
  });
  it('drops objects nested deeper than any event needs', () => {
    let deep: Record<string, unknown> = { url: `/en/payments/return?order=${ORDER}` };
    for (let i = 0; i < 20; i++) deep = { child: deep };
    expect(JSON.stringify(redactUrlProps(deep))).not.toContain(ORDER);
  });
});

describe('isPaymentPath', () => {
  it('spots payment pages only', () => {
    expect(isPaymentPath(`https://kwetuly.com/en/payments/return?order=${ORDER}`)).toBe(true);
    expect(isPaymentPath('/sw/payments/return')).toBe(true);
    expect(isPaymentPath('/en/paymentsinfo')).toBe(false);
    expect(isPaymentPath('/en/tours')).toBe(false);
    expect(isPaymentPath(undefined)).toBe(false);
  });
});
