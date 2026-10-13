import { ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { LOCALES, LOCALE_NAMES } from '@rafrika/shared';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { Button, Card, Chip, Muted, SectionTitle } from '@/components/ui';
import { useProfile, useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { SITE_URL, supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';

export default function AccountScreen() {
  const { t, locale, setLocale } = useI18n();
  const { session } = useSession();
  const profile = useProfile();
  const role = profile.data?.role;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 40 }}>
      <Stack.Title large>{t.app.tabAccount}</Stack.Title>

      {session ? (
        <Card>
          <Muted>{t.app.signedInAs}</Muted>
          <Text selectable style={{ fontSize: 20, fontWeight: '800', color: colors.label }}>
            {profile.data?.full_name ?? session.user.email}
          </Text>
          <Text selectable style={{ color: colors.secondaryLabel }}>{session.user.email}</Text>
          {profile.data?.phone && <Text selectable style={{ color: colors.secondaryLabel }}>{profile.data.phone}</Text>}
          {role && role !== 'traveler' && (
            <>
              <Muted>{t.app.editOnWeb}</Muted>
              <Button title={t.nav.dashboard} variant="outline" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/${locale}/dashboard`)} />
            </>
          )}
          <Button title={t.nav.signOut} variant="dark" onPress={() => supabase.auth.signOut()} />
        </Card>
      ) : (
        <View style={{ marginHorizontal: -16 }}>
          <SignInPrompt />
        </View>
      )}

      <View style={{ gap: 10 }}>
        <SectionTitle>{t.app.language}</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {LOCALES.map((l) => (
            <Chip key={l} label={LOCALE_NAMES[l]} active={l === locale} onPress={() => setLocale(l)} />
          ))}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Button title={t.app.website} variant="outline" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/${locale}`)} />
        <Button title={t.moments.title} variant="outline" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/${locale}/moments`)} />
        <Button title={t.partners.title} variant="outline" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/${locale}/partners/agents`)} />
      </View>
    </ScrollView>
  );
}
