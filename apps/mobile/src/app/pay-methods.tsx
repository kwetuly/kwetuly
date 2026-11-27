import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useNetworkState } from 'expo-network';
import {
  METHOD_BADGE_NAMES,
  PAYMENT_PURPOSES,
  canPick,
  formatTzsAmount,
  orderMethods,
  payChooserText,
  lipaPayText,
  type MethodBadge,
  type PaymentProviderKey,
  type PaymentPurpose,
} from '@kwetuly/shared';
import { Button, ErrorState, Muted, Skeleton } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { paymentMethods, readLastMethod, saveLastMethod, startOrder } from '@/lib/lipa';
import { useType } from '@/lib/use-type';
import { brand, colors, radius, space } from '@/theme';

// The payment-method chooser (native sheet). Rows come from the server for this platform: the store
// policy may return none (web_only items show nothing in the app), coming-soon methods are hidden in
// the apps by default (store flags), and only live rows can be picked. Nothing is decided here.
export default function PayMethodsScreen() {
  const params = useLocalSearchParams<{ purpose?: string; subject?: string; period?: string; amount?: string }>();
  const { locale } = useI18n();
  const { type, font } = useType();
  const t = payChooserText(locale);
  const lp = lipaPayText(locale);
  const purpose = (PAYMENT_PURPOSES as readonly string[]).includes(params.purpose ?? '') ? (params.purpose as PaymentPurpose) : null;
  const network = useNetworkState();
  const offline = network.isConnected === false || network.isInternetReachable === false;
  // Synchronous on iOS and Android (expo-sqlite localStorage); null when storage fails.
  const [last] = useState<string | null>(() => readLastMethod());
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const rows = useQuery({ queryKey: ['pay-methods', purpose], queryFn: () => paymentMethods(purpose!), enabled: !!purpose, staleTime: 0 });
  const list = orderMethods(rows.data ?? [], last);
  const amount = /^\d{1,12}$/.test(params.amount ?? '') ? formatTzsAmount(params.amount!) : null;
  const badgeName = (b: MethodBadge) => (b === 'bank' ? t.bank : METHOD_BADGE_NAMES[b]);

  async function choose(id: string) {
    if (!purpose || offline) return;
    setBusy(id);
    setNote('');
    const result = await startOrder({
      provider: id as PaymentProviderKey,
      purpose,
      subject: params.subject ?? null,
      period: params.period === 'month' || params.period === 'year' ? params.period : null,
      locale,
    });
    setBusy(null);
    if (result.kind === 'instructions') {
      saveLastMethod(id);
      router.replace({ pathname: '/pay/[ref]', params: { ref: result.reference } });
      return;
    }
    setNote(result.kind === 'error' && Object.hasOwn(lp.errors, result.code) ? lp.errors[result.code] : lp.errors.failed);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }} contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: t.title }} />
      <Muted>{t.subtitle}</Muted>
      {amount && list.length > 0 && (
        <View style={{ backgroundColor: brand.sand, borderRadius: radius.button, padding: space.md, gap: space.xxs }}>
          <Text style={type.muted}>{t.amountLabel}</Text>
          <Text style={{ ...type.title2, ...font.extrabold, color: brand.ink, fontVariant: ['tabular-nums'] }}>{amount}</Text>
        </View>
      )}
      {offline && <Text accessibilityRole="alert" style={{ ...type.callout, ...font.semibold, color: brand.ink }}>{t.offline}</Text>}
      {note ? <Text accessibilityRole="alert" selectable style={{ ...type.callout, ...font.semibold, color: brand.ink }}>{note}</Text> : null}
      {!purpose ? (
        <Muted>{t.none}</Muted>
      ) : rows.isPending ? (
        <View accessibilityLabel={t.loading} style={{ gap: space.md }}>
          <Skeleton height={88} />
          <Skeleton height={88} />
        </View>
      ) : rows.isError ? (
        <ErrorState onRetry={() => rows.refetch()} retryLabel={t.retry} />
      ) : list.length === 0 ? (
        <Muted>{t.none}</Muted>
      ) : (
        list.map((row) => {
          const pick = canPick(row);
          const label = `${row.display_name}. ${pick ? t.live : t.comingSoon}. ${row.methods.map((m) => t.methods[m]).join(', ')}`;
          return (
            <Pressable
              key={row.id}
              onPress={() => (pick ? choose(row.id) : undefined)}
              disabled={!pick || offline || busy !== null}
              accessibilityRole="button"
              accessibilityLabel={pick ? `${t.choose.replace('{name}', row.display_name)}. ${label}` : `${label}. ${t.comingSoonHint}`}
              accessibilityState={{ disabled: !pick || offline, busy: busy === row.id }}
              style={({ pressed }) => ({
                borderWidth: pick ? 2 : 1,
                borderColor: pick ? brand.primary : colors.separator,
                backgroundColor: pick ? (pressed ? brand.mint : colors.card) : colors.fill,
                borderRadius: radius.button,
                padding: space.md,
                gap: space.xs,
                opacity: pick ? 1 : 0.8,
              })}
            >
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, alignItems: 'center' }}>
                <Text style={{ ...type.cardTitle, color: brand.ink }}>{row.display_name}</Text>
                {pick && row.id === last && <Text style={{ ...type.caption, ...font.bold, backgroundColor: brand.goldSoft, color: brand.ink, paddingHorizontal: space.xs, borderRadius: radius.button, overflow: 'hidden' }}>{t.lastUsed}</Text>}
                <Text style={{ ...type.caption, ...font.bold, color: pick ? brand.forest : colors.secondaryLabel }}>{pick ? t.live : t.comingSoon}</Text>
              </View>
              <Text style={type.muted}>{row.methods.map((m) => t.methods[m]).join(', ')}</Text>
              {row.badges.length > 0 && <Text style={type.caption}>{row.badges.map(badgeName).join(' · ')}</Text>}
              {busy === row.id && <Text style={type.caption}>{t.loading}</Text>}
            </Pressable>
          );
        })
      )}
      <Button title={t.close} variant="outline" size="md" onPress={() => router.back()} />
    </ScrollView>
  );
}
