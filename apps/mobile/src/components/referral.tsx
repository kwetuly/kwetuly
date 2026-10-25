import { useState } from 'react';
import { Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, Field, FormMessage, Muted, SectionTitle } from '@/components/ui';
import { getMyAgreement, listBusinessSales, listMyReferralSales, myReferralCode, reportSale } from '@/lib/businesses';
import { useI18n } from '@/lib/i18n';
import { brand, colors, radius, space, textSize } from '@/theme';

const tzs = (n: number) => `TSh ${Math.round(n).toLocaleString('en-US')}`;

/** The guide's referral code and the sales businesses recorded with it. */
export function GuideReferralCard({ approved }: { approved: boolean }) {
  const { t } = useI18n();
  const bt = t.business;
  const code = useQuery({ queryKey: ['referral-code'], queryFn: myReferralCode, enabled: approved });
  const sales = useQuery({ queryKey: ['referral-sales'], queryFn: listMyReferralSales, enabled: approved });
  return (
    <Card>
      <SectionTitle>{bt.referralTitle}</SectionTitle>
      {!approved ? (
        <Muted>{bt.referralPending}</Muted>
      ) : (
        <>
          {code.data && (
            <Text selectable style={{ alignSelf: 'flex-start', backgroundColor: brand.mint, color: brand.forest, fontWeight: '800', fontSize: 26, letterSpacing: 4, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.button }}>
              {code.data}
            </Text>
          )}
          <Muted>{bt.referralBody}</Muted>
          <Text style={{ fontWeight: '700', color: colors.label }}>{bt.referralSales}</Text>
          {(sales.data ?? []).length === 0 && <Muted>{bt.referralNone}</Muted>}
          {(sales.data ?? []).map((s) => (
            <View key={s.id} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
              <Text style={{ color: colors.secondaryLabel, fontVariant: ['tabular-nums'] }}>{s.sale_date}</Text>
              <Text style={{ color: colors.label, fontWeight: '700', flex: 1 }}>{s.providers?.business_name}</Text>
              <Text style={{ color: colors.label, fontVariant: ['tabular-nums'] }}>{tzs(Number(s.amount_tzs))}</Text>
              <Badge label={bt.saleStatus[s.status]} tone="sand" />
            </View>
          ))}
        </>
      )}
    </Card>
  );
}

/** The business's commission agreement, a form to record a referral sale, and recent sales. */
export function BusinessSalesCard({ providerId }: { providerId: string }) {
  const { t } = useI18n();
  const bt = t.business;
  const queryClient = useQueryClient();
  const agreement = useQuery({ queryKey: ['agreement', providerId], queryFn: () => getMyAgreement(providerId) });
  const sales = useQuery({ queryKey: ['business-sales', providerId], queryFn: () => listBusinessSales(providerId) });
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function save() {
    const value = Number.parseFloat(amount);
    if (!/^[A-Za-z0-9]{6,10}$/.test(code.trim()) || !Number.isFinite(value) || value <= 0) return setMessage({ tone: 'error', text: t.auth.error });
    setBusy(true);
    try {
      await reportSale(providerId, code, value, note.trim() || null);
      setCode('');
      setAmount('');
      setNote('');
      setMessage({ tone: 'ok', text: bt.saved });
      await queryClient.invalidateQueries({ queryKey: ['business-sales', providerId] });
    } catch {
      setMessage({ tone: 'error', text: t.auth.error });
    } finally {
      setBusy(false);
    }
  }

  const a = agreement.data;
  return (
    <Card>
      <SectionTitle>{bt.salesTitle}</SectionTitle>
      <Muted>{bt.salesBody}</Muted>
      <Text style={{ fontWeight: '700', color: colors.label, backgroundColor: colors.fill, padding: space.md, borderRadius: radius.button }}>
        {a?.active ? bt.agreementShares.replace('{r}', String(Number(a.kwetuly_pct))).replace('{g}', String(Number(a.guide_pct))) : bt.noAgreement}
      </Text>
      <Field label={bt.codeField} value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" />
      <Field label={bt.amountField} value={amount} onChangeText={setAmount} keyboardType="number-pad" />
      <Field label={bt.noteField} value={note} onChangeText={setNote} />
      <FormMessage message={message} />
      <Button title={bt.reportSale} onPress={save} loading={busy} />
      {(sales.data ?? []).length === 0 && <Muted>{bt.salesNone}</Muted>}
      {(sales.data ?? []).map((s) => (
        <View key={s.id} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
          <Text style={{ color: colors.secondaryLabel, fontVariant: ['tabular-nums'] }}>{s.sale_date}</Text>
          <Text style={{ color: colors.label, fontWeight: '700', fontFamily: 'monospace' }}>{s.code}</Text>
          {!s.guide_id && <Text style={{ color: brand.danger, fontSize: textSize.footnote }}>{bt.unknownCode}</Text>}
          <Text style={{ color: colors.label, marginLeft: 'auto', fontVariant: ['tabular-nums'] }}>{tzs(Number(s.amount_tzs))}</Text>
          <Badge label={bt.saleStatus[s.status]} tone="sand" />
        </View>
      ))}
    </Card>
  );
}
