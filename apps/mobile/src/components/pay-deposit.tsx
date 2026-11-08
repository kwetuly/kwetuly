import { useState } from 'react';
import { Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, IconSquare } from '@/components/ui';
import { GLYPHS } from '@/components/glyph';
import { depositPayable, depositState, payDeposit, paymentsEnabled } from '@/lib/api-requests';
import { useI18n } from '@/lib/i18n';
import { useType } from '@/lib/use-type';
import { brand, colors, space, textSize } from '@/theme';

type Props = { kind: 'offer' | 'group'; id: string; totalUsd: number; percent: number };

// Deposit for an accepted offer or group-trip spot, paid on Selcom's page. Hidden until Selcom is set
// up, and hidden when this deposit cannot be paid online (the Edge Function's own rules decide).
// 2026-11 restyle: only the look changed here (fonts, colours, the paid line split in two); no payment logic.
export function PayDeposit({ kind, id, totalUsd, percent }: Props) {
  const { t, locale } = useI18n();
  const { type, font } = useType();
  const p = t.payments;
  const queryClient = useQueryClient();
  const column = kind === 'offer' ? 'trip_offer_id' : 'group_member_id';
  const enabled = useQuery({ queryKey: ['payments-enabled'], queryFn: paymentsEnabled, staleTime: 10 * 60_000 });
  const paid = useQuery({ queryKey: ['deposit-state', id], queryFn: () => depositState(column, id) });
  const payable = useQuery({
    queryKey: ['deposit-payable', id],
    queryFn: () => depositPayable(kind, id),
    enabled: Boolean(enabled.data) && percent > 0 && paid.data?.paid === false && !paid.data.review,
  });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  if (percent <= 0) return null;
  if (paid.data?.paid) {
    return (
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
        <IconSquare glyph={GLYPHS.check} />
        <View style={{ flex: 1, gap: space.xxs }}>
          <Text style={{ ...type.body, ...font.bold, color: brand.forest }}>{p.paid}</Text>
          <Text style={type.muted}>{paid.data.paidOut ? p.paidOutNote : p.heldNote}</Text>
        </View>
      </View>
    );
  }
  const checking = (
    <Card style={{ backgroundColor: brand.sand }}>
      <Text style={{ ...type.cardTitle, color: brand.ink }}>{p.review}</Text>
      <Text selectable style={{ ...type.callout, color: colors.secondaryLabel }}>{p.underReview}</Text>
    </Card>
  );
  if (paid.data?.review) return checking;
  if (!enabled.data || !payable.data || payable.data === 'hidden') return null;
  if (payable.data === 'review') return checking;

  async function pay() {
    setBusy(true);
    setNote('');
    const result = await payDeposit(kind, id, locale);
    setBusy(false);
    if (result === 'paid' || result === 'review' || result === 'under_review' || result === 'already_paid') {
      queryClient.invalidateQueries({ queryKey: ['deposit-state', id] });
      queryClient.invalidateQueries({ queryKey: ['deposit-payable', id] });
      return;
    }
    const messages: Record<string, string> = {
      pending: p.pending,
      failed: p.failed,
      phone_required: p.phoneRequired,
      pending_order: p.pendingOrder,
      not_approved: p.notApproved,
    };
    setNote(messages[result] ?? p.error);
  }

  return (
    <Card style={{ backgroundColor: brand.sand }}>
      <Text style={{ ...type.cardTitle, color: brand.ink }}>{p.title}</Text>
      <Text style={{ ...type.title2, ...font.extrabold, color: brand.ink, fontVariant: ['tabular-nums'] }}>
        ${(Math.round(totalUsd * percent) / 100).toLocaleString(locale)} <Text style={{ fontSize: textSize.subhead, ...font.semibold }}>({percent}%)</Text>
      </Text>
      <Text style={{ ...type.callout, color: colors.secondaryLabel }}>{p.body}</Text>
      {note ? <Text selectable accessibilityRole="alert" style={{ ...type.callout, ...font.semibold, color: brand.ink }}>{note}</Text> : null}
      <Button title={p.cta} onPress={pay} loading={busy} />
      {note === p.pending && <Button title={p.checkAgain} variant="outline" size="md" onPress={() => paid.refetch()} />}
      <Text style={type.caption}>{p.direct}</Text>
    </Card>
  );
}
