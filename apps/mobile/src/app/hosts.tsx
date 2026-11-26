import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ScrollView, Text } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { HOST_FEATURES, HOSTS_ENTRY_LINKS, RATE_LIMIT_MESSAGE, hostsEntryText, hostsText, isFeatureOn, limitTexts } from '@kwetuly/shared';
import { Button, Card, FormMessage, Muted, ScreenState, SectionTitle } from '@/components/ui';
import { myInterestExists, registerInterest } from '@/lib/api-more';
import { useProfile, useSession } from '@/lib/auth';
import { useFeatures } from '@/lib/features';
import { useI18n } from '@/lib/i18n';
import { useType } from '@/lib/use-type';
import { brand, colors, layout, space } from '@/theme';

// "Please contact me" is stored as this interest row (the website uses the same values).
const HOST_CONTACT_SECTION = 'partners';
const HOST_CONTACT_ITEM = 'become-host';

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
  // "Please contact me" is sent once per account: the database says whether this account already sent
  // it (from the website or the app), so the button stays hidden on every phone and later visits.
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const sentKey = ['my-interest', userId, HOST_CONTACT_SECTION, HOST_CONTACT_ITEM] as const;
  const sent = useQuery({ queryKey: sentKey, queryFn: () => myInterestExists(HOST_CONTACT_SECTION, HOST_CONTACT_ITEM), enabled: !!userId });
  const alreadySent = sent.data === true;
  const [missing, setMissing] = useState(false);
  const x = hostsText(locale);
  const e = hostsEntryText(locale);
  const concierge = isFeatureOn(features.data ?? {}, HOST_FEATURES.concierge);
  const investment = isFeatureOn(features.data ?? {}, HOST_FEATURES.investment);

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
    // An empty phone falls back to the email.
    const contact = profile.data?.phone?.trim() || session?.user.email || '';
    const name = profile.data?.full_name?.trim() || '';
    if (alreadySent) return setMessage({ tone: 'ok', text: HOSTS_ENTRY_LINKS.askContactSent[locale] });
    if (!contact || !name) return setMissing(true);
    setBusy(true);
    setMessage(null);
    try {
      await registerInterest({
        section: HOST_CONTACT_SECTION,
        item: HOST_CONTACT_ITEM,
        kind: role === 'provider' ? 'business' : 'traveler',
        name,
        contact,
        message: `Host sign-up: wants to apply (${kinds.map((k) => k.id).join(', ')}), signed in as ${role ?? 'unknown'}`,
        locale: locale === 'sw' ? 'sw' : 'en',
      });
      setMessage({ tone: 'ok', text: HOSTS_ENTRY_LINKS.askContactSent[locale] });
      queryClient.setQueryData(sentKey, true);
    } catch (err) {
      // More than 5 requests an hour: the database refuses with 'rate_limited'.
      const busy = err instanceof Error && err.message === RATE_LIMIT_MESSAGE;
      setMessage({ tone: 'error', text: busy ? limitTexts(locale).tooMany : t.auth.error });
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
            <Muted>{HOSTS_ENTRY_LINKS.notGuide[locale]}</Muted>
            <FormMessage message={message} />
            {alreadySent && !message && <Muted>{HOSTS_ENTRY_LINKS.askContactSent[locale]}</Muted>}
            {/* No name or no phone/email on the account: say what to add and open the Account tab. */}
            {missing ? (
              <>
                <FormMessage message={{ tone: 'error', text: HOSTS_ENTRY_LINKS.missingDetails[locale] }} />
                <Button title={HOSTS_ENTRY_LINKS.openAccount[locale]} variant="outline" onPress={() => router.navigate('/account')} />
              </>
            ) : (
              message?.tone !== 'ok' && !alreadySent && !sent.isLoading && <Button title={HOSTS_ENTRY_LINKS.askContact[locale]} onPress={askContact} loading={busy} />
            )}
          </Card>
        )
      )}
    </ScrollView>
  );
}
