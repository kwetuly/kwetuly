import { useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { Redirect, Stack, router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { EVENTS, GUIDE_EXPERTISE, GUIDE_LANGUAGES, GUIDE_SPECIALTIES, REGIONS } from '@kwetuly/shared';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { Button, Card, ChipSelect, Field, FormMessage, Muted } from '@/components/ui';
import { createRequest, today } from '@/lib/api-requests';
import { track } from '@/lib/analytics';
import { useProfile, useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useNeedsSetup, welcomeHref } from '@/lib/onboarding';
import { brand, colors, space } from '@/theme';

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value.trim());

// A traveller describes the trip they want; matching verified guides are alerted and send offers.
export default function NewRequestScreen() {
  const { t, locale } = useI18n();
  const r = t.requests;
  const { session } = useSession();
  const userId = session?.user.id;
  const profile = useProfile();
  const queryClient = useQueryClient();

  const [f, setF] = useState({
    title: '',
    specialty: ['safari'] as string[],
    details: '',
    start: '',
    end: '',
    flexible: false,
    adults: '2',
    children: '0',
    budget: '',
    regions: [] as string[],
    languages: [locale] as string[],
    expertise: [] as string[],
    female: false,
  });
  const set = <K extends keyof typeof f>(key: K) => (value: (typeof f)[K]) => setF((current) => ({ ...current, [key]: value }));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const needsSetup = useNeedsSetup();
  if (needsSetup) return <Redirect href={welcomeHref('/request/new')} />;
  if (!userId) return <SignInPrompt />;

  async function submit() {
    const start = f.start.trim() || null;
    const end = f.end.trim() || null;
    const budget = parseInt(f.budget, 10);
    const valid =
      f.title.trim().length >= 5 &&
      f.details.trim().length >= 20 &&
      f.specialty[0] &&
      (!start || (isDate(start) && start >= today())) &&
      (!end || isDate(end)) &&
      (!start || !end || end >= start);
    if (!valid) return setMessage({ tone: 'error', text: r.error });
    setBusy(true);
    setMessage(null);
    try {
      const id = await createRequest(userId!, {
        traveler_name: (profile.data?.full_name ?? '').trim() || 'Traveller',
        title: f.title.trim(),
        details: f.details.trim(),
        specialty: f.specialty[0],
        expertise: f.expertise,
        regions: f.regions,
        start_date: start,
        end_date: end,
        flexible_dates: f.flexible,
        adults: Math.min(Math.max(parseInt(f.adults, 10) || 1, 1), 50),
        children: Math.min(Math.max(parseInt(f.children, 10) || 0, 0), 50),
        budget_per_person_usd: budget > 0 ? Math.min(budget, 100000) : null,
        languages: f.languages,
        female_guide: f.female,
      });
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      track(EVENTS.tripRequestSent, {});
      router.replace({ pathname: '/request/[id]', params: { id, posted: '1' } });
    } catch {
      setMessage({ tone: 'error', text: r.error });
    } finally {
      setBusy(false);
    }
  }

  const toggle = (label: string, value: boolean, onChange: (v: boolean) => void) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
      <Text style={{ flex: 1, color: colors.label, fontWeight: '600' }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: brand.forest }} />
    </View>
  );

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }}>
      <Stack.Title>{r.newTitle}</Stack.Title>
      <Muted>{r.newBody}</Muted>
      <Card>
        <Field label={r.tripTitle} value={f.title} onChangeText={set('title')} placeholder={r.tripTitlePlaceholder} />
        <ChipSelect label={r.tripType} options={GUIDE_SPECIALTIES.map((s) => ({ value: s.id, label: s[locale] }))} selected={f.specialty} onChange={set('specialty')} multiple={false} />
        <Field label={r.details} value={f.details} onChangeText={set('details')} placeholder={r.detailsPlaceholder} multiline />
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ flex: 1 }}><Field label={r.adults} value={f.adults} onChangeText={set('adults')} keyboardType="number-pad" /></View>
          <View style={{ flex: 1 }}><Field label={r.children} value={f.children} onChangeText={set('children')} keyboardType="number-pad" /></View>
        </View>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ flex: 1 }}><Field label={r.startDate} value={f.start} onChangeText={set('start')} placeholder="2027-02-10" /></View>
          <View style={{ flex: 1 }}><Field label={r.endDate} value={f.end} onChangeText={set('end')} placeholder="2027-02-16" /></View>
        </View>
        {toggle(r.flexible, f.flexible, set('flexible'))}
        <Field label={r.budget} value={f.budget} onChangeText={set('budget')} keyboardType="number-pad" />
        <ChipSelect label={r.regions} options={REGIONS.map((x) => ({ value: x, label: x }))} selected={f.regions} onChange={set('regions')} />
        <ChipSelect label={r.languages} options={GUIDE_LANGUAGES.map((l) => ({ value: l.code, label: l.name }))} selected={f.languages} onChange={set('languages')} />
        <ChipSelect label={r.expertise} options={GUIDE_EXPERTISE.map((e) => ({ value: e.id, label: e.label[locale] }))} selected={f.expertise} onChange={set('expertise')} />
        {toggle(r.femaleGuide, f.female, set('female'))}
        <FormMessage message={message} />
        <Button title={r.submit} onPress={submit} loading={busy} />
      </Card>
    </ScrollView>
  );
}
