import { describe, expect, it } from 'vitest';
import {
  monthStart,
  ownerReservationActions,
  recentMonths,
  reservationSlots,
  tanzaniaParts,
  tanzaniaStartsAt,
  travellerReservationActions,
  weekdayOfDay,
} from './reservation-screens';

describe('Tanzania times', () => {
  it('round trip', () => {
    expect(tanzaniaStartsAt('2026-12-05', '19:30')).toBe('2026-12-05T19:30:00+03:00');
    expect(tanzaniaParts('2026-12-05T22:15:00Z')).toEqual({ day: '2026-12-06', time: '01:15' });
    expect(weekdayOfDay('2026-11-22')).toBe(0);
  });
});

describe('free start times', () => {
  const base = { periods: [{ opens: '12:00', closes: '14:00' }, { opens: '18:00', closes: '19:00' }], durationMin: 60, minNoticeMin: 120, maxDays: 60, today: '2026-11-22', closedDays: ['2026-11-25'] };
  it('quarter hours with the whole visit before closing', () => {
    expect(reservationSlots({ ...base, day: '2026-11-23', now: new Date('2026-11-22T06:00:00Z') })).toEqual(['12:00', '12:15', '12:30', '12:45', '13:00', '18:00']);
  });
  it('minimum notice, closed dates, past and too far', () => {
    // 10:30 Tanzania now + 2 h notice: from 12:30.
    expect(reservationSlots({ ...base, day: '2026-11-22', now: new Date('2026-11-22T07:30:00Z') })[0]).toBe('12:30');
    expect(reservationSlots({ ...base, day: '2026-11-25', now: new Date('2026-11-22T06:00:00Z') })).toEqual([]);
    expect(reservationSlots({ ...base, day: '2026-11-21', now: new Date('2026-11-22T06:00:00Z') })).toEqual([]);
    expect(reservationSlots({ ...base, day: '2027-02-01', now: new Date('2026-11-22T06:00:00Z') })).toEqual([]);
  });
});

describe('buttons', () => {
  const now = new Date('2026-11-22T12:00:00Z');
  it('traveller', () => {
    expect(travellerReservationActions({ status: 'other_time_offered', starts_at: '2026-11-23T10:00:00Z' }, now)).toEqual(['accept_offer', 'refuse_offer', 'cancel']);
    expect(travellerReservationActions({ status: 'confirmed', starts_at: '2026-11-21T10:00:00Z' }, now)).toEqual([]);
  });
  it('owner', () => {
    expect(ownerReservationActions({ status: 'requested', starts_at: '2026-11-23T10:00:00Z' }, now)).toEqual(['confirm', 'decline', 'offer_time']);
    expect(ownerReservationActions({ status: 'confirmed', starts_at: '2026-11-21T10:00:00Z' }, now)).toEqual(['mark_came', 'mark_no_show']);
    expect(ownerReservationActions({ status: 'completed', starts_at: '2026-11-21T10:00:00Z' }, now)).toEqual([]);
  });
  it('months', () => {
    expect(monthStart('2026-10', '2026-11-22')).toBe('2026-10-01');
    expect(monthStart('bad', '2026-11-22')).toBe('2026-11-01');
    expect(recentMonths('2026-01-15', 3)).toEqual(['2026-01', '2025-12', '2025-11']);
  });
});
