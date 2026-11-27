'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { LIPA_NETWORKS, PAYMENT_METHODS, PAYMENT_PROVIDER_IDS, METHOD_BADGES, STORE_ITEM_TYPES, STORE_ROUTES } from '@kwetuly/shared';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { getCurrentUser, isAdminSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

// Admin actions for Lipa payments. Each call runs with the admin's own two-step session; the database
// functions check private.is_admin() (aal2) again, refuse an admin's own payment, apply the paid effect
// once (idempotency key) and write every action to payment_audit_log. Only fixed codes go into addresses.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function admin(formData: FormData, page: string) {
  const value = String(formData.get('locale') ?? '');
  const locale = hasLocale(value) ? value : defaultLocale;
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);
  return `/${locale}/admin/payments${page}`;
}

function go(back: string, params: Record<string, string>): never {
  redirect(`${back}${back.includes('?') ? '&' : '?'}${new URLSearchParams(params)}`);
}

function code(message: string | undefined): string {
  const m = message ?? '';
  if (/admins only/.test(m)) return 'not_admin';
  if (/own payment/.test(m)) return 'own';
  if (/amount does not match|received amount needed/.test(m)) return 'amount';
  if (/amount matches/.test(m)) return 'matches';
  if (/already decided|claim not found/.test(m)) return 'decided';
  if (/order_closed/.test(m)) return 'closed';
  if (/deposit not pending/.test(m)) return 'deposit';
  if (/commission lines changed/.test(m)) return 'changed';
  if (/check constraint|violates|not found|date not allowed/.test(m)) return 'input';
  return 'failed';
}

// Whole shillings: digits with optional separators.
function tzs(raw: FormDataEntryValue | null): number | null {
  const text = String(raw ?? '').replace(/[\s,]/g, '');
  if (!/^\d{1,12}$/.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
const note = (formData: FormData) => String(formData.get('note') ?? '').trim().slice(0, 200) || null;

export async function confirmClaim(formData: FormData) {
  const back = await admin(formData, '');
  const claim = String(formData.get('claim') ?? '');
  const received = tzs(formData.get('received'));
  if (!UUID.test(claim) || received === null) go(back, { e: 'amount' });
  if (formData.get('found') !== 'yes') go(back, { e: 'confirm' });
  // One key per form render (hidden field): pressing Confirm twice sends the same key.
  const key = String(formData.get('key') ?? '');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_confirm_payment', {
    p_claim: claim,
    p_received_tzs: received,
    p_idempotency_key: /^[A-Za-z0-9-]{8,64}$/.test(key) ? key : randomUUID(),
    p_note: note(formData),
  });
  if (error) go(back, { e: code(error.message) });
  go(back, { ok: data === 'already_confirmed' ? 'already' : 'confirmed' });
}

export async function rejectClaim(formData: FormData) {
  const back = await admin(formData, '');
  const claim = String(formData.get('claim') ?? '');
  const reason = String(formData.get('reason') ?? '');
  if (!UUID.test(claim)) go(back, { e: 'input' });
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_reject_payment', {
    p_claim: claim,
    p_reason_code: reason,
    p_note: note(formData),
    p_close: formData.get('close') === 'yes',
  });
  if (error) go(back, { e: code(error.message) });
  go(back, { ok: 'rejected' });
}

export async function wrongAmount(formData: FormData) {
  const back = await admin(formData, '');
  const claim = String(formData.get('claim') ?? '');
  const received = tzs(formData.get('received'));
  if (!UUID.test(claim) || received === null) go(back, { e: 'amount' });
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_mark_wrong_amount', { p_claim: claim, p_received_tzs: received, p_note: note(formData) });
  if (error) go(back, { e: code(error.message) });
  go(back, { ok: 'wrong' });
}

export async function saveNumber(formData: FormData) {
  const back = await admin(formData, '/numbers');
  const id = String(formData.get('id') ?? '');
  const network = String(formData.get('network') ?? '');
  if (!(LIPA_NETWORKS as readonly string[]).includes(network)) go(back, { e: 'input' });
  const sort = Number(String(formData.get('sort') ?? '0'));
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_save_payment_number', {
    p_id: UUID.test(id) ? id : null,
    p_network: network,
    p_lipa_number: String(formData.get('lipa_number') ?? '').slice(0, 20),
    p_business_name: String(formData.get('business_name') ?? '').slice(0, 80),
    p_bank_name: String(formData.get('bank_name') ?? '').slice(0, 60),
    p_menu_hint: String(formData.get('menu_hint') ?? '').slice(0, 40),
    p_is_on: formData.get('is_on') === 'yes',
    p_sort: Number.isInteger(sort) && sort >= 0 && sort <= 99 ? sort : 0,
  });
  if (error) go(back, { e: code(error.message) });
  go(back, { ok: 'saved' });
}

export async function saveProviders(formData: FormData) {
  const back = await admin(formData, '/numbers');
  const value: Record<string, string[]> = {};
  for (const m of PAYMENT_METHODS) {
    value[m] = String(formData.get(m) ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => (PAYMENT_PROVIDER_IDS as readonly string[]).includes(s))
      .slice(0, 4);
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_payment_providers', { p_value: value });
  if (error) go(back, { e: code(error.message) });
  go(back, { ok: 'saved' });
}

export async function saveRate(formData: FormData) {
  const back = await admin(formData, '/numbers');
  const rate = String(formData.get('rate') ?? '').trim();
  const date = String(formData.get('as_of') ?? '').trim();
  if (!/^[1-9]\d{0,5}(\.\d{1,4})?$/.test(rate) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) go(back, { e: 'input' });
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_manual_rate', { p_rate: rate, p_source: String(formData.get('source') ?? '').slice(0, 120), p_as_of: date });
  if (error) go(back, { e: code(error.message) });
  go(back, { ok: 'saved' });
}

export async function saveMethod(formData: FormData) {
  const back = await admin(formData, '/methods');
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  const sort = Number(String(formData.get('sort') ?? ''));
  if (!(PAYMENT_PROVIDER_IDS as readonly string[]).includes(id) || !['live', 'coming_soon', 'hidden'].includes(status) || !Number.isInteger(sort) || sort < 0 || sort > 99) {
    go(back, { e: 'input' });
  }
  const badges = formData.getAll('badges').map(String).filter((b) => (METHOD_BADGES as readonly string[]).includes(b));
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_save_payment_method', {
    p_id: id,
    p_display_name: String(formData.get('display_name') ?? '').slice(0, 40),
    p_status: status,
    p_sort: sort,
    p_badges: badges,
  });
  if (error) go(back, { e: code(error.message) });
  go(back, { ok: 'saved' });
}

export async function saveStorePolicy(formData: FormData) {
  const back = await admin(formData, '/methods');
  const policy: Record<string, Record<string, string>> = { web: {}, ios: {}, android: {} };
  for (const platform of ['web', 'ios', 'android'] as const) {
    for (const item of STORE_ITEM_TYPES) {
      const v = String(formData.get(`${platform}.${item}`) ?? '');
      if ((STORE_ROUTES as readonly string[]).includes(v)) policy[platform][item] = v;
    }
  }
  const flags = {
    show_coming_soon: { web: formData.get('csoon.web') === 'yes', ios: formData.get('csoon.ios') === 'yes', android: formData.get('csoon.android') === 'yes' },
    show_prices_for_web_only_items_in_app: false,
    ios_link_out_storefronts: [],
    android_link_out_countries: [],
  };
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_store_policy', { p_kinds: null, p_policy: policy, p_flags: flags });
  if (error) go(back, { e: code(error.message) });
  go(back, { ok: 'saved' });
}
