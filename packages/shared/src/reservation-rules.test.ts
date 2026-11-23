import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  completedReservationCommission,
  reservationActionRefusals,
  reservationActions,
  reservationAnswerMismatch,
  reservationCommissionBase,
  reservationCommissionStatuses,
  reservationDisputeOutcomes,
  reservationErrorCode,
  reservationGroupDiscountApplies,
  reservationPricePerPerson,
  reservationGuideShare,
  reservationRefusals,
  reservationRules,
  reservationStatuses,
} from './reservation-rules';

const sql = readFileSync(new URL('../../../supabase/migrations/20261122300000_reservations.sql', import.meta.url), 'utf8');
const quoted = (block: string) => [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
const fn = (name: string) => sql.match(new RegExp(`create or replace function ${name.replace('.', '\\.')}[\\s\\S]*?\\n\\$\\$;`))![0];

describe('reservations match migration 20261122300000', () => {
  it('statuses', () => {
    const block = sql.match(/create type public\.reservation_status as enum\s*\(([^)]*)\)/)![1];
    expect(quoted(block)).toEqual([...reservationStatuses]);
  });
  it('commission statuses', () => {
    const block = sql.match(/check \(commission_status in \(([^)]*)\)\)/)![1];
    expect(quoted(block)).toEqual([...reservationCommissionStatuses]);
  });
  it('refusal codes of place_reservation', () => {
    const body = fn('public.place_reservation');
    const codes = new Set<string>();
    for (const m of body.matchAll(/reservation_refused: ([a-z_]+)/g)) codes.add(m[1]);
    // The two computed codes and those coming from reservation_time_problem().
    for (const c of ['service_required', 'no_rate', ...quoted(fn('private.reservation_time_problem')).filter((c) => /^(time_not_allowed|too_soon|too_far|closed_date|outside_hours)$/.test(c))]) codes.add(c);
    expect([...codes].sort()).toEqual([...reservationRefusals].sort());
  });
  it('actions and action refusals', () => {
    const body = fn('public.reservation_action');
    const actions = new Set(quoted(body.match(/p_action (?:in \([^)]*\)|= '[a-z_]+')/g)!.join(' ')));
    expect([...actions].sort()).toEqual([...reservationActions].sort());
    const codes = new Set([...body.matchAll(/reservation_action_refused: ([a-z_]+)/g)].map((m) => m[1]));
    for (const c of ['too_soon', 'too_far', 'closed_date', 'outside_hours']) codes.add(c);
    expect([...codes].sort()).toEqual([...reservationActionRefusals].sort());
  });
  it('rules', () => {
    expect(sql).toContain(`select ${reservationRules.guideSharePct}::numeric;`);
    expect(sql).toContain(`::date + ${reservationRules.dietLineDays});`);
    expect(sql).toContain(`then ${reservationRules.restaurantMaxParty} else s.max_people`);
    expect(sql).toContain(`coalesce(v_duration, ${reservationRules.defaultDurationMin})`);
    expect(sql).toContain(`% ${reservationRules.slotMinutes} <> 0`);
    expect(sql).toContain(`now() - interval '${reservationRules.autoCompleteDays} days'`);
    expect(sql).toContain(`now() - interval '${reservationRules.ownerReminderHours} hours'`);
    expect(sql).toContain(`::date + ${reservationRules.visitAnswerDays}`);
    expect(sql).toContain(`r.starts_at > now() - interval '${reservationRules.noShowWindowDays} days'`);
    expect(sql).toContain(`r.dispute_resolved_at is null)) >= ${reservationRules.noShowLimit}`);
    expect(sql).toContain(`now() - interval '${reservationRules.noShowPauseDays} days'`);
    expect(sql).toContain(`('requested', 'other_time_offered')) >= ${reservationRules.maxOpenRequests}`);
    expect(sql).toContain(`private.tz_today()) >= ${reservationRules.maxPerBusinessPerDay}`);
    expect(sql).toContain(`> now() - interval '${reservationRules.newAccountDays} days'\n             then ${reservationRules.newAccountRequestsPerDay} else ${reservationRules.maxRequestsPerDay} end`);
    expect(sql).toContain(`status_at > now() - interval '24 hours') >= ${reservationRules.maxCancellationsPerDay}`);
    expect(sql).toContain(`r.starts_at > now() - interval '${reservationRules.noShowMarkAfterMin} minutes'`);
    expect(sql).toContain(`r.starts_at < now() + interval '${reservationRules.lateCancelHours} hours'`);
    expect(sql).toContain(`::date + ${reservationRules.textsClearDays} < private.tz_today()`);
    expect(sql).toContain(`least(now() + interval '${reservationRules.answerWithinHours} hours', p_starts_at - make_interval`);
    expect(sql).toContain(`answer_by = least(now() + interval '${reservationRules.answerWithinHours} hours',`);
    expect(sql).toContain(`'*/${reservationRules.jobEveryMinutes} * * * *'`);
    expect(sql).toContain(`not k.ok and k.created_at > now() - interval '1 hour') >= ${reservationRules.guideCodeFailuresPerHour}\n`);
    expect(sql).toContain(`k.created_at > now() - interval '1 hour') >= ${reservationRules.guideCodeChecksPerHour} then\n    return 'too_many';`);
    // No code is stored in any form (final review N2).
    expect(fn('public.guide_code_status')).not.toMatch(/md5|code_hash/);
  });
  it('group discount in the trigger and copied at request time', () => {
    expect(fn('private.reservation_compute')).toContain('and new.party_size >= new.group_discount_min_people');
    expect(fn('private.reservation_compute')).toContain('then (100 - new.group_discount_percent)::numeric / 100 else 1 end');
    expect(fn('public.place_reservation')).toContain("case when rate.kind = 'percent' then s.group_discount_percent end");
  });
  it('dispute outcomes', () => {
    const block = sql.match(/check \(dispute_outcome in \(([^)]*)\)\)/)![1];
    expect(quoted(block)).toEqual([...reservationDisputeOutcomes]);
  });
  it('the billing switch is seeded off', () => {
    expect(sql).toContain(`('feature.reservation_commission_billing', '{"on": false}')`);
  });
});

describe('commission arithmetic (same as the trigger)', () => {
  const perGuest = { commission_kind: 'per_guest', commission_rate_tzs: 2000, commission_percent: null, max_guests_counted: 10, price_basis_tzs: null } as const;
  const percent = { commission_kind: 'percent', commission_rate_tzs: null, commission_percent: 10, max_guests_counted: null, price_basis_tzs: 45005 } as const;
  const perPerson = { commission_kind: 'per_person', commission_rate_tzs: 3000, commission_percent: null, max_guests_counted: null, price_basis_tzs: null } as const;

  it('restaurant: fee per guest who came, up to the maximum counted', () => {
    expect(completedReservationCommission(perGuest, 4)).toBe(8000);
    expect(completedReservationCommission(perGuest, 10)).toBe(20000);
    expect(completedReservationCommission(perGuest, 14)).toBe(20000);
    expect(completedReservationCommission({ ...perGuest, max_guests_counted: null }, 14)).toBe(28000);
  });
  it('spa and salon: percent of the copied listed price per person, rounded to shillings', () => {
    expect(completedReservationCommission(percent, 1)).toBe(4501); // 4500.5 rounds up
    expect(completedReservationCommission(percent, 2)).toBe(9001);
    expect(completedReservationCommission({ ...percent, price_basis_tzs: null }, 1)).toBeNull();
  });
  it('group discount: percent of the discounted price per person once the booking reaches the minimum', () => {
    const spa = { commission_kind: 'percent', commission_rate_tzs: null, commission_percent: 10, max_guests_counted: null,
      price_basis_tzs: 40000, group_discount_min_people: 4, group_discount_percent: 20 } as const;
    expect(completedReservationCommission({ ...spa, party_size: 3 }, 3)).toBe(12000);
    expect(completedReservationCommission({ ...spa, party_size: 4 }, 4)).toBe(12800);
    // Booked 4 (discount applies), 3 came: 3 x 32000 x 10%.
    expect(completedReservationCommission({ ...spa, party_size: 4 }, 3)).toBe(9600);
    expect(reservationPricePerPerson({ ...spa }, 4)).toBe(32000);
    expect(reservationPricePerPerson({ ...spa }, 3)).toBe(40000);
    expect(reservationGroupDiscountApplies(spa, 4)).toBe(true);
  });
  it('unpriced service: fee per person who came', () => {
    expect(completedReservationCommission(perPerson, 3)).toBe(9000);
  });
  it('nobody came: nothing', () => {
    expect(completedReservationCommission(perGuest, 0)).toBeNull();
  });
  it('guide share: half, only when a guide is linked', () => {
    expect(reservationGuideShare(8000, true)).toBe(4000);
    expect(reservationGuideShare(4501, true)).toBe(2251);
    expect(reservationGuideShare(8000, false)).toBe(0);
  });
  it('owed only for completed, undisputed, real reservations', () => {
    expect(reservationCommissionBase({ status: 'completed', isSample: false, disputed: false, disputeResolved: false })).toBe('owed');
    expect(reservationCommissionBase({ status: 'completed', isSample: false, disputed: true, disputeResolved: false })).toBe('held');
    expect(reservationCommissionBase({ status: 'completed', isSample: false, disputed: true, disputeResolved: true })).toBe('owed');
    expect(reservationCommissionBase({ status: 'completed', isSample: true, disputed: false, disputeResolved: false })).toBe('none');
    for (const status of ['no_show', 'cancelled', 'declined', 'confirmed'] as const) {
      expect(reservationCommissionBase({ status, isSample: false, disputed: false, disputeResolved: false })).toBe('none');
    }
  });
  it('answer mismatch', () => {
    expect(reservationAnswerMismatch('completed', false)).toBe(true);
    expect(reservationAnswerMismatch('no_show', true)).toBe(true);
    expect(reservationAnswerMismatch('completed', true)).toBe(false);
    expect(reservationAnswerMismatch('confirmed', false)).toBe(false);
    expect(reservationAnswerMismatch('completed', null)).toBe(false);
    expect(reservationAnswerMismatch('completed', true, 4, 2)).toBe(true);
    expect(reservationAnswerMismatch('completed', true, 2, 2)).toBe(false);
    expect(reservationAnswerMismatch('completed', true, 1, 2)).toBe(false);
  });
  it('error codes', () => {
    expect(reservationErrorCode('reservation_refused: too_soon')).toBe('too_soon');
    expect(reservationErrorCode('reservation_action_refused: too_late')).toBe('too_late');
    expect(reservationErrorCode('something else')).toBeNull();
  });
});
