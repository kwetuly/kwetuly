import { useState } from 'react';
import { Text } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { checkBilling, depositClosed, depositLastDay, formatDay, tanzaniaDate, type Billing, type PayMethod } from '@kwetuly/shared';
import { CountryField } from '@/components/country-field';
import { Button, Card, ChipSelect, Field } from '@/components/ui';
import { depositPayable, depositState, payDeposit, paymentsConfig } from '@/lib/api-requests';
import { useI18n } from '@/lib/i18n';
import { brand, textSize } from '@/theme';

type Props = {
  kind: 'offer' | 'group';
  id: string;
  totalUsd: number;
  percent: number;
  /** The trip's start date (YYYY-MM-DD): online deposits close 8 days before it (Tanzania date). */
  startDate?: string | null;
  /** For an offer on flexible or open dates: its last valid day (YYYY-MM-DD), if the guide set one. */
  validUntil?: string | null;
  /** The trip request is closed or the trip cancelled: no new deposit (a paid one still shows). */
  closed?: boolean;
};

const EMPTY: Record<keyof Billing, string> = {
  firstname: '',
  lastname: '',
  address_1: '',
  address_2: '',
  city: '',
  state_or_region: '',
  postcode_or_pobox: '',
  country: '',
};

// Deposit for an accepted offer or group-trip spot, paid on Selcom's page. Hidden until Selcom is set
// up, and hidden when this deposit cannot be paid online (the Edge Function's own rules decide; the
// date rules are shown here first so the traveller knows why). A card billing address stays in this
// screen's memory only: never saved on the phone, never tracked.
export function PayDeposit({ kind, id, totalUsd, percent, startDate, validUntil, closed }: Props) {
  const { t, locale } = useI18n();
  const p = t.payments;
  const queryClient = useQueryClient();
  const column = kind === 'offer' ? 'trip_offer_id' : 'group_member_id';
  const config = useQuery({ queryKey: ['payments-config'], queryFn: paymentsConfig, staleTime: 10 * 60_000 });
  const late = depositClosed(startDate);
  const expired = !!validUntil && validUntil < tanzaniaDate();
  const paid = useQuery({ queryKey: ['deposit-state', id], queryFn: () => depositState(column, id) });
  const payable = useQuery({
    queryKey: ['deposit-payable', id],
    queryFn: () => depositPayable(kind, id),
    enabled: Boolean(config.data?.enabled) && percent > 0 && !closed && !late && !expired && paid.data?.paid === false && !paid.data.review,
  });
  const methods = config.data?.methods ?? [];
  const [method, setMethod] = useState<PayMethod>('mobile_money');
  const [billing, setBilling] = useState(EMPTY);
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
  const checking = (
    <Card style={{ backgroundColor: brand.sand }}>
      <Text style={{ fontWeight: '800', color: brand.ink }}>{p.review}</Text>
      <Text selectable style={{ color: brand.ink, opacity: 0.8 }}>{p.underReview}</Text>
    </Card>
  );
  if (paid.data?.review) return checking;
  if (!config.data?.enabled || !paid.data || closed) return null;
  if (late || expired) {
    return (
      <Card style={{ backgroundColor: brand.sand }}>
        <Text selectable style={{ color: brand.ink, fontWeight: '600' }}>{late ? p.lateNote : t.requests.expired}</Text>
      </Card>
    );
  }
  if (!payable.data || payable.data === 'hidden') return null;
  if (payable.data === 'review') return checking;

  const chosen: PayMethod = methods.includes(method) ? method : 'mobile_money';
  const set = (key: keyof Billing) => (value: string) => setBilling((b) => ({ ...b, [key]: value }));

  async function pay() {
    setNote('');
    let address: Billing | undefined;
    if (chosen === 'card') {
      const checked = checkBilling(billing);
      if ('problem' in checked) return setNote(checked.problem === 'chars' ? p.billingChars : p.billingRequired);
      address = checked.billing;
    }
    setBusy(true);
    const result = await payDeposit(kind, id, locale, chosen, address);
    setBusy(false);
    if (result === 'paid' || result === 'review' || result === 'under_review' || result === 'already_paid') {
      setBilling(EMPTY);
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
      billing_required: p.billingRequired,
      method_unavailable: p.methodUnavailable,
    };
    if (result === 'method_unavailable') queryClient.invalidateQueries({ queryKey: ['payments-config'] });
    setNote(messages[result] ?? p.error);
  }

  return (
    <Card style={{ backgroundColor: brand.sand }}>
      <Text style={{ fontWeight: '800', color: brand.ink }}>{p.title}</Text>
      <Text style={{ fontSize: textSize.title2, fontWeight: '800', color: brand.ink }}>
        ${(Math.round(totalUsd * percent) / 100).toLocaleString(locale)} <Text style={{ fontSize: textSize.subhead }}>({percent}%)</Text>
      </Text>
      <Text style={{ color: brand.ink, opacity: 0.8 }}>{methods.includes('card') ? p.body : p.bodyMobile}</Text>
      {startDate ? (
        <Text style={{ color: brand.ink, fontWeight: '600' }}>{p.lastDay.replace('{date}', formatDay(depositLastDay(startDate), locale))}</Text>
      ) : null}
      {methods.length > 1 && (
        <>
          <ChipSelect
            label={p.method}
            multiple={false}
            options={[
              { value: 'mobile_money' as PayMethod, label: p.mobileMoney },
              { value: 'card' as PayMethod, label: p.card },
            ]}
            selected={[chosen]}
            onChange={(next) => setMethod(next[0] ?? 'mobile_money')}
          />
          <Text style={{ color: brand.ink, opacity: 0.8, fontSize: textSize.footnote }}>{p.sameAmount}</Text>
        </>
      )}
      {chosen === 'card' && (
        <>
          <Text accessibilityRole="header" style={{ fontWeight: '800', color: brand.ink }}>{p.billingTitle}</Text>
          <Field label={p.firstName} value={billing.firstname} onChangeText={set('firstname')} autoComplete="given-name" maxLength={60} />
          <Field label={p.lastName} value={billing.lastname} onChangeText={set('lastname')} autoComplete="family-name" maxLength={60} />
          <Field label={p.address1} value={billing.address_1} onChangeText={set('address_1')} autoComplete="address-line1" maxLength={100} />
          <Field label={p.address2} value={billing.address_2} onChangeText={set('address_2')} autoComplete="address-line2" maxLength={100} />
          <Field label={p.city} value={billing.city} onChangeText={set('city')} maxLength={60} />
          <Field label={p.region} value={billing.state_or_region} onChangeText={set('state_or_region')} maxLength={60} />
          <Field label={p.postcode} value={billing.postcode_or_pobox} onChangeText={set('postcode_or_pobox')} autoComplete="postal-code" autoCapitalize="characters" maxLength={20} />
          <CountryField label={p.country} placeholder={p.chooseCountry} value={billing.country} onChange={set('country')} />
          <Text style={{ color: brand.ink, opacity: 0.8, fontSize: textSize.footnote }}>{p.cardNote}</Text>
        </>
      )}
      {note ? (
        <Text selectable accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: brand.ink, fontWeight: '600' }}>
          {note}
        </Text>
      ) : null}
      <Button title={p.cta} onPress={pay} loading={busy} />
      {note === p.pending && <Button title={p.checkAgain} variant="outline" onPress={() => paid.refetch()} />}
      <Text style={{ color: brand.ink, opacity: 0.7, fontSize: textSize.caption }}>{p.direct}</Text>
    </Card>
  );
}
