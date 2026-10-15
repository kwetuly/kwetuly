import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { BUSINESS_TYPES } from '@rafrika/shared';
import { BusinessBadge } from '@/components/business-card';
import { Button, Card, Field, FormMessage, Muted, ScreenState, SectionTitle } from '@/components/ui';
import { useProfile, useSession } from '@/lib/auth';
import { askBusiness, getBusiness } from '@/lib/businesses';
import { useI18n } from '@/lib/i18n';
import { brand, colors, radius, space, textSize } from '@/theme';

// A listed business, its badge (if any) and a question form, like /businesses/[id] on the website.
export default function BusinessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const bt = t.business;
  const { session } = useSession();
  const profile = useProfile();
  const business = useQuery({ queryKey: ['business', id], queryFn: () => getBusiness(id) });
  const [name, setName] = useState(profile.data?.full_name ?? '');
  const [contact, setContact] = useState(profile.data?.phone ?? session?.user.email ?? '');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const b = business.data;
  if (!b) return <ScreenState loading={business.isLoading} error={business.error} onRetry={() => business.refetch()} empty emptyText={t.ux.notFoundTitle} />;
  const photos = [b.photo_url, ...b.photos].filter((p): p is string => !!p).slice(0, 7);

  async function send() {
    if (!name.trim() || !contact.trim() || !text.trim()) return setMessage({ tone: 'error', text: t.auth.error });
    setBusy(true);
    try {
      await askBusiness({ providerId: b!.id, userId: session?.user.id, name, contact, message: text });
      setText('');
      setMessage({ tone: 'ok', text: bt.sent });
    } catch {
      setMessage({ tone: 'error', text: t.auth.error });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.huge }}>
      <Stack.Title>{b.business_name}</Stack.Title>
      <View style={{ gap: space.xs }}>
        <Text style={{ color: brand.leafDark, fontWeight: '700' }}>{BUSINESS_TYPES.find((x) => x.id === b.business_type)?.[locale]}</Text>
        <Text style={{ color: colors.label, fontWeight: '800', fontSize: textSize.title2 }}>{b.business_name}</Text>
        <Muted>{[b.location, b.base_region].filter(Boolean).join(', ')}</Muted>
      </View>
      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {photos.map((src) => (
            <Image key={src} source={{ uri: src }} style={{ width: 260, height: 180, borderRadius: radius.button }} contentFit="cover" />
          ))}
        </ScrollView>
      )}
      <BusinessBadge business={b} full />
      {b.has_referral_agreement && <Muted>{bt.commissionNote}</Muted>}
      {b.story && <Text selectable style={{ color: colors.label, lineHeight: 21 }}>{b.story}</Text>}
      {b.website && <Button title={bt.website} variant="outline" onPress={() => WebBrowser.openBrowserAsync(b.website!)} />}

      <Card>
        <SectionTitle>{bt.askTitle.replace('{name}', b.business_name)}</SectionTitle>
        <Muted>{bt.askBody}</Muted>
        <Field label={t.profile.name} value={name} onChangeText={setName} />
        <Field label={t.profile.contact} value={contact} onChangeText={setContact} autoCapitalize="none" />
        <Field label={t.profile.message} value={text} onChangeText={setText} multiline />
        <FormMessage message={message} />
        <Button title={t.profile.send} onPress={send} loading={busy} />
      </Card>
    </ScrollView>
  );
}
