import { useState } from 'react';
import { Text } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Muted } from '@/components/ui';
import { isDepositPaid, payDeposit, paymentsEnabled } from '@/lib/api-requests';
import { useI18n } from '@/lib/i18n';
import { brand, colors } from '@/theme/colors';

type Props = { kind: 'offer' | 'group'; id: string; totalUsd: number; percent: number };

// Deposit for an accepted offer or group-trip spot, paid on Selcom's page. Hidden until Selcom is set up.
export function PayDeposit({ kind, id, totalUsd, percent }: Props) {
  const { t, locale } = useI18n();
  const p = t.payments;
  const queryClient = useQueryClient();
  const column = kind === 'offer' ? 'trip_offer_id' : 'group_member_id';
  const enabled = useQuery({ queryKey: ['payments-enabled'], queryFn: paymentsEnabled, staleTime: 10 * 60_000 });
  const paid = useQuery({ queryKey: ['deposit-paid', id], queryFn: () => isDepositPaid(column, id) });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  if (percent <= 0) return null;
  if (paid.data) {
    return <Text style={{ color: brand.forest, fontWeight: '700' }}>✓ {p.paid}</Text>;
  }
  if (!enabled.data) return null;

  async function pay() {
    setBusy(true);
    setNote('');
    const result = await payDeposit(kind, id, locale);
    setBusy(false);
    if (result === 'paid') queryClient.invalidateQueries({ queryKey: ['deposit-paid', id] });
    else setNote(result === 'pending' ? p.pending : result === 'failed' ? p.failed : result === 'phone_required' ? p.phoneRequired : p.error);
  }

  return (
    <Card style={{ backgroundColor: brand.sand }}>
      <Text style={{ fontWeight: '800', color: brand.night }}>{p.title}</Text>
      <Text style={{ fontSize: 24, fontWeight: '800', color: brand.night }}>
        ${(Math.round(totalUsd * percent) / 100).toLocaleString(locale)} <Text style={{ fontSize: 14 }}>({percent}%)</Text>
      </Text>
      <Muted>{p.body}</Muted>
      {note ? <Text selectable style={{ color: colors.label, fontWeight: '600' }}>{note}</Text> : null}
      <Button title={p.cta} onPress={pay} loading={busy} />
      {note === p.pending && <Button title={p.checkAgain} variant="outline" onPress={() => paid.refetch()} />}
      <Muted>{p.direct}</Muted>
    </Card>
  );
}
