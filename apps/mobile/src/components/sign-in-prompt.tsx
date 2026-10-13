import { View } from 'react-native';
import { router } from 'expo-router';
import { useI18n } from '@/lib/i18n';
import { Button, Card, Muted } from './ui';

export function SignInPrompt() {
  const { t } = useI18n();
  return (
    <Card style={{ margin: 16 }}>
      <Muted>{t.app.signInPrompt}</Muted>
      <View style={{ gap: 8 }}>
        <Button title={t.auth.signIn} onPress={() => router.push('/sign-in')} />
        <Button title={t.nav.signUp} variant="outline" onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'join' } })} />
      </View>
    </Card>
  );
}
