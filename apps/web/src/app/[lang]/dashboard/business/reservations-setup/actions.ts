'use server';

import { refresh } from 'next/cache';
import {
  RESERVATION_TERMS_VERSION,
  closedDateRange,
  closedNoteOk,
  groupDiscountError,
  hoursPayload,
  knownBlockers,
  reservationLimits,
  reservationSetupError,
  serviceInputError,
  tanzaniaToday,
  type OpeningPeriod,
  type ReservationBlocker,
  type ServiceInput,
} from '@kwetuly/shared';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

// Reservation setup for restaurant, spa and salon owners (slice 1). Every write goes through the
// owner's own session: row level security and the table guards decide, these actions only check the
// shape first and turn database errors into codes the screen can say politely. Nothing here moves money.

export type SetupResult =
  | { ok: true; blockers?: ReservationBlocker[] }
  | { ok: false; error: 'soon' | 'sign_in' | 'bad_request' | 'duplicate' | 'range' | 'note' | 'too_many' | 'terms_outdated' | 'invalid' | 'failed'; field?: string; weekday?: number; blockers?: ReservationBlocker[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

type DbError = { code?: string | null; message?: string | null } | null;

function fail(error: DbError): SetupResult {
  return { ok: false, error: reservationSetupError(error) };
}

async function client(providerId: string) {
  if (!UUID.test(providerId)) return { error: { ok: false, error: 'bad_request' } as SetupResult };
  if (!(await getCurrentUser())) return { error: { ok: false, error: 'sign_in' } as SetupResult };
  return { supabase: await createClient() };
}

export async function acceptTerms(providerId: string, version: string): Promise<SetupResult> {
  const c = await client(providerId);
  if (!c.supabase) return c.error;
  if (version !== RESERVATION_TERMS_VERSION) return { ok: false, error: 'terms_outdated' };
  const { error } = await c.supabase.rpc('accept_reservation_terms', { p_provider: providerId, p_version: version });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

/** On: the database returns the reasons it cannot be switched on yet (empty = done). Off always works. */
export async function setReservationsOn(providerId: string, on: boolean): Promise<SetupResult> {
  const c = await client(providerId);
  if (!c.supabase) return c.error;
  const { data, error } = await c.supabase.rpc('set_takes_reservations', { p_provider: providerId, p_on: on });
  if (error) return fail(error);
  const blockers = knownBlockers((data ?? []) as string[]);
  refresh();
  return blockers.length > 0 ? { ok: false, error: 'invalid', blockers } : { ok: true };
}

export async function saveHours(providerId: string, days: Record<number, OpeningPeriod[]>): Promise<SetupResult> {
  const c = await client(providerId);
  if (!c.supabase) return c.error;
  const payload = hoursPayload(days);
  if (!payload.ok) return { ok: false, error: 'invalid', weekday: payload.weekday };
  const { error } = await c.supabase.rpc('set_business_hours', { p_provider: providerId, p_hours: payload.hours });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

export async function addClosedDate(providerId: string, day: string, note: string): Promise<SetupResult> {
  const c = await client(providerId);
  if (!c.supabase) return c.error;
  const range = closedDateRange(tanzaniaToday());
  if (!DAY.test(day) || day < range.min || day > range.max) return { ok: false, error: 'range' };
  if (!closedNoteOk(note)) return { ok: false, error: 'note' };
  const { error } = await c.supabase.from('business_closed_dates').insert({ provider_id: providerId, day, note: note.trim() || null });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

export async function updateClosedNote(providerId: string, day: string, note: string): Promise<SetupResult> {
  const c = await client(providerId);
  if (!c.supabase) return c.error;
  if (!DAY.test(day)) return { ok: false, error: 'bad_request' };
  if (!closedNoteOk(note)) return { ok: false, error: 'note' };
  const { error } = await c.supabase.from('business_closed_dates').update({ note: note.trim() || null }).eq('provider_id', providerId).eq('day', day);
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

export async function removeClosedDate(providerId: string, day: string): Promise<SetupResult> {
  const c = await client(providerId);
  if (!c.supabase) return c.error;
  if (!DAY.test(day)) return { ok: false, error: 'bad_request' };
  const { error } = await c.supabase.from('business_closed_dates').delete().eq('provider_id', providerId).eq('day', day);
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

/** Adds a service (no id) or saves one. New services go to the end of the list. */
export async function saveService(providerId: string, serviceId: string | null, input: ServiceInput): Promise<SetupResult> {
  const c = await client(providerId);
  if (!c.supabase) return c.error;
  if (serviceId !== null && !UUID.test(serviceId)) return { ok: false, error: 'bad_request' };
  const field = serviceInputError(input);
  if (field) return { ok: false, error: 'invalid', field };
  const min = input.group_discount_min_people ?? null;
  const pct = input.group_discount_percent ?? null;
  if ((min !== null && typeof min !== 'number') || (pct !== null && typeof pct !== 'number') || groupDiscountError({ ...input, group_discount_min_people: min, group_discount_percent: pct })) {
    return { ok: false, error: 'invalid', field: 'discount' };
  }
  const row = { name: input.name.trim(), duration_min: input.duration_min, price_tzs: input.price_tzs, max_people: input.max_people, group_discount_min_people: min, group_discount_percent: pct };
  if (serviceId) {
    const { error } = await c.supabase.from('business_services').update(row).eq('id', serviceId).eq('provider_id', providerId);
    if (error) return fail(error);
  } else {
    const { data: last } = await c.supabase.from('business_services').select('sort').eq('provider_id', providerId).order('sort', { ascending: false }).limit(1).maybeSingle<{ sort: number }>();
    const sort = Math.min((last?.sort ?? -1) + 1, 1000);
    const { error } = await c.supabase.from('business_services').insert({ ...row, provider_id: providerId, sort });
    if (error) return fail(error);
  }
  refresh();
  return { ok: true };
}

export async function setServiceActive(providerId: string, serviceId: string, active: boolean): Promise<SetupResult> {
  const c = await client(providerId);
  if (!c.supabase) return c.error;
  if (!UUID.test(serviceId)) return { ok: false, error: 'bad_request' };
  const { error } = await c.supabase.from('business_services').update({ active }).eq('id', serviceId).eq('provider_id', providerId);
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

export async function removeService(providerId: string, serviceId: string): Promise<SetupResult> {
  const c = await client(providerId);
  if (!c.supabase) return c.error;
  if (!UUID.test(serviceId)) return { ok: false, error: 'bad_request' };
  const { error } = await c.supabase.from('business_services').delete().eq('id', serviceId).eq('provider_id', providerId);
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

/** Saves the order of the services as shown (sort 0, 1, 2 ...). */
export async function orderServices(providerId: string, serviceIds: string[]): Promise<SetupResult> {
  const c = await client(providerId);
  if (!c.supabase) return c.error;
  if (serviceIds.length > reservationLimits.servicesPerBusiness || !serviceIds.every((id) => UUID.test(id))) return { ok: false, error: 'bad_request' };
  for (const [sort, id] of serviceIds.entries()) {
    const { error } = await c.supabase.from('business_services').update({ sort }).eq('id', id).eq('provider_id', providerId);
    if (error) return fail(error);
  }
  refresh();
  return { ok: true };
}

export async function saveRules(providerId: string, minNotice: number, maxDays: number): Promise<SetupResult> {
  const c = await client(providerId);
  if (!c.supabase) return c.error;
  const l = reservationLimits;
  if (!Number.isInteger(minNotice) || minNotice < l.minNoticeMin || minNotice > l.minNoticeMax || !Number.isInteger(maxDays) || maxDays < l.maxDaysMin || maxDays > l.maxDaysMax) {
    return { ok: false, error: 'invalid' };
  }
  const { error } = await c.supabase.from('providers').update({ reservation_min_notice_min: minNotice, reservation_max_days: maxDays }).eq('id', providerId);
  if (error) return fail(error);
  refresh();
  return { ok: true };
}
