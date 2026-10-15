import { ScrollView, Text } from 'react-native';
import { Stack, router } from 'expo-router';
import { Button, Card, Muted } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { colors, space, textSize } from '@/theme';

// Shown for a link that matches no screen, like the website's not-found page.
export default function NotFoundScreen() {
  const { t } = useI18n();
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
      <Stack.Screen options={{ title: t.ux.notFoundTitle }} />
      <Card>
        <Text style={{ fontSize: textSize.title2, fontWeight: '800', color: colors.label }}>{t.ux.notFoundTitle}</Text>
        <Muted>{t.ux.notFoundBody}</Muted>
        <Button title={t.nav.guides} onPress={() => router.replace('/guides')} />
        <Button title={t.ux.goHome} variant="outline" onPress={() => router.replace('/')} />
      </Card>
    </ScrollView>
  );
}
