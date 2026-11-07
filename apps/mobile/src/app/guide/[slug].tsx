import { useEffect, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { GLYPHS } from '@/components/glyph';
import { Avatar, Badge, BottomBar, Button, Card, HeaderIconButton, ScreenState, Section, SectionTitle, SkeletonCard, StatRow, Stars, contentFadeIn } from '@/components/ui';
import { getGuide, listReviews, openConversation } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useNeedsSetup, welcomeHref } from '@/lib/onboarding';
import { expertiseOf, languageName, specialtyName } from '@/lib/labels';
import { shareLink } from '@/lib/share';
import { GuideChecksCard, useCheckLabels } from '@/components/guide-checks';
import { GuidePackages } from '@/components/guide-packages';
import { PhotoCredits } from '@/components/sample-offer';
import { getGuidePackages } from '@/lib/packages';

import { EVENTS, formatUsd, hasRecordedCheck } from '@kwetuly/shared';
import { track } from '@/lib/analytics';
import { brand, colors, font, layout, space, textSize, type } from '@/theme';

function Facts({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View style={{ gap: space.sm }}>
      <Text style={type.label}>{title}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: layout.inlineGap }}>
        {items.map((item) => (
          <Badge key={item} label={item} />
        ))}
      </View>
    </View>
  );
}

export default function GuideScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, locale } = useI18n();
  const { width } = useWindowDimensions();
  const { session } = useSession();
  const guide = useQuery({ queryKey: ['guide', slug], queryFn: () => getGuide(slug) });
  const packages = useQuery({ queryKey: ['guide-packages', guide.data?.id], queryFn: () => getGuidePackages(guide.data!.id), enabled: !!guide.data });
  const reviews = useQuery({ queryKey: ['reviews', guide.data?.id], queryFn: () => listReviews(guide.data!.id), enabled: !!guide.data });
  const [opening, setOpening] = useState(false);
  const guideSlug = guide.data?.slug;
  useEffect(() => {
    if (guideSlug) track(EVENTS.guideViewed, { guide: guideSlug, locale });
  }, [guideSlug, locale]);
  const checkLabels = useCheckLabels(guide.data ?? { identity_checked_at: null, licence_checked_at: null, first_aid_checked_at: null, first_aid_valid_until: null });

  const needsSetup = useNeedsSetup();
  if (!guide.data) {
    return <ScreenState screen loading={guide.isLoading} error={guide.error} onRetry={() => guide.refetch()} empty emptyText={t.guides.empty} />;
  }
  const g = guide.data;
  const isMe = session?.user.id === g.owner_id;

  async function message() {
    if (!session) return router.push('/sign-in');
    if (needsSetup) return router.push(welcomeHref(`/guide/${g.slug}`));
    track(EVENTS.enquiryStarted, { kind: 'message', guide: g.slug, locale });
    setOpening(true);
    try {
      const id = await openConversation(g.id, session.user.id);
      router.push(`/conversation/${id}`);
    } finally {
      setOpening(false);
    }
  }

  const dateFormat = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });

  const callPrice = g.call_price_usd != null ? formatUsd(g.call_price_usd) : null;
  // The price goes on its own line under the label (no "A · B" joins).
  const callTitle = callPrice ? `${t.calls.book}\n${callPrice}` : t.calls.book;
  // Two buttons side by side only when they fit without cutting words; otherwise one under the other.
  const sideBySide = width >= 414 && t.calls.book.length <= 16 && t.profile.contactTitle.length <= 16;
  const stats = [
    g.years_experience != null ? { value: String(g.years_experience), label: t.guides.years } : null,
    g.summits ? { value: String(g.summits), label: t.guides.summits } : null,
    g.max_group_size ? { value: String(g.max_group_size), label: t.guides.groupUpTo } : null,
  ].filter((x): x is { value: string; label: string } => !!x);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: layout.screenX, paddingBottom: layout.sectionGap }}>
      <Stack.Title>{g.display_name}</Stack.Title>
      <HeaderIconButton glyph={GLYPHS.share} accessibilityLabel={t.share.share} onPress={() => shareLink(`/${locale}/guides/${g.slug}`, `${t.share.shareGuide}: ${g.display_name}`)} />

      <Animated.View entering={contentFadeIn} style={{ gap: space.lg }}>
      <Card>
        <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
          <Avatar name={g.display_name} uri={g.photo_url} size={88} />
          <View style={{ flex: 1, gap: space.xs }}>
            <Text accessibilityRole="header" style={type.title2}>{g.display_name}</Text>
            {g.headline && <Text style={{ ...type.callout, color: colors.secondaryLabel }}>{g.headline}</Text>}
            {g.rating_count > 0 && g.rating_avg != null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Stars value={g.rating_avg} />
                <Text style={{ ...font.bold, fontSize: textSize.callout, color: colors.label, fontVariant: ['tabular-nums'] }}>{Number(g.rating_avg).toFixed(1)}</Text>
                <Text style={type.meta}>({g.rating_count})</Text>
              </View>
            )}
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: layout.inlineGap }}>
          {g.is_sample ? (
            <Badge label={t.extras.sampleGuide} tone="sand" />
          ) : hasRecordedCheck(g) ? (
            <Badge label={t.guides.verified} icon={GLYPHS.check} />
          ) : g.verification_status === 'approved' ? (
            <Badge label={t.extras.approvedGuide} tone="sand" />
          ) : null}
          {checkLabels.map((label) => <Badge key={label} label={label} icon={GLYPHS.check} />)}
          {g.female_guide && <Badge label={t.guides.female} tone="sand" />}
          {g.open_to_partners && <Badge label={t.guides.partners} tone="neutral" />}
          {g.plan === 'pro' && <Badge label={t.guides.pro} tone="gold" />}
        </View>
        <StatRow items={stats} />
        {(g.years_experience != null || !!g.summits) && <Text style={type.caption}>{t.extras.ownFigures}</Text>}
        {!isMe && (
          <View style={{ flexDirection: sideBySide ? 'row' : 'column', gap: space.sm }}>
            {g.call_enabled && (
              <Button
                title={callTitle}
                accessibilityLabel={callPrice ? `${t.calls.book}, ${callPrice}` : t.calls.book}
                variant="outline"
                size="md"
                style={sideBySide ? { flex: 1 } : undefined}
                onPress={() => router.push({ pathname: '/call/[guideId]', params: { guideId: g.id, slug: g.slug } })}
              />
            )}
            <Button
              title={t.profile.contactTitle}
              variant="outline"
              size="md"
              style={sideBySide ? { flex: 1 } : undefined}
              onPress={() => {
                track(EVENTS.enquiryStarted, { kind: 'guide', guide: g.slug, locale });
                router.push({ pathname: '/contact/[guideId]', params: { guideId: g.id, name: g.display_name, sample: g.is_sample ? '1' : '' } });
              }}
            />
          </View>
        )}
      </Card>

      <GuideChecksCard guide={g} approved={g.verification_status === 'approved' && !g.is_sample} />

      {g.bio && (
        <Card>
          <SectionTitle>{t.profile.about}</SectionTitle>
          <Text selectable style={type.callout}>{g.bio}</Text>
        </Card>
      )}

      <GuidePackages packages={packages.data ?? []} guideId={g.id} guideName={g.display_name} guideSlug={g.slug} sample={g.is_sample} />
      {g.is_sample && <PhotoCredits urls={[g.photo_url, ...(packages.data ?? []).map((p) => p.photo_url)]} />}

      <Card style={{ gap: space.lg }}>
        <Facts title={t.profile.specialties} items={g.specialties.map((s) => specialtyName(s, locale))} />
        <Facts title={t.guides.languages} items={g.languages.map(languageName)} />
        <Facts title={t.profile.expertise} items={expertiseOf(g.expertise).map((e) => e.label[locale])} />
        <Facts title={t.profile.regions} items={[g.base_region, ...g.regions.filter((r) => r !== g.base_region)]} />
        <Facts title={t.profile.certifications} items={[...g.certifications, ...(g.association ? [g.association] : [])]} />
      </Card>

      <Section title={t.reviews.title} style={{ marginTop: space.lg }}>
        {reviews.isLoading ? (
          <View accessibilityRole="progressbar" accessibilityState={{ busy: true }} style={{ gap: layout.listGap }}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : (
          <ScreenState error={reviews.error} onRetry={() => reviews.refetch()} empty={reviews.data?.length === 0} emptyText={t.reviews.none} emptyGlyph={GLYPHS.chat} />
        )}
        {(reviews.data ?? []).map((r) => (
          <Card key={r.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Stars value={r.rating} />
              <Text style={type.caption}>{dateFormat.format(new Date(r.created_at))}</Text>
            </View>
            <Text selectable style={type.callout}>{r.body}</Text>
            <Text style={type.label}>— {r.author_name}</Text>
          </Card>
        ))}
        {session && !isMe ? (
          <View style={{ alignItems: 'flex-start' }}>
            <Button title={t.reviews.write} variant="text" size="md" onPress={() => router.push({ pathname: '/review/[guideId]', params: { guideId: g.id, name: g.display_name } })} />
          </View>
        ) : (
          <Text style={{ ...type.meta, color: brand.forest }}>{t.reviews.onlyAfter}</Text>
        )}
      </Section>
      </Animated.View>
    </ScrollView>
    {!isMe && (
      <BottomBar>
        <Button title={t.profile.askName.replace('{name}', g.display_name)} onPress={message} loading={opening} />
      </BottomBar>
    )}
    </View>
  );
}
