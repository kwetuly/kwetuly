'use client';

import { useId, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { CalendarClock, CalendarX2, CheckCircle2, ClipboardList, Clock, FileText, Info, Loader2, Percent, Power } from 'lucide-react';
import {
  RESERVATION_TERMS_VERSION,
  closedDateRange,
  fillText,
  formatTzs,
  hoursByWeekday,
  reservationLimits,
  reservationText,
  weekdaysMondayFirst,
  type OpeningPeriod,
  type ReservableBusinessType,
  type ReservationBlocker,
  type ReservationRate,
  type ReservationText,
} from '@kwetuly/shared';
import { formatDay } from '../../verification/format';
import {
  acceptTerms,
  addClosedDate,
  orderServices,
  removeClosedDate,
  removeService,
  saveHours,
  saveRules,
  saveService,
  setReservationsOn,
  setServiceActive,
  updateClosedNote,
  type SetupResult,
} from './actions';

export type SetupData = {
  soon: boolean;
  today: string;
  providerId: string;
  businessName: string;
  businessType: ReservableBusinessType;
  status: {
    takesReservations: boolean;
    openNow: boolean;
    blockers: ReservationBlocker[];
    termsVersion: string | null;
    termsCurrentVersion: string | null;
    termsAcceptedAt: string | null;
  };
  rules: { minNotice: number; maxDays: number };
  hours: { weekday: number; opens: string; closes: string }[];
  closed: { day: string; note: string | null }[];
  services: { id: string; name: string; duration_min: number; price_tzs: number | null; max_people: number; active: boolean; sort: number }[];
  rate: ReservationRate | null;
  unpricedRate: ReservationRate | null;
};

type Message = { tone: 'ok' | 'error'; text: string } | null;
type Props = { locale: string; data: SetupData };

/** A sorry line for the codes every action can return. */
function errorText(r: ReservationText, result: SetupResult): string {
  if (result.ok) return '';
  if (result.error === 'soon') return r.soon;
  return r.saveError;
}

function Feedback({ message }: { message: Message }) {
  if (!message) return null;
  return message.tone === 'ok' ? (
    <p role="status" className="flex items-center gap-2 rounded-[5px] bg-mint p-3 text-sm font-semibold text-forest">
      <CheckCircle2 className="size-5 shrink-0" aria-hidden /> {message.text}
    </p>
  ) : (
    <p role="alert" className="rounded-[5px] bg-red-50 p-3 text-sm text-red-800">{message.text}</p>
  );
}

function Section({ id, icon, title, children }: { id: string; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="card scroll-mt-24 space-y-4">
      <h2 id={`${id}-title`} className="flex items-center gap-2 text-lg font-bold">
        {icon} {title}
      </h2>
      {children}
    </section>
  );
}

function Busy({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </>
  );
}

export function ReservationSetup({ locale, data }: Props) {
  const r = reservationText(locale);
  return (
    <div className="mt-2 space-y-6">
      <p className="text-muted">{r.intro}</p>
      {data.soon && (
        <p role="status" className="flex items-start gap-2 rounded-[5px] bg-sand p-4 font-semibold">
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden /> {r.soon}
        </p>
      )}
      <StatusCard r={r} locale={locale} data={data} />
      <RateCard r={r} data={data} />
      <TermsCard r={r} locale={locale} data={data} />
      <HoursCard r={r} data={data} />
      <ClosedCard r={r} locale={locale} data={data} />
      <ServicesCard r={r} data={data} />
      <RulesCard r={r} data={data} />
    </div>
  );
}

function fixHref(code: ReservationBlocker, locale: string): string | null {
  switch (code) {
    case 'not_approved':
    case 'type_not_approved':
    case 'type_not_reservable':
      return `/${locale}/dashboard#business`;
    case 'terms_not_accepted':
      return '#terms';
    case 'no_opening_hours':
      return '#hours';
    case 'licence_check_missing':
      return `/${locale}/dashboard/verification`;
    case 'no_service':
    case 'service_needs_price':
      return '#services';
    default:
      return null;
  }
}

function BlockerList({ r, locale, blockers }: { r: ReservationText; locale: string; blockers: ReservationBlocker[] }) {
  if (blockers.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="font-semibold">{r.blockersTitle}</p>
      <ul className="space-y-2">
        {blockers.map((code) => {
          const href = fixHref(code, locale);
          return (
            <li key={code} className="rounded-[5px] border border-line bg-white p-3 text-sm">
              <p>{r.blockers[code]}</p>
              {href && r.fixes[code] && (
                <Link href={href} className="mt-1 inline-block font-semibold text-forest underline">{r.fixes[code]}</Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatusCard({ r, locale, data }: { r: ReservationText; locale: string; data: SetupData }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<Message>(null);
  const [refused, setRefused] = useState<ReservationBlocker[] | null>(null);
  const { takesReservations, openNow } = data.status;
  const blockers = refused ?? data.status.blockers;
  const line = data.soon ? r.statusOff : takesReservations ? (openNow ? r.statusOn : r.statusOnBlocked) : blockers.length === 0 ? r.statusReady : r.statusOff;
  const tone = takesReservations && openNow ? 'bg-mint text-forest' : 'bg-white border border-line';

  function toggle(on: boolean) {
    setMessage(null);
    start(async () => {
      const result = await setReservationsOn(data.providerId, on);
      if (result.ok) {
        setRefused(null);
        setMessage({ tone: 'ok', text: on ? r.switchedOn : r.switchedOff });
      } else if (result.blockers) {
        setRefused(result.blockers);
        setMessage({ tone: 'error', text: r.switchRefused });
      } else setMessage({ tone: 'error', text: errorText(r, result) });
    });
  }

  return (
    <section aria-labelledby="status-title" className={`rounded-[5px] p-5 ${tone} space-y-4`}>
      <h2 id="status-title" className="flex items-center gap-2 text-xl font-bold">
        <Power className="size-6 shrink-0" aria-hidden /> {fillText(r.statusTitle, { business: data.businessName })}
      </h2>
      <p>{line}</p>
      {!data.soon && <BlockerList r={r} locale={locale} blockers={blockers} />}
      {takesReservations ? (
        <button type="button" className="btn-outline w-full sm:w-auto" disabled={data.soon || pending} onClick={() => toggle(false)}>
          <Busy pending={pending}>{r.switchOff}</Busy>
        </button>
      ) : (
        // The page's one main action.
        <button type="button" className="btn w-full sm:w-auto" disabled={data.soon || pending} aria-describedby={data.soon ? 'reservations-soon' : undefined} onClick={() => toggle(true)}>
          <Busy pending={pending}>{r.switchOn}</Busy>
        </button>
      )}
      {data.soon && <p id="reservations-soon" className="sr-only">{r.soon}</p>}
      <Feedback message={message} />
    </section>
  );
}

function rateLine(r: ReservationText, rate: ReservationRate): string | null {
  if (rate.kind === 'per_guest' && rate.amount_tzs != null) {
    return rate.max_guests_counted != null
      ? fillText(r.rate.per_guest, { amount: formatTzs(rate.amount_tzs), max: rate.max_guests_counted })
      : fillText(r.rate.per_guest_no_cap, { amount: formatTzs(rate.amount_tzs) });
  }
  if (rate.kind === 'percent' && rate.percent != null) return fillText(r.rate.percent, { percent: rate.percent });
  if (rate.kind === 'per_person' && rate.amount_tzs != null) return fillText(r.rate.per_person, { amount: formatTzs(rate.amount_tzs) });
  return null;
}

function RateCard({ r, data }: { r: ReservationText; data: SetupData }) {
  const lines = [data.rate, data.unpricedRate].filter((x): x is ReservationRate => !!x).map((x) => rateLine(r, x)).filter((x): x is string => !!x);
  return (
    <Section id="rate" icon={<Percent className="size-5 text-leaf-dark" aria-hidden />} title={r.rateTitle}>
      {lines.length === 0 ? <p className="text-sm">{r.rate.none}</p> : lines.map((l) => <p key={l} className="font-semibold">{l}</p>)}
      <p className="text-sm text-muted">{r.rateNote}</p>
    </Section>
  );
}

function TermsCard({ r, locale, data }: { r: ReservationText; locale: string; data: SetupData }) {
  const [agree, setAgree] = useState(false);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<Message>(null);
  const current = data.status.termsVersion != null && data.status.termsVersion === (data.status.termsCurrentVersion ?? RESERVATION_TERMS_VERSION);
  const outdated = data.status.termsVersion != null && !current;

  function accept() {
    if (!agree) return setMessage({ tone: 'error', text: r.termsAgreeFirst });
    setMessage(null);
    start(async () => {
      const result = await acceptTerms(data.providerId, RESERVATION_TERMS_VERSION);
      if (result.ok) setMessage({ tone: 'ok', text: fillText(r.termsAccepted, { date: formatDay(new Date().toISOString(), locale) }) });
      else setMessage({ tone: 'error', text: result.error === 'terms_outdated' ? r.termsReload : errorText(r, result) });
    });
  }

  return (
    <Section id="terms" icon={<FileText className="size-5 text-leaf-dark" aria-hidden />} title={r.termsTitle}>
      <p className="text-sm text-muted">{r.termsIntro}</p>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        {r.termsPoints.map((p) => <li key={p}>{p}</li>)}
      </ol>
      {current && data.status.termsAcceptedAt ? (
        <p className="flex items-center gap-2 rounded-[5px] bg-mint p-3 text-sm font-semibold text-forest">
          <CheckCircle2 className="size-5 shrink-0" aria-hidden /> {fillText(r.termsAccepted, { date: formatDay(data.status.termsAcceptedAt, locale) })}
        </p>
      ) : (
        <>
          {outdated && <p className="rounded-[5px] bg-sand p-3 text-sm font-semibold">{r.termsOutdated}</p>}
          <label className="flex items-start gap-3 rounded-[5px] bg-surface p-3 font-semibold">
            <input type="checkbox" className="mt-1 size-5 accent-[#1D951A]" checked={agree} onChange={(e) => setAgree(e.target.checked)} disabled={data.soon} />
            <span>{fillText(r.termsAgree, { business: data.businessName })}</span>
          </label>
          <button type="button" className="btn-outline w-full sm:w-auto" disabled={data.soon || pending} onClick={accept}>
            <Busy pending={pending}>{r.termsAccept}</Busy>
          </button>
        </>
      )}
      <Feedback message={message} />
    </Section>
  );
}

function HoursCard({ r, data }: { r: ReservationText; data: SetupData }) {
  const [days, setDays] = useState<Record<number, OpeningPeriod[]>>(() => hoursByWeekday(data.hours));
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<Message>(null);
  const [badDay, setBadDay] = useState<number | null>(null);
  const uid = useId();

  const update = (day: number, periods: OpeningPeriod[]) => setDays((d) => ({ ...d, [day]: periods }));
  const copyToAll = (day: number) => setDays(() => Object.fromEntries(weekdaysMondayFirst.map((d) => [d, days[day].map((p) => ({ ...p }))])) as Record<number, OpeningPeriod[]>);

  function save() {
    setMessage(null);
    setBadDay(null);
    start(async () => {
      const result = await saveHours(data.providerId, days);
      if (result.ok) setMessage({ tone: 'ok', text: r.hoursSaved });
      else if (result.error === 'invalid' && result.weekday != null) {
        setBadDay(result.weekday);
        setMessage({ tone: 'error', text: fillText(r.hoursInvalid, { day: r.weekdays[result.weekday] }) });
      } else setMessage({ tone: 'error', text: errorText(r, result) });
    });
  }

  return (
    <Section id="hours" icon={<Clock className="size-5 text-leaf-dark" aria-hidden />} title={r.hoursTitle}>
      <p className="text-sm text-muted">{r.hoursBody}</p>
      <div className="divide-y divide-line">
        {weekdaysMondayFirst.map((day) => {
          const periods = days[day];
          const name = r.weekdays[day];
          return (
            <fieldset key={day} className={`py-3 ${badDay === day ? 'rounded-[5px] bg-red-50 px-2' : ''}`}>
              <legend className="sr-only">{name}</legend>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold" aria-hidden>{name}</p>
                {periods.length === 0 && <span className="text-sm text-muted">{r.closed}</span>}
              </div>
              <div className="mt-2 space-y-2">
                {periods.map((p, i) => (
                  <div key={i} className="flex flex-wrap items-end gap-2">
                    <label className="block" htmlFor={`${uid}-${day}-${i}-o`}>
                      <span className="label">{r.opens}</span>
                      <input id={`${uid}-${day}-${i}-o`} type="time" step={300} required className="field w-32" value={p.opens} onChange={(e) => update(day, periods.map((x, j) => (j === i ? { ...x, opens: e.target.value } : x)))} />
                    </label>
                    <label className="block" htmlFor={`${uid}-${day}-${i}-c`}>
                      <span className="label">{r.closes}</span>
                      <input id={`${uid}-${day}-${i}-c`} type="time" step={300} required className="field w-32" value={p.closes} onChange={(e) => update(day, periods.map((x, j) => (j === i ? { ...x, closes: e.target.value } : x)))} />
                    </label>
                    <button type="button" className="min-h-12 px-2 text-sm font-semibold text-red-800 underline" aria-label={`${r.removePeriod}: ${name} ${p.opens}–${p.closes}`} onClick={() => update(day, periods.filter((_, j) => j !== i))}>
                      {r.removePeriod}
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4">
                {periods.length < reservationLimits.periodsPerDay && (
                  <button type="button" className="min-h-11 text-sm font-semibold text-forest underline" aria-label={`${r.addPeriod}: ${name}`} onClick={() => update(day, [...periods, periods.length ? { opens: '18:00', closes: '22:00' } : { opens: '08:00', closes: '17:00' }])}>
                    {r.addPeriod}
                  </button>
                )}
                {periods.length > 0 && (
                  <button type="button" className="min-h-11 text-sm font-semibold text-forest underline" aria-label={`${r.copyToAll}: ${name}`} onClick={() => copyToAll(day)}>
                    {r.copyToAll}
                  </button>
                )}
              </div>
            </fieldset>
          );
        })}
      </div>
      <button type="button" className="btn-outline w-full sm:w-auto" disabled={data.soon || pending} onClick={save}>
        <Busy pending={pending}>{r.hoursSave}</Busy>
      </button>
      <Feedback message={message} />
    </Section>
  );
}

function ClosedCard({ r, locale, data }: { r: ReservationText; locale: string; data: SetupData }) {
  const range = closedDateRange(data.today);
  const [day, setDay] = useState('');
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<Message>(null);
  const uid = useId();

  const say = (result: SetupResult, ok: string) => {
    if (result.ok) return setMessage({ tone: 'ok', text: ok });
    const known = result.error === 'range' || result.error === 'duplicate' || result.error === 'note' ? r.closedErrors[result.error] : errorText(r, result);
    setMessage({ tone: 'error', text: known });
  };

  function add() {
    setMessage(null);
    if (!day || day < range.min || day > range.max) return setMessage({ tone: 'error', text: r.closedErrors.range });
    start(async () => {
      const result = await addClosedDate(data.providerId, day, note);
      say(result, r.closedAdded);
      if (result.ok) {
        setDay('');
        setNote('');
      }
    });
  }

  return (
    <Section id="closed" icon={<CalendarX2 className="size-5 text-leaf-dark" aria-hidden />} title={r.closedTitle}>
      <p className="text-sm text-muted">{r.closedBody}</p>
      {data.closed.length === 0 ? (
        <p className="text-sm text-muted">{r.closedEmpty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {data.closed.map((c) => (
            <ClosedRow key={c.day} r={r} locale={locale} providerId={data.providerId} row={c} disabled={data.soon} onResult={say} />
          ))}
        </ul>
      )}
      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <label className="block" htmlFor={`${uid}-day`}>
          <span className="label">{r.closedDay}</span>
          <input id={`${uid}-day`} type="date" className="field" min={range.min} max={range.max} value={day} onChange={(e) => setDay(e.target.value)} />
        </label>
        <label className="block" htmlFor={`${uid}-note`}>
          <span className="label">{r.closedNote}</span>
          <input id={`${uid}-note`} className="field" maxLength={reservationLimits.closedDateNoteMax} value={note} onChange={(e) => setNote(e.target.value)} aria-describedby={`${uid}-note-hint`} />
        </label>
      </div>
      <p id={`${uid}-note-hint`} className="text-sm text-muted">{r.closedNoteHint}</p>
      <button type="button" className="btn-outline w-full sm:w-auto" disabled={data.soon || pending} onClick={add}>
        <Busy pending={pending}>{r.closedAdd}</Busy>
      </button>
      <Feedback message={message} />
    </Section>
  );
}

function ClosedRow({
  r,
  locale,
  providerId,
  row,
  disabled,
  onResult,
}: {
  r: ReservationText;
  locale: string;
  providerId: string;
  row: { day: string; note: string | null };
  disabled: boolean;
  onResult: (result: SetupResult, ok: string) => void;
}) {
  const [note, setNote] = useState(row.note ?? '');
  const [pending, start] = useTransition();
  const uid = useId();
  const date = formatDay(row.day, locale);
  return (
    <li className="flex flex-wrap items-end gap-3 py-3">
      <p className="min-w-28 font-semibold">{date}</p>
      <label className="block min-w-0 flex-1" htmlFor={`${uid}-n`}>
        <span className="sr-only">{`${r.closedNote}: ${date}`}</span>
        <input id={`${uid}-n`} className="field" maxLength={reservationLimits.closedDateNoteMax} value={note} placeholder={r.closedNote} onChange={(e) => setNote(e.target.value)} disabled={disabled} />
      </label>
      {note !== (row.note ?? '') && (
        <button type="button" className="min-h-12 px-2 text-sm font-semibold text-forest underline" disabled={disabled || pending} onClick={() => start(async () => onResult(await updateClosedNote(providerId, row.day, note), r.closedNoteSaved))}>
          {r.closedSaveNote}
        </button>
      )}
      <button type="button" className="min-h-12 px-2 text-sm font-semibold text-red-800 underline" aria-label={`${r.closedRemove}: ${date}`} disabled={disabled || pending} onClick={() => start(async () => onResult(await removeClosedDate(providerId, row.day), r.closedRemoved))}>
        {r.closedRemove}
      </button>
    </li>
  );
}

type ServiceForm = { name: string; duration: string; price: string; people: string };
const emptyForm: ServiceForm = { name: '', duration: String(reservationLimits.durationDefault), price: '', people: '2' };

function ServicesCard({ r, data }: { r: ReservationText; data: SetupData }) {
  const [editing, setEditing] = useState<string | 'new' | null>(data.services.length === 0 ? 'new' : null);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<Message>(null);
  const care = data.businessType !== 'restaurant';

  const say = (result: SetupResult, ok: string) => {
    if (result.ok) return setMessage({ tone: 'ok', text: ok });
    if (result.error === 'too_many') return setMessage({ tone: 'error', text: r.serviceErrors.too_many });
    setMessage({ tone: 'error', text: errorText(r, result) });
  };

  function move(index: number, by: -1 | 1) {
    const ids = data.services.map((s) => s.id);
    const j = index + by;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    setMessage(null);
    start(async () => say(await orderServices(data.providerId, ids), r.serviceSaved));
  }

  return (
    <Section id="services" icon={<ClipboardList className="size-5 text-leaf-dark" aria-hidden />} title={r.servicesTitle}>
      <p className="text-sm text-muted">{care ? r.servicesBodyCare : r.servicesBodyRestaurant}</p>
      {data.services.length === 0 && <p className="text-sm text-muted">{r.servicesEmpty}</p>}
      <ul className="space-y-3">
        {data.services.map((s, i) =>
          editing === s.id ? (
            <li key={s.id}>
              <ServiceEditor r={r} data={data} serviceId={s.id} initial={{ name: s.name, duration: String(s.duration_min), price: s.price_tzs == null ? '' : String(s.price_tzs), people: String(s.max_people) }} onDone={(ok) => { if (ok) setMessage({ tone: 'ok', text: r.serviceSaved }); setEditing(null); }} />
            </li>
          ) : (
            <li key={s.id} className={`rounded-[5px] border border-line p-3 ${s.active ? 'bg-white' : 'bg-surface'}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{s.name}</p>
                {!s.active && <span className="rounded-[5px] bg-line px-2 py-0.5 text-xs font-semibold">{r.serviceIsOff}</span>}
              </div>
              <p className="text-sm text-muted">
                {[fillText(r.serviceMinutes, { n: s.duration_min }), fillText(r.servicePeople, { n: s.max_people }), s.price_tzs == null ? r.serviceNoPrice : formatTzs(s.price_tzs)].join(' · ')}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4">
                <button type="button" className="min-h-11 text-sm font-semibold text-forest underline" aria-label={`${r.serviceEdit}: ${s.name}`} disabled={data.soon || pending} onClick={() => setEditing(s.id)}>{r.serviceEdit}</button>
                <button type="button" className="min-h-11 text-sm font-semibold text-forest underline" aria-label={`${s.active ? r.serviceOff : r.serviceOn}: ${s.name}`} disabled={data.soon || pending} onClick={() => start(async () => say(await setServiceActive(data.providerId, s.id, !s.active), r.serviceSaved))}>
                  {s.active ? r.serviceOff : r.serviceOn}
                </button>
                {i > 0 && <button type="button" className="min-h-11 text-sm font-semibold text-forest underline" aria-label={`${r.serviceMoveUp}: ${s.name}`} disabled={data.soon || pending} onClick={() => move(i, -1)}>{r.serviceMoveUp}</button>}
                {i < data.services.length - 1 && <button type="button" className="min-h-11 text-sm font-semibold text-forest underline" aria-label={`${r.serviceMoveDown}: ${s.name}`} disabled={data.soon || pending} onClick={() => move(i, 1)}>{r.serviceMoveDown}</button>}
                <button
                  type="button"
                  className="min-h-11 text-sm font-semibold text-red-800 underline"
                  aria-label={`${r.serviceRemove}: ${s.name}`}
                  disabled={data.soon || pending}
                  onClick={() => {
                    if (!window.confirm(fillText(r.serviceRemoveConfirm, { name: s.name }))) return;
                    start(async () => say(await removeService(data.providerId, s.id), r.serviceRemoved));
                  }}
                >
                  {r.serviceRemove}
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
      {editing === 'new' ? (
        <ServiceEditor r={r} data={data} serviceId={null} initial={{ ...emptyForm, people: care ? '1' : '2' }} onDone={(ok) => { if (ok) setMessage({ tone: 'ok', text: r.serviceSaved }); setEditing(data.services.length === 0 && !ok ? 'new' : null); }} cancellable={data.services.length > 0} />
      ) : (
        data.services.length < reservationLimits.servicesPerBusiness && (
          <button type="button" className="btn-outline w-full sm:w-auto" disabled={pending} onClick={() => setEditing('new')}>{r.serviceNew}</button>
        )
      )}
      <Feedback message={message} />
    </Section>
  );
}

function ServiceEditor({
  r,
  data,
  serviceId,
  initial,
  onDone,
  cancellable = true,
}: {
  r: ReservationText;
  data: SetupData;
  serviceId: string | null;
  initial: ServiceForm;
  onDone: (saved: boolean) => void;
  cancellable?: boolean;
}) {
  const [f, setF] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const uid = useId();
  const care = data.businessType !== 'restaurant';
  const l = reservationLimits;
  const set = (key: keyof ServiceForm) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [key]: e.target.value }));

  function save() {
    setError(null);
    const input = {
      name: f.name,
      duration_min: Number(f.duration),
      price_tzs: f.price.trim() === '' ? null : Number(f.price.replace(/[ ,]/g, '')),
      max_people: Number(f.people),
    };
    start(async () => {
      const result = await saveService(data.providerId, serviceId, input);
      if (result.ok) return onDone(true);
      if (result.error === 'invalid' && result.field && result.field in r.serviceErrors) return setError(r.serviceErrors[result.field as keyof ReservationText['serviceErrors']]);
      if (result.error === 'too_many') return setError(r.serviceErrors.too_many);
      setError(errorText(r, result));
    });
  }

  return (
    <div className="space-y-3 rounded-[5px] border border-forest bg-white p-4">
      <label className="block" htmlFor={`${uid}-name`}>
        <span className="label">{r.serviceName}</span>
        <input id={`${uid}-name`} className="field" maxLength={l.serviceNameMax} value={f.name} onChange={set('name')} />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block" htmlFor={`${uid}-duration`}>
          <span className="label">{r.serviceDuration}</span>
          <input id={`${uid}-duration`} type="number" inputMode="numeric" min={l.durationMin} max={l.durationMax} step={5} className="field" value={f.duration} onChange={set('duration')} />
        </label>
        <label className="block" htmlFor={`${uid}-price`}>
          <span className="label">{r.servicePrice}</span>
          <input id={`${uid}-price`} type="number" inputMode="numeric" min={l.priceTzsMin} max={l.priceTzsMax} className="field" value={f.price} onChange={set('price')} aria-describedby={care ? `${uid}-price-hint` : undefined} />
        </label>
        <label className="block" htmlFor={`${uid}-people`}>
          <span className="label">{r.serviceMaxPeople}</span>
          <input id={`${uid}-people`} type="number" inputMode="numeric" min={1} max={l.maxPeopleMax} className="field" value={f.people} onChange={set('people')} />
        </label>
      </div>
      {care && <p id={`${uid}-price-hint`} className="text-sm text-muted">{r.servicePriceHintCare}</p>}
      {error && <p role="alert" className="rounded-[5px] bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-outline" disabled={data.soon || pending} onClick={save}>
          <Busy pending={pending}>{serviceId ? r.serviceSave : r.serviceAdd}</Busy>
        </button>
        {cancellable && (
          <button type="button" className="min-h-12 px-2 font-semibold text-forest underline" onClick={() => onDone(false)}>{r.serviceCancel}</button>
        )}
      </div>
    </div>
  );
}

function RulesCard({ r, data }: { r: ReservationText; data: SetupData }) {
  const [minNotice, setMinNotice] = useState(String(data.rules.minNotice));
  const [maxDays, setMaxDays] = useState(String(data.rules.maxDays));
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<Message>(null);
  const uid = useId();
  const l = reservationLimits;

  function save() {
    setMessage(null);
    start(async () => {
      const result = await saveRules(data.providerId, Number(minNotice), Number(maxDays));
      if (result.ok) setMessage({ tone: 'ok', text: r.rulesSaved });
      else setMessage({ tone: 'error', text: result.error === 'invalid' ? r.rulesInvalid : errorText(r, result) });
    });
  }

  return (
    <Section id="rules" icon={<CalendarClock className="size-5 text-leaf-dark" aria-hidden />} title={r.rulesTitle}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block" htmlFor={`${uid}-notice`}>
          <span className="label">{r.minNotice}</span>
          <input id={`${uid}-notice`} type="number" inputMode="numeric" min={l.minNoticeMin} max={l.minNoticeMax} step={15} className="field" value={minNotice} onChange={(e) => setMinNotice(e.target.value)} aria-describedby={`${uid}-notice-hint`} />
          <span id={`${uid}-notice-hint`} className="mt-1 block text-sm text-muted">{r.minNoticeHint}</span>
        </label>
        <label className="block" htmlFor={`${uid}-days`}>
          <span className="label">{r.maxDays}</span>
          <input id={`${uid}-days`} type="number" inputMode="numeric" min={l.maxDaysMin} max={l.maxDaysMax} className="field" value={maxDays} onChange={(e) => setMaxDays(e.target.value)} aria-describedby={`${uid}-days-hint`} />
          <span id={`${uid}-days-hint`} className="mt-1 block text-sm text-muted">{r.maxDaysHint}</span>
        </label>
      </div>
      <button type="button" className="btn-outline w-full sm:w-auto" disabled={data.soon || pending} onClick={save}>
        <Busy pending={pending}>{r.rulesSave}</Busy>
      </button>
      <Feedback message={message} />
    </Section>
  );
}
