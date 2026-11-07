import { CreditCard } from 'lucide-react';
import { depositClosed, depositLastDay, formatDay, tanzaniaDate } from '@kwetuly/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { depositPayable, depositUsd, paymentsConfig } from '@/lib/payments';
import { createClient } from '@/lib/supabase/server';
import { startPayment } from '@/app/[lang]/payments/actions';
import { KeepForm } from './keep-form';
import { PayMethodFields } from './pay-method-fields';
import { SubmitButton } from './submit-button';

type Props = {
  kind: 'offer' | 'group';
  id: string;
  totalUsd: number;
  percent: number;
  paid: boolean;
  /** Selcom reported a payment that Kwetuly is checking by hand: say so, never offer to pay again. */
  review?: boolean;
  /** Set when paid: whether Kwetuly still holds the deposit or has paid the guide. */
  paidOut?: boolean;
  /** The trip's start date (YYYY-MM-DD): online deposits close 8 days before it (Tanzania date). */
  startDate?: string | null;
  /** For an offer on flexible or open dates: its last valid day (YYYY-MM-DD), if the guide set one. */
  validUntil?: string | null;
  /** The trip request is closed: no new deposit (a paid one still shows). */
  closed?: boolean;
  /** An error code from an earlier attempt, e.g. ?payError= on older links. */
  error?: string;
  t: Dictionary;
  locale: Locale;
  dark?: boolean;
};

function errorMessages(p: Dictionary['payments']): Record<string, string> {
  return {
    phone_required: p.phoneRequired,
    under_review: p.underReview,
    pending_order: p.pendingOrder,
    not_approved: p.notApproved,
    billing_required: p.billingRequired,
    billing_chars: p.billingChars,
    method_unavailable: p.methodUnavailable,
  };
}

// Deposit box for an accepted offer or group-trip spot. Hidden until Selcom is set up, and hidden
// when this deposit cannot be paid online (the Edge Function's own rules decide; the date rules
// are shown here first so the traveller knows why).
export async function PayDeposit({ kind, id, totalUsd, percent, paid, review, paidOut, startDate, validUntil, closed, error, t, locale, dark }: Props) {
  const p = t.payments;
  if (percent <= 0) return null;
  if (paid) {
    return (
      <div className="rounded-[5px] bg-mint p-4 text-forest">
        <p className="font-semibold">✓ {p.paid}</p>
        <p className="mt-1 text-sm">{paidOut ? p.paidOutNote : p.heldNote}</p>
      </div>
    );
  }
  const box = `rounded-[5px] p-4 ${dark ? 'bg-white/10' : 'bg-sand'}`;
  const checking = (
    <div className={box}>
      <p className="font-semibold">{p.review}</p>
      <p className="mt-1 text-sm opacity-80">{p.underReview}</p>
    </div>
  );
  if (review) return checking;
  const config = await paymentsConfig();
  if (!config.enabled || closed) return null;

  // Same date rules as the Edge Function, by the Tanzania date.
  if (depositClosed(startDate)) {
    return (
      <p id="pay" className={`${box} scroll-mt-28 text-sm font-semibold`}>
        {p.lateNote}
      </p>
    );
  }
  if (validUntil && validUntil < tanzaniaDate()) {
    return (
      <p id="pay" className={`${box} scroll-mt-28 text-sm font-semibold`}>
        {t.requests.expired}
      </p>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const payable = await depositPayable(kind, id, data.session?.access_token);
  if (payable === 'hidden') return null;
  if (payable === 'review') return checking;

  const messages = errorMessages(p);
  return (
    <div id="pay" className="scroll-mt-28">
      <KeepForm action={startPayment} messages={messages} fallback={p.error} className={`space-y-3 ${box}`}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={id} />
        <p className="flex items-center gap-2 font-bold"><CreditCard className="size-5" aria-hidden /> {p.title}</p>
        <p className="text-2xl font-extrabold">
          ${depositUsd(totalUsd, percent).toLocaleString(locale)} <span className="text-sm font-semibold">({percent}%)</span>
        </p>
        <p className="text-sm opacity-80">{config.methods.includes('card') ? p.body : p.bodyMobile}</p>
        {startDate && <p className="text-sm font-semibold">{p.lastDay.replace('{date}', formatDay(depositLastDay(startDate), locale))}</p>}
        {error && <p className="rounded-[5px] bg-red-50 p-2 text-sm text-red-800">{messages[error] ?? p.error}</p>}
        <PayMethodFields methods={config.methods} p={p} locale={locale} dark={dark} />
        <SubmitButton className="btn w-full">{p.cta}</SubmitButton>
        <p className="text-xs opacity-70">{p.direct}</p>
      </KeepForm>
    </div>
  );
}
