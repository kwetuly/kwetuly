import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { GUIDE_LANGUAGES, GUIDE_SPECIALTIES, REGIONS } from '@rafrika/shared';
import { Button, Card, ChipSelect, Field, FormMessage, Muted, ScreenState } from '@/components/ui';
import { createGroupTrip, getMyGuide } from '@/lib/api-more';
import { useProfile, useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { colors, space } from '@/theme';

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value.trim());

// Verified guides post as themselves; business accounts post under their company name.
// Every group trip waits for Rafrika's approval before travellers see it.
export default function NewGroupTripScreen() {
  const { t, locale } = useI18n();
  const g = t.groups;
  const complete = useLocalSearchParams<{ complete?: string }>().complete === '1';
  const { session } = useSession();
  const userId = session?.user.id;
  const profile = useProfile();
  const mine = useQuery({ queryKey: ['my-guide', userId], queryFn: () => getMyGuide(userId!), enabled: !!userId });
  const asGuide = mine.data?.guide?.verification_status === 'approved';
  const asBusiness = profile.data?.role === 'provider' || profile.data?.role === 'admin';
  // Travellers organise as themselves once their account has a phone; Rafrika calls it before approving.
  const asTraveller = !asGuide && !asBusiness;

  const [f, setF] = useState({
    company: '',
    title: '',
    specialty: [] as string[],
    region: [] as string[],
    description: '',
    start: '',
    end: '',
    price: '',
    meeting: '',
    min: '2',
    max: '8',
    languages: ['en'] as string[],
    includes: '',
    deposit: '30',
    contact: '',
    going: '2',
  });
  const set = <K extends keyof typeof f>(key: K) => (value: (typeof f)[K]) => setF((current) => ({ ...current, [key]: value }));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  if (!userId || mine.isLoading || profile.isLoading) return <ScreenState loading />;
  if (asTraveller && !profile.data?.phone) {
    return (
      <Card style={{ margin: space.lg }}>
        <Muted>{t.extras.phoneNeeded}</Muted>
        <Button title={t.extras.addPhone} onPress={() => router.replace('/profile-edit')} />
      </Card>
    );
  }

  async function submit() {
    const min = parseInt(f.min, 10) || 1;
    const max = parseInt(f.max, 10);
    const price = parseInt(f.price, 10);
    const going = complete ? parseInt(f.going, 10) || 0 : 0;
    const today = new Date().toISOString().slice(0, 10);
    const valid =
      f.title.trim().length >= 5 &&
      f.description.trim().length >= 20 &&
      f.specialty[0] &&
      f.region[0] &&
      isDate(f.start) &&
      isDate(f.end) &&
      f.end >= f.start &&
      f.start >= today &&
      price >= 0 &&
      max >= 2 &&
      min <= max &&
      f.contact.trim().length >= 3 &&
      (!complete || (going >= 1 && going < max)) &&
      (asGuide || asTraveller || f.company.trim());
    if (!valid) return setMessage({ tone: 'error', text: t.auth.error });
    setBusy(true);
    try {
      const id = await createGroupTrip(
        userId!,
        asGuide ? mine.data!.guide!.id : null,
        {
          company_name: asGuide || asTraveller ? null : f.company.trim(),
          already_going: going,
          title: f.title.trim(),
          description: f.description.trim(),
          specialty: f.specialty[0],
          region: f.region[0],
          meeting_point: f.meeting.trim() || null,
          start_date: f.start.trim(),
          end_date: f.end.trim(),
          price_per_person_usd: price,
          min_people: min,
          max_people: max,
          languages: f.languages,
          includes: f.includes.trim() || null,
          deposit_percent: Math.min(Math.max(parseInt(f.deposit, 10) || 0, 0), 100),
        },
        f.contact.trim(),
      );
      router.replace({ pathname: '/group-trip/[id]', params: { id } });
    } catch {
      setMessage({ tone: 'error', text: t.auth.error });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.huge }}>
      <Stack.Title>{complete ? t.extras.completeTitle : g.newTitle}</Stack.Title>
      <Card>
        <Muted>{complete ? t.extras.completeBody : g.newBody}</Muted>
        {asTraveller && <Muted>{t.extras.travellerCheck}</Muted>}
        {asBusiness && !asGuide && <Field label={g.companyName} value={f.company} onChangeText={set('company')} />}
        <Field label={g.tripTitle} value={f.title} onChangeText={set('title')} />
        <ChipSelect label={g.tripType} options={GUIDE_SPECIALTIES.map((s) => ({ value: s.id, label: s[locale] }))} selected={f.specialty} onChange={set('specialty')} multiple={false} />
        <ChipSelect label={g.region} options={REGIONS.map((r) => ({ value: r, label: r }))} selected={f.region} onChange={set('region')} multiple={false} />
        <Field label={g.description} value={f.description} onChangeText={set('description')} multiline />
        <Field label={g.startDate} value={f.start} onChangeText={set('start')} placeholder="2027-03-14" keyboardType="numbers-and-punctuation" />
        <Field label={g.endDate} value={f.end} onChangeText={set('end')} placeholder="2027-03-20" keyboardType="numbers-and-punctuation" />
        <Field label={g.price} value={f.price} onChangeText={set('price')} keyboardType="number-pad" />
        <Field label={g.meetingPoint} value={f.meeting} onChangeText={set('meeting')} />
        <Field label={g.minPeopleField} value={f.min} onChangeText={set('min')} keyboardType="number-pad" />
        {complete && <Field label={t.extras.alreadyGoing} value={f.going} onChangeText={set('going')} keyboardType="number-pad" />}
        <Field label={g.maxPeople} value={f.max} onChangeText={set('max')} keyboardType="number-pad" />
        <ChipSelect label={t.guides.languages} options={GUIDE_LANGUAGES.map((l) => ({ value: l.code, label: l.name }))} selected={f.languages} onChange={set('languages')} />
        <Field label={g.includesField} value={f.includes} onChangeText={set('includes')} multiline />
        <Field label={t.offers.deposit} value={f.deposit} onChangeText={set('deposit')} keyboardType="number-pad" hint={t.offers.depositHint} />
        <Field label={g.organiserContact} value={f.contact} onChangeText={set('contact')} keyboardType="phone-pad" />
        <FormMessage message={message} />
        <Button title={g.submit} onPress={submit} loading={busy} />
      </Card>
    </ScrollView>
  );
}
