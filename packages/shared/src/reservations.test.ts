import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  RESERVATION_TERMS_VERSION,
  reservableBusinessTypes,
  reservationBlockers,
  reservationCommissionTzs,
  reservationLimits,
  reservationPriceCodes,
  reservationRateKinds,
  validDayPeriods,
} from './reservations';

const sql = readFileSync(new URL('../../../supabase/migrations/20261122200000_reservation_setup.sql', import.meta.url), 'utf8');

describe('reservations match migration 20261122200000', () => {
  it('terms version', () => {
    expect(sql).toContain(`select '${RESERVATION_TERMS_VERSION}'::text;`);
  });
  it('blocker codes, in order', () => {
    const body = sql.match(/create or replace function private\.reservation_blockers[\s\S]*?\n\$\$;/)![0];
    const codes = [...body.matchAll(/array_append\(b, '([a-z_]+)'\)/g)].map((m) => m[1]);
    expect([...new Set(codes)]).toEqual([...reservationBlockers]);
  });
  it('rate kinds', () => {
    const body = sql.match(/create or replace function private\.reservation_rate_for[\s\S]*?\n\$\$;/)![0];
    const kinds = [...body.matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]);
    expect([...new Set(kinds)].sort()).toEqual([...reservationRateKinds].sort());
  });
  it('service codes and reservable types', () => {
    expect(sql).toContain(`service_code in ('${reservationPriceCodes.join("', '")}')`);
    expect(sql).toContain(`not in ('${reservableBusinessTypes.join("', '")}')`);
  });
  it('limits', () => {
    expect(sql).toContain(`duration_min between ${reservationLimits.durationMin} and ${reservationLimits.durationMax}`);
    expect(sql).toContain(`default ${reservationLimits.durationDefault} check (duration_min`);
    expect(sql).toContain(`max_people between 1 and ${reservationLimits.maxPeopleMax}`);
    expect(sql).toContain(`price_tzs between ${reservationLimits.priceTzsMin} and ${reservationLimits.priceTzsMax.toString()}`);
    expect(sql).toContain(`>= ${reservationLimits.servicesPerBusiness} then`);
    expect(sql).toContain(`reservation_min_notice_min between ${reservationLimits.minNoticeMin} and ${reservationLimits.minNoticeMax}`);
    expect(sql).toContain(`reservation_max_days between ${reservationLimits.maxDaysMin} and ${reservationLimits.maxDaysMax}`);
    expect(sql).toContain(`percent <= ${reservationLimits.percentMax}`);
    expect(sql).toContain(`amount_tzs <= ${reservationLimits.reservationAmountTzsMax}`);
    expect(sql).toContain(`max_guests_counted between 1 and ${reservationLimits.maxGuestsCountedMax}`);
  });
  it('seeds no amount', () => {
    const seed = sql.match(/insert into public\.price_list \(account_type, business_type, service_code, period, note\)[\s\S]*?;\n/)![0];
    expect(seed).not.toMatch(/amount_tzs|percent\b(?!')/);
    expect(seed.match(/\('[a-z]+', 'reservation_commission'|\(null, 'reservation_unpriced_fee'/g)).toHaveLength(4);
  });
});

describe('commission arithmetic', () => {
  it('per guest, capped', () => {
    const rate = { kind: 'per_guest', amount_tzs: 2000, percent: null, max_guests_counted: 10 } as const;
    expect(reservationCommissionTzs(rate, 4, null)).toBe(8000);
    expect(reservationCommissionTzs(rate, 25, null)).toBe(20000);
    expect(reservationCommissionTzs(rate, 0, null)).toBeNull();
  });
  it('percent of the listed price, rounded to shillings', () => {
    const rate = { kind: 'percent', amount_tzs: null, percent: 10, max_guests_counted: null } as const;
    expect(reservationCommissionTzs(rate, 2, 45_005)).toBe(9001);
    expect(reservationCommissionTzs(rate, 1, null)).toBeNull();
  });
  it('per person for unpriced services', () => {
    const rate = { kind: 'per_person', amount_tzs: 3000, percent: null, max_guests_counted: null } as const;
    expect(reservationCommissionTzs(rate, 3, null)).toBe(9000);
  });
});

describe('opening periods', () => {
  it('valid and invalid days', () => {
    expect(validDayPeriods([{ opens: '08:00', closes: '11:00' }, { opens: '12:00', closes: '15:00' }])).toBe(true);
    expect(validDayPeriods([{ opens: '08:00', closes: '12:00' }, { opens: '11:00', closes: '15:00' }])).toBe(false);
    expect(validDayPeriods([{ opens: '10:00', closes: '09:00' }])).toBe(false);
    expect(validDayPeriods([{ opens: '24:00', closes: '25:00' }])).toBe(false);
    expect(validDayPeriods(Array.from({ length: 4 }, (_, i) => ({ opens: `0${i}:00`, closes: `0${i}:30` })))).toBe(false);
  });
});
