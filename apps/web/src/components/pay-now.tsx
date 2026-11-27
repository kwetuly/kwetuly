import { centsText, estimateFromCents, fillText, formatTzsAmount, payChooserText, tzsToUsdCents, type PaymentPurpose } from '@kwetuly/shared';
import { localEstimateRate, manualRate, paymentMethods } from '@/lib/lipa';
import { PaymentChooser } from './payment-chooser';

type Props = {
  purpose: PaymentPurpose;
  subject?: string;
  period?: 'month' | 'year';
  month?: string;
  /** For display only; the server works out and charges the real amount. */
  amountTzs: number;
  locale: string;
  back: string;
  buttonLabel?: string;
  buttonClassName?: string;
  note?: string | null;
};

// "Pay now" with the method chooser (server part): loads the methods the server allows for this purpose
// and the display texts for the amount: TZS, about US$ (from the admin-typed rate) and, where an admin
// typed a rate for the viewer's currency, a local estimate labelled as an estimate.
export async function PayNow({ purpose, subject, period, month, amountTzs, locale, back, buttonLabel, buttonClassName, note }: Props) {
  const t = payChooserText(locale);
  const [rows, rate, local] = await Promise.all([paymentMethods(purpose), manualRate(), localEstimateRate(locale)]);
  const usdCents = rate ? tzsToUsdCents(amountTzs, rate.rate) : null;
  const usdText = usdCents ? fillText(t.usdApprox, { usd: centsText(usdCents) }) : null;
  const localAmount = usdCents && local ? estimateFromCents(usdCents, local.perUsd) : null;
  const localText = localAmount && local ? `${fillText(t.localEstimate, { amount: `${local.currency} ${localAmount}` })} (${local.source})` : null;
  return (
    <PaymentChooser
      purpose={purpose}
      subject={subject}
      period={period}
      month={month}
      rows={rows}
      amountText={formatTzsAmount(amountTzs)}
      usdText={usdText}
      localText={localText}
      locale={locale}
      back={back}
      t={t}
      buttonLabel={buttonLabel}
      buttonClassName={buttonClassName}
      note={note}
    />
  );
}
