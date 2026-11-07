import { describe, expect, it } from 'vitest';
import { isSelcomPaymentUrl, SELCOM_PAYMENT_DOMAINS } from './payments';

describe('isSelcomPaymentUrl', () => {
  it('accepts https pages on Selcom subdomains', () => {
    expect(isSelcomPaymentUrl('https://checkout.selcommobile.com/pg/t12222')).toBe(true);
    expect(isSelcomPaymentUrl('https://pay.apigwtest.selcommobile.com/x?y=1#z')).toBe(true);
    expect(isSelcomPaymentUrl('https://pay.selcom.net')).toBe(true);
    expect(isSelcomPaymentUrl('https://pay.selcom.net/')).toBe(true);
    expect(isSelcomPaymentUrl('https://PAY.SelcomMobile.COM/p')).toBe(true);
    expect(isSelcomPaymentUrl('https://pay.selcommobile.com:443/p')).toBe(true);
  });

  it('refuses anything that is not https', () => {
    expect(isSelcomPaymentUrl('http://checkout.selcommobile.com/p')).toBe(false);
    expect(isSelcomPaymentUrl('HTTPS://checkout.selcommobile.com/p')).toBe(false);
    expect(isSelcomPaymentUrl('javascript:alert(1)//checkout.selcommobile.com')).toBe(false);
    expect(isSelcomPaymentUrl('//checkout.selcommobile.com/p')).toBe(false);
    expect(isSelcomPaymentUrl('https:checkout.selcommobile.com/p')).toBe(false);
    expect(isSelcomPaymentUrl('https:/checkout.selcommobile.com/p')).toBe(false);
  });

  it('refuses lookalike hosts and the bare domains', () => {
    expect(isSelcomPaymentUrl('https://selcommobile.com.evil.com/p')).toBe(false);
    expect(isSelcomPaymentUrl('https://checkout.selcommobile.com.evil.com/p')).toBe(false);
    expect(isSelcomPaymentUrl('https://evilselcommobile.com/p')).toBe(false);
    expect(isSelcomPaymentUrl('https://selcommobile.co/p')).toBe(false);
    expect(isSelcomPaymentUrl('https://selcom.net.evil.com')).toBe(false);
    expect(isSelcomPaymentUrl('https://selcommobile.com/p')).toBe(false);
    expect(isSelcomPaymentUrl('https://selcom.net/')).toBe(false);
    expect(isSelcomPaymentUrl('https://xn--selcmobile-b7a.com/p')).toBe(false);
    expect(isSelcomPaymentUrl('https://checkout.selcommobile.com./p')).toBe(false);
    expect(isSelcomPaymentUrl('https://.selcommobile.com/p')).toBe(false);
    expect(isSelcomPaymentUrl('https://a..selcommobile.com/p')).toBe(false);
    expect(isSelcomPaymentUrl('https://-a.selcommobile.com/p')).toBe(false);
    expect(isSelcomPaymentUrl('https://192.168.1.1/p')).toBe(false);
    expect(isSelcomPaymentUrl('https://[::1]/p')).toBe(false);
  });

  it('refuses userinfo, backslash and encoding tricks', () => {
    expect(isSelcomPaymentUrl('https://checkout.selcommobile.com@evil.com/p')).toBe(false);
    expect(isSelcomPaymentUrl('https://evil.com@checkout.selcommobile.com/p')).toBe(false);
    expect(isSelcomPaymentUrl('https://user:pw@checkout.selcommobile.com/p')).toBe(false);
    expect(isSelcomPaymentUrl('https://evil.com\\@checkout.selcommobile.com/p')).toBe(false);
    expect(isSelcomPaymentUrl('https://evil.com\\.selcommobile.com/p')).toBe(false);
    expect(isSelcomPaymentUrl('https://checkout.selcommobile.com/p\\x')).toBe(false);
    expect(isSelcomPaymentUrl('https://evil%2ecom.selcommobile.com/p')).toBe(false);
    expect(isSelcomPaymentUrl('https://checkout%2eselcommobile.com/p')).toBe(false);
  });

  it('refuses other ports', () => {
    expect(isSelcomPaymentUrl('https://checkout.selcommobile.com:8443/p')).toBe(false);
    expect(isSelcomPaymentUrl('https://checkout.selcommobile.com:80/p')).toBe(false);
    expect(isSelcomPaymentUrl('https://checkout.selcommobile.com:/p')).toBe(false);
    expect(isSelcomPaymentUrl('https://checkout.selcommobile.com:0443/p')).toBe(false);
  });

  it('refuses spaces, control and non-ASCII characters, empty and oversized input', () => {
    expect(isSelcomPaymentUrl(' https://checkout.selcommobile.com/p')).toBe(false);
    expect(isSelcomPaymentUrl('https://checkout.selcommobile.com/p ')).toBe(false);
    expect(isSelcomPaymentUrl('https://checkout.selcommobile.com/a b')).toBe(false);
    expect(isSelcomPaymentUrl('https://checkout.selcommobile.com/p\n')).toBe(false);
    expect(isSelcomPaymentUrl('https://checkout.selcommobile.com\t/p')).toBe(false);
    expect(isSelcomPaymentUrl('https://checkout.sеlcommobile.com/p')).toBe(false); // Cyrillic е
    expect(isSelcomPaymentUrl('https://checkout.selcommobile.com/ü')).toBe(false);
    expect(isSelcomPaymentUrl('')).toBe(false);
    expect(isSelcomPaymentUrl(`https://checkout.selcommobile.com/${'a'.repeat(2048)}`)).toBe(false);
    expect(isSelcomPaymentUrl(null)).toBe(false);
    expect(isSelcomPaymentUrl(undefined)).toBe(false);
    expect(isSelcomPaymentUrl(42)).toBe(false);
  });

  it('lists only Selcom domains', () => {
    expect([...SELCOM_PAYMENT_DOMAINS]).toEqual(['selcommobile.com', 'selcom.net']);
  });
});
