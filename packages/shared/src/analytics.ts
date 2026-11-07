// Event names shared by the website and the app, so funnels in PostHog line up across both.
// Rule: never put names, emails, phone numbers, message text or other personal details in
// properties. Public ids (guide/tour slugs, locale, screen) are fine.

export const EVENTS = {
  ctaClicked: 'cta_clicked',
  signupStarted: 'signup_started',
  signupCompleted: 'signup_completed',
  signinCompleted: 'signin_completed',
  enquiryStarted: 'enquiry_started',
  enquirySent: 'enquiry_sent',
  guideViewed: 'guide_viewed',
  tourViewed: 'tour_viewed',
  tourSaved: 'tour_saved',
  groupTripJoined: 'group_trip_joined',
  tripRequestSent: 'trip_request_sent',
  searchUsed: 'search_used',
  onboardingStep: 'onboarding_step',
  errorShown: 'error_shown',
} as const;

export type AnalyticsEvent = (typeof EVENTS)[keyof typeof EVENTS];
export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

export const POSTHOG_DEFAULT_HOST = 'https://eu.i.posthog.com';

const BLOCKED = /(e-?mail|phone|name|message|body|text|password|token)/i;

// Payment pages carry the order id in the address (/payments/return?order=RAF...), and Selcom's own
// pages (the referrer after paying) can carry payment tokens. Analytics gets those addresses without
// the query string or #hash. Other addresses are left as they are.
const PRIVATE_PATH = /\/payments(\/|$)/;
const PRIVATE_HOST = /(^|\.)(selcom\.net|selcommobile\.com)$/i;

/** Strips the query string and hash from a payment-page or Selcom address (full URL or path). */
export function redactUrl(value: string): string {
  const isPath = value.startsWith('/');
  if (!isPath && !/^https?:\/\//i.test(value)) return value;
  try {
    const url = new URL(value, 'https://placeholder.invalid');
    if (!PRIVATE_PATH.test(url.pathname) && !PRIVATE_HOST.test(url.hostname)) return value;
    return isPath ? url.pathname : `${url.origin}${url.pathname}`;
  } catch {
    return value;
  }
}

// Text that holds a payment-page or Selcom address with a query string or #hash anywhere inside it,
// also without "https://" or a leading "/" (e.g. "en/payments/return?order=..." or a web-vitals
// attribution string). The query string and hash after such an address are cut off.
const PAYMENT_QUERY = /(\/payments\/[^\s?#"'<>]*)[?#][^\s"'<>]*/g;
const SELCOM_QUERY = /((?:^|[\s/"'.])(?:[\w-]+\.)*(?:selcom\.net|selcommobile\.com)(?:[/:][^\s?#"'<>]*)?)[?#][^\s"'<>]*/gi;

/** redactUrl, then cuts the query string and hash after any payment or Selcom address inside the text. */
export function redactText(value: string): string {
  const url = redactUrl(value);
  if (url !== value) return url;
  if (!/[?#]/.test(value)) return value;
  return value.replace(PAYMENT_QUERY, '$1').replace(SELCOM_QUERY, '$1');
}

const MAX_DEPTH = 12;

function redactDeep(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return redactText(value);
  if (value === null || typeof value !== 'object') return value;
  // Deeper than any PostHog event needs: dropped rather than sent unchecked.
  if (depth >= MAX_DEPTH) return null;
  if (Array.isArray(value)) return value.map((item) => redactDeep(item, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [redactText(key), redactDeep(item, depth + 1)]));
}

/**
 * Applies redactText to every string in PostHog event properties, $set and $set_once: values and keys,
 * in nested objects and arrays too (web vitals send nested attribution objects).
 */
export function redactUrlProps<T extends Record<string, unknown>>(props: T | undefined): T | undefined {
  if (!props) return props;
  return redactDeep(props, 0) as T;
}

/** True for a payment page address or path (/{lang}/payments/...). Analytics sends nothing from these. */
export function isPaymentPath(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    return PRIVATE_PATH.test(new URL(value, 'https://placeholder.invalid').pathname);
  } catch {
    return false;
  }
}

/** Drops property keys that could carry personal details, as a safety net. */
export function safeProps(props: AnalyticsProps = {}): AnalyticsProps {
  return Object.fromEntries(Object.entries(props).filter(([key, value]) => value !== undefined && !BLOCKED.test(key)));
}
