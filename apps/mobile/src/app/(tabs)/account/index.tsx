import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, router, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { openExternal } from '@/lib/open-external';
import { useQuery } from '@tanstack/react-query';
import { CALL_TOPICS, LOCALES, LOCALE_NAMES } from '@kwetuly/shared';
import { ConnectedSignIns } from '@/components/connected-sign-ins';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { GLYPHS } from '@/components/glyph';
import { Badge, Button, Card, Chip, IconSquare, ListGroup, ListRow, MetaItems, Muted, Section } from '@/components/ui';
import { useCanOffer } from '@/hooks/use-can-offer';
import { getMyGuide, listMyCalls } from '@/lib/api-more';
import { useProfile, useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { welcomeHref } from '@/lib/onboarding';
import { registerForPush, signOut, type PushState } from '@/lib/push';
import { SITE_URL } from '@/lib/supabase';
import { useType } from '@/lib/use-type';
import { brand, colors, layout, space } from '@/theme';

export default function AccountScreen() {
  const { t, locale, setLocale } = useI18n();
  const { type, font } = useType();
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

  // The one filled button: finish setup, when the account is not set up yet. Everything else is a row.
  const needsFinish = !!profile.data && !profile.data.onboarded_at;
  const approvedGuide = myGuide?.verification_status === 'approved';

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: layout.screenX, gap: layout.sectionGap, paddingBottom: space.xxxl }}>
      <Stack.Title large>{t.app.tabAccount}</Stack.Title>

      {session ? (
        <>
          <Card>
            <Muted>{t.app.signedInAs}</Muted>
            <Text selectable style={type.title3}>
              {profile.data?.full_name ?? session.user.email}
            </Text>
            <MetaItems selectable items={[session.user.email, profile.data?.phone]} />
            {needsFinish && <Button title={t.auth.finishSetup} onPress={() => router.push('/welcome')} />}
          </Card>

          {/* Guides */}
          {(myGuide || role === 'guide') && (
            <Section title={t.nav.hub}>
              {myGuide && (
                <Badge
                  label={myGuide.verification_status === 'approved' ? t.dashboard.statusApproved : myGuide.verification_status === 'rejected' ? t.dashboard.statusRejected : t.dashboard.statusPending}
                  tone={myGuide.verification_status === 'approved' ? 'mint' : 'sand'}
                />
              )}
              <ListGroup>
                {approvedGuide && <ListRow icon={GLYPHS.hub} title={t.nav.hub} onPress={() => router.push('/hub' as Href)} />}
                <ListRow icon={GLYPHS.profile} title={t.dashboard.title} onPress={() => router.push('/profile-edit')} />
                {approvedGuide && myGuide && (
                  <ListRow icon={GLYPHS.view} title={t.dashboard.viewProfile} onPress={() => router.push({ pathname: '/guide/[slug]', params: { slug: myGuide.slug } })} />
                )}
              </ListGroup>
            </Section>
          )}

          {/* Businesses */}
          {isBusiness && (
            <Section title={t.join.provider.title}>
              <ListGroup>
                <ListRow icon={GLYPHS.store} title={t.business.dashboardTitle} onPress={() => router.push('/my-business')} />
                <ListRow icon={GLYPHS.briefcase} title={t.jobs.postNew} onPress={() => router.push('/jobs-post')} />
                <ListRow icon={GLYPHS.people} title={t.jobs.handoverTab} onPress={() => router.push({ pathname: '/jobs-post', params: { kind: 'handover' } })} />
                <ListRow icon={GLYPHS.calendarAdd} title={t.groups.start} onPress={() => router.push('/group-trip/new')} />
                <ListRow icon={GLYPHS.handshake} title={t.partners.applyTitle} onPress={() => router.push('/partners')} />
              </ListGroup>
            </Section>
          )}

          {/* Trip requests: travellers post them; guides and companies answer with offers. */}
          <Section title={t.requests.title}>
            <ListGroup>
              <ListRow icon={GLYPHS.write} title={t.requests.post} onPress={() => router.push('/request/new')} />
              <ListRow icon={GLYPHS.list} title={t.requests.mine} subtitle={canOffer ? t.offers.boardTitle : undefined} onPress={() => router.push('/requests')} />
            </ListGroup>
          </Section>

          {/* Phone alerts */}
          {push !== 'unavailable' && push !== null && (
            <Section title={t.alerts.notifications}>
              <Card>
                {push === 'on' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                    <IconSquare glyph={GLYPHS.check} />
                    <Text style={{ ...type.body, ...font.semibold, color: brand.forest, flex: 1 }}>{t.alerts.notificationsOn}</Text>
                  </View>
                ) : (
                  <>
                    <Muted>{push === 'denied' ? t.alerts.denied : t.alerts.enableBody}</Muted>
                    {push === 'off' && <Button title={t.alerts.enable} variant="outline" size="md" icon={GLYPHS.bell} onPress={() => registerForPush(true).then(setPush)} />}
                  </>
                )}
              </Card>
            </Section>
          )}

          {/* Everyone: trips and prep calls */}
          <Section title={t.traveler.title}>
            <ListGroup>
              <ListRow icon={GLYPHS.calendar} title={t.groups.mine} onPress={() => router.push('/my-group-trips')} />
              <ListRow icon={GLYPHS.video} title={t.traveler.findCall} onPress={() => router.push('/calls')} />
              {!myGuide && role !== 'guide' && (
                <ListRow
                  icon={GLYPHS.hiking}
                  title={t.traveler.becomeGuide}
                  accessibilityRole="link"
                  // Unfinished accounts cannot save a guide profile or upload a photo yet: finish the welcome step as a guide first.
                  onPress={() => router.push(profile.data && !profile.data.onboarded_at ? welcomeHref('/profile-edit', 'guide') : '/profile-edit')}
                />
              )}
            </ListGroup>
            <Card>
              <Text accessibilityRole="header" style={type.label}>{t.traveler.calls}</Text>
              {calls.data?.length === 0 && <Muted>{t.traveler.noCalls}</Muted>}
              {(calls.data ?? []).map((c, i) => (
                <View key={c.id} style={{ gap: space.xxs, paddingTop: i ? space.md : 0, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                  <Text style={{ ...type.body, ...font.bold }}>{CALL_TOPICS.find((x) => x.id === c.topic)?.[locale] ?? c.topic}</Text>
                  <MetaItems
                    items={[c.guides?.display_name, t.hub.status[c.status as keyof typeof t.hub.status] ?? c.status, c.scheduled_at ? new Date(c.scheduled_at).toLocaleString(locale) : null]}
                  />
                  {c.status === 'accepted' && c.meeting_link && (
                    <View style={{ alignItems: 'flex-start' }}>
                      <Button title={t.traveler.joinCall} variant="text" size="md" icon={GLYPHS.video} onPress={() => openExternal(c.meeting_link, { inApp: true })} />
                    </View>
                  )}
                </View>
              ))}
            </Card>
          </Section>

          <ConnectedSignIns />

          <ListGroup>
            <ListRow icon={GLYPHS.lock} title={t.ux.securityLink} onPress={() => router.push('/security')} />
            <ListRow icon={GLYPHS.power} title={t.nav.signOut} onPress={signOut} />
          </ListGroup>
          <View style={{ alignItems: 'center', marginTop: -space.lg }}>
            <Button title={t.ux.deleteTitle} variant="danger" size="md" onPress={() => router.push('/delete-account')} />
          </View>
        </>
      ) : (
        <View style={{ marginHorizontal: -layout.screenX }}>
          <SignInPrompt />
        </View>
      )}

      <Section title={t.app.language}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: layout.inlineGap }}>
          {LOCALES.map((l) => (
            <Chip key={l} label={LOCALE_NAMES[l]} active={l === locale} onPress={() => setLocale(l)} />
          ))}
        </View>
      </Section>

      <ListGroup>
        <ListRow icon={GLYPHS.photos} title={t.moments.title} onPress={() => router.push('/moments')} />
        <ListRow icon={GLYPHS.handshake} title={t.partners.title} onPress={() => router.push('/partners')} />
        <ListRow icon={GLYPHS.globe} title={t.app.website} accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/${locale}`)} />
      </ListGroup>
    </ScrollView>
  );
}
