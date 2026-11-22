// Reservations, slice 1 (business setup). Mirrors supabase/migrations/20261122200000_reservation_setup.sql;
// reservations.test.ts compares the two. The database is the authority: screens use these only for
// labels, form limits and to read the codes the functions return.

/** Current reservation terms for businesses. [legal] placeholder until the advocate's wording. */
export const RESERVATION_TERMS_VERSION = '2026-11-22-draft';

/** Business types that can take reservations. */
export const reservableBusinessTypes = ['restaurant', 'spa', 'salon'] as const;
export type ReservableBusinessType = (typeof reservableBusinessTypes)[number];

/**
 * Codes returned by reservation_setup_status().blockers and set_takes_reservations(), in the order
 * the database checks them. Empty list = the business can take reservations today.
 */
export const reservationBlockers = [
  'not_approved',
  'type_not_reservable',
  'terms_not_accepted',
  'no_opening_hours',
  'licence_check_missing',
  'no_commission_rate',
  'no_service',
  'service_needs_price',
] as const;
export type ReservationBlocker = (typeof reservationBlockers)[number];

/** How Kwetuly's commission is worked out (reservation_rate().kind). */
export const reservationRateKinds = ['per_guest', 'percent', 'per_person'] as const;
export type ReservationRateKind = (typeof reservationRateKinds)[number];

/** price_list service codes editable on /admin/prices today. */
export const reservationPriceCodes = ['reservation_commission', 'reservation_unpriced_fee'] as const;
export type ReservationPriceCode = (typeof reservationPriceCodes)[number];

/** Form limits, the same as the table checks. */
export const reservationLimits = {
  periodsPerDay: 3,
  serviceNameMin: 2,
  serviceNameMax: 80,
  durationMin: 15,
  durationMax: 480,
  durationDefault: 90,
  maxPeopleMax: 50,
  priceTzsMin: 100,
  priceTzsMax: 50_000_000,
  servicesPerBusiness: 40,
  closedDateNoteMax: 80,
  minNoticeMin: 30,
  minNoticeMax: 2880,
  minNoticeDefault: 120,
  maxDaysMin: 1,
  maxDaysMax: 180,
  maxDaysDefault: 60,
  percentMax: 50,
  reservationAmountTzsMax: 200_000,
  maxGuestsCountedMax: 100,
} as const;

export type ReservationRate = {
  kind: ReservationRateKind;
  amount_tzs: number | null;
  percent: number | null;
  max_guests_counted: number | null;
};

/**
 * What the business owes Kwetuly for one completed reservation, in whole shillings (slice 2 records
 * this; nobody is charged by Kwetuly). people = guests who came; priceTzs = the service's listed price.
 * Returns null when the rate cannot be applied.
 */
export function reservationCommissionTzs(rate: ReservationRate, people: number, priceTzs: number | null): number | null {
  if (!Number.isInteger(people) || people < 1) return null;
  if (rate.kind === 'percent') {
    if (rate.percent == null || priceTzs == null) return null;
    return Math.round((priceTzs * people * rate.percent) / 100);
  }
  if (rate.amount_tzs == null) return null;
  const counted = rate.kind === 'per_guest' && rate.max_guests_counted != null ? Math.min(people, rate.max_guests_counted) : people;
  return rate.amount_tzs * counted;
}

/** 0 Sunday .. 6 Saturday, as in business_hours.weekday. */
export const weekdays = [0, 1, 2, 3, 4, 5, 6] as const;

/** "HH:MM" 24-hour time, as the hours form sends it. */
export function isClockTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** True when the periods of one day are valid: closes after opens, no overlap, at most 3. */
export function validDayPeriods(periods: { opens: string; closes: string }[]): boolean {
  if (periods.length > reservationLimits.periodsPerDay) return false;
  if (!periods.every((p) => isClockTime(p.opens) && isClockTime(p.closes) && p.closes > p.opens)) return false;
  const sorted = [...periods].sort((a, b) => a.opens.localeCompare(b.opens));
  return sorted.every((p, i) => i === 0 || sorted[i - 1].closes <= p.opens);
}
