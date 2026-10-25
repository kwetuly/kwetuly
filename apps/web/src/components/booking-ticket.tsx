import type { ReactNode } from 'react';
import { approxTzs, formatUsd } from '@kwetuly/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import type { DepositState } from '@/lib/requests';

type Props = {
  title: string;
  guide: string;
  dates: string;
  people: number;
  totalUsd: number;
  depositPercent: number;
  deposit: DepositState;
  rate: number | null;
  t: Dictionary;
  locale: Locale;
  children?: ReactNode;
  /** The guide or company is looking: say "paid out to you" instead of "your guide". */
  forGuide?: boolean;
};

// A confirmed booking reads like a ticket: what, who, when, how much, and where the deposit is.
export function BookingTicket({ title, guide, dates, people, totalUsd, depositPercent, deposit, rate, t, locale, children, forGuide }: Props) {
  const r = t.requests;
  const p = t.payments;
  const tzs = approxTzs(totalUsd, rate);
  const depositLine = !depositPercent
    ? null
    : deposit.paid
      ? `${p.paidOn.replace('{date}', deposit.paidAt ? new Date(deposit.paidAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '')} · ${forGuide ? (deposit.paidOut ? t.hub.depositPaidOut : t.hub.depositHeld) : deposit.paidOut ? p.paidOutNote : p.heldNote}`
      : deposit.review
        ? forGuide ? t.hub.depositChecking : p.checking
        : p.notPaid;

  return (
    <div className="overflow-hidden rounded-[5px] border border-line bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-dashed border-line px-5 py-3">
        <p className="text-sm font-bold text-muted">{r.ticketTitle}</p>
        <span className="rounded-[5px] bg-mint px-3 py-1 text-xs font-bold text-forest">{r.offerStatus.accepted}</span>
      </div>
      <div className="px-5 py-4">
        <p className="text-xl font-extrabold">{title}</p>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div><dt className="text-muted">{r.ticketGuide}</dt><dd className="font-semibold">{guide}</dd></div>
          <div><dt className="text-muted">{r.ticketDates}</dt><dd className="font-semibold">{dates}</dd></div>
          <div><dt className="text-muted">{r.ticketGroup}</dt><dd className="font-semibold">{people} {r.people}</dd></div>
          <div>
            <dt className="text-muted">{r.ticketTotal}</dt>
            <dd className="font-semibold tabular-nums">{formatUsd(totalUsd)}{tzs && <span className="block text-xs font-normal text-muted">{tzs}</span>}</dd>
          </div>
        </dl>
      </div>
      {depositLine && (
        <div className="border-t border-dashed border-line px-5 py-3 text-sm">
          <span className="font-bold">{r.deposit} {depositPercent}%</span>
          <span className="tabular-nums"> · {formatUsd(deposit.amountUsd ?? Math.round(totalUsd * depositPercent) / 100)}</span>
          <p className="mt-1 text-muted">{depositLine}</p>
        </div>
      )}
      {children && <div className="border-t border-line px-5 py-4">{children}</div>}
    </div>
  );
}
