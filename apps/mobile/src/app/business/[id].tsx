import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { BUSINESS_TYPES, ORDER_TYPES, orderMessage, type OrderMode } from '@kwetuly/shared';
import { BusinessBadge } from '@/components/business-card';
import { PhotoCredits, SampleOffer } from '@/components/sample-offer';
import { Button, Card, Chip, Field, FormMessage, Muted, ScreenState, SectionTitle } from '@/components/ui';
import { useProfile, useSession } from '@/lib/auth';
import { askBusiness, getBusiness } from '@/lib/businesses';
import { useI18n } from '@/lib/i18n';
import { openExternal } from '@/lib/open-external';
import { useNeedsSetup, welcomeHref } from '@/lib/onboarding';
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
  const [mode, setMode] = useState<OrderMode>('deliver');
  const [where, setWhere] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const b = business.data;
  const needsSetup = useNeedsSetup();
  if (!b) return <ScreenState loading={business.isLoading} error={business.error} onRetry={() => business.refetch()} empty emptyText={t.ux.notFoundTitle} />;
  const isShop = ORDER_TYPES.includes(b.business_type);
  const photos = [b.photo_url, ...b.photos].filter((p): p is string => !!p).slice(0, 7);

  async function send() {
    if (!name.trim() || !contact.trim() || !text.trim()) return setMessage({ tone: 'error', text: t.auth.error });
    // An enquiry from a signed-in account needs a finished account (the database checks the same).
    if (needsSetup) return router.push(welcomeHref(`/business/${b!.id}`));
    setBusy(true);
    try {
      await askBusiness({ providerId: b!.id, userId: session?.user.id, name, contact, message: isShop ? orderMessage(mode, where.trim(), text.trim()) : text });
      setText('');
      setWhere('');
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
      {b.is_sample && <PhotoCredits urls={photos} />}
      <BusinessBadge business={b} full />
      {b.has_referral_agreement && <Muted>{bt.commissionNote}</Muted>}
      {b.story && <Text selectable style={{ color: colors.label, lineHeight: 21 }}>{b.story}</Text>}
      {b.website && <Button title={bt.website} variant="outline" onPress={() => openExternal(b.website, { inApp: true })} />}
      {/* Sample businesses only (security finding F1). */}
      {b.is_sample && <SampleOffer providerId={b.id} />}

      <Card>
        <SectionTitle>{(isShop ? bt.orderTitle : bt.askTitle).replace('{name}', b.business_name)}</SectionTitle>
        {/* Sample listings: the business has not joined, so the message goes to Kwetuly. */}
        <Muted>{b.is_sample ? bt.askBodySample : isShop ? bt.orderBody : bt.askBody}</Muted>
        <Field label={t.profile.name} value={name} onChangeText={setName} />
        <Field label={t.profile.contact} value={contact} onChangeText={setContact} autoCapitalize="none" />
        {isShop && (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              <Chip label={bt.orderDeliver} active={mode === 'deliver'} onPress={() => setMode('deliver')} />
              <Chip label={bt.orderCollect} active={mode === 'collect'} onPress={() => setMode('collect')} />
            </View>
            <Field label={bt.orderWhere} value={where} onChangeText={setWhere} />
          </>
        )}
        <Field label={isShop ? bt.orderWhat : t.profile.message} value={text} onChangeText={setText} multiline />
        <FormMessage message={message} />
        <Button title={t.profile.send} onPress={send} loading={busy} />
      </Card>
    </ScrollView>
  );
}
