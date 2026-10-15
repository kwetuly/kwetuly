import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { BUSINESS_PAGES, findMenuItem, hasValidBadge } from '@rafrika/shared';
import { useQuery } from '@tanstack/react-query';
import { BusinessCard } from '@/components/business-card';
import { listBusinesses } from '@/lib/businesses';
import { Button, Card, Chip, Field, FormMessage, Muted, ScreenState } from '@/components/ui';
import { registerInterest } from '@/lib/api-more';
import { useProfile, useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { colors, space, textSize } from '@/theme';

// "Opening soon" sections (stays, transport, gear, local life…): travellers register interest,
// businesses ask to be listed. Same inbox as the website.
export default function ComingSoonScreen() {
  const { section, item } = useLocalSearchParams<{ section: string; item: string }>();
  const { t, locale } = useI18n();
  const e = t.explore;
  const { session } = useSession();
  const profile = useProfile();
  const found = findMenuItem(section, item);
  // Listed businesses for pages that have them (Stay, Shop, Transport, Local life), checked ones first.
  const types = BUSINESS_PAGES[`${section}/${item}`];
  const businesses = useQuery({ queryKey: ['businesses', section, item], queryFn: () => listBusinesses(types!), enabled: !!types });
  const today = new Date().toISOString().slice(0, 10);
  const listed = [...(businesses.data ?? [])].sort((a, b) => Number(hasValidBadge(b, today)) - Number(hasValidBadge(a, today)));

  const [kind, setKind] = useState<'traveler' | 'business'>('traveler');
  const [name, setName] = useState(profile.data?.full_name ?? '');
  const [contact, setContact] = useState(profile.data?.phone ?? session?.user.email ?? '');
  const [business, setBusiness] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  if (!found) return <ScreenState empty emptyText={e.comingTitle} />;

  async function submit() {
    if (!name.trim() || !contact.trim()) return setMessage({ tone: 'error', text: t.auth.error });
    setBusy(true);
    try {
      await registerInterest({ section, item, kind, name, contact, businessName: business, message: note, locale });
      setMessage({ tone: 'ok', text: e.thanks });
    } catch {
      setMessage({ tone: 'error', text: t.auth.error });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
      <Stack.Title>{found.item.label[locale]}</Stack.Title>
      {listed.length > 0 && (
        <View style={{ gap: space.md }}>
          <Text style={{ fontSize: textSize.headline, fontWeight: '800', color: colors.label }}>{t.business.placesTitle}</Text>
          {listed.map((b) => (
            <BusinessCard key={b.id} business={b} />
          ))}
        </View>
      )}
      <Card>
        <Text style={{ fontSize: textSize.title3, fontWeight: '800', color: colors.label }}>{found.item.label[locale]}</Text>
        <Muted>{found.item.blurb[locale]}</Muted>
        <Text style={{ fontWeight: '700', color: colors.label }}>{e.comingTitle}</Text>
        <Muted>{e.comingBody}</Muted>
      </Card>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Chip label={t.join.traveler.title} active={kind === 'traveler'} onPress={() => setKind('traveler')} />
          <Chip label={e.listTitle} active={kind === 'business'} onPress={() => setKind('business')} />
        </View>
        {kind === 'business' && (
          <>
            <Muted>{e.listBody}</Muted>
            <Field label={e.businessName} value={business} onChangeText={setBusiness} />
          </>
        )}
        <Field label={t.profile.name} value={name} onChangeText={setName} />
        <Field label={t.profile.contact} value={contact} onChangeText={setContact} autoCapitalize="none" />
        <Field label={t.profile.message} value={note} onChangeText={setNote} multiline />
        <FormMessage message={message} />
        <Button title={kind === 'business' ? e.listCta : t.profile.send} onPress={submit} loading={busy} />
      </Card>
    </ScrollView>
  );
}
