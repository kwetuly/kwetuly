'use server';

import { redirect } from 'next/navigation';
import { defaultLocale, hasLocale, type Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { isAllowedPaymentUrl } from '@kwetuly/shared';
import { callPayments } from '@/lib/payments';
import { createClient } from '@/lib/supabase/server';

const localeOf = (formData: FormData): Locale => {
  const value = String(formData.get('locale') ?? '');
  return hasLocale(value) ? value : defaultLocale;
};

// Starts a checkout for a deposit and sends the traveller to Flutterwave's hosted payment page.
// The payment page address is checked again here: only https pages on Flutterwave's own domain.
export async function startPayment(formData: FormData) {
  const locale = localeOf(formData);
  await requireUser(locale);
  const kind = formData.get('kind') === 'group' ? 'group' : 'offer';
  const id = String(formData.get('id') ?? '');
  // Only return to pages on this site.
  const backRaw = String(formData.get('back') ?? '');
  const back = backRaw.startsWith(`/${locale}/`) ? backRaw : `/${locale}/dashboard`;

  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const result = await callPayments({ action: 'checkout', kind, id, locale }, data.session?.access_token).catch(() => ({ error: 'gateway_error' }) as const);
  if ('url' in result && isAllowedPaymentUrl(result.url)) redirect(result.url);
  redirect(`${back}${back.includes('?') ? '&' : '?'}payError=${encodeURIComponent(('error' in result && result.error) || 'gateway_error')}#pay`);
}
