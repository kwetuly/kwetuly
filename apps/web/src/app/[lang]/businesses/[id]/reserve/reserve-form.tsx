'use client';

import { useId, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Info, Loader2 } from 'lucide-react';
import {
  addDaysIso,
  fillText,
  formatTzs,
  joinSentences,
  reservationGroupDiscountApplies,
  reservationPricePerPerson,
  reservationRules,
  reservationSlots,
  reserveText,
  tanzaniaStartsAt,
  weekdayOfDay,
  type OpeningPeriod,
  type ReservationRate,
  type ReserveText,
} from '@kwetuly/shared';
import { checkGuideCode, placeReservation, type ReservationResult } from '../../../reservations/actions';

export type ReserveData = {
  soon: boolean;
  open: boolean;
  providerId: string;
  businessName: string;
  care: boolean;
  today: string;
  minNoticeMin: number;
  maxDays: number;
  hours: Record<number, OpeningPeriod[]>;
  closedDays: string[];
  services: { id: string; name: string; duration_min: number; price_tzs: number | null; max_people: number; group_discount_min_people?: number | null; group_discount_percent?: number | null }[];
  rate: ReservationRate | null;
  unpricedRate: ReservationRate | null;
};

/** The polite text for a result that is not ok. */
export function reserveError(r: ReserveText, result: ReservationResult): string {
  if (result.ok) return '';
  if (result.error === 'soon') return r.soon;
  if (result.error === 'sign_in') return r.refusals.not_signed_in;
  if (result.error === 'refused' && result.code) {
    if (result.code in r.refusals) return r.refusals[result.code as keyof ReserveText['refusals']];
    if (result.code in r.actionRefusals) return r.actionRefusals[result.code as keyof ReserveText['actionRefusals']];
  }
  return r.saveError;
}

export function ReserveForm({ locale, data }: { locale: string; data: ReserveData }) {
  const r = reserveText(locale);
  const router = useRouter();
  const uid = useId();
  const [serviceId, setServiceId] = useState<string>(data.care ? (data.services[0]?.id ?? '') : '');
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [party, setParty] = useState(data.care ? '1' : '2');
  const [note, setNote] = useState('');
  const [diet, setDiet] = useState('');
  const [consent, setConsent] = useState(false);
  const [guideCode, setGuideCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const business = { business: data.businessName };

  const service = data.services.find((s) => s.id === serviceId) ?? null;
  const maxParty = service ? service.max_people : reservationRules.restaurantMaxParty;
  // Slots depend on "now": worked out only after a day is picked, so the server and browser agree.
  const slots = useMemo(
    () =>
      day
        ? reservationSlots({
            day,
            periods: data.hours[weekdayOfDay(day)] ?? [],
            durationMin: service?.duration_min ?? reservationRules.defaultDurationMin,
            minNoticeMin: data.minNoticeMin,
            maxDays: data.maxDays,
            today: data.today,
            closedDays: data.closedDays,
          })
        : [],
    [day, service, data],
  );
  const rate = data.care && service && service.price_tzs == null ? data.unpricedRate : data.rate;
  // The service's group discount (spa and salon): shown on the service, and the price per person after
  // it once the party reaches the minimum. The disclosure line stays the same.
  const discount =
    service && service.price_tzs != null && service.group_discount_min_people != null && service.group_discount_percent != null
      ? { group_discount_min_people: service.group_discount_min_people, group_discount_percent: service.group_discount_percent }
      : null;
  const partyNumber = Number(party);
  const discountPrice =
    discount && service && Number.isInteger(partyNumber) && reservationGroupDiscountApplies(discount, partyNumber)
      ? reservationPricePerPerson({ commission_kind: 'percent', commission_rate_tzs: null, commission_percent: null, max_guests_counted: null, price_basis_tzs: service.price_tzs, ...discount }, partyNumber)
      : null;
  // No rate for this choice outside "opens soon": no disclosure, so no Send (security review L-A).
  const rateMissing = !data.soon && data.open && !rate;
  const disabled = data.soon || !data.open || rateMissing;

  function send() {
    setError(null);
    if (data.care && !service) return setError(r.refusals.service_required);
    if (!day || !time || !slots.includes(time)) return setError(r.refusals.time_not_allowed);
    const people = Number(party);
    if (!Number.isInteger(people) || people < 1 || people > maxParty) return setError(r.refusals.party_size);
    if (diet.trim() && !consent) return setError(r.refusals.diet_consent_needed);
    start(async () => {
      // A guide code is checked first; the database takes only a code checked in the last hour.
      if (guideCode.trim()) {
        const check = await checkGuideCode(guideCode);
        if (check !== 'ok') {
          setError(check === 'unknown' ? r.refusals.guide_code_unknown : check === 'too_many' ? r.guideCodeTooMany : check === 'soon' ? r.soon : r.saveError);
          return;
        }
      }
      const result = await placeReservation({ providerId: data.providerId, serviceId: service?.id ?? null, startsAt: tanzaniaStartsAt(day, time), partySize: people, note, dietLine: diet, dietConsent: consent, guideCode });
      // Only the reservation id goes in the address; the page reads the business name from the database (L-C).
      if (result.ok) router.push(`/${locale}/reservations?sent=${result.id ?? '1'}`);
      else setError(reserveError(r, result));
    });
  }

  return (
    <div className="mt-2 space-y-6">
      <p className="text-muted">{fillText(r.intro, business)}</p>
      {data.soon && (
        <p role="status" className="flex items-start gap-2 rounded-[5px] bg-sand p-4 font-semibold">
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden /> {r.soon}
        </p>
      )}
      {!data.soon && !data.open && (
        <div role="status" className="space-y-3 rounded-[5px] bg-sand p-4">
          <p className="font-semibold">{fillText(r.notOpen, business)}</p>
          <Link href={`/${locale}/businesses/${data.providerId}#ask`} className="btn-outline">{fillText(r.askInstead, business)}</Link>
        </div>
      )}

      <form
        className="card space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        {(data.care || data.services.length > 0) && (
          <label className="block" htmlFor={`${uid}-service`}>
            <span className="label">{r.service}</span>
            <select
              id={`${uid}-service`}
              className="field"
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                setTime('');
              }}
            >
              {!data.care && <option value="">{r.table}</option>}
              {data.care && data.services.length === 0 && <option value="">—</option>}
              {data.services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        )}

        {service && service.price_tzs != null && (
          <div className="space-y-1 rounded-[5px] bg-surface p-3 text-sm" aria-live="polite">
            <p>{fillText(r.pricePerPerson, { price: formatTzs(service.price_tzs) })}</p>
            {discount && <p>{fillText(r.groupDiscount, { percent: discount.group_discount_percent!, n: discount.group_discount_min_people! })}</p>}
            {discount && discountPrice != null && <p className="font-semibold text-forest">{fillText(r.priceWithDiscount, { price: formatTzs(discountPrice) })}</p>}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block" htmlFor={`${uid}-day`}>
            <span className="label">{r.date}</span>
            <input
              id={`${uid}-day`}
              type="date"
              className="field"
              min={data.today}
              max={addDaysIso(data.today, data.maxDays)}
              value={day}
              onChange={(e) => {
                setDay(e.target.value);
                setTime('');
              }}
            />
          </label>
          <label className="block" htmlFor={`${uid}-time`}>
            <span className="label">{r.time}</span>
            <select id={`${uid}-time`} className="field" value={time} onChange={(e) => setTime(e.target.value)} disabled={!day || slots.length === 0} aria-describedby={`${uid}-time-hint`}>
              <option value="">—</option>
              {slots.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span id={`${uid}-time-hint`} className="mt-1 block text-sm text-muted">{!day ? r.pickDay : slots.length === 0 && !disabled ? r.noTimes : ''}</span>
          </label>
        </div>

        <label className="block" htmlFor={`${uid}-party`}>
          <span className="label">{r.party}</span>
          <input id={`${uid}-party`} type="number" inputMode="numeric" min={1} max={maxParty} className="field w-32" value={party} onChange={(e) => setParty(e.target.value)} aria-describedby={`${uid}-party-hint`} />
          <span id={`${uid}-party-hint`} className="mt-1 block text-sm text-muted">{fillText(r.partyHint, { max: maxParty })}</span>
        </label>

        <label className="block" htmlFor={`${uid}-note`}>
          <span className="label">{fillText(r.note, business)}</span>
          <textarea id={`${uid}-note`} className="field min-h-24" autoComplete="off" maxLength={reservationRules.noteMax} value={note} onChange={(e) => setNote(e.target.value)} aria-describedby={`${uid}-note-hint`} />
          <span id={`${uid}-note-hint`} className="mt-1 block text-sm text-muted">{joinSentences(locale, r.noteHint, r.noteHealth)}</span>
        </label>

        <div className="space-y-2">
          <label className="block" htmlFor={`${uid}-diet`}>
            <span className="label">{r.diet}</span>
            <input id={`${uid}-diet`} className="field" autoComplete="off" maxLength={reservationRules.dietLineMax} value={diet} onChange={(e) => setDiet(e.target.value)} aria-describedby={`${uid}-diet-hint`} />
            <span id={`${uid}-diet-hint`} className="mt-1 block text-sm text-muted">{fillText(r.dietHint, business)}</span>
          </label>
          {diet.trim() && (
            <label className="flex items-start gap-3 rounded-[5px] bg-surface p-3 text-sm font-semibold">
              <input type="checkbox" className="mt-0.5 size-5 accent-[#1D951A]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>{fillText(r.dietConsent, business)}</span>
            </label>
          )}
        </div>

        <label className="block" htmlFor={`${uid}-guide`}>
          <span className="label">{r.guideCode}</span>
          <input id={`${uid}-guide`} className="field w-48 uppercase" maxLength={20} autoCapitalize="characters" value={guideCode} onChange={(e) => setGuideCode(e.target.value)} aria-describedby={`${uid}-guide-hint`} />
          <span id={`${uid}-guide-hint`} className="mt-1 block text-sm text-muted">{r.guideCodeHint}</span>
        </label>

        {/* The disclosure, before Send (docs/team/business-reservation-commission-2026-11-22.md section 8). */}
        <div className="space-y-1 rounded-[5px] bg-mint p-4 text-sm text-forest">
          {rate && <p>{fillText(r.disclosure[rate.kind], business)}{guideCode.trim() ? ` ${r.disclosureGuide}` : ''}</p>}
          <p className="font-semibold">{r.noCharge}</p>
        </div>

        {rateMissing && <p role="alert" className="rounded-[5px] bg-red-50 p-3 text-sm text-red-800">{r.loadError}</p>}
        {error && <p role="alert" className="rounded-[5px] bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <button type="submit" className="btn w-full sm:w-auto" disabled={disabled || pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {r.send}
        </button>
      </form>
      <Link href={`/${locale}/reservations`} className="inline-block text-sm font-semibold text-forest underline">{r.myTitle}</Link>
    </div>
  );
}
