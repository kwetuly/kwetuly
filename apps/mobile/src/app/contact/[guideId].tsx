import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Field, FormMessage, Muted } from '@/components/ui';
import { contactGuide } from '@/lib/api-more';
import { useProfile, useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { colors } from '@/theme/colors';

// "Ask this guide about a trip": a request that goes to the guide's Hub inbox (signed in or not).
export default function ContactGuideScreen() {
  const { guideId, name } = useLocalSearchParams<{ guideId: string; name?: string }>();
  const { t } = useI18n();
  const p = t.profile;
  const { session } = useSession();
  const profile = useProfile();
  const [fullName, setFullName] = useState(profile.data?.full_name ?? '');
  const [contact, setContact] = useState(profile.data?.phone ?? session?.user.email ?? '');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function submit() {
    if (!fullName.trim() || !contact.trim() || !text.trim()) return setMessage({ tone: 'error', text: t.auth.error });
    setBusy(true);
    try {
      await contactGuide({ guideId, userId: session?.user.id, name: fullName, contact, message: text });
      setMessage({ tone: 'ok', text: p.sent });
      setTimeout(() => router.back(), 1200);
    } catch {
      setMessage({ tone: 'error', text: t.auth.error });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Stack.Title>{p.contactTitle}</Stack.Title>
      {name && <Text style={{ fontSize: 20, fontWeight: '800', color: colors.label }}>{name}</Text>}
      <Card>
        <Muted>{p.contactBody}</Muted>
        <Field label={p.name} value={fullName} onChangeText={setFullName} />
        <Field label={p.contact} value={contact} onChangeText={setContact} autoCapitalize="none" />
        <Field label={p.message} value={text} onChangeText={setText} multiline />
        <FormMessage message={message} />
        <Button title={p.send} onPress={submit} loading={busy} />
      </Card>
    </ScrollView>
  );
}
