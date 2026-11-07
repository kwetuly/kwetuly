'use server';

import { redirect } from 'next/navigation';
import { BILLING_FIELDS, checkBilling, isSelcomPaymentUrl, type Billing } from '@kwetuly/shared';
import type { FormResult } from '@/components/keep-form';
import { defaultLocale, hasLocale, type Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { callPayments } from '@/lib/payments';
import { createClient } from '@/lib/supabase/server';

const localeOf = (formData: FormData): Locale => {
  const value = String(formData.get('locale') ?? '');
  return hasLocale(value) ? value : defaultLocale;
};

// Starts a Selcom checkout for a deposit and sends the traveller to the payment page. A refusal comes
// back as { error } (the Pay box is a KeepForm), so a typed card billing address stays on screen in
// the browser only and never travels through the address bar.
export async function startPayment(_previous: FormResult, formData: FormData): Promise<FormResult> {
  const locale = localeOf(formData);
  await requireUser(locale);
  const kind = formData.get('kind') === 'group' ? 'group' : 'offer';
  const id = String(formData.get('id') ?? '');

  // Mobile money unless the traveller picked card. The card billing address goes to the Edge Function
  // (and from there to Selcom) only; it is never saved or logged here.
  const method = formData.get('method') === 'card' ? 'card' : 'mobile_money';
  let billing: Billing | undefined;
  if (method === 'card') {
    const raw = Object.fromEntries(BILLING_FIELDS.map(([key]) => [key, String(formData.get(`billing_${key}`) ?? '')]));
    const checked = checkBilling(raw);
    if ('problem' in checked) return { error: checked.problem === 'chars' ? 'billing_chars' : 'billing_required' };
    billing = checked.billing;
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const result = await callPayments({ action: 'checkout', kind, id, locale, method, ...(billing ? { billing } : {}) }, data.session?.access_token).catch(
    () => ({ error: 'gateway_error' }) as const,
  );
  // Only ever send the traveller to Selcom's own payment page; anything else is treated as a gateway error.
  if ('url' in result && result.url) {
    if (isSelcomPaymentUrl(result.url)) redirect(result.url);
    return { error: 'gateway_error' };
  }
  return { error: ('error' in result && result.error) || 'gateway_error' };
}
