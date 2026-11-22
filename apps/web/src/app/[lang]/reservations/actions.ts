'use server';

import { refresh } from 'next/cache';
import { isNotAppliedError, reservationActions, reservationErrorCode, type ReservationAction } from '@kwetuly/shared';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

// Reservations (slice 2): place a request, move one along (traveller or business owner) and answer
// "Did your visit happen?". The database functions decide everything; these only check the shape and
// pass back the fixed refusal code, which the screens turn into a polite text. Nothing moves money.

export type ReservationResult = { ok: true } | { ok: false; error: 'soon' | 'sign_in' | 'bad_request' | 'refused' | 'failed'; code?: string };

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

export async function placeReservation(input: PlaceInput): Promise<ReservationResult> {
  if (!UUID.test(input.providerId) || (input.serviceId !== null && !UUID.test(input.serviceId)) || !ISO.test(input.startsAt) || !Number.isInteger(input.partySize)) {
    return { ok: false, error: 'bad_request' };
  }
  if (!(await getCurrentUser())) return { ok: false, error: 'sign_in' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('place_reservation', {
    p_provider: input.providerId,
    p_service: input.serviceId,
    p_starts_at: input.startsAt,
    p_party_size: input.partySize,
    p_note: input.note.trim().slice(0, 400) || null,
    p_diet_line: input.dietLine.trim().slice(0, 200) || null,
    p_diet_consent: input.dietConsent,
    p_guide_code: input.guideCode.trim().slice(0, 40) || null,
  });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

/** One step for a reservation, by the traveller or the business owner (the database checks who). */
export async function actOnReservation(
  reservationId: string,
  action: ReservationAction,
  extra: { offeredStartsAt?: string | null; note?: string | null; cameCount?: number | null } = {},
): Promise<ReservationResult> {
  if (!UUID.test(reservationId) || !(reservationActions as readonly string[]).includes(action)) return { ok: false, error: 'bad_request' };
  if (extra.offeredStartsAt && !ISO.test(extra.offeredStartsAt)) return { ok: false, error: 'bad_request' };
  if (!(await getCurrentUser())) return { ok: false, error: 'sign_in' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('reservation_action', {
    p_reservation: reservationId,
    p_action: action,
    p_offered_starts_at: extra.offeredStartsAt ?? null,
    p_note: extra.note?.trim().slice(0, 400) || null,
    p_came_count: extra.cameCount ?? null,
  });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

export async function answerVisit(reservationId: string, happened: boolean, people: number | null = null): Promise<ReservationResult> {
  if (!UUID.test(reservationId) || (people !== null && (!Number.isInteger(people) || people < 1))) return { ok: false, error: 'bad_request' };
  if (!(await getCurrentUser())) return { ok: false, error: 'sign_in' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('reservation_visit_answer', { p_reservation: reservationId, p_happened: happened, p_people: happened ? people : null });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}
