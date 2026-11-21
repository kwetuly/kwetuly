import { CreditCard } from 'lucide-react';
import { depositTzs, PAYMENT_PROVIDER_NAME } from '@kwetuly/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { depositPayable, depositUsd, paymentsConfig } from '@/lib/payments';
import { createClient } from '@/lib/supabase/server';
import { startPayment } from '@/app/[lang]/payments/actions';
import { SubmitButton } from './submit-button';

type Props = {
  kind: 'offer' | 'group';
  id: string;
  totalUsd: number;
  percent: number;
  paid: boolean;
  /** The payment provider reported a payment that Kwetuly is checking by hand: say so, never offer to pay again. */
  review?: boolean;
  /** Set when paid: whether Kwetuly still holds the deposit or has paid the guide. */
  paidOut?: boolean;
  /** Page to come back to if starting the payment fails. */
  back: string;
  error?: string;
  t: Dictionary;
  locale: Locale;
  dark?: boolean;
};

function errorText(error: string, p: Dictionary['payments']) {
  switch (error) {
    case 'phone_required':
      return p.phoneRequired;
    case 'under_review':
      return p.underReview;
    case 'pending_order':
      return p.pendingOrder;
    case 'not_approved':
      return p.notApproved;
    default:
      return p.error;
  }
}

// Deposit box for an accepted offer or group-trip spot. Hidden until online payments are set up, and hidden
// when this deposit cannot be paid online (the Edge Function's own rules decide).
export async function PayDeposit({ kind, id, totalUsd, percent, paid, review, paidOut, back, error, t, locale, dark }: Props) {
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
  const checking = (
    <div className={`rounded-[5px] p-4 ${dark ? 'bg-white/10' : 'bg-sand'}`}>
      <p className="font-semibold">{p.review}</p>
      <p className="mt-1 text-sm opacity-80">{p.underReview}</p>
    </div>
  );
  if (review) return checking;
  const config = await paymentsConfig();
  if (!config.enabled) return null;

  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const payable = await depositPayable(kind, id, data.session?.access_token);
  if (payable === 'hidden') return null;
  if (payable === 'review') return checking;
  // The shillings the traveller will be charged, worked out the same way as the server (whole cents,
  // integer maths). Display only: the server computes and saves the real amount at checkout.
  const cents = totalUsd * percent;
  const tzs = config.rate100 && Number.isSafeInteger(cents) && cents > 0 ? depositTzs(cents, config.rate100) : null;

  return (
    <form id="pay" action={startPayment} className={`scroll-mt-28 space-y-3 rounded-[5px] p-4 ${dark ? 'bg-white/10' : 'bg-sand'}`}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      <p className="flex items-center gap-2 font-bold"><CreditCard className="size-5" aria-hidden /> {p.title}</p>
      <p className="text-2xl font-extrabold">
        ${depositUsd(totalUsd, percent).toLocaleString(locale)} <span className="text-sm font-semibold">({percent}%)</span>
      </p>
      <p className="text-sm opacity-80">{p.body.replace('{provider}', PAYMENT_PROVIDER_NAME)}</p>
      {tzs !== null && <p className="text-sm font-semibold">{p.charged.replace('{amount}', tzs.toLocaleString(locale))}</p>}
      {error && <p className="rounded-[5px] bg-red-50 p-2 text-sm text-red-800">{errorText(error, p)}</p>}
      <SubmitButton className="btn w-full">{p.cta}</SubmitButton>
      <p className="text-xs opacity-70">{p.direct}</p>
    </form>
  );
}
