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

/** Drops property keys that could carry personal details, as a safety net. */
export function safeProps(props: AnalyticsProps = {}): AnalyticsProps {
  return Object.fromEntries(Object.entries(props).filter(([key, value]) => value !== undefined && !BLOCKED.test(key)));
}
