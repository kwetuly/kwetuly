import { hasLocale, type Locale } from '@/i18n/config';

// Where to send someone after signing in or confirming an email, limited to pages on this site.
// Accepts only plain paths of the form "/{locale}/..." (or "/{locale}"); anything else, such as
// "//evil.com", "/\evil.com", "https://..." or encoded tricks, falls back to `fallback`.
export function safeLocalPath(value: unknown, fallback: string): string {
  const next = typeof value === 'string' ? value : '';
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;
  // Browsers treat "\" like "/", and control characters can hide a second slash.
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  if (/%(2f|5c)/i.test(next.split(/[?#]/)[0])) return fallback;
  const first = next.split(/[/?#]/)[1] ?? '';
  if (!hasLocale(first)) return fallback;
  // Final check: resolved against a dummy origin it must stay on that origin.
  try {
    const base = 'https://kwetuly.invalid';
    if (new URL(next, base).origin !== base) return fallback;
  } catch {
    return fallback;
  }
  return next;
}

// The locale a safe path starts with, or `fallback`.
export function localeOfPath(path: string, fallback: Locale): Locale {
  const first = path.split(/[/?#]/)[1] ?? '';
  return hasLocale(first) ? first : fallback;
}
