'use server';

import { redirect } from 'next/navigation';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { getCurrentUser, isAdminSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

// Reservation commission (migration 20261122300000). Every call runs with the admin's own two-step
// session; the database checks private.is_admin() (aal2) again and logs each change. Kwetuly charges
// nobody from here: while the billing switch is off the database refuses "invoiced" and "paid".
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH = /^\d{4}-\d{2}$/;

async function adminOnly(formData: FormData) {
  const value = String(formData.get('locale') ?? '');
  const locale = hasLocale(value) ? value : defaultLocale;
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);
  const month = String(formData.get('month') ?? '');
  return { back: `/${locale}/admin/commissions`, month: MONTH.test(month) ? month : null };
}

function done(back: string, month: string | null, params: Record<string, string>, anchor: string): never {
  const search = new URLSearchParams(month ? { month, ...params } : params);
  redirect(`${back}?${search}${anchor}`);
}

// Only fixed codes go into the address; the page maps them to fixed texts.
function code(message: string | undefined): string {
  const m = message ?? '';
  if (/billing is off/i.test(m)) return 'billing_off';
  if (/month not finished/i.test(m)) return 'month_open';
  if (/no open dispute/i.test(m)) return 'no_dispute';
  if (/admins only/i.test(m)) return 'not_admin';
  return 'failed';
}

export async function markReservationCommission(formData: FormData) {
  const { back, month } = await adminOnly(formData);
  const provider = String(formData.get('provider_id') ?? '');
  const to = String(formData.get('to') ?? '');
  if (!UUID.test(provider) || !month || !['invoiced', 'paid', 'waived'].includes(to)) done(back, month, { rerr: 'failed' }, '#reservation-commission');
  if (formData.get('confirm') !== 'yes') done(back, month, { rerr: 'confirm' }, '#reservation-commission');
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_reservation_commission', { p_provider: provider, p_month: `${month}-01`, p_to: to });
  if (error) done(back, month, { rerr: code(error.message) }, '#reservation-commission');
  done(back, month, { rok: to }, '#reservation-commission');
}

export async function resolveReservationDispute(formData: FormData) {
  const { back, month } = await adminOnly(formData);
  const id = String(formData.get('reservation_id') ?? '');
  const outcome = String(formData.get('outcome') ?? '');
  if (!UUID.test(id) || !['completed', 'no_show', 'business_fault'].includes(outcome)) done(back, month, { rerr: 'failed' }, '#reservation-disputes');
  const supabase = await createClient();
  // p_detail is a fixed code (security review L8); the database keeps only codes from its own list.
  const { error } = await supabase.rpc('admin_resolve_reservation_dispute', { p_reservation: id, p_outcome: outcome, p_detail: 'admin_page' });
  if (error) done(back, month, { rerr: code(error.message) }, '#reservation-disputes');
  done(back, month, { rok: 'resolved' }, '#reservation-disputes');
}
