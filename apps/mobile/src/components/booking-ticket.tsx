import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { approxTzs, formatUsd } from '@kwetuly/shared';
import { Badge } from '@/components/ui';
import type { DepositState } from '@/lib/api-requests';
import { useI18n } from '@/lib/i18n';
import { useType } from '@/lib/use-type';
import { colors, layout, radius, space } from '@/theme';

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

const dashed = { borderStyle: 'dashed' as const, borderColor: colors.border };

// A confirmed booking reads like a ticket: what, who, when, how much, and where the deposit is.
// 2026-11 restyle: same values and conditions; the deposit line is shown as two lines instead of one "A · B" line.
export function BookingTicket({ title, guide, dates, people, totalUsd, depositPercent, deposit, rate, children, forGuide }: Props) {
  const { t, locale } = useI18n();
  const { type, font } = useType();
  const r = t.requests;
  const p = t.payments;
  const tzs = approxTzs(totalUsd, rate);
  // [main line, note line]: the same texts the single joined line used to show.
  const depositLines: [string, string | null] | null = !depositPercent
    ? null
    : deposit?.paid
      ? [
          p.paidOn.replace('{date}', deposit.paidAt ? new Date(deposit.paidAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : ''),
          forGuide ? (deposit.paidOut ? t.hub.depositPaidOut : t.hub.depositHeld) : deposit.paidOut ? p.paidOutNote : p.heldNote,
        ]
      : deposit?.review
        ? [forGuide ? t.hub.depositChecking : p.checking, null]
        : [p.notPaid, null];

  const cell = (label: string, value: string, extra?: string | null) => (
    <View style={{ width: '50%', paddingRight: space.sm, gap: space.xxs }}>
      <Text style={type.meta}>{label}</Text>
      <Text selectable style={{ ...type.body, ...font.bold, fontVariant: ['tabular-nums'] }}>{value}</Text>
      {extra ? <Text style={{ ...type.caption, fontVariant: ['tabular-nums'] }}>{extra}</Text> : null}
    </View>
  );

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm, paddingHorizontal: layout.cardPadding, paddingVertical: space.md, borderBottomWidth: 1, ...dashed }}>
        <Text style={{ ...type.label, color: colors.secondaryLabel, flexShrink: 1 }}>{r.ticketTitle}</Text>
        <Badge label={r.offerStatus.accepted} />
      </View>
      <View style={{ padding: layout.cardPadding, gap: space.md }}>
        <Text style={type.cardTitle}>{title}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md }}>
          {cell(r.ticketGuide, guide)}
          {cell(r.ticketDates, dates)}
          {cell(r.ticketGroup, `${people} ${r.people}`)}
          {cell(r.ticketTotal, formatUsd(totalUsd), tzs)}
        </View>
      </View>
      {depositLines && (
        <View style={{ paddingHorizontal: layout.cardPadding, paddingVertical: space.md, borderTopWidth: 1, ...dashed, gap: space.xxs }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md }}>
            <Text style={{ ...type.body, ...font.bold, fontVariant: ['tabular-nums'] }}>
              {r.deposit} {depositPercent}%
            </Text>
            <Text style={{ ...type.body, ...font.bold, fontVariant: ['tabular-nums'] }}>{formatUsd(deposit?.amountUsd ?? Math.round(totalUsd * depositPercent) / 100)}</Text>
          </View>
          <Text style={type.muted}>{depositLines[0]}</Text>
          {depositLines[1] ? <Text style={type.muted}>{depositLines[1]}</Text> : null}
        </View>
      )}
      {children ? <View style={{ padding: layout.cardPadding, gap: space.md, borderTopWidth: 1, borderTopColor: colors.border }}>{children}</View> : null}
    </View>
  );
}
