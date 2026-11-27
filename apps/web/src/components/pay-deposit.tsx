import { CreditCard } from 'lucide-react';
import { canPick, depositTzs, depositTzsFromRateText, formatTzsAmount, lipaPayText, PAYMENT_PROVIDER_NAME } from '@kwetuly/shared';
import { manualRate, paymentMethods } from '@/lib/lipa';
import { PayNow } from './pay-now';
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

// Deposit box for an accepted offer or group-trip spot. While online payments are switched off it shows the
// amount with a disabled Pay button and "opens soon"; once on, it is hidden when this deposit cannot be paid
// online (the Edge Function's own rules decide).
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
  // Payments switched off (Walter, 2026-11-22: show every button): the box stays, with the amount and
  // a disabled Pay button. The payable check is skipped: while off, the Edge Function answers
  // not_configured to every check, so it cannot tell us more.
  if (!config.enabled) {
    // Lipa numbers (manual payments, 2026-11-26): offered when the server lists a live method for this
    // deposit (feature.deposits_via_kwetuly_lipa, a switched-on number, a current rate). This money
    // belongs to the guide or business: Kwetuly holds it until it is paid out.
    const purpose = kind === 'offer' ? 'offer_deposit' : 'group_deposit';
    const [rows, rate] = await Promise.all([paymentMethods(purpose), manualRate()]);
    const cents = totalUsd * percent;
    const lipaTzs = rate && Number.isSafeInteger(cents) ? depositTzsFromRateText(cents, rate.rate) : null;
    if (lipaTzs && rows?.some(canPick)) {
      const lp = lipaPayText(locale);
      return (
        <div id="pay" className={`scroll-mt-28 space-y-3 rounded-[5px] p-4 ${dark ? 'bg-white/10' : 'bg-sand'}`}>
          <p className="flex items-center gap-2 font-bold"><CreditCard className="size-5" aria-hidden /> {p.title}</p>
          <p className="text-2xl font-extrabold">
            ${depositUsd(totalUsd, percent).toLocaleString(locale)} <span className="text-sm font-semibold">({percent}%)</span>
          </p>
          <p className="text-sm font-semibold">{formatTzsAmount(lipaTzs)}</p>
          {error && <p role="alert" className="text-sm font-semibold">{Object.hasOwn(lp.errors, error) ? lp.errors[error] : errorText(error, p)}</p>}
          <PayNow purpose={purpose} subject={id} amountTzs={lipaTzs} locale={locale} back={back} note={lp.depositHeld} />
          <p className="text-xs opacity-80">{lp.depositHeld}</p>
          <p className="text-xs opacity-70">{p.direct}</p>
        </div>
      );
    }
    return (
      <div id="pay" className={`scroll-mt-28 space-y-3 rounded-[5px] p-4 ${dark ? 'bg-white/10' : 'bg-sand'}`}>
        <p className="flex items-center gap-2 font-bold"><CreditCard className="size-5" aria-hidden /> {p.title}</p>
        <p className="text-2xl font-extrabold">
          ${depositUsd(totalUsd, percent).toLocaleString(locale)} <span className="text-sm font-semibold">({percent}%)</span>
        </p>
        <button type="button" className="btn w-full" disabled aria-describedby="pay-soon">{p.cta}</button>
        <p id="pay-soon" className="text-sm font-semibold">{p.opensSoon}</p>
        <p className="text-xs opacity-70">{p.direct}</p>
      </div>
    );
  }

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
