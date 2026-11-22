// Reservations, slice 2 (requests, statuses, commission). Mirrors
// supabase/migrations/20261122300000_reservations.sql; reservation-rules.test.ts compares the two.
// The database decides every status and every commission; screens use these for labels and previews.
// Kwetuly never charges anyone: commission is recorded and listed, nothing more.

export const reservationStatuses = [
  'requested',
  'confirmed',
  'declined',
  'other_time_offered',
  'cancelled',
  'no_show',
  'completed',
] as const;
export type ReservationStatus = (typeof reservationStatuses)[number];

/** none = nothing owed; held = disputed, waiting for an admin; owed / invoiced / paid / waived. */
export const reservationCommissionStatuses = ['none', 'held', 'owed', 'invoiced', 'paid', 'waived'] as const;
export type ReservationCommissionStatus = (typeof reservationCommissionStatuses)[number];

/** Codes after "reservation_refused: " from place_reservation(). */
export const reservationRefusals = [
  'not_signed_in',
  'not_onboarded',
  'not_open',
  'own_business',
  'no_show_pause',
  'too_many_open',
  'too_many_today',
  'service_not_found',
  'service_required',
  'no_rate',
  'party_size',
  'time_not_allowed',
  'too_soon',
  'too_far',
  'closed_date',
  'outside_hours',
  'note_too_long',
  'diet_consent_needed',
  'diet_too_long',
  'guide_code_unknown',
] as const;
export type ReservationRefusal = (typeof reservationRefusals)[number];

/** p_action values for reservation_action(). */
export const reservationActions = [
  'confirm',
  'decline',
  'offer_time',
  'accept_offer',
  'refuse_offer',
  'cancel',
  'mark_came',
  'mark_no_show',
] as const;
export type ReservationAction = (typeof reservationActions)[number];

/** Codes after "reservation_action_refused: ". */
export const reservationActionRefusals = [
  'not_found',
  'note_too_long',
  'too_late',
  'too_early',
  'came_count',
  'not_allowed',
  'time_not_allowed',
  'too_soon',
  'too_far',
  'closed_date',
  'outside_hours',
] as const;
export type ReservationActionRefusal = (typeof reservationActionRefusals)[number];

export const reservationRules = {
  /** Half of Kwetuly's commission is recorded for a guide linked by guide code. */
  guideSharePct: 50,
  /** Diet lines are deleted this many days after the reservation date. */
  dietLineDays: 30,
  dietLineMax: 120,
  noteMax: 300,
  /** Restaurant reservations without a service: at most this many people. */
  restaurantMaxParty: 20,
  /** Default length (minutes) used for the opening-hours check when no service is chosen. */
  defaultDurationMin: 60,
  /** Start times on the quarter hour. */
  slotMinutes: 15,
  /** A confirmed reservation not marked by the business is completed this many days after its time. */
  autoCompleteDays: 3,
  /** Reminder to the business this many hours after the time. */
  ownerReminderHours: 2,
  /** "Did your visit happen?" from the day after, for this many days. */
  visitAnswerDays: 14,
  /** Traveller no-show limit: this many no-shows in noShowWindowDays pauses reserving for noShowPauseDays. */
  noShowLimit: 2,
  noShowWindowDays: 90,
  noShowPauseDays: 30,
  maxOpenRequests: 5,
  maxPerBusinessPerDay: 3,
} as const;

/** The rate copied onto a reservation at request time. */
export type ReservationRateSnapshot = {
  commission_kind: 'per_guest' | 'percent' | 'per_person';
  commission_rate_tzs: number | null;
  commission_percent: number | null;
  max_guests_counted: number | null;
  price_basis_tzs: number | null;
};

/**
 * Commission for a completed reservation, in whole shillings, exactly as the database trigger works
 * it out: per guest x min(came, max counted); per person x came; percent x listed price x came,
 * rounded half up. came = people who came (the business's count, or everyone booked).
 */
export function completedReservationCommission(rate: ReservationRateSnapshot, came: number): number | null {
  if (!Number.isInteger(came) || came < 1) return null;
  if (rate.commission_kind === 'percent') {
    if (rate.commission_percent == null || rate.price_basis_tzs == null) return null;
    return Math.round((rate.price_basis_tzs * came * rate.commission_percent) / 100);
  }
  if (rate.commission_rate_tzs == null) return null;
  const counted = rate.commission_kind === 'per_guest' ? Math.min(came, rate.max_guests_counted ?? came) : came;
  return rate.commission_rate_tzs * counted;
}

/** The linked guide's recorded share of Kwetuly's commission (0 when no guide). */
export function reservationGuideShare(commissionTzs: number, guideLinked: boolean, pct: number = reservationRules.guideSharePct): number {
  if (!guideLinked || pct <= 0) return 0;
  return Math.round((commissionTzs * pct) / 100);
}

/** Commission is owed only for completed, non-sample reservations without an open dispute. */
export function reservationCommissionBase(input: {
  status: ReservationStatus;
  isSample: boolean;
  disputed: boolean;
  disputeResolved: boolean;
}): 'none' | 'held' | 'owed' {
  if (input.status !== 'completed' || input.isSample) return 'none';
  if (input.disputed && !input.disputeResolved) return 'held';
  return 'owed';
}

/** True when the traveller's answer contradicts the outcome (the commission is then held). */
export function reservationAnswerMismatch(status: ReservationStatus, travellerSaidHappened: boolean | null): boolean {
  if (travellerSaidHappened == null) return false;
  return (status === 'completed' && !travellerSaidHappened) || (status === 'no_show' && travellerSaidHappened);
}

/** The fixed code from a database error message ("reservation_refused: too_soon" -> "too_soon"). */
export function reservationErrorCode(message: string | null | undefined): string | null {
  const m = /reservation(?:_action)?_refused: ([a-z_]+)/.exec(message ?? '');
  return m ? m[1] : null;
}
