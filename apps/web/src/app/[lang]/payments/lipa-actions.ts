'use server';

import { redirect } from 'next/navigation';
import { LIPA_NETWORKS, PAYMENT_ADAPTERS, PAYMENT_PROVIDER_IDS, PAYMENT_PURPOSES, isPaymentReference, normalizeTransactionId, paymentErrorCode, type LipaNetwork, type PaymentProviderKey, type PaymentPurpose, type RpcClient } from '@kwetuly/shared';
import { defaultLocale, hasLocale, type Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

// Paying Kwetuly from the website. These actions never send an amount: the database works it out
// (start_payment_order) and refuses providers that are not live. "I have paid" only records the
// transaction ID for an admin to check; it never makes anything paid.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH = /^\d{4}-\d{2}-01$/;

const localeOf = (formData: FormData): Locale => {
  const value = String(formData.get('locale') ?? '');
  return hasLocale(value) ? value : defaultLocale;
};
const backOf = (formData: FormData, locale: Locale) => {
  const raw = String(formData.get('back') ?? '');
  return raw.startsWith(`/${locale}/`) && !raw.startsWith('//') ? raw.split('#')[0] : `/${locale}/payments/orders`;
};
const withParam = (url: string, key: string, value: string) => `${url}${url.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(value)}`;

/** From the chooser: start (or reopen) an order with the chosen provider. */
export async function startPayment(formData: FormData) {
  const locale = localeOf(formData);
  await requireUser(locale);
  const back = backOf(formData, locale);
  const purpose = String(formData.get('purpose') ?? '') as PaymentPurpose;
  const provider = String(formData.get('provider') ?? '') as PaymentProviderKey;
  if (!(PAYMENT_PURPOSES as readonly string[]).includes(purpose) || !(PAYMENT_PROVIDER_IDS as readonly string[]).includes(provider)) {
    redirect(withParam(back, 'payError', 'failed'));
  }
  const subject = String(formData.get('subject') ?? '');
  const period = String(formData.get('period') ?? '');
  const month = String(formData.get('month') ?? '');
  const supabase = await createClient();
  const result = await PAYMENT_ADAPTERS[provider].createPayment(supabase as unknown as RpcClient, {
    purpose,
    subject: UUID.test(subject) ? subject : null,
    period: period === 'month' || period === 'year' ? period : null,
    accountType: purpose === 'verification' ? 'guide' : null,
    month: MONTH.test(month) ? month : null,
    locale,
    platform: 'web',
  });
  if (result.kind === 'instructions') redirect(`/${locale}/payments/orders/${result.reference}`);
  // Hosted checkout pages are started by the deposit box (payments/actions.ts) until fee orders move there.
  redirect(withParam(back, 'payError', result.kind === 'error' ? result.code : 'failed'));
}

export async function submitClaim(formData: FormData) {
  const locale = localeOf(formData);
  await requireUser(locale);
  const reference = String(formData.get('reference') ?? '');
  if (!isPaymentReference(reference)) redirect(`/${locale}/payments/orders`);
  const here = `/${locale}/payments/orders/${reference}`;
  const network = String(formData.get('network') ?? '');
  const tx = normalizeTransactionId(String(formData.get('transaction_id') ?? ''));
  if (!tx) redirect(withParam(here, 'e', 'transaction_format') + '#paid');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('submit_payment_claim', {
    p_reference: reference,
    p_network: network,
    p_transaction_id: tx,
    p_phone: String(formData.get('phone') ?? '').slice(0, 30),
  });
  if (error) redirect(withParam(here, 'e', paymentErrorCode(error.message)) + '#paid');
  if (data === 'duplicate') redirect(withParam(here, 'e', 'duplicate') + '#paid');
  redirect(withParam(here, 'ok', 'submitted'));
}

export type ClaimState = { error: string | null; network: LipaNetwork; tx: string; phone: string };

/** The same as submitClaim, for useActionState: a refusal returns the typed values (QA 7). */
export async function submitClaimState(_prev: ClaimState, formData: FormData): Promise<ClaimState> {
  const locale = localeOf(formData);
  await requireUser(locale);
  const reference = String(formData.get('reference') ?? '');
  const raw = String(formData.get('network') ?? '');
  const network = ((LIPA_NETWORKS as readonly string[]).includes(raw) ? raw : 'mpesa') as LipaNetwork;
  const typed = String(formData.get('transaction_id') ?? '').slice(0, 60);
  const phone = String(formData.get('phone') ?? '').slice(0, 30);
  const back = (error: string): ClaimState => ({ error, network, tx: typed, phone });
  if (!isPaymentReference(reference)) return back('not_found');
  const tx = normalizeTransactionId(typed);
  if (!tx) return back('transaction_format');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('submit_payment_claim', { p_reference: reference, p_network: network, p_transaction_id: tx, p_phone: phone });
  if (error) return back(paymentErrorCode(error.message));
  if (data === 'duplicate') return back('duplicate');
  redirect(withParam(`/${locale}/payments/orders/${reference}`, 'ok', 'submitted'));
}

export async function cancelOrder(formData: FormData) {
  const locale = localeOf(formData);
  await requireUser(locale);
  const reference = String(formData.get('reference') ?? '');
  if (!isPaymentReference(reference)) redirect(`/${locale}/payments/orders`);
  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_payment_order', { p_reference: reference });
  const here = `/${locale}/payments/orders/${reference}`;
  redirect(error ? withParam(here, 'e', paymentErrorCode(error.message)) : withParam(here, 'ok', 'cancelled'));
}
