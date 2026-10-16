import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { cleanPhoto } from '@/lib/clean-photo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PACKAGE_KINDS, packageDuration, packagePrice, type GuidePackage, type PackageKind, type PackageStatus } from '@rafrika/shared';
import { Badge, Button, Card, ChipSelect, Field, FormMessage, Muted, ScreenState } from '@/components/ui';
import { getMyGuide } from '@/lib/api-more';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { deletePackage, listMyPackages, savePackage } from '@/lib/packages';
import { brand, colors, radius, space, textSize } from '@/theme';

const STATUS_TONE: Record<PackageStatus, 'night' | 'sand' | 'mint' | 'gold'> = { draft: 'night', pending: 'sand', approved: 'mint', rejected: 'gold' };

const EMPTY = { kind: ['cultural'] as string[], title: '', summary: '', details: '', hours: '', days: '', price: '', per: ['person'] as string[], maxGroup: '', includes: '', meeting: '' };

// Photos are shrunk to at most 1600px and saved as JPEG, which also drops the camera's location data.
async function pickPhoto() {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: true, aspect: [4, 3] });
  if (result.canceled) return null;
  const asset = result.assets[0];
  return cleanPhoto(asset, { maxSide: 1600 });
}

// The guide's own packages, the same as /dashboard/packages on the website.
export default function MyPackagesScreen() {
  const { t, locale } = useI18n();
  const pt = t.packages;
  const { session } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const mine = useQuery({ queryKey: ['my-guide', userId], queryFn: () => getMyGuide(userId!), enabled: !!userId });
  const guideId = mine.data?.guide?.id;
  const packages = useQuery({ queryKey: ['my-packages', guideId], queryFn: () => listMyPackages(guideId!), enabled: !!guideId });

  const [editing, setEditing] = useState<GuidePackage | 'new' | null>(null);
  const [f, setF] = useState(EMPTY);
  const [photo, setPhoto] = useState<{ uri: string; mimeType: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const set = <K extends keyof typeof f>(key: K) => (value: (typeof f)[K]) => setF((current) => ({ ...current, [key]: value }));

  if (!userId) return <SignInPrompt />;
  if (mine.isLoading || packages.isLoading) return <ScreenState loading />;
  if (!guideId) return <ScreenState empty emptyText={t.dashboard.statusPending} />;

  function open(p: GuidePackage | 'new') {
    setMessage(null);
    setPhoto(null);
    setEditing(p);
    setF(
      p === 'new'
        ? EMPTY
        : {
            kind: [p.kind],
            title: p.title,
            summary: p.summary,
            details: p.details ?? '',
            hours: p.duration_hours?.toString() ?? '',
            days: p.duration_days?.toString() ?? '',
            price: p.price_usd?.toString() ?? '',
            per: [p.price_per],
            maxGroup: p.max_group?.toString() ?? '',
            includes: p.includes.join('\n'),
            meeting: p.meeting_point ?? '',
          },
    );
  }

  const whole = (value: string, min: number, max: number) => {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  };

  async function save(draft: boolean) {
    if (f.title.trim().length < 3 || f.summary.trim().length < 10) return setMessage({ tone: 'error', text: t.auth.error });
    setBusy(true);
    setMessage(null);
    try {
      const price = Number.parseFloat(f.price);
      await savePackage(
        guideId!,
        userId!,
        {
          kind: (f.kind[0] ?? 'other') as PackageKind,
          title: f.title.trim(),
          summary: f.summary.trim(),
          details: f.details.trim() || null,
          duration_hours: whole(f.hours, 1, 24),
          duration_days: whole(f.days, 1, 30),
          price_usd: Number.isFinite(price) && price >= 0 ? Math.round(price * 100) / 100 : null,
          price_per: f.per[0] === 'group' ? 'group' : 'person',
          max_group: whole(f.maxGroup, 1, 60),
          includes: f.includes.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 15),
          meeting_point: f.meeting.trim() || null,
          status: draft ? 'draft' : 'pending',
        },
        editing && editing !== 'new' ? editing.id : undefined,
        photo ?? undefined,
      );
      await queryClient.invalidateQueries({ queryKey: ['my-packages'] });
      setEditing(null);
      setMessage({ tone: 'ok', text: pt.saved });
    } catch {
      setMessage({ tone: 'error', text: t.auth.error });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await deletePackage(id).catch(() => undefined);
    await queryClient.invalidateQueries({ queryKey: ['my-packages'] });
  }

  const list = packages.data ?? [];

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.huge }}>
      <Stack.Title>{pt.manageTitle}</Stack.Title>
      <Muted>{pt.manageIntro}</Muted>
      {!editing && <FormMessage message={message} />}

      {!editing && list.length === 0 && <Muted>{pt.none}</Muted>}
      {!editing &&
        list.map((p) => (
          <Card key={p.id}>
            <Text style={{ fontWeight: '800', color: colors.label, fontSize: textSize.body }}>{p.title}</Text>
            <Badge label={pt.status[p.status]} tone={STATUS_TONE[p.status]} />
            <Muted>{[PACKAGE_KINDS.find((k) => k.id === p.kind)?.[locale], packageDuration(p, pt), packagePrice(p, pt)].filter(Boolean).join(' · ')}</Muted>
            {p.status === 'rejected' && p.review_note && (
              <Text style={{ color: colors.label }}>
                <Text style={{ fontWeight: '700' }}>{pt.reviewNote}: </Text>
                {p.review_note}
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              <Button title={t.dashboard.edit} variant="outline" onPress={() => open(p)} style={{ flex: 1 }} />
              <Text accessibilityRole="button" onPress={() => remove(p.id)} style={{ color: brand.danger, fontWeight: '700', padding: space.sm }}>
                {pt.remove}
              </Text>
            </View>
          </Card>
        ))}
      {!editing && <Button title={pt.add} onPress={() => open('new')} />}

      {editing && (
        <Card>
          <Text style={{ fontWeight: '800', color: colors.label, fontSize: textSize.headline }}>{editing === 'new' ? pt.add : pt.editPackage}</Text>
          {editing !== 'new' && editing.status === 'approved' && <Muted>{pt.changeNote}</Muted>}
          <ChipSelect label={pt.kindField} options={PACKAGE_KINDS.map((k) => ({ value: k.id, label: k[locale] }))} selected={f.kind} onChange={set('kind')} multiple={false} />
          <Field label={pt.titleField} value={f.title} onChangeText={set('title')} />
          <Field label={pt.summaryField} value={f.summary} onChangeText={set('summary')} multiline />
          <Field label={pt.detailsField} value={f.details} onChangeText={set('details')} multiline />
          <Field label={pt.hoursField} value={f.hours} onChangeText={set('hours')} keyboardType="number-pad" />
          <Field label={pt.daysField} value={f.days} onChangeText={set('days')} keyboardType="number-pad" />
          <Field label={pt.priceField} value={f.price} onChangeText={set('price')} keyboardType="decimal-pad" />
          <ChipSelect
            label={pt.pricePerField}
            options={[
              { value: 'person', label: pt.person },
              { value: 'group', label: pt.group },
            ]}
            selected={f.per}
            onChange={set('per')}
            multiple={false}
          />
          <Field label={pt.maxGroupField} value={f.maxGroup} onChangeText={set('maxGroup')} keyboardType="number-pad" />
          <Field label={pt.includesField} value={f.includes} onChangeText={set('includes')} multiline />
          <Field label={pt.meetingField} value={f.meeting} onChangeText={set('meeting')} />
          <Pressable onPress={async () => setPhoto((await pickPhoto()) ?? photo)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            {(photo?.uri ?? (editing !== 'new' ? editing.photo_url : null)) ? (
              <Image source={{ uri: photo?.uri ?? (editing !== 'new' ? editing.photo_url! : '') }} style={{ width: 96, height: 72, borderRadius: radius.button }} contentFit="cover" />
            ) : null}
            <Text style={{ color: brand.leafDark, fontWeight: '700' }}>{pt.photoField}</Text>
          </Pressable>
          <FormMessage message={message} />
          <Button title={pt.submit} onPress={() => save(false)} loading={busy} />
          <Button title={pt.saveDraft} variant="outline" onPress={() => save(true)} disabled={busy} />
          <Text accessibilityRole="button" onPress={() => setEditing(null)} style={{ color: brand.forest, fontWeight: '700', textAlign: 'center', paddingVertical: space.sm }}>
            {t.ux.cancel}
          </Text>
        </Card>
      )}
    </ScrollView>
  );
}
