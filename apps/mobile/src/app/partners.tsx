import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { Stack, router } from 'expo-router';
import { Button, Card, Field, FormMessage, Muted, SectionTitle } from '@/components/ui';
import { registerInterest } from '@/lib/api-more';
import { useProfile, useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { colors, space, textSize } from '@/theme';

// For travel agents and tour companies: why work with Kwetuly, and the partner application.
export default function PartnersScreen() {
  const { t, locale } = useI18n();
  const p = t.partners;
  const { session } = useSession();
  const profile = useProfile();
  const [agency, setAgency] = useState('');
  const [country, setCountry] = useState('');
  const [website, setWebsite] = useState('');
  const [name, setName] = useState(profile.data?.full_name ?? '');
  const [contact, setContact] = useState(profile.data?.phone ?? session?.user.email ?? '');
  const [markets, setMarkets] = useState('');
  const [volume, setVolume] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function submit() {
    if (!agency.trim() || !name.trim() || !contact.trim()) return setMessage({ tone: 'error', text: t.auth.error });
    setBusy(true);
    const details = [
      ['Country', country],
      ['Website', website],
      ['Clients and trips', markets],
      ['Travellers per year', volume],
    ]
      .filter(([, v]) => v.trim())
      .map(([k, v]) => `${k}: ${v.trim()}`)
      .join('\n');
    try {
      await registerInterest({ section: 'partners', item: 'travel-agents', kind: 'business', name, contact, businessName: agency, message: details, locale });
      setMessage({ tone: 'ok', text: p.sent });
    } catch {
      setMessage({ tone: 'error', text: t.auth.error });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }}>
      <Stack.Title>{p.applyTitle}</Stack.Title>
      <Card>
        <Text style={{ fontSize: textSize.title2, fontWeight: '800', color: colors.label }}>{p.title}</Text>
        <Muted>{p.subtitle}</Muted>
      </Card>
      {p.why.map((w) => (
        <Card key={w.title}>
          <Text style={{ fontWeight: '800', color: colors.label }}>{w.title}</Text>
          <Muted>{w.body}</Muted>
        </Card>
      ))}
      <Card>
        <SectionTitle>{p.howTitle}</SectionTitle>
        {p.how.map((step, i) => (
          <Muted key={step}>
            {i + 1}. {step}
          </Muted>
        ))}
        <Button title={p.browse} variant="outline" onPress={() => router.push({ pathname: '/guides', params: { partners: '1' } })} />
      </Card>
      <Card>
        <SectionTitle>{p.overflowTitle}</SectionTitle>
        <Muted>{p.overflowBody}</Muted>
        <Button title={p.overflowCta} variant="dark" onPress={() => router.push({ pathname: '/jobs-post', params: { kind: 'handover' } })} />
      </Card>
      <Card>
        <SectionTitle>{p.applyTitle}</SectionTitle>
        <Muted>{p.applyBody}</Muted>
        <Field label={p.agency} value={agency} onChangeText={setAgency} />
        <Field label={p.country} value={country} onChangeText={setCountry} />
        <Field label={p.website} value={website} onChangeText={setWebsite} autoCapitalize="none" keyboardType="url" />
        <Field label={t.profile.name} value={name} onChangeText={setName} />
        <Field label={t.profile.contact} value={contact} onChangeText={setContact} autoCapitalize="none" />
        <Field label={p.markets} value={markets} onChangeText={setMarkets} multiline />
        <Field label={p.volume} value={volume} onChangeText={setVolume} />
        <FormMessage message={message} />
        <Button title={p.submit} onPress={submit} loading={busy} />
      </Card>
    </ScrollView>
  );
}
