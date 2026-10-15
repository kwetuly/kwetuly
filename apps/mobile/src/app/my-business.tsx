import { useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { Stack, router } from 'expo-router';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BUSINESS_TYPES, REGIONS, formatUsd, hasValidBadge, type BusinessType } from '@rafrika/shared';
import { Avatar, Badge, Button, Card, ChipSelect, Field, FormMessage, Muted, ScreenState, SectionTitle } from '@/components/ui';
import { useProfile, useSession } from '@/lib/auth';
import { getBadgeFee, getMyBusiness, listBusinessEnquiries, requestBadge, saveMyBusiness, type MyBusiness } from '@/lib/businesses';
import { useI18n } from '@/lib/i18n';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { brand, colors, space } from '@/theme';

type Upload = { uri: string; mimeType: string };

// Photos are shrunk to at most 1600px and saved as JPEG, which also drops the camera's location data.
async function pickPhoto(): Promise<Upload | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > 1600) context.resize(asset.width >= asset.height ? { width: 1600 } : { height: 1600 });
  const saved = await (await context.renderAsync()).saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
  return { uri: saved.uri, mimeType: 'image/jpeg' };
}

// The owner's listing, the paid badge and enquiries, the same as the business dashboard on the website.
export default function MyBusinessScreen() {
  const { t, locale } = useI18n();
  const bt = t.business;
  const { session } = useSession();
  const userId = session?.user.id;
  const profile = useProfile();
  const queryClient = useQueryClient();
  const mine = useQuery({ queryKey: ['my-business', userId], queryFn: () => getMyBusiness(userId!), enabled: !!userId });
  const fee = useQuery({ queryKey: ['badge-fee'], queryFn: getBadgeFee });
  const enquiries = useQuery({ queryKey: ['business-enquiries', mine.data?.id], queryFn: () => listBusinessEnquiries(mine.data!.id), enabled: !!mine.data });

  if (!userId) return <SignInPrompt />;
  if (mine.isLoading) return <ScreenState loading />;
  return <Editor key={mine.data?.id ?? 'new'} business={mine.data ?? null} userId={userId} defaultPhone={profile.data?.phone ?? ''} fee={fee.data ?? null} enquiries={enquiries.data ?? []} onSaved={() => queryClient.invalidateQueries({ queryKey: ['my-business'] })} t={t} locale={locale} bt={bt} />;
}

function Editor({
  business,
  userId,
  defaultPhone,
  fee,
  enquiries,
  onSaved,
  t,
  locale,
  bt,
}: {
  business: MyBusiness | null;
  userId: string;
  defaultPhone: string;
  fee: number | null;
  enquiries: Awaited<ReturnType<typeof listBusinessEnquiries>>;
  onSaved: () => void;
  t: ReturnType<typeof useI18n>['t'];
  locale: ReturnType<typeof useI18n>['locale'];
  bt: ReturnType<typeof useI18n>['t']['business'];
}) {
  const [f, setF] = useState({
    name: business?.business_name ?? '',
    type: [business?.business_type ?? 'hotel'] as string[],
    region: business ? [business.base_region] : ([] as string[]),
    location: business?.location ?? '',
    story: business?.story ?? '',
    website: business?.website ?? '',
    whatsapp: business?.provider_private?.whatsapp_number ?? defaultPhone,
  });
  const [photo, setPhoto] = useState<Upload | null>(null);
  const [extra, setExtra] = useState<Upload | null>(null);
  const [licence, setLicence] = useState<Upload | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const set = <K extends keyof typeof f>(key: K) => (value: (typeof f)[K]) => setF((current) => ({ ...current, [key]: value }));
  const today = new Date().toISOString().slice(0, 10);
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

  async function save() {
    if (!f.name.trim() || !f.region[0] || !f.whatsapp.trim()) return setMessage({ tone: 'error', text: t.auth.error });
    setBusy(true);
    setMessage(null);
    try {
      const website = f.website.trim();
      await saveMyBusiness(
        userId,
        business,
        {
          business_name: f.name.trim(),
          business_type: (f.type[0] ?? 'other') as BusinessType,
          base_region: f.region[0],
          location: f.location.trim() || null,
          story: f.story.trim() || null,
          website: /^https:\/\/\S+$/i.test(website) ? website : null,
          whatsapp_number: f.whatsapp.trim(),
        },
        { photo: photo ?? undefined, extraPhoto: extra ?? undefined, licence: licence ?? undefined },
      );
      setPhoto(null);
      setExtra(null);
      setLicence(null);
      setMessage({ tone: 'ok', text: bt.saved });
      onSaved();
    } catch {
      setMessage({ tone: 'error', text: t.auth.error });
    } finally {
      setBusy(false);
    }
  }

  async function askForBadge() {
    await requestBadge(userId).catch(() => undefined);
    onSaved();
  }

  const status = business?.verification_status;
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.huge }}>
      <Stack.Title>{bt.dashboardTitle}</Stack.Title>
      {status && (
        <Card>
          <Badge label={status === 'approved' ? bt.statusApproved : status === 'rejected' ? bt.statusRejected : bt.statusPending} tone={status === 'approved' ? 'mint' : 'sand'} />
          {status === 'approved' && <Button title={bt.viewListing} variant="outline" onPress={() => router.push({ pathname: '/business/[id]', params: { id: business!.id } })} />}
        </Card>
      )}

      <Card>
        <Pressable onPress={async () => setPhoto((await pickPhoto()) ?? photo)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Avatar name={f.name || '?'} uri={photo?.uri ?? business?.photo_url} size={72} />
          <Text style={{ color: brand.leafDark, fontWeight: '700' }}>{bt.photoField}</Text>
        </Pressable>
        <Field label={bt.nameField} value={f.name} onChangeText={set('name')} />
        <ChipSelect label={bt.typeField} options={BUSINESS_TYPES.map((b) => ({ value: b.id, label: b[locale] }))} selected={f.type} onChange={set('type')} multiple={false} />
        <ChipSelect label={bt.regionField} options={REGIONS.map((r) => ({ value: r, label: r }))} selected={f.region} onChange={set('region')} multiple={false} />
        <Field label={bt.locationField} value={f.location} onChangeText={set('location')} />
        <Field label={bt.whatsappField} value={f.whatsapp} onChangeText={set('whatsapp')} keyboardType="phone-pad" />
        <Field label={bt.storyField} value={f.story} onChangeText={set('story')} multiline />
        <Field label={bt.websiteField} value={f.website} onChangeText={set('website')} autoCapitalize="none" keyboardType="url" />
        <Button title={`${bt.morePhotosField} (${business?.photos.length ?? 0}/6)${extra ? ' ✓' : ''}`} variant="outline" onPress={async () => setExtra((await pickPhoto()) ?? extra)} />
        <Button title={`${bt.licenceField}${licence || business?.provider_private?.licence_document_path ? ' ✓' : ''}`} variant="outline" onPress={async () => setLicence((await pickPhoto()) ?? licence)} />
        <FormMessage message={message} />
        <Button title={bt.save} onPress={save} loading={busy} />
      </Card>

      {business && (
        <Card style={{ backgroundColor: brand.sand }}>
          <SectionTitle>{bt.badgeTitle}</SectionTitle>
          <Muted>{bt.badgeBody}</Muted>
          <Text style={{ fontWeight: '700', color: colors.label }}>{fee != null ? bt.badgeFee.replace('{price}', formatUsd(fee)) : bt.badgeFeeAsk}</Text>
          {hasValidBadge(business, today) ? (
            <Text style={{ color: brand.forest, fontWeight: '700' }}>{bt.badgeActive.replace('{date}', date.format(new Date(business.badge_valid_until!)))}</Text>
          ) : business.badge_requested_at ? (
            <Text style={{ color: colors.label, fontWeight: '700' }}>{bt.badgeRequested}</Text>
          ) : (
            <>
              {business.badge_valid_until && <Text style={{ color: brand.danger }}>{bt.badgeExpired.replace('{date}', date.format(new Date(business.badge_valid_until)))}</Text>}
              <Button title={bt.badgeRequest} onPress={askForBadge} />
            </>
          )}
        </Card>
      )}

      {business && (
        <Card>
          <SectionTitle>{bt.enquiriesTitle}</SectionTitle>
          {enquiries.length === 0 && <Muted>{bt.noEnquiries}</Muted>}
          {enquiries.map((e) => (
            <Text key={e.id} selectable style={{ color: colors.label, paddingVertical: space.xs }}>
              <Text style={{ fontWeight: '700' }}>{e.traveler_name}</Text> · {e.traveler_contact}
              {'\n'}
              {e.message}
            </Text>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}
