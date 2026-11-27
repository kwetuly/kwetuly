import { useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LIPA_NETWORKS,
  LIPA_NETWORK_NAMES,
  fillText,
  formatTzsAmount,
  isPaymentReference,
  lipaPayText,
  type LipaNetwork,
  type LipaPayText,
} from '@kwetuly/shared';
import { Button, Card, ChipSelect, ErrorText, Field, FormScreen, Muted, ScreenState } from '@/components/ui';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { myOrder, payerNumbers, submitClaim } from '@/lib/lipa';
import { useType } from '@/lib/use-type';
import { brand, radius, space } from '@/theme';

const networkName = (n: LipaNetwork, t: LipaPayText) => (n === 'bank' ? t.bank : LIPA_NETWORK_NAMES[n]);

// One Lipa payment in the app: the amount from the server, Kwetuly's numbers, the payment code, the
// steps for each network and the "I have paid" form. Only an admin confirmation makes it paid.
export default function PayOrderScreen() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const reference = (ref ?? '').toUpperCase();
  const { locale } = useI18n();
  const t = lipaPayText(locale);
  const { type, font } = useType();
  const session = useSession();
  const queryClient = useQueryClient();
  const valid = isPaymentReference(reference);
  const order = useQuery({ queryKey: ['lipa-order', reference], queryFn: () => myOrder(reference), enabled: valid && !!session });
  const numbers = useQuery({ queryKey: ['lipa-numbers'], queryFn: payerNumbers, enabled: valid && !!session });
  const [network, setNetwork] = useState<LipaNetwork>('mpesa');
  const [tx, setTx] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!session) return <SignInPrompt screen />;
  if (!valid) return <ScreenState empty emptyText={t.errors.not_found} />;
  if (order.isPending) return <ScreenState loading />;
  if (order.isError) return <ScreenState error={order.error} onRetry={() => order.refetch()} />;
  if (!order.data) return <ScreenState empty emptyText={t.errors.not_found} />;
  const o = order.data;
  const amount = formatTzsAmount(o.amount_tzs);
  const received = o.received_tzs ? formatTzsAmount(o.received_tzs) : '';
  const open = o.status === 'awaiting_payment' || o.status === 'wrong_amount';
  const list = numbers.data ?? [];

  async function send() {
    setBusy(true);
    setError('');
    setMessage('');
    const result = await submitClaim(reference, network, tx, phone);
    setBusy(false);
    if (result === 'submitted') {
      setMessage(t.submittedOk);
      setTx('');
      queryClient.invalidateQueries({ queryKey: ['lipa-order', reference] });
      return;
    }
    setError(Object.hasOwn(t.errors, result) ? t.errors[result] : t.errors.failed);
  }

  return (
    <FormScreen>
      <Stack.Screen options={{ title: t.purposes[o.purpose] }} />
      <Card style={{ backgroundColor: o.status === 'confirmed' ? brand.mint : brand.sand }}>
        <Text accessibilityRole="header" style={{ ...type.cardTitle, color: brand.ink }}>{t.status[o.status]}</Text>
        <Text selectable style={{ ...type.body, color: brand.ink }}>{fillText(t.statusBody[o.status], { amount, received })}</Text>
        {o.claim_status === 'rejected' && o.claim_reason && o.status !== 'confirmed' && (
          <Text style={{ ...type.callout, color: brand.ink }}>{`${t.rejectedTitle}. ${t.rejected[o.claim_reason]}${o.claim_note ? ` ${o.claim_note}` : ''}`}</Text>
        )}
      </Card>

      <Card>
        <Muted>{t.amount}</Muted>
        <Text selectable style={{ ...type.title2, ...font.extrabold, color: brand.ink, fontVariant: ['tabular-nums'] }}>{amount}</Text>
        {(o.purpose === 'offer_deposit' || o.purpose === 'group_deposit') && <Muted>{t.depositHeld}</Muted>}
        <Muted>{t.reference}</Muted>
        <Text selectable style={{ ...type.title2, ...font.bold, color: brand.ink, letterSpacing: 2 }}>{o.reference}</Text>
        <Muted>{t.referenceHint}</Muted>
      </Card>

      {open && (
        <>
          <Card>
            <Text accessibilityRole="header" style={type.cardTitle}>{t.numbersTitle}</Text>
            {numbers.isError ? <ErrorText>{t.errors.failed}</ErrorText> : list.length === 0 ? <Muted>{t.noNumbers}</Muted> : null}
            {list.map((n) => {
              const steps = n.network === 'bank' ? t.stepsBank : t.stepsMobile;
              const values = { network: networkName(n.network, t), number: n.lipa_number, name: n.business_name, amount, code: o.reference, bank: n.bank_name ?? t.bank };
              return (
                <View key={n.id} style={{ gap: space.xs, paddingVertical: space.sm, borderTopWidth: 1, borderColor: brand.mint, borderRadius: radius.button }}>
                  <Text style={{ ...type.body, ...font.bold }}>{networkName(n.network, t)}{n.bank_name ? ` (${n.bank_name})` : ''}</Text>
                  <Text selectable style={{ ...type.title2, ...font.bold, color: brand.ink }}>{n.lipa_number}</Text>
                  <Muted selectable>{fillText(t.nameShown, { name: n.business_name })}</Muted>
                  {n.menu_hint ? <Muted selectable>{fillText(t.menu, { hint: n.menu_hint })}</Muted> : null}
                  <Text style={{ ...type.callout, ...font.semibold }}>{t.stepsTitle}</Text>
                  {steps.map((s, i) => (
                    <Text key={i} style={type.callout}>{`${i + 1}. ${fillText(s, values)}`}</Text>
                  ))}
                </View>
              );
            })}
          </Card>

          <Card>
            <Text accessibilityRole="header" style={type.cardTitle}>{t.formTitle}</Text>
            <ChipSelect
              label={t.network}
              selected={[network]}
              multiple={false}
              onChange={(v) => v[0] && setNetwork(v[0])}
              options={LIPA_NETWORKS.map((n) => ({ value: n, label: networkName(n, t) }))}
            />
            <Field label={t.transactionId} value={tx} onChangeText={setTx} hint={t.transactionHint} autoCapitalize="characters" autoCorrect={false} maxLength={40} />
            <Field label={t.phone} value={phone} onChangeText={setPhone} hint={t.phoneHint} keyboardType="phone-pad" maxLength={20} autoComplete="tel" />
            {error ? <ErrorText>{error}</ErrorText> : null}
            {message ? <Text accessibilityRole="alert" style={{ ...type.callout, ...font.semibold, color: brand.forest }}>{message}</Text> : null}
            <Button title={t.submit} onPress={send} loading={busy} disabled={tx.trim().length < 6} />
          </Card>
        </>
      )}
      <Muted>{t.refundNotes.manual}</Muted>
    </FormScreen>
  );
}
