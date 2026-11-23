'use client';

import { useId, useState, useTransition } from 'react';
import Link from 'next/link';
import { CalendarCheck, CheckCircle2, Loader2, MessageSquare, ReceiptText } from 'lucide-react';
import {
  answerByTime,
  fillText,
  formatReservationTime,
  offerTimeOk,
  statementTotals,
  formatTzs,
  ownerReservationActions,
  reservationInboxText,
  reservationRules,
  tanzaniaParts,
  tanzaniaStartsAt,
  type ReservationAction,
  type ReservationCommissionStatus,
  type ReservationInboxText,
  type ReservationStatus,
} from '@kwetuly/shared';
import { actOnReservation, type ReservationResult } from '../../../reservations/actions';

export type OwnerReservation = {
  id: string;
  starts_at: string;
  party_size: number;
  service_name: string | null;
  traveller_first_name: string;
  note: string | null;
  diet_line: string | null;
  status: ReservationStatus;
  offered_starts_at: string | null;
  business_note: string | null;
  cancelled_by: string | null;
  came_count: number | null;
  disputed: boolean;
  commission_tzs: number | null;
  commission_status: ReservationCommissionStatus;
  is_sample: boolean;
  /** Being added by backend; absent until then. */
  answer_by?: string | null;
  /** The Kwetuly chat thread with the guest (business chat migration); absent before it. */
  chat_id?: string | null;
};

export type StatementRow = { commission_status: ReservationCommissionStatus; reservation_count: number; guests_counted: number; commission_tzs: number; billing_on: boolean };

type Message = { tone: 'ok' | 'error'; text: string } | null;

function errorText(x: ReservationInboxText, result: ReservationResult): string {
  if (result.ok) return '';
  if (result.error === 'soon') return x.soon;
  if (result.error === 'refused' && result.code && result.code in x.actionRefusals) return x.actionRefusals[result.code as keyof ReservationInboxText['actionRefusals']];
  return x.saveError;
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

/** Groups: requests to answer, past confirmed to mark, upcoming, then the rest (newest first). */
function group(rows: OwnerReservation[], now: number) {
  const waiting: OwnerReservation[] = [];
  const toMark: OwnerReservation[] = [];
  const upcoming: OwnerReservation[] = [];
  const earlier: OwnerReservation[] = [];
  for (const r of rows) {
    const future = new Date(r.starts_at).getTime() > now;
    if (r.status === 'requested' && future) waiting.push(r);
    else if (r.status === 'confirmed' && !future) toMark.push(r);
    else if ((r.status === 'confirmed' || r.status === 'other_time_offered') && future) upcoming.push(r);
    else earlier.push(r);
  }
  earlier.reverse();
  return { waiting, toMark, upcoming, earlier };
}

export function Inbox({ locale, rows, soon }: { locale: string; rows: OwnerReservation[]; soon: boolean }) {
  const x = reservationInboxText(locale);
  const [now] = useState(() => Date.now());
  const groups = group(rows, now);
  return (
    <section aria-labelledby="inbox-title" className="space-y-6">
      <h2 id="inbox-title" className="flex items-center gap-2 text-xl font-bold">
        <CalendarCheck className="size-6 text-leaf-dark" aria-hidden /> {x.title}
      </h2>
      <p className="text-sm text-muted">{x.range}</p>
      <p className="rounded-[5px] bg-surface p-3 text-sm">{x.markRule}</p>
      {rows.length === 0 && <p className="card text-muted">{x.empty}</p>}
      {(['waiting', 'toMark', 'upcoming', 'earlier'] as const).map((key) =>
        groups[key].length === 0 ? null : (
          <div key={key} className="space-y-3">
            <h3 className="text-lg font-bold">{x.groups[key]}</h3>
            <ul className="space-y-3">
              {groups[key].map((r) => (
                <li key={r.id}>
                  <Row x={x} locale={locale} row={r} soon={soon} />
                </li>
              ))}
            </ul>
          </div>
        ),
      )}
    </section>
  );
}

function Row({ x, locale, row, soon }: { x: ReservationInboxText; locale: string; row: OwnerReservation; soon: boolean }) {
  const uid = useId();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<Message>(null);
  const [note, setNote] = useState('');
  const [offering, setOffering] = useState(false);
  const own = tanzaniaParts(row.starts_at);
  const [offerDay, setOfferDay] = useState(own.day);
  const [offerAt, setOfferAt] = useState(own.time);
  const [came, setCame] = useState(String(row.party_size));
  const actions = ownerReservationActions(row);
  const answering = actions.includes('confirm');

  function run(action: ReservationAction, extra: Parameters<typeof actOnReservation>[2] = {}) {
    setMessage(null);
    start(async () => {
      const result = await actOnReservation(row.id, action, extra);
      if (result.ok) {
        setOffering(false);
        setMessage({ tone: 'ok', text: x.done[action as keyof ReservationInboxText['done']] ?? x.done.confirm });
      } else setMessage({ tone: 'error', text: errorText(x, result) });
    });
  }

  const statusTone = row.status === 'requested' || row.status === 'other_time_offered' ? 'bg-sand' : row.status === 'confirmed' || row.status === 'completed' ? 'bg-mint text-forest' : 'bg-line';

  return (
    <article aria-labelledby={`${uid}-t`} className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 id={`${uid}-t`} className="font-bold">
            {formatReservationTime(row.starts_at, locale)}
          </h4>
          <p className="text-sm text-muted">{[row.traveller_first_name, row.service_name ?? x.table, fillText(x.people, { n: row.party_size })].join(' · ')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {row.is_sample && <span className="rounded-[5px] bg-line px-2 py-1 text-sm font-semibold">{x.sample}</span>}
          <span className={`rounded-[5px] px-2 py-1 text-sm font-semibold ${statusTone}`}>{x.statuses[row.status]}</span>
        </div>
      </div>

      {answering && answerByTime(row.answer_by, locale) && <p className="text-sm font-semibold">{fillText(x.answerBy, { time: answerByTime(row.answer_by, locale)! })}</p>}
      {row.note && <p className="text-sm"><span className="font-semibold">{x.guestNote}: </span>{row.note}</p>}
      {row.diet_line && <p className="rounded-[5px] bg-sand p-3 text-sm"><span className="font-semibold">{x.diet}: </span>{row.diet_line}</p>}
      {row.offered_starts_at && <p className="text-sm font-semibold">{fillText(x.offered, { time: formatReservationTime(row.offered_starts_at, locale) })}</p>}
      {row.business_note && <p className="text-sm text-muted"><span className="font-semibold">{x.yourNote}: </span>{row.business_note}</p>}
      {row.status === 'cancelled' && <p className="text-sm">{row.cancelled_by === 'business' ? x.cancelledByBusiness : x.cancelledByTraveller}</p>}
      {row.status === 'completed' && row.came_count != null && <p className="text-sm">{fillText(x.came, { n: row.came_count })}</p>}
      {row.disputed && <p className="rounded-[5px] bg-sand p-3 text-sm font-semibold">{x.disputed}</p>}
      {row.status === 'completed' && row.commission_tzs != null ? (
        <p className="text-sm">{fillText(x.commissionLine, { amount: formatTzs(row.commission_tzs) })} · {x.commissionStatuses[row.commission_status]}</p>
      ) : (
        (row.status === 'confirmed' || row.status === 'requested') && <p className="text-sm text-muted">{x.commissionAfter}</p>
      )}

      {row.chat_id && (
        <Link href={`/${locale}/messages/${row.chat_id}`} className="inline-flex min-h-12 items-center gap-2 font-semibold text-forest underline">
          <MessageSquare className="size-5" aria-hidden /> {x.messageGuest}
        </Link>
      )}
      {answering && (
        <label className="block" htmlFor={`${uid}-note`}>
          <span className="label">{x.note}</span>
          <textarea id={`${uid}-note`} className="field min-h-20" maxLength={reservationRules.noteMax} value={note} onChange={(e) => setNote(e.target.value)} aria-describedby={`${uid}-note-hint`} />
          <span id={`${uid}-note-hint`} className="mt-1 block text-sm text-muted">{x.noteHint}</span>
        </label>
      )}

      {offering && (
        <div className="grid gap-3 rounded-[5px] border border-forest p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block" htmlFor={`${uid}-od`}>
            <span className="label">{x.offerDay}</span>
            <input id={`${uid}-od`} type="date" className="field" value={offerDay} onChange={(e) => setOfferDay(e.target.value)} />
          </label>
          <label className="block" htmlFor={`${uid}-ot`}>
            <span className="label">{x.offerAt}</span>
            <input id={`${uid}-ot`} type="time" step={900} className="field" value={offerAt} onChange={(e) => setOfferAt(e.target.value)} />
          </label>
          <button type="button" className="btn-outline" disabled={soon || pending} onClick={() => (offerTimeOk(offerDay, offerAt.slice(0, 5)) ? run('offer_time', { offeredStartsAt: tanzaniaStartsAt(offerDay, offerAt.slice(0, 5)), note }) : setMessage({ tone: 'error', text: x.offerInvalid }))}>
            {x.sendOffer}
          </button>
        </div>
      )}

      {actions.includes('mark_came') && (
        <label className="block" htmlFor={`${uid}-came`}>
          <span className="label">{x.cameCount}</span>
          <input id={`${uid}-came`} type="number" inputMode="numeric" min={1} max={row.party_size} className="field w-28" value={came} onChange={(e) => setCame(e.target.value)} />
        </label>
      )}

      {actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {actions.map((a) => {
            const common = { type: 'button' as const, disabled: soon || pending };
            switch (a) {
              case 'confirm':
                return <button key={a} {...common} className="btn-outline" onClick={() => run('confirm', { note })}>{x.confirm}</button>;
              case 'decline':
                return <button key={a} {...common} className="btn-outline" onClick={() => run('decline', { note })}>{x.decline}</button>;
              case 'offer_time':
                return <button key={a} {...common} className="min-h-12 px-2 font-semibold text-forest underline" aria-expanded={offering} onClick={() => setOffering((o) => !o)}>{offering ? x.close : x.offerTime}</button>;
              case 'cancel':
                return <button key={a} {...common} className="min-h-12 px-2 font-semibold text-red-800 underline" onClick={() => window.confirm(x.cancelConfirm) && run('cancel')}>{x.cancel}</button>;
              case 'mark_came':
                return <button key={a} {...common} className="btn-outline" onClick={() => run('mark_came', { cameCount: Number(came) })}>{x.markCame}</button>;
              case 'mark_no_show':
                return <button key={a} {...common} className="min-h-12 px-2 font-semibold text-red-800 underline" onClick={() => run('mark_no_show')}>{x.markNoShow}</button>;
              default:
                return null;
            }
          })}
          {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
        </div>
      )}
      <Feedback message={message} />
    </article>
  );
}

export function Statement({
  locale,
  providerId,
  month,
  months,
  rows,
  billingOn,
  soon,
}: {
  locale: string;
  providerId: string;
  month: string;
  months: string[];
  rows: StatementRow[];
  billingOn: boolean;
  soon: boolean;
}) {
  const x = reservationInboxText(locale);
  const uid = useId();
  // Only owed, invoiced and paid count; held and waived are their own lines (security review L-F).
  const { total, held, waived } = statementTotals(rows);
  const label = (m: string) => {
    try {
      return new Date(`${m}-01T00:00:00Z`).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
    } catch {
      return m;
    }
  };
  return (
    <section aria-labelledby={`${uid}-st`} className="card space-y-4">
      <h2 id={`${uid}-st`} className="flex items-center gap-2 text-lg font-bold">
        <ReceiptText className="size-5 text-leaf-dark" aria-hidden /> {x.statementTitle}
      </h2>
      <p className="rounded-[5px] bg-sand p-3 text-sm font-semibold">{billingOn ? x.statementBilling : x.statementInfo}</p>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={providerId} />
        <label className="block" htmlFor={`${uid}-m`}>
          <span className="label">{x.statementMonth}</span>
          <select id={`${uid}-m`} name="month" className="field" defaultValue={month}>
            {months.map((m) => (
              <option key={m} value={m}>{label(m)}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-outline" disabled={soon}>{x.statementShow}</button>
      </form>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{x.statementEmpty}</p>
      ) : (
        <dl className="divide-y divide-line">
          {rows.filter((r) => r.commission_status !== 'held' && r.commission_status !== 'waived').map((r) => (
            <div key={r.commission_status} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
              <dt>
                <span className="font-semibold">{x.commissionStatuses[r.commission_status]}</span>
                <span className="block text-muted">{fillText(x.statementRow, { count: r.reservation_count, guests: r.guests_counted })}</span>
              </dt>
              <dd className="font-semibold">{formatTzs(Number(r.commission_tzs))}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-2 py-2 font-bold">
            <dt>{x.statementTotal}</dt>
            <dd>{formatTzs(total)}</dd>
          </div>
          {held > 0 && (
            <div className="flex justify-between gap-2 py-2 text-sm">
              <dt>{x.commissionStatuses.held}</dt>
              <dd>{formatTzs(held)}</dd>
            </div>
          )}
          {waived > 0 && (
            <div className="flex justify-between gap-2 py-2 text-sm">
              <dt>{x.commissionStatuses.waived}</dt>
              <dd>{formatTzs(waived)}</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}
