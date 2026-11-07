import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useI18n } from '@/lib/i18n';
import { Button, Card, Muted } from './ui';
import { colors, layout, space } from '@/theme';

/**
 * Asks the person to sign in or join. `screen`: it is the whole screen (an early return), so it scrolls
 * under the header like any page and never sits under a see-through iOS header.
 */
export function SignInPrompt({ screen }: { screen?: boolean }) {
  const { t } = useI18n();
  const card = (
    <Card style={screen ? null : { margin: layout.screenX }}>
      <Muted>{t.app.signInPrompt}</Muted>
      <View style={{ gap: space.sm }}>
        <Button title={t.auth.signIn} onPress={() => router.push('/sign-in')} />
        <Button title={t.nav.signUp} variant="outline" onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'join' } })} />
      </View>
    </Card>
  );
  if (!screen) return card;
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: layout.screenX }}
    >
      {card}
    </ScrollView>
  );
}
