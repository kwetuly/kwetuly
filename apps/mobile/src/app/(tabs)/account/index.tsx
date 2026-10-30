import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, router, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { openExternal } from '@/lib/open-external';
import { useQuery } from '@tanstack/react-query';
import { CALL_TOPICS, LOCALES, LOCALE_NAMES } from '@kwetuly/shared';
import { ConnectedSignIns } from '@/components/connected-sign-ins';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { Badge, Button, Card, Chip, Muted, SectionTitle } from '@/components/ui';
import { useCanOffer } from '@/hooks/use-can-offer';
import { getMyGuide, listMyCalls } from '@/lib/api-more';
import { useProfile, useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { welcomeHref } from '@/lib/onboarding';
import { registerForPush, signOut, type PushState } from '@/lib/push';
import { SITE_URL } from '@/lib/supabase';
import { brand, colors, space, textSize } from '@/theme';

export default function AccountScreen() {
  const { t, locale, setLocale } = useI18n();
  const { session } = useSession();
  const userId = session?.user.id;
  const profile = useProfile();
  const role = profile.data?.role;
  const guide = useQuery({ queryKey: ['my-guide', userId], queryFn: () => getMyGuide(userId!), enabled: !!userId });
  const calls = useQuery({ queryKey: ['my-calls', userId], queryFn: () => listMyCalls(userId!), enabled: !!userId });
  const myGuide = guide.data?.guide;
  // Anyone who owns an approved listing gets the business tools, whatever account type they picked.
  const { approvedBusiness } = useCanOffer();
  const isBusiness = role === 'provider' || role === 'admin' || approvedBusiness;
  const canOffer = isBusiness || myGuide?.verification_status === 'approved';
  const [push, setPush] = useState<PushState | null>(null);

  useEffect(() => {
    if (userId) registerForPush(false).then(setPush);
  }, [userId]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: space.xxxl }}>
      <Stack.Title large>{t.app.tabAccount}</Stack.Title>

      {session ? (
        <>
          <Card>
            <Muted>{t.app.signedInAs}</Muted>
            <Text selectable style={{ fontSize: textSize.title3, fontWeight: '800', color: colors.label }}>
              {profile.data?.full_name ?? session.user.email}
            </Text>
            <Text selectable style={{ color: colors.secondaryLabel }}>{session.user.email}</Text>
            {profile.data?.phone && <Text selectable style={{ color: colors.secondaryLabel }}>{profile.data.phone}</Text>}
            {profile.data && !profile.data.onboarded_at && <Button title={t.auth.finishSetup} onPress={() => router.push('/welcome')} />}
          </Card>

          {/* Guides */}
          {(myGuide || role === 'guide') && (
            <Card>
              <SectionTitle>{t.nav.hub}</SectionTitle>
              {myGuide && (
                <Badge
                  label={myGuide.verification_status === 'approved' ? t.dashboard.statusApproved : myGuide.verification_status === 'rejected' ? t.dashboard.statusRejected : t.dashboard.statusPending}
                  tone={myGuide.verification_status === 'approved' ? 'mint' : 'sand'}
                />
              )}
              {myGuide?.verification_status === 'approved' && <Button title={t.nav.hub} onPress={() => router.push('/hub' as Href)} />}
              <Button title={t.dashboard.title} variant="outline" onPress={() => router.push('/profile-edit')} />
              {myGuide?.verification_status === 'approved' && (
                <Button title={t.dashboard.viewProfile} variant="outline" onPress={() => router.push({ pathname: '/guide/[slug]', params: { slug: myGuide.slug } })} />
              )}
            </Card>
          )}

          {/* Businesses */}
          {isBusiness && (
            <Card>
              <SectionTitle>{t.join.provider.title}</SectionTitle>
              <Button title={t.business.dashboardTitle} onPress={() => router.push('/my-business')} />
              <Button title={t.jobs.postNew} variant="outline" onPress={() => router.push('/jobs-post')} />
              <Button title={t.jobs.handoverTab} variant="dark" onPress={() => router.push({ pathname: '/jobs-post', params: { kind: 'handover' } })} />
              <Button title={t.groups.start} variant="outline" onPress={() => router.push('/group-trip/new')} />
              <Button title={t.partners.applyTitle} variant="outline" onPress={() => router.push('/partners')} />
            </Card>
          )}

          {/* Trip requests: travellers post them; guides and companies answer with offers. */}
          <Card>
            <SectionTitle>{t.requests.title}</SectionTitle>
            <Button title={t.requests.post} onPress={() => router.push('/request/new')} />
            <Button title={canOffer ? `${t.requests.mine} · ${t.offers.boardTitle}` : t.requests.mine} variant="outline" onPress={() => router.push('/requests')} />
          </Card>

          {/* Phone alerts */}
          {push !== 'unavailable' && push !== null && (
            <Card>
              <SectionTitle>{t.alerts.notifications}</SectionTitle>
              {push === 'on' ? (
                <Text style={{ color: brand.forest, fontWeight: '700' }}>✓ {t.alerts.notificationsOn}</Text>
              ) : (
                <>
                  <Muted>{push === 'denied' ? t.alerts.denied : t.alerts.enableBody}</Muted>
                  {push === 'off' && <Button title={t.alerts.enable} onPress={() => registerForPush(true).then(setPush)} />}
                </>
              )}
            </Card>
          )}

          {/* Everyone: trips and prep calls */}
          <Card>
            <SectionTitle>{t.traveler.title}</SectionTitle>
            <Button title={t.groups.mine} variant="outline" onPress={() => router.push('/my-group-trips')} />
            <Text style={{ fontWeight: '700', color: colors.label }}>{t.traveler.calls}</Text>
            {calls.data?.length === 0 && <Muted>{t.traveler.noCalls}</Muted>}
            {(calls.data ?? []).map((c) => (
              <View key={c.id} style={{ gap: space.xxs, paddingVertical: space.xs }}>
                <Text style={{ fontWeight: '700', color: colors.label }}>
                  {CALL_TOPICS.find((x) => x.id === c.topic)?.[locale] ?? c.topic} · {c.guides?.display_name}
                </Text>
                <Muted>
                  {t.hub.status[c.status as keyof typeof t.hub.status] ?? c.status}
                  {c.scheduled_at ? ` · ${new Date(c.scheduled_at).toLocaleString(locale)}` : ''}
                </Muted>
                {c.status === 'accepted' && c.meeting_link && (
                  <Text style={{ color: brand.leafDark, fontWeight: '700' }} onPress={() => openExternal(c.meeting_link, { inApp: true })}>
                    {t.traveler.joinCall}
                  </Text>
                )}
              </View>
            ))}
            <Button title={t.traveler.findCall} variant="outline" onPress={() => router.push('/calls')} />
            {!myGuide && role !== 'guide' && (
              <Text
                accessibilityRole="link"
                style={{ color: brand.forest, fontWeight: '700' }}
                // Unfinished accounts cannot save a guide profile or upload a photo yet: finish the welcome step as a guide first.
                onPress={() => router.push(profile.data && !profile.data.onboarded_at ? welcomeHref('/profile-edit', 'guide') : '/profile-edit')}
              >
                {t.traveler.becomeGuide}
              </Text>
            )}
          </Card>

          <ConnectedSignIns />

          <Button title={t.ux.securityLink} variant="outline" onPress={() => router.push('/security')} />
          <Button title={t.nav.signOut} variant="dark" onPress={signOut} />
          <Text accessibilityRole="link" onPress={() => router.push('/delete-account')} style={{ color: brand.danger, fontWeight: '700', textAlign: 'center', paddingVertical: space.md }}>
            {t.ux.deleteTitle}
          </Text>
        </>
      ) : (
        <View style={{ marginHorizontal: -16 }}>
          <SignInPrompt />
        </View>
      )}

      <View style={{ gap: space.md }}>
        <SectionTitle>{t.app.language}</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {LOCALES.map((l) => (
            <Chip key={l} label={LOCALE_NAMES[l]} active={l === locale} onPress={() => setLocale(l)} />
          ))}
        </View>
      </View>

      <View style={{ gap: space.md }}>
        <Button title={t.moments.title} variant="outline" onPress={() => router.push('/moments')} />
        <Button title={t.partners.title} variant="outline" onPress={() => router.push('/partners')} />
        <Button title={t.app.website} variant="outline" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/${locale}`)} />
      </View>
    </ScrollView>
  );
}
