import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { GUIDE_LANGUAGES, GUIDE_SPECIALTIES, JOB_ROLES, REGIONS } from '@rafrika/shared';
import { Button, Card, Chip, ChipSelect, Field, FormMessage, Muted } from '@/components/ui';
import { postJob } from '@/lib/api-more';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { colors, space } from '@/theme';

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value.trim());

// Companies hire crew, or hand over clients they can't take. Rafrika reviews each one first.
export default function JobsPostScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const { t, locale } = useI18n();
  const j = t.jobs;
  const { session } = useSession();
  const [kind, setKind] = useState<'crew' | 'handover'>(params.kind === 'handover' ? 'handover' : 'crew');
  const [f, setF] = useState({
    company: '',
    role: ['guide'] as string[],
    specialty: [] as string[],
    title: '',
    groupSize: '',
    languages: [] as string[],
    description: '',
    location: [] as string[],
    pay: '',
    start: '',
    end: '',
    apply: '',
  });
  const set = <K extends keyof typeof f>(key: K) => (value: (typeof f)[K]) => setF((current) => ({ ...current, [key]: value }));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const handover = kind === 'handover';

  if (!session) {
    return (
      <Card style={{ margin: space.lg }}>
        <Muted>{j.signInFirst}</Muted>
        <Button title={t.auth.signIn} onPress={() => router.replace('/sign-in')} />
      </Card>
    );
  }

  async function submit() {
    const groupSize = parseInt(f.groupSize, 10);
    if (!f.company.trim() || !f.title.trim() || !f.location[0] || !f.apply.trim() || (handover && !f.specialty[0])) {
      return setMessage({ tone: 'error', text: t.auth.error });
    }
    setBusy(true);
    try {
      await postJob(session!.user.id, {
        company_name: f.company.trim(),
        role_needed: handover ? 'guide' : f.role[0],
        title: f.title.trim(),
        description: f.description.trim() || null,
        location: f.location[0],
        start_date: isDate(f.start) ? f.start.trim() : null,
        end_date: isDate(f.end) ? f.end.trim() : null,
        pay: f.pay.trim() || null,
        how_to_apply: f.apply.trim(),
        kind,
        group_size: handover && groupSize >= 1 ? groupSize : null,
        languages: handover ? f.languages : [],
        specialty: handover ? f.specialty[0] : null,
      });
      setMessage({ tone: 'ok', text: j.sent });
    } catch {
      setMessage({ tone: 'error', text: t.auth.error });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.huge }}>
      <Stack.Title>{handover ? j.handoverTitle : j.postTitle}</Stack.Title>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label={j.crewTab} active={!handover} onPress={() => setKind('crew')} />
        <Chip label={j.handoverTab} active={handover} onPress={() => setKind('handover')} />
      </View>
      <Card>
        <Muted>{handover ? j.handoverSubtitle : j.postSubtitle}</Muted>
        <Field label={j.company} value={f.company} onChangeText={set('company')} />
        {handover ? (
          <ChipSelect label={j.tripType} options={GUIDE_SPECIALTIES.map((s) => ({ value: s.id, label: s[locale] }))} selected={f.specialty} onChange={set('specialty')} multiple={false} />
        ) : (
          <ChipSelect label={j.role} options={JOB_ROLES.map((r) => ({ value: r.id, label: r[locale] }))} selected={f.role} onChange={set('role')} multiple={false} />
        )}
        <Field label={handover ? j.tripTitle : j.title} value={f.title} onChangeText={set('title')} />
        {handover && (
          <>
            <Field label={j.groupSize} value={f.groupSize} onChangeText={set('groupSize')} keyboardType="number-pad" />
            <ChipSelect label={j.languagesNeeded} options={GUIDE_LANGUAGES.map((l) => ({ value: l.code, label: l.name }))} selected={f.languages} onChange={set('languages')} />
          </>
        )}
        <Field label={j.description} value={f.description} onChangeText={set('description')} multiline />
        <ChipSelect label={j.location} options={REGIONS.map((r) => ({ value: r, label: r }))} selected={f.location} onChange={set('location')} multiple={false} />
        <Field label={handover ? j.handoverPay : j.pay} value={f.pay} onChangeText={set('pay')} />
        <Field label={j.start} value={f.start} onChangeText={set('start')} placeholder="2027-03-14" keyboardType="numbers-and-punctuation" />
        <Field label={j.end} value={f.end} onChangeText={set('end')} placeholder="2027-03-20" keyboardType="numbers-and-punctuation" />
        <Field label={j.howToApply} value={f.apply} onChangeText={set('apply')} />
        <FormMessage message={message} />
        <Button title={handover ? j.handoverSubmit : j.submit} onPress={submit} loading={busy} />
      </Card>
    </ScrollView>
  );
}
