import { percentCommissionTzs, percentToBasisPoints, roundHalfUpDiv } from './reservations';

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
  'too_many_requests',
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
  'too_many_cancellations',
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
  /** Requests a traveller may create in 24 hours; accounts younger than newAccountDays get fewer. */
  maxRequestsPerDay: 10,
  newAccountRequestsPerDay: 3,
  newAccountDays: 3,
  /** Cancellations a traveller may make in 24 hours. */
  maxCancellationsPerDay: 5,
  /** "Did not come" can be marked this many minutes after the time at the earliest. */
  noShowMarkAfterMin: 30,
  /** A business cancelling a confirmed reservation less than this many hours before is a late cancel. */
  lateCancelHours: 2,
  /** Notes (traveller and business) are cleared this many days after the reservation date. */
  textsClearDays: 30,
  /**
   * Who must answer (the business for a request, the traveller for an other-time offer) answers within
   * this many hours, and never later than the time minus the business's minimum notice (answer_by).
   */
  answerWithinHours: 4,
  /** The reservation job runs this often, so a missed answer-by time closes within this many minutes. */
  jobEveryMinutes: 15,
  /** guide_code_status() stops checking after this many wrong codes in an hour. */
  guideCodeFailuresPerHour: 10,
  /** guide_code_status() stops checking after this many checks of any kind in an hour. */
  guideCodeChecksPerHour: 30,
} as const;

/** Admin decisions on a dispute. business_fault: nothing owed and no strike for the traveller. */
export const reservationDisputeOutcomes = ['completed', 'no_show', 'business_fault'] as const;
export type ReservationDisputeOutcome = (typeof reservationDisputeOutcomes)[number];

/** The rate copied onto a reservation at request time. */
export type ReservationRateSnapshot = {
  commission_kind: 'per_guest' | 'percent' | 'per_person';
  commission_rate_tzs: number | null;
  commission_percent: number | null;
  max_guests_counted: number | null;
  /** Listed price per person. */
  price_basis_tzs: number | null;
  /** The service's group discount, copied at request time (percent rates only). */
  group_discount_min_people?: number | null;
  group_discount_percent?: number | null;
  /** People booked; the group discount applies when this reaches group_discount_min_people. */
  party_size?: number | null;
};

/** True when the booking qualifies for the service's group discount. */
export function reservationGroupDiscountApplies(rate: Pick<ReservationRateSnapshot, 'group_discount_min_people' | 'group_discount_percent'>, partySize: number): boolean {
  return rate.group_discount_min_people != null && rate.group_discount_percent != null && partySize >= rate.group_discount_min_people;
}

/** The price per person used for commission: the listed price, less the group discount when it applies. */
export function reservationPricePerPerson(rate: ReservationRateSnapshot, partySize: number): number | null {
  if (rate.price_basis_tzs == null) return null;
  return reservationGroupDiscountApplies(rate, partySize)
    ? (rate.price_basis_tzs * (100 - (rate.group_discount_percent as number))) / 100
    : rate.price_basis_tzs;
}

/**
 * Commission for a completed reservation, in whole shillings, exactly as the database trigger works
 * it out: per guest x min(came, max counted); per person x came; percent x price per person (less the
 * group discount when party_size reaches its minimum) x came, rounded half up. came = people who came
 * (the business's count, or everyone booked); party_size defaults to came.
 */
export function completedReservationCommission(rate: ReservationRateSnapshot, came: number): number | null {
  if (!Number.isInteger(came) || came < 1) return null;
  if (rate.commission_kind === 'percent') {
    if (rate.commission_percent == null || rate.price_basis_tzs == null) return null;
    const discount = reservationGroupDiscountApplies(rate, rate.party_size ?? came) ? (rate.group_discount_percent as number) : 0;
    // One rounding at the end, like the database (numeric arithmetic, then round).
    return percentCommissionTzs(rate.price_basis_tzs, discount, came, rate.commission_percent);
  }
  if (rate.commission_rate_tzs == null) return null;
  const counted = rate.commission_kind === 'per_guest' ? Math.min(came, rate.max_guests_counted ?? came) : came;
  return rate.commission_rate_tzs * counted;
}

/** The linked guide's recorded share of Kwetuly's commission (0 when no guide). */
export function reservationGuideShare(commissionTzs: number, guideLinked: boolean, pct: number = reservationRules.guideSharePct): number {
  if (!guideLinked || pct <= 0) return 0;
  return Number(roundHalfUpDiv(BigInt(commissionTzs) * percentToBasisPoints(pct), BigInt(10_000)));
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

/**
 * True when the traveller's answer contradicts the outcome (the commission is then held): "no" to a
 * completed visit, "yes" to a no-show, or more people than the business counted.
 */
export function reservationAnswerMismatch(
  status: ReservationStatus,
  travellerSaidHappened: boolean | null,
  travellerSaidPeople: number | null = null,
  cameCount: number | null = null,
): boolean {
  if (travellerSaidHappened == null) return false;
  if (status === 'completed' && travellerSaidHappened && travellerSaidPeople != null && cameCount != null) {
    return travellerSaidPeople > cameCount;
  }
  return (status === 'completed' && !travellerSaidHappened) || (status === 'no_show' && travellerSaidHappened);
}

/** The fixed code from a database error message ("reservation_refused: too_soon" -> "too_soon"). */
export function reservationErrorCode(message: string | null | undefined): string | null {
  const m = /reservation(?:_action)?_refused: ([a-z_]+)/.exec(message ?? '');
  return m ? m[1] : null;
}
