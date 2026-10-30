// Messages shown when the database refuses a request because too many were sent in a short time
// (rate limits, e.g. enquiries: supabase/migrations/20261030000100_order_alerts_to_owner.sql).
// Travellers see these, so all 7 languages. Non-English text is a draft for native-speaker review.
import type { Locale } from '../locales';

export type LimitTexts = { tooMany: string };

export const LIMIT_TEXT: Record<Locale, LimitTexts> = {
  en: { tooMany: 'Too many requests. Please try again later.' },
  sw: { tooMany: 'Maombi ni mengi mno. Tafadhali jaribu tena baadaye.' },
  fr: { tooMany: 'Trop de demandes. Veuillez réessayer plus tard.' },
  it: { tooMany: 'Troppe richieste. Riprova più tardi.' },
  de: { tooMany: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.' },
  pl: { tooMany: 'Zbyt wiele próśb. Spróbuj ponownie później.' },
  zh: { tooMany: '请求过多，请稍后再试。' },
};

/** The database error code (SQLSTATE) and message of a rate limit. */
export const RATE_LIMIT_SQLSTATE = 'P0001';
export const RATE_LIMIT_MESSAGE = 'rate_limited';

/** True when a Supabase/PostgREST error is the database's rate limit. */
export function isRateLimited(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  return !!error && error.code === RATE_LIMIT_SQLSTATE && error.message === RATE_LIMIT_MESSAGE;
}

export const limitTexts = (locale: Locale | string): LimitTexts => LIMIT_TEXT[(locale in LIMIT_TEXT ? locale : 'en') as Locale];
