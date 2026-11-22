// Helpers for the reservation screens (slice 2): Tanzania times, the free start times of a day and
// which buttons each side sees. The database decides every rule again (place_reservation,
// reservation_action); these only keep the screens from offering what it would refuse.
import type { OpeningPeriod } from './reservations';
import type { ReservationAction, ReservationStatus } from './reservation-rules';
import { reservationRules } from './reservation-rules';

/** Tanzania has no summer time: always UTC+3. */
export const TANZANIA_OFFSET = '+03:00';
export const TANZANIA_TZ = 'Africa/Dar_es_Salaam';

/** A Tanzania day and "HH:MM" as an ISO time for the database. */
export function tanzaniaStartsAt(day: string, time: string): string {
  return `${day}T${time}:00${TANZANIA_OFFSET}`;
}

/** An ISO time as the Tanzania day and "HH:MM". */
export function tanzaniaParts(iso: string): { day: string; time: string } {
  const d = new Date(new Date(iso).getTime() + 3 * 3600_000);
  const s = d.toISOString();
  return { day: s.slice(0, 10), time: s.slice(11, 16) };
}

/** 0 Sunday .. 6 Saturday for a "YYYY-MM-DD" day. */
export function weekdayOfDay(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toClock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/**
 * Start times ("HH:MM", every 15 minutes) on one Tanzania day that the database would accept: inside an
 * opening period with the whole visit before closing, not a closed date, at least the minimum notice
 * from now and not further ahead than the business allows.
 */
export function reservationSlots(input: {
  day: string;
  periods: readonly OpeningPeriod[];
  durationMin: number;
  minNoticeMin: number;
  maxDays: number;
  today: string;
  closedDays: readonly string[];
  now?: Date;
}): string[] {
  const { day, periods, durationMin, minNoticeMin, maxDays, today, closedDays } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < today || closedDays.includes(day)) return [];
  const last = new Date(`${today}T00:00:00Z`);
  last.setUTCDate(last.getUTCDate() + maxDays);
  if (day > last.toISOString().slice(0, 10)) return [];
  const earliest = (input.now ?? new Date()).getTime() + minNoticeMin * 60_000;
  const step = reservationRules.slotMinutes;
  const out: string[] = [];
  for (const p of periods) {
    const opens = Math.ceil(toMinutes(p.opens) / step) * step;
    for (let m = opens; m + durationMin <= toMinutes(p.closes); m += step) {
      const time = toClock(m);
      if (new Date(tanzaniaStartsAt(day, time)).getTime() >= earliest) out.push(time);
    }
  }
  return [...new Set(out)].sort();
}

/** A reservation time in the reader's language, Tanzania time: "Sat 6 Dec 2026, 19:30". */
export function formatReservationTime(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return d.toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TANZANIA_TZ });
  } catch {
    const { day, time } = tanzaniaParts(iso);
    return `${day} ${time}`;
  }
}

type Row = { status: ReservationStatus; starts_at: string };

/** The traveller's buttons for one reservation. */
export function travellerReservationActions(r: Row, now: Date = new Date()): ('cancel' | 'accept_offer' | 'refuse_offer')[] {
  const future = new Date(r.starts_at).getTime() > now.getTime();
  if (r.status === 'requested') return ['cancel'];
  if (r.status === 'other_time_offered') return ['accept_offer', 'refuse_offer', 'cancel'];
  if (r.status === 'confirmed' && future) return ['cancel'];
  return [];
}

/** The business owner's buttons for one reservation. */
export function ownerReservationActions(r: Row, now: Date = new Date()): ReservationAction[] {
  const future = new Date(r.starts_at).getTime() > now.getTime();
  if (r.status === 'requested') return future ? ['confirm', 'decline', 'offer_time'] : [];
  if (r.status === 'confirmed') return future ? ['cancel'] : ['mark_came', 'mark_no_show'];
  return [];
}

/** The first day of a month as "YYYY-MM-01" from "YYYY-MM" (or the Tanzania month of today). */
export function monthStart(month: string | null | undefined, today: string): string {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month ?? '') ? `${month}-01` : `${today.slice(0, 7)}-01`;
}

/** Months from the current one back, as "YYYY-MM", for the statement picker. */
export function recentMonths(today: string, count = 12): string[] {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7)) - 1;
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - i, 1));
    return d.toISOString().slice(0, 7);
  });
}

/** A fixed text for a refusal from the database, or null (then say the general "sorry"). */
export function refusalText<T extends Record<string, string>>(texts: T, message: string | null | undefined): string | null {
  const m = /reservation(?:_action)?_refused: ([a-z_]+)/.exec(message ?? '');
  return m && m[1] in texts ? texts[m[1] as keyof T] : null;
}
