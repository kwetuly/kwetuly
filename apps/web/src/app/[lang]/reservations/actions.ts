'use server';

import { refresh } from 'next/cache';
import { isNotAppliedError, reservationActions, reservationErrorCode, type ReservationAction } from '@kwetuly/shared';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

// Reservations (slice 2): place a request, move one along (traveller or business owner) and answer
// "Did your visit happen?". The database functions decide everything; these only check the shape and
// pass back the fixed refusal code, which the screens turn into a polite text. Nothing moves money.

export type ReservationResult = { ok: true; id?: string } | { ok: false; error: 'soon' | 'sign_in' | 'bad_request' | 'refused' | 'failed'; code?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+03:00$/;

function fail(error: { code?: string | null; message?: string | null }): ReservationResult {
  if (isNotAppliedError(error)) return { ok: false, error: 'soon' };
  const code = reservationErrorCode(error.message);
  return code ? { ok: false, error: 'refused', code } : { ok: false, error: 'failed' };
}

export type PlaceInput = {
  providerId: string;
  serviceId: string | null;
  startsAt: string;
  partySize: number;
  note: string;
  dietLine: string;
  dietConsent: boolean;
  guideCode: string;
};

// Server action inputs come from the browser: every field is type-checked before use (security L-D).
const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

export async function placeReservation(input: PlaceInput): Promise<ReservationResult> {
  const i = (input ?? {}) as Record<string, unknown>;
  if (
    !isUuid(i.providerId) ||
    !(i.serviceId === null || isUuid(i.serviceId)) ||
    !(typeof i.startsAt === 'string' && ISO.test(i.startsAt)) ||
    !(typeof i.partySize === 'number' && Number.isInteger(i.partySize) && i.partySize >= 1 && i.partySize <= 100) ||
    !isStr(i.note, 400) ||
    !isStr(i.dietLine, 200) ||
    typeof i.dietConsent !== 'boolean' ||
    !isStr(i.guideCode, 40)
  ) {
    return { ok: false, error: 'bad_request' };
  }
  if (!(await getCurrentUser())) return { ok: false, error: 'sign_in' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('place_reservation', {
    p_provider: i.providerId,
    p_service: i.serviceId,
    p_starts_at: i.startsAt,
    p_party_size: i.partySize,
    p_note: i.note.trim() || null,
    p_diet_line: i.dietLine.trim() || null,
    p_diet_consent: i.dietConsent,
    p_guide_code: i.guideCode.trim() || null,
  });
  if (error) return fail(error);
  refresh();
  return { ok: true, id: typeof data === 'string' ? data : undefined };
}

/** One step for a reservation, by the traveller or the business owner (the database checks who). */
export async function actOnReservation(
  reservationId: string,
  action: ReservationAction,
  extra: { offeredStartsAt?: string | null; note?: string | null; cameCount?: number | null } = {},
): Promise<ReservationResult> {
  const x = (extra ?? {}) as Record<string, unknown>;
  if (!isUuid(reservationId) || typeof action !== 'string' || !(reservationActions as readonly string[]).includes(action)) return { ok: false, error: 'bad_request' };
  if (!(x.offeredStartsAt == null || (typeof x.offeredStartsAt === 'string' && ISO.test(x.offeredStartsAt)))) return { ok: false, error: 'bad_request' };
  if (!(x.note == null || isStr(x.note, 400))) return { ok: false, error: 'bad_request' };
  if (!(x.cameCount == null || (typeof x.cameCount === 'number' && Number.isInteger(x.cameCount)))) return { ok: false, error: 'bad_request' };
  if (!(await getCurrentUser())) return { ok: false, error: 'sign_in' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('reservation_action', {
    p_reservation: reservationId,
    p_action: action,
    p_offered_starts_at: (x.offeredStartsAt as string | null | undefined) ?? null,
    p_note: typeof x.note === 'string' ? x.note.trim() || null : null,
    p_came_count: (x.cameCount as number | null | undefined) ?? null,
  });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

export async function answerVisit(reservationId: string, happened: boolean, people: number | null = null): Promise<ReservationResult> {
  if (!isUuid(reservationId) || typeof happened !== 'boolean' || !(people === null || (typeof people === 'number' && Number.isInteger(people) && people >= 1))) return { ok: false, error: 'bad_request' };
  if (!(await getCurrentUser())) return { ok: false, error: 'sign_in' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('reservation_visit_answer', { p_reservation: reservationId, p_happened: happened, p_people: happened ? people : null });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

/** Checks a guide code before Send (guide_code_status); place_reservation accepts only codes checked in the last hour. */
export async function checkGuideCode(code: string): Promise<'ok' | 'unknown' | 'too_many' | 'soon' | 'failed'> {
  if (typeof code !== 'string' || !code.trim() || code.length > 40) return 'unknown';
  if (!(await getCurrentUser())) return 'failed';
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('guide_code_status', { p_code: code.trim() });
  if (error) return isNotAppliedError(error) ? 'soon' : 'failed';
  return data === 'ok' || data === 'unknown' || data === 'too_many' ? data : 'failed';
}
