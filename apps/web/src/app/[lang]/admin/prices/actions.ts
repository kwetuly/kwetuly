'use server';

import { redirect } from 'next/navigation';
import { reservationLimits } from '@kwetuly/shared';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { getCurrentUser, isAdminSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

// Reservation commission rates (price_list). Every call runs with the admin's own two-step session; the
// database functions check private.is_admin() (aal2) again, validate the values, and log every save in
// price_list_log. Nothing here charges anyone: the rates are recorded on reservations only (slice 2).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function adminOnly(formData: FormData) {
  const value = String(formData.get('locale') ?? '');
  const locale = hasLocale(value) ? value : defaultLocale;
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);
  return `/${locale}/admin/prices`;
}

function done(back: string, params: Record<string, string>, anchor = '#reservation-rates'): never {
  redirect(`${back}?${new URLSearchParams(params)}${anchor}`);
}

// Only fixed codes go into the address; the page maps them to fixed texts.
function code(message: string | undefined): string {
  const m = message ?? '';
  if (/admins only/i.test(m)) return 'not_admin';
  if (/only drafts/i.test(m)) return 'not_draft';
  if (/start date in the past/i.test(m)) return 'past_date';
  if (/value not set/i.test(m)) return 'no_value';
  if (/max guests not set/i.test(m)) return 'no_max_guests';
  if (/another price starts|covers these dates/i.test(m)) return 'overlap';
  if (/draft already exists/i.test(m)) return 'draft_exists';
  if (/end date not allowed/i.test(m)) return 'end_date';
  if (/not found/i.test(m)) return 'not_found';
  if (/check constraint|violates/i.test(m)) return 'out_of_range';
  return 'failed';
}

// Whole shillings only: digits with optional thousands separators ("2,000" or "2 000").
function parseTzs(raw: FormDataEntryValue | null): number | null | 'bad' {
  const text = String(raw ?? '').replace(/[\s,]/g, '');
  if (!text) return null;
  if (!/^\d{1,9}$/.test(text)) return 'bad';
  const n = Number(text);
  return n >= 1 && n <= reservationLimits.reservationAmountTzsMax ? n : 'bad';
}

function parsePercent(raw: FormDataEntryValue | null): number | null | 'bad' {
  const text = String(raw ?? '').trim().replace(',', '.');
  if (!text) return null;
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(text)) return 'bad';
  const n = Number(text);
  return n > 0 && n <= reservationLimits.percentMax ? n : 'bad';
}

function parseMaxGuests(raw: FormDataEntryValue | null): number | null | 'bad' {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  if (!/^\d{1,3}$/.test(text)) return 'bad';
  const n = Number(text);
  return n >= 1 && n <= reservationLimits.maxGuestsCountedMax ? n : 'bad';
}

export async function saveReservationRate(formData: FormData) {
  const back = await adminOnly(formData);
  const id = String(formData.get('price_id') ?? '');
  if (!UUID.test(id)) done(back, { e: 'not_found' });
  const period = String(formData.get('period') ?? '');
  const amount = period === 'percent' ? null : parseTzs(formData.get('amount_tzs'));
  const percent = period === 'percent' ? parsePercent(formData.get('percent')) : null;
  const maxGuests = formData.get('max_guests') === null ? null : parseMaxGuests(formData.get('max_guests'));
  if (amount === 'bad' || percent === 'bad' || maxGuests === 'bad') done(back, { e: 'out_of_range' }, `#price-${id}`);
  const from = String(formData.get('active_from') ?? '').trim();
  if (from && !DATE.test(from)) done(back, { e: 'past_date' }, `#price-${id}`);
  const note = String(formData.get('note') ?? '').trim().slice(0, 300) || null;

  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_save_price_draft', {
    p_id: id,
    p_amount_tzs: amount,
    p_percent: percent,
    p_max_guests: maxGuests,
    p_active_from: from || null,
    p_note: note,
  });
  if (error) done(back, { e: code(error.message) }, `#price-${id}`);
  done(back, { ok: 'saved' }, `#price-${id}`);
}

// Second step of two: the page shows the values and asks Walter to confirm before this runs.
export async function activateReservationRate(formData: FormData) {
  const back = await adminOnly(formData);
  const id = String(formData.get('price_id') ?? '');
  if (!UUID.test(id)) done(back, { e: 'not_found' });
  if (formData.get('confirm') !== 'yes') done(back, { e: 'confirm' }, `#price-${id}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_activate_price', { p_id: id });
  if (error) done(back, { e: code(error.message) }, `#price-${id}`);
  done(back, { ok: 'activated' }, `#price-${id}`);
}

export async function newReservationRateVersion(formData: FormData) {
  const back = await adminOnly(formData);
  const id = String(formData.get('price_id') ?? '');
  if (!UUID.test(id)) done(back, { e: 'not_found' });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_new_price_version', { p_from: id });
  if (error || typeof data !== 'string') done(back, { e: code(error?.message) }, `#price-${id}`);
  done(back, { ok: 'version' }, `#price-${data}`);
}

export async function endReservationRate(formData: FormData) {
  const back = await adminOnly(formData);
  const id = String(formData.get('price_id') ?? '');
  const on = String(formData.get('active_to') ?? '').trim();
  if (!UUID.test(id)) done(back, { e: 'not_found' });
  if (!DATE.test(on)) done(back, { e: 'end_date' }, `#price-${id}`);
  if (formData.get('confirm') !== 'yes') done(back, { e: 'confirm' }, `#price-${id}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_end_price', { p_id: id, p_on: on });
  if (error) done(back, { e: code(error.message) }, `#price-${id}`);
  done(back, { ok: 'ended' }, `#price-${id}`);
}
