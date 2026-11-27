import { Pressable, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { formatTzsAmount, lipaPayText } from '@kwetuly/shared';
import { Card, FormScreen, Muted, ScreenState } from '@/components/ui';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { myOrders } from '@/lib/lipa';
import { useType } from '@/lib/use-type';
import { brand, colors, radius, space } from '@/theme';

// The payer's own payments to Kwetuly (newest first). Each row opens /pay/[ref], which shows only the
// status for items the store policy keeps on the website.
export default function MyPaymentsScreen() {
  const { locale } = useI18n();
  const t = lipaPayText(locale);
  const { type, font } = useType();
  const { session } = useSession();
  const orders = useQuery({ queryKey: ['my-payments'], queryFn: myOrders, enabled: !!session });
  if (!session) return <SignInPrompt screen />;
  if (orders.isPending) return <ScreenState loading />;
  if (orders.isError) return <ScreenState error={orders.error} onRetry={() => orders.refetch()} retryLabel={t.retry} />;
  const rows = orders.data ?? [];
  return (
    <FormScreen>
      <Stack.Screen options={{ title: t.myPayments }} />
      {rows.length === 0 ? (
        <Card>
          <Text style={{ ...type.body, ...font.semibold }}>{t.none}</Text>
          <Muted>{t.emptyNext}</Muted>
        </Card>
      ) : (
        rows.map((o) => (
          <Pressable
            key={o.reference}
            accessibilityRole="button"
            accessibilityLabel={`${t.purposes[o.purpose]}, ${o.reference}, ${t.status[o.status]}`}
            onPress={() => router.push({ pathname: '/pay/[ref]', params: { ref: o.reference } })}
            style={({ pressed }) => ({ backgroundColor: pressed ? colors.pressed : colors.card, borderRadius: radius.button, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: space.xxs })}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
              <Text style={{ ...type.body, ...font.bold, flex: 1 }}>{t.purposes[o.purpose]}</Text>
              <Text style={{ ...type.body, ...font.bold, fontVariant: ['tabular-nums'] }}>{formatTzsAmount(o.amount_tzs)}</Text>
            </View>
            <Text selectable style={type.caption}>{o.reference}</Text>
            <Text style={{ ...type.callout, color: o.status === 'confirmed' ? brand.forest : brand.ink }}>{t.status[o.status]}</Text>
          </Pressable>
        ))
      )}
    </FormScreen>
  );
}
