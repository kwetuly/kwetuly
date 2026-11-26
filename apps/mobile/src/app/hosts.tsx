import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { HOST_FEATURES, HOSTS_ENTRY_LINKS, hostsEntryText, hostsText } from '@kwetuly/shared';
import { Button, Card, FormMessage, Muted, ScreenState, SectionTitle } from '@/components/ui';
import { registerInterest } from '@/lib/api-more';
import { useProfile, useSession } from '@/lib/auth';
import { useFeatures } from '@/lib/feature-switches';
import { useI18n } from '@/lib/i18n';
import { useType } from '@/lib/use-type';
import { brand, colors, layout, space } from '@/theme';

// "Become a host", like /hosts on the website: what a concierge (VIP host) and an investment visit host
// do, what is not offered, and the way in (a guide account, then a host service once approved).
// Each kind shows only while its admin switch is on. Host texts are English and Kiswahili.
export default function HostsScreen() {
  const { t, locale } = useI18n();
  const { type, font } = useType();
  const { session } = useSession();
  const profile = useProfile();
  const features = useFeatures();
  // Opened from sign-up or the welcome step: Apply goes back there instead of opening a second copy.
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const x = hostsText(locale);
  const e = hostsEntryText(locale);
  const concierge = features.on.includes(HOST_FEATURES.concierge);
  const investment = features.on.includes(HOST_FEATURES.investment);

  if (features.isPending || features.error || (!concierge && !investment)) {
    return (
      <>
        <Stack.Title>{x.metaTitle}</Stack.Title>
        <ScreenState
          screen
          loading={features.isPending}
          error={features.error}
          onRetry={() => features.refetch()}
          empty
          emptyText={HOSTS_ENTRY_LINKS.closed[locale]}
          emptyAction={{ label: t.app.tabExplore, onPress: () => router.navigate('/') }}
        />
      </>
    );
  }

  const kinds = x.kinds.filter((k) => (k.id === 'concierge' ? concierge : investment));
  const role = profile.data?.role;
  const back = (screen: string) => from === screen && router.canGoBack();
  // Signed out: sign up as a guide. Signed in but the welcome step not finished: finish it as a guide.
  // A guide (or admin) carries on with the guide profile. Sign-up and the welcome step already chose
  // Guide before opening this screen, so going back to them is enough.
  // Other account types get a next step below: ask Kwetuly to get in touch.
  const apply = !session
    ? () => (back('sign-in') ? router.back() : router.push({ pathname: '/sign-in', params: { mode: 'join', role: 'guide' } }))
    : profile.data && !profile.data.onboarded_at
      ? () => (back('welcome') ? router.back() : router.replace({ pathname: '/welcome', params: { role: 'guide' } }))
    : role === 'guide' || role === 'admin'
      ? () => router.push('/profile-edit')
      : null;

  // The same "interest" list as the coming-soon pages; an admin reads it. Only this account's own name
  // and phone or email are sent, after the person taps the button.
  async function askContact() {
    const contact = profile.data?.phone ?? session?.user.email ?? '';
    const name = profile.data?.full_name ?? '';
    if (!contact || !name) return setMessage({ tone: 'error', text: t.auth.error });
    setBusy(true);
    setMessage(null);
    try {
      await registerInterest({
        section: 'partners',
        item: 'become-host',
        kind: role === 'provider' ? 'business' : 'traveler',
        name,
        contact,
        message: `Host sign-up: wants to apply (${kinds.map((k) => k.id).join(', ')}), signed in as ${role ?? 'unknown'}`,
        locale: locale === 'sw' ? 'sw' : 'en',
      });
      setMessage({ tone: 'ok', text: e.askContactSent });
    } catch {
      setMessage({ tone: 'error', text: t.auth.error });
    } finally {
      setBusy(false);
    }
  }

  const bullets = (lines: string[]) => lines.map((line) => <Text key={line} style={{ ...type.body, color: colors.label }}>• {line}</Text>);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: layout.screenX, gap: space.lg, paddingBottom: space.huge }}>
      <Stack.Title>{x.metaTitle}</Stack.Title>
      <Text style={{ ...type.cardTitle, color: colors.label }}>{x.title}</Text>
      <Muted>{x.intro}</Muted>

      <Card>
        <SectionTitle>{kinds.length > 1 ? x.kindsTitle : e.oneKindTitle}</SectionTitle>
        {kinds.map((k) => (
          <Text key={k.id} style={{ ...type.body, color: colors.label }}>
            <Text style={font.bold}>{k.name}. </Text>
            {k.body}
          </Text>
        ))}
      </Card>

      {concierge && (
        <Card>
          <SectionTitle>{e.conciergeTitle}</SectionTitle>
          {bullets(e.conciergeDoes)}
          <Text style={{ ...type.body, ...font.bold, color: colors.label }}>{e.conciergeNot}</Text>
        </Card>
      )}

      {/* The limits stand out in gold, like the website. */}
      <Card style={{ borderColor: brand.gold }}>
        <SectionTitle>{x.notOfferedTitle}</SectionTitle>
        {bullets(x.notOffered)}
      </Card>

      <Card>
        <SectionTitle>{x.howTitle}</SectionTitle>
        {x.how.map((line, i) => (
          <Text key={line} style={{ ...type.body, color: colors.label }}>
            {i + 1}. {line}
          </Text>
        ))}
        <Text style={{ ...type.body, color: colors.label }}>{e.serviceNote}</Text>
      </Card>

      <Card>
        <SectionTitle>{x.goodTitle}</SectionTitle>
        {bullets(x.good)}
      </Card>

      <Card>
        <SectionTitle>{x.conductTitle}</SectionTitle>
        {bullets(x.conduct)}
        <Muted>{x.draftNote}</Muted>
      </Card>

      {apply ? (
        <Card>
          <Button title={session && profile.data?.onboarded_at ? e.continueGuide : x.apply} onPress={apply} />
          {!session && <Muted>{x.applyNote}</Muted>}
        </Card>
      ) : (
        profile.data && (
          <Card>
            <Muted>{e.notGuide}</Muted>
            <FormMessage message={message} />
            {message?.tone !== 'ok' && <Button title={e.askContact} onPress={askContact} loading={busy} />}
          </Card>
        )
      )}
    </ScrollView>
  );
}
