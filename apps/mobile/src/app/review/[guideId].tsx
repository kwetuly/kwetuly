import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Field, FormMessage, Muted, ScreenState } from '@/components/ui';
import { reviewStatus, submitReview } from '@/lib/api-more';
import { useProfile, useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { pathWithParams, useNeedsSetup, welcomeHref } from '@/lib/onboarding';
import { brand, colors, space, textSize } from '@/theme';

// Only travellers with a confirmed call or booking with this guide can review (checked by the database too).
export default function ReviewScreen() {
  const { guideId, name } = useLocalSearchParams<{ guideId: string; name?: string }>();
  const { t } = useI18n();
  const r = t.reviews;
  const { session } = useSession();
  const profile = useProfile();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const status = useQuery({ queryKey: ['review-status', guideId, userId], queryFn: () => reviewStatus(guideId, userId!), enabled: !!userId });

  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (status.data?.own) {
      setRating(status.data.own.rating);
      setBody(status.data.own.body);
    }
  }, [status.data?.own]);

  const needsSetup = useNeedsSetup();
  if (needsSetup) return <Redirect href={welcomeHref(pathWithParams(`/review/${guideId}`, { name }))} />;
  if (!userId) {
    return (
      <View style={{ padding: space.lg }}>
        <Button title={r.signIn} onPress={() => router.replace('/sign-in')} />
      </View>
    );
  }
  if (!status.data) return <ScreenState loading={status.isLoading} error={status.error} onRetry={() => status.refetch()} />;

  async function submit() {
    if (rating < 1 || body.trim().length < 10) return setMessage({ tone: 'error', text: t.auth.error });
    setBusy(true);
    setMessage(null);
    try {
      await submitReview(guideId, userId!, profile.data?.full_name ?? null, rating, body);
      await queryClient.invalidateQueries({ queryKey: ['reviews'] });
      await queryClient.invalidateQueries({ queryKey: ['guide'] });
      setMessage({ tone: 'ok', text: r.thanks });
      setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/')), 900);
    } catch {
      setMessage({ tone: 'error', text: t.auth.error });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
      <Stack.Title>{status.data.own ? r.edit : r.write}</Stack.Title>
      {name && <Text style={{ fontSize: textSize.title3, fontWeight: '800', color: colors.label }}>{name}</Text>}
      {!status.data.eligible ? (
        <Card>
          <Muted>{r.onlyAfter}</Muted>
        </Card>
      ) : (
        <Card>
          <Text style={{ fontWeight: '600', color: colors.label }}>{r.rating}</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }} accessibilityRole="radiogroup">
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} accessibilityRole="radio" accessibilityState={{ checked: rating === n }} accessibilityLabel={`${n} / 5 ${r.stars}`}>
                <Text style={{ fontSize: textSize.display, color: n <= rating ? brand.gold : colors.separator }}>★</Text>
              </Pressable>
            ))}
          </View>
          <Field label={r.body} value={body} onChangeText={setBody} multiline />
          <FormMessage message={message} />
          <Button title={r.submit} onPress={submit} loading={busy} />
        </Card>
      )}
    </ScrollView>
  );
}
