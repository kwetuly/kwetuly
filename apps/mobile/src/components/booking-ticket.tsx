import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { approxTzs, formatUsd } from '@rafrika/shared';
import { Badge } from '@/components/ui';
import type { DepositState } from '@/lib/api-requests';
import { useI18n } from '@/lib/i18n';
import { colors, radius, space, textSize } from '@/theme';

type Props = {
  title: string;
  guide: string;
  dates: string;
  people: number;
  totalUsd: number;
  depositPercent: number;
  deposit: DepositState | undefined;
  rate: number | null | undefined;
  children?: ReactNode;
  /** The guide or company is looking: say "paid out to you" instead of "your guide". */
  forGuide?: boolean;
};

const dashed = { borderStyle: 'dashed' as const, borderColor: colors.separator };

// A confirmed booking reads like a ticket: what, who, when, how much, and where the deposit is.
export function BookingTicket({ title, guide, dates, people, totalUsd, depositPercent, deposit, rate, children, forGuide }: Props) {
  const { t, locale } = useI18n();
  const r = t.requests;
  const p = t.payments;
  const tzs = approxTzs(totalUsd, rate);
  const depositLine = !depositPercent
    ? null
    : deposit?.paid
      ? `${p.paidOn.replace('{date}', deposit.paidAt ? new Date(deposit.paidAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '')} · ${forGuide ? (deposit.paidOut ? t.hub.depositPaidOut : t.hub.depositHeld) : deposit.paidOut ? p.paidOutNote : p.heldNote}`
      : p.notPaid;

  const cell = (label: string, value: string, extra?: string | null) => (
    <View style={{ width: '50%', paddingRight: space.sm, gap: space.xxs }}>
      <Text style={{ color: colors.secondaryLabel, fontSize: textSize.footnote }}>{label}</Text>
      <Text selectable style={{ color: colors.label, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{value}</Text>
      {extra ? <Text style={{ color: colors.secondaryLabel, fontSize: textSize.caption, fontVariant: ['tabular-nums'] }}>{extra}</Text> : null}
    </View>
  );

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.separator, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1, ...dashed }}>
        <Text style={{ color: colors.secondaryLabel, fontSize: textSize.subhead, fontWeight: '700' }}>{r.ticketTitle}</Text>
        <Badge label={r.offerStatus.accepted} />
      </View>
      <View style={{ padding: space.lg, gap: space.md }}>
        <Text style={{ color: colors.label, fontSize: textSize.headline, fontWeight: '800' }}>{title}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md }}>
          {cell(r.ticketGuide, guide)}
          {cell(r.ticketDates, dates)}
          {cell(r.ticketGroup, `${people} ${r.people}`)}
          {cell(r.ticketTotal, formatUsd(totalUsd), tzs)}
        </View>
      </View>
      {depositLine && (
        <View style={{ paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: 1, ...dashed, gap: space.xxs }}>
          <Text style={{ color: colors.label, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
            {r.deposit} {depositPercent}% · {formatUsd(deposit?.amountUsd ?? Math.round(totalUsd * depositPercent) / 100)}
          </Text>
          <Text style={{ color: colors.secondaryLabel }}>{depositLine}</Text>
        </View>
      )}
      {children ? <View style={{ padding: space.lg, gap: space.md, borderTopWidth: 1, borderTopColor: colors.separator }}>{children}</View> : null}
    </View>
  );
}
