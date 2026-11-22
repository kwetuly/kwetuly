import {
  RESERVATION_TERMS_VERSION,
  closedDateRange,
  closedNoteOk,
  hoursPayload,
  isNotAppliedError,
  knownBlockers,
  reservationLimits,
  reservationSetupError,
  serviceInputError,
  tanzaniaToday,
  type OpeningPeriod,
  type ReservationBlocker,
  type ReservationRate,
  type ReservationSetupError,
  type ServiceInput,
} from '@kwetuly/shared';
import { supabase } from './supabase';

// Reservations setup for restaurant, spa and salon owners, the same tables, functions and rules as the
// website's /dashboard/business/reservations-setup. Row level security and the table guards decide;
// these functions check the shape first and return codes the screen says politely. Nothing moves money.
// While migration 20261122200000 is not on the database, loading returns soon = true.

export type SetupStatus = {
  takesReservations: boolean;
  openNow: boolean;
  blockers: ReservationBlocker[];
  termsVersion: string | null;
  termsCurrentVersion: string | null;
  termsAcceptedAt: string | null;
};
export type SetupService = { id: string; name: string; duration_min: number; price_tzs: number | null; max_people: number; active: boolean; sort: number };
export type SetupData = {
  soon: boolean;
  today: string;
  status: SetupStatus;
  rules: { minNotice: number; maxDays: number };
  hours: { weekday: number; opens: string; closes: string }[];
  closed: { day: string; note: string | null }[];
  services: SetupService[];
  rate: ReservationRate | null;
  unpricedRate: ReservationRate | null;
};

export type SetupResult =
  | { ok: true }
  | { ok: false; error: ReservationSetupError | 'note'; field?: 'name' | 'duration' | 'price' | 'people'; weekday?: number; blockers?: ReservationBlocker[] };

const rateOf = (row: Record<string, unknown> | undefined): ReservationRate | null =>
  row && typeof row.kind === 'string'
    ? { kind: row.kind as ReservationRate['kind'], amount_tzs: (row.amount_tzs as number | null) ?? null, percent: row.percent == null ? null : Number(row.percent), max_guests_counted: (row.max_guests_counted as number | null) ?? null }
    : null;

export async function loadReservationSetup(providerId: string, businessType: string): Promise<SetupData> {
  const today = tanzaniaToday();
  const [status, rules, hours, closed, services, rate] = await Promise.all([
    supabase.rpc('reservation_setup_status', { p_provider: providerId }),
    supabase.from('providers').select('reservation_min_notice_min, reservation_max_days').eq('id', providerId).maybeSingle<{ reservation_min_notice_min: number; reservation_max_days: number }>(),
    supabase.from('business_hours').select('weekday, opens, closes').eq('provider_id', providerId),
    // Notes are not readable from the table (security review); the owner reads them through this function.
    supabase.rpc('business_closed_dates_with_notes', { p_provider: providerId }),
    supabase.from('business_services').select('id, name, duration_min, price_tzs, max_people, active, sort').eq('provider_id', providerId).order('sort').order('created_at').limit(reservationLimits.servicesPerBusiness),
    supabase.rpc('reservation_rate', { p_provider: providerId }),
  ]);
  const results = [status, rules, hours, closed, services, rate];
  const soon = results.some((x) => isNotAppliedError(x.error));
  if (!soon) {
    const failed = results.find((x) => x.error);
    if (failed?.error) throw new Error(failed.error.message);
  }
  const s = soon ? undefined : ((status.data ?? []) as Record<string, unknown>[])[0];
  const serviceRows = soon ? [] : ((services.data ?? []) as SetupService[]);
  // Spa and salon services without a listed price use the per-person rate: show it too.
  const unpriced = businessType !== 'restaurant' ? serviceRows.find((x) => x.active && x.price_tzs == null) : undefined;
  const unpricedRate = unpriced && !soon ? await supabase.rpc('reservation_rate', { p_provider: providerId, p_service: unpriced.id }) : null;
  return {
    soon,
    today,
    status: {
      takesReservations: Boolean(s?.takes_reservations),
      openNow: Boolean(s?.open_now),
      blockers: knownBlockers((s?.blockers as string[] | undefined) ?? []),
      termsVersion: (s?.terms_version as string | null) ?? null,
      termsCurrentVersion: (s?.terms_current_version as string | null) ?? null,
      termsAcceptedAt: (s?.terms_accepted_at as string | null) ?? null,
    },
    rules: {
      minNotice: rules.data?.reservation_min_notice_min ?? reservationLimits.minNoticeDefault,
      maxDays: rules.data?.reservation_max_days ?? reservationLimits.maxDaysDefault,
    },
    hours: soon ? [] : ((hours.data ?? []) as SetupData['hours']),
    closed: soon ? [] : ((closed.data ?? []) as SetupData['closed']).filter((c) => c.day >= today),
    services: serviceRows,
    rate: soon ? null : rateOf(((rate.data ?? []) as Record<string, unknown>[])[0]),
    unpricedRate: unpricedRate && !unpricedRate.error ? rateOf(((unpricedRate.data ?? []) as Record<string, unknown>[])[0]) : null,
  };
}

const fail = (error: { code?: string | null; message?: string | null }): SetupResult => ({ ok: false, error: reservationSetupError(error) });

export async function acceptTerms(providerId: string): Promise<SetupResult> {
  const { error } = await supabase.rpc('accept_reservation_terms', { p_provider: providerId, p_version: RESERVATION_TERMS_VERSION });
  return error ? fail(error) : { ok: true };
}

/** On: the database returns the reasons it cannot be switched on yet (empty = done). Off always works. */
export async function setReservationsOn(providerId: string, on: boolean): Promise<SetupResult> {
  const { data, error } = await supabase.rpc('set_takes_reservations', { p_provider: providerId, p_on: on });
  if (error) return fail(error);
  const blockers = knownBlockers((data ?? []) as string[]);
  return blockers.length > 0 ? { ok: false, error: 'invalid', blockers } : { ok: true };
}

export async function saveHours(providerId: string, days: Record<number, OpeningPeriod[]>): Promise<SetupResult> {
  const payload = hoursPayload(days);
  if (!payload.ok) return { ok: false, error: 'invalid', weekday: payload.weekday };
  const { error } = await supabase.rpc('set_business_hours', { p_provider: providerId, p_hours: payload.hours });
  return error ? fail(error) : { ok: true };
}

export async function addClosedDate(providerId: string, day: string, note: string): Promise<SetupResult> {
  const range = closedDateRange(tanzaniaToday());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`)) || day < range.min || day > range.max) return { ok: false, error: 'range' };
  if (!closedNoteOk(note)) return { ok: false, error: 'note' };
  const { error } = await supabase.from('business_closed_dates').insert({ provider_id: providerId, day, note: note.trim() || null });
  return error ? fail(error) : { ok: true };
}

export async function updateClosedNote(providerId: string, day: string, note: string): Promise<SetupResult> {
  if (!closedNoteOk(note)) return { ok: false, error: 'note' };
  const { error } = await supabase.from('business_closed_dates').update({ note: note.trim() || null }).eq('provider_id', providerId).eq('day', day);
  return error ? fail(error) : { ok: true };
}

export async function removeClosedDate(providerId: string, day: string): Promise<SetupResult> {
  const { error } = await supabase.from('business_closed_dates').delete().eq('provider_id', providerId).eq('day', day);
  return error ? fail(error) : { ok: true };
}

/** Adds a service (no id) or saves one. New services go to the end of the list. */
export async function saveService(providerId: string, serviceId: string | null, input: ServiceInput, nextSort: number): Promise<SetupResult> {
  const field = serviceInputError(input);
  if (field) return { ok: false, error: 'invalid', field };
  const row = { name: input.name.trim(), duration_min: input.duration_min, price_tzs: input.price_tzs, max_people: input.max_people };
  const { error } = serviceId
    ? await supabase.from('business_services').update(row).eq('id', serviceId).eq('provider_id', providerId)
    : await supabase.from('business_services').insert({ ...row, provider_id: providerId, sort: Math.min(nextSort, 1000) });
  return error ? fail(error) : { ok: true };
}

export async function setServiceActive(providerId: string, serviceId: string, active: boolean): Promise<SetupResult> {
  const { error } = await supabase.from('business_services').update({ active }).eq('id', serviceId).eq('provider_id', providerId);
  return error ? fail(error) : { ok: true };
}

export async function removeService(providerId: string, serviceId: string): Promise<SetupResult> {
  const { error } = await supabase.from('business_services').delete().eq('id', serviceId).eq('provider_id', providerId);
  return error ? fail(error) : { ok: true };
}

/** Saves the order of the services as shown (sort 0, 1, 2 ...). */
export async function orderServices(providerId: string, serviceIds: string[]): Promise<SetupResult> {
  for (const [sort, id] of serviceIds.entries()) {
    const { error } = await supabase.from('business_services').update({ sort }).eq('id', id).eq('provider_id', providerId);
    if (error) return fail(error);
  }
  return { ok: true };
}

export async function saveRules(providerId: string, minNotice: number, maxDays: number): Promise<SetupResult> {
  const l = reservationLimits;
  if (!Number.isInteger(minNotice) || minNotice < l.minNoticeMin || minNotice > l.minNoticeMax || !Number.isInteger(maxDays) || maxDays < l.maxDaysMin || maxDays > l.maxDaysMax) {
    return { ok: false, error: 'invalid' };
  }
  const { error } = await supabase.from('providers').update({ reservation_min_notice_min: minNotice, reservation_max_days: maxDays }).eq('id', providerId);
  return error ? fail(error) : { ok: true };
}
