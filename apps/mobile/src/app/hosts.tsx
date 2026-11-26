import { ScrollView, Text } from 'react-native';
import { Stack, router } from 'expo-router';
import { HOST_FEATURES, HOSTS_ENTRY_LINKS, hostsEntryText, hostsText } from '@kwetuly/shared';
import { Button, Card, Muted, ScreenState, SectionTitle } from '@/components/ui';
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
  // Signed out: sign up as a guide. A guide (or admin) carries on with the guide profile. Other account
  // types are told that hosts apply with a guide account.
  // Signed in but the welcome step not finished yet: finish it as a guide.
  const apply = !session
    ? () => router.push({ pathname: '/sign-in', params: { mode: 'join', role: 'guide' } })
    : profile.data && !profile.data.onboarded_at
      ? () => router.replace({ pathname: '/welcome', params: { role: 'guide' } })
    : role === 'guide' || role === 'admin'
      ? () => router.push('/profile-edit')
      : null;

  const bullets = (lines: string[]) => lines.map((line) => <Text key={line} style={{ ...type.body, color: colors.label }}>• {line}</Text>);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: layout.screenX, gap: space.lg, paddingBottom: space.huge }}>
      <Stack.Title>{x.metaTitle}</Stack.Title>
      <Text style={{ ...type.cardTitle, color: colors.label }}>{x.title}</Text>
      <Muted>{x.intro}</Muted>

      <Card>
        <SectionTitle>{x.kindsTitle}</SectionTitle>
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
        profile.data && <Muted>{e.notGuide}</Muted>
      )}
    </ScrollView>
  );
}
