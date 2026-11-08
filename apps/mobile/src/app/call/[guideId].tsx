import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CALL_TOPICS, formatUsd } from '@kwetuly/shared';
import { Button, Card, ChipSelect, Field, FormMessage, Muted, ScreenState } from '@/components/ui';
import { getGuide } from '@/lib/api';
import { requestCall } from '@/lib/api-more';
import { useProfile, useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { pathWithParams, useNeedsSetup, welcomeHref } from '@/lib/onboarding';
import { useType } from '@/lib/use-type';
import { brand, colors, layout, space } from '@/theme';

// Request a paid 1-on-1 prep call with a guide; the guide confirms a time and sends a video link.
export default function CallScreen() {
  const { guideId, slug } = useLocalSearchParams<{ guideId: string; slug: string }>();
  const { t, locale } = useI18n();
  const c = t.calls;
  const { type, font } = useType();
  const { session } = useSession();
  const profile = useProfile();
  const guide = useQuery({ queryKey: ['guide', slug], queryFn: () => getGuide(slug) });

  const [topic, setTopic] = useState<string[]>([]);
  const [times, setTimes] = useState('');
  const [contact, setContact] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const needsSetup = useNeedsSetup();
  if (needsSetup) return <Redirect href={welcomeHref(pathWithParams(`/call/${guideId}`, { slug }))} />;
  if (!session) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: layout.screenX }}>
        <Card>
          <Muted>{c.signInFirst}</Muted>
          <Button title={t.auth.signIn} onPress={() => router.replace('/sign-in')} />
        </Card>
      </ScrollView>
    );
  }
  if (!guide.data) return <ScreenState screen loading={guide.isLoading} error={guide.error} onRetry={() => guide.refetch()} />;
  const g = guide.data;
  const topics = CALL_TOPICS.filter((x) => g.call_topics.length === 0 || g.call_topics.includes(x.id));

  async function submit() {
    if (!topic[0] || !times.trim()) return setMessage({ tone: 'error', text: t.auth.error });
    setBusy(true);
    setMessage(null);
    try {
      await requestCall({ guideId, userId: session!.user.id, topic: topic[0], times, message: note, contact: contact || profile.data?.phone || session!.user.email || '' });
      setMessage({ tone: 'ok', text: c.sent });
      setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/')), 1200);
    } catch {
      setMessage({ tone: 'error', text: t.auth.error });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: layout.screenX, gap: space.lg, paddingBottom: space.xxxl }}>
      <Stack.Title>{c.book}</Stack.Title>
      <Card>
        <Text accessibilityRole="header" style={type.title3}>{g.display_name}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: space.md }}>
          <Text style={{ ...type.price, color: brand.forest }}>{g.call_price_usd != null ? formatUsd(g.call_price_usd) : c.priceTbc}</Text>
          <Text style={{ ...type.callout, ...font.semibold }}>
            {g.call_minutes} {c.minutes}
          </Text>
        </View>
        {c.how.map((step, i) => (
          <Muted key={step}>
            {i + 1}. {step}
          </Muted>
        ))}
        <Muted>{c.payNote}</Muted>
      </Card>
      <Card>
        <ChipSelect label={c.topic} options={topics.map((x) => ({ value: x.id, label: x[locale] }))} selected={topic} onChange={setTopic} multiple={false} />
        <Field label={c.times} value={times} onChangeText={setTimes} multiline />
        <Field label={c.contact} value={contact} onChangeText={setContact} placeholder={profile.data?.phone ?? session.user.email ?? ''} />
        <Field label={t.profile.message} value={note} onChangeText={setNote} multiline />
        <FormMessage message={message} />
        <Button title={c.book} onPress={submit} loading={busy} />
      </Card>
    </ScrollView>
  );
}
