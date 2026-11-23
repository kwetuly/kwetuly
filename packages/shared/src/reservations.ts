// Reservations, slice 1 (business setup). Mirrors supabase/migrations/20261122200000_reservation_setup.sql;
// reservations.test.ts compares the two. The database is the authority: screens use these only for
// labels, form limits and to read the codes the functions return.

import { addDaysIso } from './person-documents';

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
  'type_not_approved', // the business type was changed after Kwetuly approved it
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

// ---------------------------------------------------------------------------------------------------
// Owner setup screens (website /dashboard/business/reservations-setup and the app's reservations-setup)
// ---------------------------------------------------------------------------------------------------

/**
 * PostgREST and Postgres codes for "this function, table or column is not on the database yet".
 * While migration 20261122200000 is not applied, the setup screens show "opens soon" instead of an error.
 */
const NOT_APPLIED_CODES = new Set(['PGRST202', 'PGRST204', 'PGRST205', '42P01', '42883', '42703']);

export function isNotAppliedError(error: { code?: string | null } | null | undefined): boolean {
  return !!error?.code && NOT_APPLIED_CODES.has(error.code);
}

/** True for restaurant, spa and salon. */
export function isReservableType(type: string | null | undefined): type is ReservableBusinessType {
  return (reservableBusinessTypes as readonly string[]).includes(type ?? '');
}

/** Blocker codes from the database, in the known order; unknown codes are dropped. */
export function knownBlockers(codes: readonly string[] | null | undefined): ReservationBlocker[] {
  const set = new Set(codes ?? []);
  return reservationBlockers.filter((code) => set.has(code));
}

/** Weekdays in the order the setup screens show them: Monday first, Sunday last. */
export const weekdaysMondayFirst = [1, 2, 3, 4, 5, 6, 0] as const;

/** Closed dates may be set from today (Tanzania) up to one year ahead. */
export function closedDateRange(today: string): { min: string; max: string } {
  return { min: today, max: addDaysIso(today, 365) };
}

/** "TZS 12,000" */
export function formatTzs(amount: number): string {
  return `TZS ${Math.round(amount).toLocaleString('en-US')}`;
}

export type OpeningPeriod = { opens: string; closes: string };
export type BusinessHourRow = { weekday: number; opens: string; closes: string };

/** business_hours rows ("08:00:00") grouped per weekday as "HH:MM" periods, sorted by opening time. */
export function hoursByWeekday(rows: readonly BusinessHourRow[]): Record<number, OpeningPeriod[]> {
  const days: Record<number, OpeningPeriod[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const r of rows) days[r.weekday]?.push({ opens: r.opens.slice(0, 5), closes: r.closes.slice(0, 5) });
  for (const d of weekdays) days[d].sort((a, b) => a.opens.localeCompare(b.opens));
  return days;
}

/** The p_hours payload for set_business_hours, or the first weekday whose periods are not valid. */
export function hoursPayload(days: Record<number, OpeningPeriod[]>): { ok: true; hours: BusinessHourRow[] } | { ok: false; weekday: number } {
  const hours: BusinessHourRow[] = [];
  for (const d of weekdaysMondayFirst) {
    const periods = days[d] ?? [];
    if (!validDayPeriods(periods)) return { ok: false, weekday: d };
    for (const p of periods) hours.push({ weekday: d, opens: p.opens, closes: p.closes });
  }
  return { ok: true, hours };
}

export type ServiceInput = { name: string; duration_min: number; price_tzs: number | null; max_people: number };

/** Checks a service form the same way as the table; returns the field that is wrong, or null. */
export function serviceInputError(s: ServiceInput): 'name' | 'duration' | 'price' | 'people' | null {
  const name = s.name.trim();
  const l = reservationLimits;
  if (name.length < l.serviceNameMin || name.length > l.serviceNameMax || /[0-9]{6,}/.test(name) || /(https?:\/\/|www\.|@)/i.test(name)) return 'name';
  if (!Number.isInteger(s.duration_min) || s.duration_min < l.durationMin || s.duration_min > l.durationMax) return 'duration';
  if (s.price_tzs != null && (!Number.isInteger(s.price_tzs) || s.price_tzs < l.priceTzsMin || s.price_tzs > l.priceTzsMax)) return 'price';
  if (!Number.isInteger(s.max_people) || s.max_people < 1 || s.max_people > l.maxPeopleMax) return 'people';
  return null;
}

/** A closed-date note is fine when empty, or up to 80 characters without long numbers or links. */
export function closedNoteOk(note: string): boolean {
  const n = note.trim();
  return n.length <= reservationLimits.closedDateNoteMax && !/[0-9]{6,}/.test(n) && !/(https?:\/\/|www\.)/i.test(n);
}

export type ReservationSetupError = 'soon' | 'duplicate' | 'range' | 'too_many' | 'terms_outdated' | 'invalid' | 'failed';

/** A database error from the setup writes, as a code the screens turn into a polite line. */
export function reservationSetupError(error: { code?: string | null; message?: string | null } | null | undefined): ReservationSetupError {
  if (isNotAppliedError(error)) return 'soon';
  const message = error?.message ?? '';
  if (error?.code === '23505') return 'duplicate';
  if (message.includes('terms_outdated')) return 'terms_outdated';
  if (message.includes('At most 40')) return 'too_many';
  if (message.includes('one year ahead')) return 'range';
  if (error?.code === '23514') return 'invalid';
  return 'failed';
}
