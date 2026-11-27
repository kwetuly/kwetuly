'use client';

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, CreditCard, Smartphone, WifiOff, X } from 'lucide-react';
import {
  LAST_METHOD_KEY,
  METHOD_BADGE_NAMES,
  canPick,
  isLastMethod,
  orderMethods,
  type MethodBadge,
  type PayChooserText,
  type PaymentMethod,
  type PaymentMethodRow,
  type PaymentPurpose,
} from '@kwetuly/shared';
import { startPayment } from '@/app/[lang]/payments/lipa-actions';
import { SubmitButton } from './submit-button';

type Props = {
  purpose: PaymentPurpose;
  subject?: string;
  period?: 'month' | 'year';
  month?: string;
  /** From the server (public.payment_methods_for); null = could not be loaded. Never decided here. */
  rows: PaymentMethodRow[] | null;
  amountText: string;
  usdText?: string | null;
  localText?: string | null;
  locale: string;
  back: string;
  t: PayChooserText;
  buttonLabel?: string;
  buttonClassName?: string;
};

const METHOD_ICON: Record<PaymentMethod, typeof CreditCard> = { mobile_money: Smartphone, bank: Building2, card: CreditCard };

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

function readLast(): string | null {
  try {
    const v = window.localStorage.getItem(LAST_METHOD_KEY);
    return isLastMethod(v) ? v : null;
  } catch {
    return null;
  }
}

function saveLast(id: string) {
  try {
    window.localStorage.setItem(LAST_METHOD_KEY, id);
  } catch {
    // Private window or blocked storage: the order simply stays as Kwetuly set it.
  }
}

// "Pay now" and its method chooser: a bottom sheet on phones, a centred dialog on larger screens. The
// native <dialog> gives the focus trap, Escape to close and the modal semantics. Every method the
// server lists is shown; only rows the server calls live (and the store route allows) can be picked.
export function PaymentChooser({ purpose, subject, period, month, rows, amountText, usdText, localText, locale, back, t, buttonLabel, buttonClassName }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [last, setLast] = useState<string | null>(null);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const titleId = `pay-title-${purpose}-${period ?? 'x'}`;

  useEffect(() => setLast(readLast()), []);

  const list = rows ? orderMethods(rows, last) : [];
  const badgeName = (b: MethodBadge) => (b === 'bank' ? t.bank : METHOD_BADGE_NAMES[b]);

  return (
    <>
      <button type="button" className={buttonClassName ?? 'btn w-full'} onClick={() => dialog.current?.showModal()} aria-haspopup="dialog">
        {buttonLabel ?? t.payNow}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-0 mt-auto w-full max-w-none rounded-t-[5px] bg-white p-0 text-charcoal shadow-2xl backdrop:bg-black/50 sm:m-auto sm:max-w-lg sm:rounded-[5px]"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="max-h-[85dvh] overflow-y-auto p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="text-xl font-bold">{t.title}</h2>
              <p className="mt-1 text-sm text-muted">{t.subtitle}</p>
            </div>
            <button type="button" onClick={() => dialog.current?.close()} className="rounded-[5px] p-2 hover:bg-surface" aria-label={t.close}>
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <div className="mt-4 rounded-[5px] bg-sand p-4">
            <p className="text-sm font-semibold text-muted">{t.amountLabel}</p>
            <p className="text-2xl font-extrabold tabular-nums">{amountText}</p>
            {usdText && <p className="text-sm tabular-nums">{usdText}</p>}
            {localText && <p className="text-sm text-muted">{localText}</p>}
          </div>

          {!online && (
            <p role="status" className="mt-4 flex items-center gap-2 rounded-[5px] bg-red-50 p-3 text-sm font-semibold text-red-900">
              <WifiOff className="size-4 shrink-0" aria-hidden /> {t.offline}
            </p>
          )}

          {rows === null ? (
            <div role="alert" className="mt-4 space-y-3">
              <p>{t.error}</p>
              <button type="button" className="btn-outline" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())}>
                {refreshing ? t.loading : t.retry}
              </button>
            </div>
          ) : list.length === 0 ? (
            <p className="mt-4">{t.none}</p>
          ) : (
            <ul className="mt-4 space-y-3" aria-label={t.methodsLabel}>
              {list.map((row) => {
                const pick = canPick(row);
                const Icon = METHOD_ICON[row.methods[0] ?? 'mobile_money'];
                const methods = row.methods.map((m) => t.methods[m]).join(', ');
                const body = (
                  <>
                    <span className={`flex size-10 shrink-0 items-center justify-center rounded-[5px] ${pick ? 'bg-leaf text-white' : 'bg-line text-muted'}`} aria-hidden>
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{row.display_name}</span>
                        {pick && row.id === last && <span className="rounded-[5px] bg-gold px-2 py-0.5 text-xs font-bold text-charcoal">{t.lastUsed}</span>}
                        <span className={`rounded-[5px] px-2 py-0.5 text-xs font-bold ${pick ? 'bg-mint text-forest' : 'bg-surface text-muted'}`}>
                          {pick ? t.live : t.comingSoon}
                        </span>
                      </span>
                      <span className="block text-sm text-muted">{methods}</span>
                      {row.badges.length > 0 && (
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          {row.badges.map((b) => (
                            <span key={b} className="rounded-[5px] border border-line bg-white px-2 py-0.5 text-xs font-semibold">{badgeName(b)}</span>
                          ))}
                        </span>
                      )}
                      {!pick && <span className="mt-1 block text-xs text-muted">{t.comingSoonHint}</span>}
                    </span>
                  </>
                );
                return (
                  <li key={row.id}>
                    {pick ? (
                      <form action={startPayment} onSubmit={() => saveLast(row.id)}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="back" value={back} />
                        <input type="hidden" name="purpose" value={purpose} />
                        <input type="hidden" name="provider" value={row.id} />
                        {subject && <input type="hidden" name="subject" value={subject} />}
                        {period && <input type="hidden" name="period" value={period} />}
                        {month && <input type="hidden" name="month" value={month} />}
                        <SubmitButton
                          disabled={!online}
                          aria-label={t.choose.replace('{name}', row.display_name)}
                          className="flex w-full items-start gap-3 rounded-[5px] border-2 border-leaf bg-white p-4 text-left transition hover:bg-mint focus-visible:bg-mint disabled:opacity-60"
                        >
                          {body}
                        </SubmitButton>
                      </form>
                    ) : (
                      <div aria-disabled="true" className="flex w-full items-start gap-3 rounded-[5px] border border-line bg-surface p-4 opacity-80">
                        {body}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </dialog>
    </>
  );
}
