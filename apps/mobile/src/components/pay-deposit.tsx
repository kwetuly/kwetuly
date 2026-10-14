import { useState } from 'react';
import { Text } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card } from '@/components/ui';
import { depositState, payDeposit, paymentsEnabled } from '@/lib/api-requests';
import { useI18n } from '@/lib/i18n';
import { brand, textSize } from '@/theme';

type Props = { kind: 'offer' | 'group'; id: string; totalUsd: number; percent: number };

// Deposit for an accepted offer or group-trip spot, paid on Selcom's page. Hidden until Selcom is set up.
export function PayDeposit({ kind, id, totalUsd, percent }: Props) {
  const { t, locale } = useI18n();
  const p = t.payments;
  const queryClient = useQueryClient();
  const column = kind === 'offer' ? 'trip_offer_id' : 'group_member_id';
  const enabled = useQuery({ queryKey: ['payments-enabled'], queryFn: paymentsEnabled, staleTime: 10 * 60_000 });
  const paid = useQuery({ queryKey: ['deposit-state', id], queryFn: () => depositState(column, id) });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  if (percent <= 0) return null;
  if (paid.data?.paid) {
    return (
      <Text style={{ color: brand.forest, fontWeight: '700' }}>
        ✓ {p.paid} · <Text style={{ fontWeight: '400' }}>{paid.data.paidOut ? p.paidOutNote : p.heldNote}</Text>
      </Text>
    );
  }
  if (!enabled.data) return null;

  async function pay() {
    setBusy(true);
    setNote('');
    const result = await payDeposit(kind, id, locale);
    setBusy(false);
    if (result === 'paid') queryClient.invalidateQueries({ queryKey: ['deposit-state', id] });
    else setNote(result === 'pending' ? p.pending : result === 'failed' ? p.failed : result === 'phone_required' ? p.phoneRequired : p.error);
  }

  return (
    <Card style={{ backgroundColor: brand.sand }}>
      <Text style={{ fontWeight: '800', color: brand.ink }}>{p.title}</Text>
      <Text style={{ fontSize: textSize.title2, fontWeight: '800', color: brand.ink }}>
        ${(Math.round(totalUsd * percent) / 100).toLocaleString(locale)} <Text style={{ fontSize: textSize.subhead }}>({percent}%)</Text>
      </Text>
      <Text style={{ color: brand.ink, opacity: 0.8 }}>{p.body}</Text>
      {note ? <Text selectable style={{ color: brand.ink, fontWeight: '600' }}>{note}</Text> : null}
      <Button title={p.cta} onPress={pay} loading={busy} />
      {note === p.pending && <Button title={p.checkAgain} variant="outline" onPress={() => paid.refetch()} />}
      <Text style={{ color: brand.ink, opacity: 0.7, fontSize: textSize.caption }}>{p.direct}</Text>
    </Card>
  );
}
