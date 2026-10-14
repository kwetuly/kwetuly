import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CALL_TOPICS, GROUP_SIZES, GUIDE_EXPERTISE, GUIDE_LANGUAGES, GUIDE_SPECIALTIES, REGIONS, documentStatus, profileCompletion, type DocumentStatus } from '@rafrika/shared';
import { Glyph } from '@/components/glyph';
import { Avatar, Badge, Button, Card, ChipSelect, Field, FormMessage, Muted, ScreenState, SectionTitle } from '@/components/ui';
import { getMyGuide, saveGuideProfile } from '@/lib/api-more';
import { useProfile, useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { brand, colors, radius, space, textSize } from '@/theme';

type Upload = { uri: string; mimeType: string };

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: brand.leaf }} />
      <Text style={{ flex: 1, color: colors.label }}>{label}</Text>
    </View>
  );
}

// Profile photos are cropped square; ID card photos are kept as taken. Both are shrunk to at most
// 1600px (phone photos are often 8–12 MB, too slow on mobile data and over the storage limit).
async function pickImage(square: boolean): Promise<Upload | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: square, aspect: square ? [1, 1] : undefined });
  if (result.canceled) return null;
  const asset = result.assets[0];
  try {
    const context = ImageManipulator.manipulate(asset.uri);
    if (Math.max(asset.width, asset.height) > 1600) context.resize(asset.width >= asset.height ? { width: 1600 } : { height: 1600 });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
    return { uri: saved.uri, mimeType: 'image/jpeg' };
  } catch {
    return { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' };
  }
}

type Translations = ReturnType<typeof useI18n>['t'];

// Profile strength: how complete the profile is and what is still missing (same rules as the website).
function ProfileStrength({ input, t }: { input: Parameters<typeof profileCompletion>[0]; t: Translations }) {
  const c = t.checks;
  const { items, percent } = profileCompletion(input);
  const allDone = items.every((i) => i.done || i.optional);
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <SectionTitle>{c.strength}</SectionTitle>
        <Text style={{ fontWeight: '800', color: brand.leafDark, fontVariant: ['tabular-nums'] }}>
          {percent}% {c.complete}
        </Text>
      </View>
      <View style={{ height: 8, borderRadius: radius.bar, backgroundColor: colors.fill, overflow: 'hidden' }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }}>
        <View style={{ width: `${percent}%`, height: '100%', backgroundColor: brand.leaf }} />
      </View>
      <Text style={{ fontWeight: '700', color: allDone ? brand.leafDark : colors.secondaryLabel, fontSize: textSize.footnote }}>{allDone ? c.allDone : c.missing}</Text>
      <View style={{ gap: space.xs }}>
        {items.map((item) => (
          <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Glyph
              name={item.done ? { ios: 'checkmark.circle.fill', android: 'check_circle' } : { ios: 'circle', android: 'radio_button_unchecked' }}
              size={18}
              color={item.done ? brand.leafDark : colors.secondaryLabel}
            />
            <Text style={{ color: item.done ? colors.secondaryLabel : colors.label, fontWeight: item.done ? '400' : '700' }}>
              {c[item.id]}
              {item.optional ? ` (${c.optional})` : ''}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

// One private document: its review status and a button to pick a new photo of it.
function DocumentRow({ label, status, picked, onPick, t }: { label: string; status: DocumentStatus; picked: boolean; onPick: () => void; t: Translations }) {
  const c = t.checks;
  const badge: Record<DocumentStatus, { text: string; tone: 'mint' | 'sand' | 'night' | 'gold' }> = {
    checked: { text: c.statusChecked, tone: 'mint' },
    waiting: { text: c.statusWaiting, tone: 'sand' },
    missing: { text: c.statusMissing, tone: 'night' },
    expired: { text: c.statusExpired, tone: 'gold' },
  };
  return (
    <View style={{ gap: space.sm }}>
      <Text style={{ fontWeight: '700', color: colors.label }}>{label}</Text>
      <Badge label={picked ? c.statusWaiting : badge[status].text} tone={picked ? 'sand' : badge[status].tone} />
      <Button title={`${label}${picked ? ' ✓' : ''}`} variant="outline" onPress={onPick} />
    </View>
  );
}

// Create or edit the guide profile, the same fields and rules as the website editor.
export default function ProfileEditScreen() {
  const { t, locale } = useI18n();
  const d = t.dashboard;
  const { session } = useSession();
  const userId = session?.user.id;
  const profile = useProfile();
  const queryClient = useQueryClient();
  const mine = useQuery({ queryKey: ['my-guide', userId], queryFn: () => getMyGuide(userId!), enabled: !!userId });

  const [f, setF] = useState({
    display_name: '',
    slug: '',
    headline: '',
    bio: '',
    base_region: [] as string[],
    regions: [] as string[],
    specialties: [] as string[],
    languages: ['sw', 'en'] as string[],
    expertise: [] as string[],
    female_guide: false,
    open_to_partners: false,
    max_group_size: ['8'] as string[],
    years_experience: '',
    summits: '',
    certifications: '',
    association: '',
    has_vehicle: false,
    visibility: 'public' as 'public' | 'link_only',
    call_enabled: false,
    call_price_usd: '',
    call_minutes: ['45'] as string[],
    call_topics: [] as string[],
    phone: '',
    whatsapp_number: '',
    registration_number: '',
    kinapa_tanapa_id: '',
  });
  const [photo, setPhoto] = useState<Upload | null>(null);
  const [idDocument, setIdDocument] = useState<Upload | null>(null);
  const [licenceDocument, setLicenceDocument] = useState<Upload | null>(null);
  const [firstAidDocument, setFirstAidDocument] = useState<Upload | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const set = <K extends keyof typeof f>(key: K) => (value: (typeof f)[K]) => setF((current) => ({ ...current, [key]: value }));

  // Fill the form once the saved profile (or the account name and phone) arrives.
  useEffect(() => {
    const g = mine.data?.guide;
    const p = mine.data?.details;
    if (g) {
      setF({
        display_name: g.display_name,
        slug: g.slug,
        headline: g.headline ?? '',
        bio: g.bio ?? '',
        base_region: [g.base_region],
        regions: g.regions,
        specialties: g.specialties,
        languages: g.languages,
        expertise: g.expertise,
        female_guide: g.female_guide,
        open_to_partners: g.open_to_partners,
        max_group_size: [String(g.max_group_size)],
        years_experience: g.years_experience?.toString() ?? '',
        summits: g.summits?.toString() ?? '',
        certifications: g.certifications.join(', '),
        association: g.association ?? '',
        has_vehicle: g.has_vehicle,
        visibility: g.visibility,
        call_enabled: g.call_enabled,
        call_price_usd: g.call_price_usd?.toString() ?? '',
        call_minutes: [String(g.call_minutes)],
        call_topics: g.call_topics,
        phone: p?.phone ?? '',
        whatsapp_number: p?.whatsapp_number ?? '',
        registration_number: p?.registration_number ?? '',
        kinapa_tanapa_id: p?.kinapa_tanapa_id ?? '',
      });
    } else if (mine.isSuccess) {
      setF((current) => ({ ...current, display_name: profile.data?.full_name ?? '', phone: profile.data?.phone ?? '', whatsapp_number: profile.data?.phone ?? '' }));
    }
  }, [mine.data, mine.isSuccess, profile.data]);

  if (!userId || mine.isLoading) return <ScreenState loading />;
  const guide = mine.data?.guide;
  const num = (value: string) => (/^\d+$/.test(value.trim()) ? parseInt(value, 10) : null);

  async function save() {
    if (!f.display_name.trim() || !f.base_region[0]) return setMessage({ tone: 'error', text: t.auth.error });
    setBusy(true);
    setMessage(null);
    try {
      await saveGuideProfile(
        userId!,
        {
          slug: f.slug,
          display_name: f.display_name.trim(),
          headline: f.headline.trim() || null,
          bio: f.bio.trim() || null,
          base_region: f.base_region[0],
          regions: f.regions,
          specialties: f.specialties,
          languages: f.languages,
          expertise: f.expertise,
          female_guide: f.female_guide,
          open_to_partners: f.open_to_partners,
          max_group_size: num(f.max_group_size[0]) ?? 8,
          years_experience: num(f.years_experience),
          summits: num(f.summits),
          certifications: f.certifications.split(',').map((c) => c.trim()).filter(Boolean).slice(0, 10),
          association: f.association.trim() || null,
          has_vehicle: f.has_vehicle,
          visibility: f.visibility,
          call_enabled: f.call_enabled,
          call_price_usd: num(f.call_price_usd),
          call_minutes: num(f.call_minutes[0]) ?? 45,
          call_topics: f.call_topics,
        },
        { phone: f.phone.trim() || null, whatsapp_number: f.whatsapp_number.trim() || null, registration_number: f.registration_number.trim() || null, kinapa_tanapa_id: f.kinapa_tanapa_id.trim() || null },
        { photo: photo ?? undefined, idDocument: idDocument ?? undefined, licenceDocument: licenceDocument ?? undefined, firstAidDocument: firstAidDocument ?? undefined },
      );
      setPhoto(null);
      setIdDocument(null);
      setLicenceDocument(null);
      setFirstAidDocument(null);
      await queryClient.invalidateQueries({ queryKey: ['my-guide'] });
      setMessage({ tone: 'ok', text: d.saved });
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error && e.message === 'slug' ? `${d.slug}: ${t.auth.error}` : t.auth.error });
    } finally {
      setBusy(false);
    }
  }

  const status = guide?.verification_status;
  const details = mine.data?.details;
  // Strength counts what is saved; documents picked but not yet saved count too, so the bar moves as the guide works.
  const strengthInput = {
    photo_url: photo?.uri ?? guide?.photo_url,
    headline: f.headline,
    bio: f.bio,
    specialties: f.specialties,
    languages: f.languages,
    regions: f.regions,
    years_experience: num(f.years_experience),
    phone: f.phone,
    id_document_path: idDocument?.uri ?? details?.id_document_path,
    license_document_path: licenceDocument?.uri ?? details?.license_document_path,
    first_aid_document_path: firstAidDocument?.uri ?? details?.first_aid_document_path,
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.huge }}>
      <Stack.Title>{d.title}</Stack.Title>
      {status && (
        <Card>
          <Badge label={status === 'approved' ? d.statusApproved : status === 'rejected' ? d.statusRejected : d.statusPending} tone={status === 'approved' ? 'mint' : 'sand'} />
        </Card>
      )}

      <ProfileStrength input={strengthInput} t={t} />

      <Card>
        <SectionTitle>{d.publicSection}</SectionTitle>
        <Pressable onPress={async () => setPhoto((await pickImage(true)) ?? photo)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }} accessibilityRole="button">
          <Avatar name={f.display_name || '?'} uri={photo?.uri ?? guide?.photo_url} size={72} />
          <Text style={{ color: brand.leafDark, fontWeight: '700' }}>{d.photo}</Text>
        </Pressable>
        <Field label={d.displayName} value={f.display_name} onChangeText={set('display_name')} />
        <Field label={d.slug} value={f.slug} onChangeText={set('slug')} autoCapitalize="none" hint="rafrika.com/guides/…" />
        <Field label={d.headline} value={f.headline} onChangeText={set('headline')} placeholder={d.headlineHint} />
        <Field label={d.bio} value={f.bio} onChangeText={set('bio')} multiline />
        <ChipSelect label={d.baseRegion} options={REGIONS.map((r) => ({ value: r, label: r }))} selected={f.base_region} onChange={set('base_region')} multiple={false} />
        <ChipSelect label={d.regions} options={REGIONS.map((r) => ({ value: r, label: r }))} selected={f.regions} onChange={set('regions')} />
        <ChipSelect label={d.specialties} options={GUIDE_SPECIALTIES.map((s) => ({ value: s.id, label: s[locale] }))} selected={f.specialties} onChange={set('specialties')} />
        <ChipSelect label={d.expertise} options={GUIDE_EXPERTISE.map((e) => ({ value: e.id, label: e.label[locale] }))} selected={f.expertise} onChange={set('expertise')} />
        <Muted>{d.expertiseHint}</Muted>
        <Toggle label={d.femaleGuide} value={f.female_guide} onChange={set('female_guide')} />
        <Toggle label={d.openToPartners} value={f.open_to_partners} onChange={set('open_to_partners')} />
        <ChipSelect label={d.languages} options={GUIDE_LANGUAGES.map((l) => ({ value: l.code, label: l.name }))} selected={f.languages} onChange={set('languages')} />
        <ChipSelect label={d.maxGroup} options={GROUP_SIZES.map((g) => ({ value: String(g.max), label: g[locale] }))} selected={f.max_group_size} onChange={set('max_group_size')} multiple={false} />
        <Field label={d.years} value={f.years_experience} onChangeText={set('years_experience')} keyboardType="number-pad" />
        <Field label={d.summits} value={f.summits} onChangeText={set('summits')} keyboardType="number-pad" />
        <Field label={`${d.certifications} (First Aid, WFR…)`} value={f.certifications} onChangeText={set('certifications')} />
        <Field label={d.association} value={f.association} onChangeText={set('association')} placeholder="TTGA" />
        <Toggle label={d.hasVehicle} value={f.has_vehicle} onChange={set('has_vehicle')} />
        <ChipSelect
          label={d.visibility}
          options={[
            { value: 'public' as const, label: d.visibilityPublic },
            { value: 'link_only' as const, label: d.visibilityLink },
          ]}
          selected={[f.visibility]}
          onChange={(v) => set('visibility')(v[0] ?? 'public')}
          multiple={false}
        />
        <Muted>{d.followUs}</Muted>
      </Card>

      <Card>
        <SectionTitle>{d.callsSection}</SectionTitle>
        <Muted>{d.callsHint}</Muted>
        <Toggle label={d.callEnabled} value={f.call_enabled} onChange={set('call_enabled')} />
        <Field label={d.callPrice} value={f.call_price_usd} onChangeText={set('call_price_usd')} keyboardType="number-pad" placeholder="49" />
        <ChipSelect label={d.callMinutes} options={['30', '45', '60', '90'].map((m) => ({ value: m, label: m }))} selected={f.call_minutes} onChange={set('call_minutes')} multiple={false} />
        <ChipSelect label={d.callTopics} options={CALL_TOPICS.map((c) => ({ value: c.id, label: c[locale] }))} selected={f.call_topics} onChange={set('call_topics')} />
      </Card>

      <Card>
        <SectionTitle>{d.privateSection}</SectionTitle>
        <Field label={d.phone} value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
        <Field label={d.whatsapp} value={f.whatsapp_number} onChangeText={set('whatsapp_number')} keyboardType="phone-pad" />
        <Field label={d.registration} value={f.registration_number} onChangeText={set('registration_number')} />
        <Field label={d.kinapa} value={f.kinapa_tanapa_id} onChangeText={set('kinapa_tanapa_id')} />
      </Card>

      <Card>
        <SectionTitle>{t.checks.documentsTitle}</SectionTitle>
        <Muted>
          {t.checks.documentsNote} {t.checks.recheckNote}
        </Muted>
        <DocumentRow
          label={d.idDocument}
          status={documentStatus(!!details?.id_document_path, guide?.identity_checked_at ?? null)}
          picked={!!idDocument}
          onPick={async () => setIdDocument((await pickImage(false)) ?? idDocument)}
          t={t}
        />
        <DocumentRow
          label={t.checks.licenceUpload}
          status={documentStatus(!!details?.license_document_path, guide?.licence_checked_at ?? null)}
          picked={!!licenceDocument}
          onPick={async () => setLicenceDocument((await pickImage(false)) ?? licenceDocument)}
          t={t}
        />
        <DocumentRow
          label={t.checks.firstAidUpload}
          status={documentStatus(!!details?.first_aid_document_path, guide?.first_aid_checked_at ?? null, guide?.first_aid_valid_until ?? null)}
          picked={!!firstAidDocument}
          onPick={async () => setFirstAidDocument((await pickImage(false)) ?? firstAidDocument)}
          t={t}
        />
      </Card>

      <FormMessage message={message} />
      <Button title={d.save} onPress={save} loading={busy} />
    </ScrollView>
  );
}
