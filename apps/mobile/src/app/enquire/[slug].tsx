import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Field, FormMessage, Muted, ScreenState } from '@/components/ui';
import { listTours } from '@/lib/api';
import { enquireTour } from '@/lib/api-more';
import { useProfile, useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { colors, space, textSize } from '@/theme';

// "Plan this trip": an enquiry to Rafrika about a catalogue tour.
export default function EnquireScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, locale } = useI18n();
  const tt = t.tours;
  const { session } = useSession();
  const profile = useProfile();
  const tours = useQuery({ queryKey: ['tours'], queryFn: listTours });
  const tour = tours.data?.find((x) => x.slug === slug);

  const [name, setName] = useState(profile.data?.full_name ?? '');
  const [contact, setContact] = useState(profile.data?.phone ?? session?.user.email ?? '');
  const [dates, setDates] = useState('');
  const [people, setPeople] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  if (!tour) return <ScreenState loading={tours.isLoading} error={tours.error} />;
  const title = (locale === 'sw' && tour.title_sw) || tour.title_en;

  async function submit() {
    if (!name.trim() || !contact.trim()) return setMessage({ tone: 'error', text: t.auth.error });
    setBusy(true);
    try {
      await enquireTour({ tripId: tour!.id, tripTitle: tour!.title_en, userId: session?.user.id, name, contact, dates, people, message: note });
      setMessage({ tone: 'ok', text: tt.sent });
      setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/')), 1200);
    } catch {
      setMessage({ tone: 'error', text: t.auth.error });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
      <Stack.Title>{tt.enquireTitle}</Stack.Title>
      <Text style={{ fontSize: textSize.title3, fontWeight: '800', color: colors.label }}>{title}</Text>
      <Card>
        <Muted>{tt.enquireBody}</Muted>
        <Field label={t.profile.name} value={name} onChangeText={setName} />
        <Field label={t.profile.contact} value={contact} onChangeText={setContact} autoCapitalize="none" />
        <Field label={tt.dates} value={dates} onChangeText={setDates} />
        <Field label={tt.groupSize} value={people} onChangeText={setPeople} keyboardType="number-pad" />
        <Field label={t.profile.message} value={note} onChangeText={setNote} multiline />
        <FormMessage message={message} />
        <Button title={tt.send} onPress={submit} loading={busy} />
      </Card>
    </ScrollView>
  );
}
