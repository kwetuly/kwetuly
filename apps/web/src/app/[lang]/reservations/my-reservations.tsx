'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import {
  fillText,
  formatReservationTime,
  reserveText,
  travellerReservationActions,
  type ReservationStatus,
  type ReserveText,
} from '@kwetuly/shared';
import { reserveError } from '../businesses/[id]/reserve/reserve-form';
import { actOnReservation, answerVisit, type ReservationResult } from './actions';

export type MyReservation = {
  id: string;
  provider_id: string | null;
  business_name: string;
  business_type: string;
  service_name: string | null;
  starts_at: string;
  party_size: number;
  note: string | null;
  status: ReservationStatus;
  offered_starts_at: string | null;
  business_note: string | null;
  cancelled_by: string | null;
  decline_reason: string | null;
  diet_line: string | null;
  traveller_said_happened: boolean | null;
  can_answer_visit: boolean;
  asks_people_count?: boolean;
};

const tone: Record<ReservationStatus, string> = {
  requested: 'bg-sand',
  confirmed: 'bg-mint text-forest',
  declined: 'bg-line',
  other_time_offered: 'bg-sand',
  cancelled: 'bg-line',
  no_show: 'bg-line',
  completed: 'bg-mint text-forest',
};

export function MyReservations({ locale, rows }: { locale: string; rows: MyReservation[] }) {
  const r = reserveText(locale);
  return (
    <ul className="space-y-4">
      {rows.map((row) => (
        <li key={row.id}>
          <Row r={r} locale={locale} row={row} />
        </li>
      ))}
    </ul>
  );
}

function Row({ r, locale, row }: { r: ReserveText; locale: string; row: MyReservation }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const b = { business: row.business_name };
  const actions = travellerReservationActions(row);
  const [people, setPeople] = useState(String(row.party_size));

  function run(work: () => Promise<ReservationResult>, ok: string) {
    setMessage(null);
    start(async () => {
      const result = await work();
      setMessage(result.ok ? { tone: 'ok', text: ok } : { tone: 'error', text: reserveError(r, result) });
    });
  }

  const label = { accept_offer: r.acceptOffer, refuse_offer: r.refuseOffer, cancel: r.cancel };
  let reason: string | null = null;
  if (row.status === 'declined' && row.decline_reason === 'no_answer') reason = r.declinedNoAnswer;
  if (row.status === 'declined' && row.decline_reason === 'offer_refused') reason = r.declinedOfferRefused;
  if (row.status === 'cancelled' && row.cancelled_by === 'business') reason = fillText(r.cancelledByBusiness, b);

  return (
    <article aria-labelledby={`res-${row.id}`} className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id={`res-${row.id}`} className="text-lg font-bold">{row.business_name}</h2>
          <p className="text-sm text-muted">{[row.service_name, formatReservationTime(row.starts_at, locale), fillText(r.people, { n: row.party_size })].filter(Boolean).join(' · ')}</p>
        </div>
        <span className={`rounded-[5px] px-2 py-1 text-sm font-semibold ${tone[row.status]}`}>{r.statuses[row.status]}</span>
      </div>
      {reason && <p className="text-sm">{reason}</p>}
      {row.status === 'other_time_offered' && row.offered_starts_at && (
        <p className="rounded-[5px] bg-sand p-3 font-semibold">{fillText(r.offered, { ...b, time: formatReservationTime(row.offered_starts_at, locale) })}</p>
      )}
      {row.business_note && (
        <p className="text-sm">
          <span className="font-semibold">{fillText(r.messageFrom, b)}: </span>
          {row.business_note}
        </p>
      )}
      {row.note && (
        <p className="text-sm text-muted">
          <span className="font-semibold">{r.noteLabel}: </span>
          {row.note}
        </p>
      )}
      {row.diet_line && (
        <p className="text-sm text-muted">
          <span className="font-semibold">{r.dietLabel}: </span>
          {row.diet_line}
        </p>
      )}

      {row.can_answer_visit && (
        <fieldset className="space-y-2 rounded-[5px] bg-surface p-3">
          <legend className="font-semibold">{r.visitQuestion}</legend>
          {row.asks_people_count && (
            <label className="block" htmlFor={`people-${row.id}`}>
              <span className="label">{r.visitPeople}</span>
              <input id={`people-${row.id}`} type="number" inputMode="numeric" min={1} max={row.party_size} className="field w-28" value={people} onChange={(e) => setPeople(e.target.value)} />
            </label>
          )}
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-outline" disabled={pending} onClick={() => run(() => answerVisit(row.id, true, row.asks_people_count ? Number(people) : null), r.visitThanks)}>{r.visitYes}</button>
            <button type="button" className="btn-outline" disabled={pending} onClick={() => run(() => answerVisit(row.id, false), r.visitThanks)}>{r.visitNo}</button>
          </div>
        </fieldset>
      )}

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {actions.map((a) => (
            <button
              key={a}
              type="button"
              className={a === 'cancel' ? 'min-h-12 px-2 font-semibold text-red-800 underline' : 'btn-outline'}
              disabled={pending}
              aria-label={`${label[a]}: ${row.business_name}`}
              onClick={() => {
                if (a === 'cancel' && !window.confirm(r.cancelConfirm)) return;
                run(() => actOnReservation(row.id, a), r.done);
              }}
            >
              {label[a]}
            </button>
          ))}
          {pending && <Loader2 className="size-5 animate-spin self-center" aria-hidden />}
        </div>
      )}
      {message &&
        (message.tone === 'ok' ? (
          <p role="status" className="flex items-center gap-2 rounded-[5px] bg-mint p-3 text-sm font-semibold text-forest">
            <CheckCircle2 className="size-5 shrink-0" aria-hidden /> {message.text}
          </p>
        ) : (
          <p role="alert" className="rounded-[5px] bg-red-50 p-3 text-sm text-red-800">{message.text}</p>
        ))}
    </article>
  );
}
