import { CreditCard } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { depositPayable, depositUsd, paymentsEnabled } from '@/lib/payments';
import { createClient } from '@/lib/supabase/server';
import { startPayment } from '@/app/[lang]/payments/actions';

type Props = {
  kind: 'offer' | 'group';
  id: string;
  totalUsd: number;
  percent: number;
  paid: boolean;
  /** Selcom reported a payment that Rafrika is checking by hand: say so, never offer to pay again. */
  review?: boolean;
  /** Set when paid: whether Rafrika still holds the deposit or has paid the guide. */
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

// Deposit box for an accepted offer or group-trip spot. Hidden until Selcom is set up, and hidden
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
  if (!(await paymentsEnabled())) return null;

  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const payable = await depositPayable(kind, id, data.session?.access_token);
  if (payable === 'hidden') return null;
  if (payable === 'review') return checking;

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
      <p className="text-sm opacity-80">{p.body}</p>
      {error && <p className="rounded-[5px] bg-red-50 p-2 text-sm text-red-800">{errorText(error, p)}</p>}
      <button className="btn w-full">{p.cta}</button>
      <p className="text-xs opacity-70">{p.direct}</p>
    </form>
  );
}
