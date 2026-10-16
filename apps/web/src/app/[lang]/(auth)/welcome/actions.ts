'use server';

import { redirect } from 'next/navigation';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { getCurrentUser } from '@/lib/auth';
import { safeLocalPath } from '@/lib/safe-next';
import { completeOnboarding } from '../actions';

// The page a redirect() call is sending the browser to, or null for any other error.
function redirectTarget(err: unknown): string | null {
  const digest = (err as { digest?: unknown } | null)?.digest;
  if (typeof digest !== 'string' || !digest.startsWith('NEXT_REDIRECT;')) return null;
  return digest.split(';').slice(2, -2).join(';');
}

/**
 * The welcome step's form. Same as completeOnboarding, but when the person came here from a page
 * they wanted to use (e.g. "Post a trip request"), it sends them back there afterwards, and keeps
 * that page in the address when the step has to be repeated (wrong invite code, phone number).
 */
export async function finishWelcome(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const wanted = safeLocalPath(formData.get('next'), '');
  const next = wanted.startsWith(`/${locale}/`) && !wanted.startsWith(`/${locale}/welcome`) ? wanted : '';

  try {
    await completeOnboarding(formData);
  } catch (err) {
    const target = redirectTarget(err);
    if (!next || target === null) throw err;
    if ((await getCurrentUser())?.onboarded) redirect(next);
    if (target.startsWith(`/${locale}/welcome?`)) redirect(`${target}&next=${encodeURIComponent(next)}`);
    throw err;
  }
}
