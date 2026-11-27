import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { appMayShowPay, payChooserText, type PaymentPurpose } from '@kwetuly/shared';
import { Button } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { paymentMethods } from '@/lib/lipa';

type Props = { purpose: PaymentPurpose; subject?: string; period?: 'month' | 'year'; amountTzs?: number | null; title?: string; variant?: 'primary' | 'outline' };

// "Pay now" in the app. Shown ONLY when the server lists at least one method for this purpose on this
// platform: for items the store policy keeps on the website (web_only, not_offered) the server returns
// no rows and this renders nothing at all (no button, no price, no link, no "pay on the website" text).
export function LipaPayButton({ purpose, subject, period, amountTzs, title, variant = 'primary' }: Props) {
  const { locale } = useI18n();
  const t = payChooserText(locale);
  const rows = useQuery({ queryKey: ['pay-methods', purpose], queryFn: () => paymentMethods(purpose), staleTime: 60_000 });
  if (!appMayShowPay(rows.data)) return null;
  return (
    <Button
      title={title ?? t.payNow}
      variant={variant}
      onPress={() =>
        router.push({
          pathname: '/pay-methods',
          params: { purpose, ...(subject ? { subject } : {}), ...(period ? { period } : {}), ...(amountTzs ? { amount: String(amountTzs) } : {}) },
        })
      }
    />
  );
}
