import { useState } from 'react';
import { Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { depositTzs, depositTzsFromRateText, formatTzsAmount, lipaPayText, PAYMENT_PROVIDER_NAME } from '@kwetuly/shared';
import { LipaPayButton } from '@/components/lipa-pay-button';
import { supabase } from '@/lib/supabase';
import { Button, Card, IconSquare } from '@/components/ui';
import { GLYPHS } from '@/components/glyph';
import { depositPayable, depositState, payDeposit, paymentsConfig } from '@/lib/api-requests';
import { useI18n } from '@/lib/i18n';
import { useType } from '@/lib/use-type';
import { brand, colors, space, textSize } from '@/theme';

type Props = { kind: 'offer' | 'group'; id: string; totalUsd: number; percent: number };

// Deposit for an accepted offer or group-trip spot, paid on the payment processor's page (PAYMENT_PROVIDER_NAME) and charged in TSh.
// While payments are switched off: the amount, a disabled Pay button and "opens soon". Once on, hidden when this
// deposit cannot be paid online (the Edge Function's own rules decide).
// 2026-11 restyle: only the look changed here (fonts, colours, the paid line split in two); no payment logic.
export function PayDeposit({ kind, id, totalUsd, percent }: Props) {
  const { t, locale } = useI18n();
  const { type, font } = useType();
  const p = t.payments;
  const queryClient = useQueryClient();
  const column = kind === 'offer' ? 'trip_offer_id' : 'group_member_id';
  const config = useQuery({ queryKey: ['payments-config'], queryFn: paymentsConfig, staleTime: 10 * 60_000 });
  const enabled = { data: config.data?.enabled };
  const paid = useQuery({ queryKey: ['deposit-state', id], queryFn: () => depositState(column, id) });
  const payable = useQuery({
    queryKey: ['deposit-payable', id],
    queryFn: () => depositPayable(kind, id),
    enabled: Boolean(enabled.data) && percent > 0 && paid.data?.paid === false && !paid.data.review,
  });
  // The admin-typed rate for Lipa deposits (display only; the server computes the real amount).
  const lipaRate = useQuery({
    queryKey: ['lipa-rate'],
    queryFn: async () => {
      const { data } = await supabase.from('site_settings').select('value').eq('key', 'payments.manual_usd_tzs_rate').maybeSingle<{ value: { rate?: unknown } }>();
      return typeof data?.value?.rate === 'string' ? data.value.rate : null;
    },
    enabled: config.data?.enabled === false,
    staleTime: 10 * 60_000,
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
  // Payments switched off (Walter, 2026-11-22: show every button): the amount and a disabled Pay button
  // with "opens soon". While off, the Edge Function answers not_configured to every check.
  if (config.data && !config.data.enabled && paid.data?.paid === false) {
    // Lipa numbers (2026-11-26): trip deposits may be paid in the app (store rules: real-world service).
    // LipaPayButton renders only when the server lists a method for this deposit on this platform.
    const lipaTzs = depositTzsFromRateText(totalUsd * percent, lipaRate.data ?? null);
    return (
      <Card style={{ backgroundColor: brand.sand }}>
        <Text style={{ ...type.cardTitle, color: brand.ink }}>{p.title}</Text>
        <Text style={{ ...type.title2, ...font.extrabold, color: brand.ink, fontVariant: ['tabular-nums'] }}>
          ${(Math.round(totalUsd * percent) / 100).toLocaleString(locale)} <Text style={{ fontSize: textSize.subhead, ...font.semibold }}>({percent}%)</Text>
        </Text>
        {lipaTzs ? (
          <>
            <Text style={{ ...type.callout, ...font.semibold, color: brand.ink }}>{formatTzsAmount(lipaTzs)}</Text>
            <LipaPayButton purpose={kind === 'offer' ? 'offer_deposit' : 'group_deposit'} subject={id} amountTzs={lipaTzs} />
            <Text style={type.caption}>{lipaPayText(locale).depositHeld}</Text>
          </>
        ) : (
          <>
            <Button title={p.cta} onPress={() => undefined} disabled accessibilityLabel={`${p.cta}. ${p.opensSoon}`} />
            <Text style={{ ...type.callout, ...font.semibold, color: brand.ink }}>{p.opensSoon}</Text>
          </>
        )}
        <Text style={type.caption}>{p.direct}</Text>
      </Card>
    );
  }
  if (!enabled.data || !payable.data || payable.data === 'hidden') return null;
  if (payable.data === 'review') return checking;
  // Display only, same integer maths as the server; the server saves the real amount at checkout.
  const cents = totalUsd * percent;
  const rate100 = config.data?.rate100 ?? null;
  const tzs = rate100 && Number.isSafeInteger(cents) && cents > 0 ? depositTzs(cents, rate100) : null;

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
      <Text style={{ ...type.callout, color: colors.secondaryLabel }}>{p.body.replace('{provider}', PAYMENT_PROVIDER_NAME)}</Text>
      {tzs !== null && <Text style={{ ...type.callout, ...font.semibold, color: brand.ink }}>{p.charged.replace('{amount}', tzs.toLocaleString(locale))}</Text>}
      {note ? <Text selectable accessibilityRole="alert" style={{ ...type.callout, ...font.semibold, color: brand.ink }}>{note}</Text> : null}
      <Button title={p.cta} onPress={pay} loading={busy} />
      {note === p.pending && <Button title={p.checkAgain} variant="outline" size="md" onPress={() => paid.refetch()} />}
      <Text style={type.caption}>{p.direct}</Text>
    </Card>
  );
}
