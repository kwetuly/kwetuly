import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Avatar, Badge, BottomBar, Button, Card, Muted, ScreenState, SectionTitle, Stars } from '@/components/ui';
import { getGuide, listReviews, openConversation } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { expertiseOf, languageName, specialtyName } from '@/lib/labels';
import { shareLink } from '@/lib/share';
import { GuideChecksCard, useCheckLabels } from '@/components/guide-checks';

import { EVENTS, formatUsd } from '@rafrika/shared';
import { track } from '@/lib/analytics';
import { brand, colors, space, textSize } from '@/theme';

function Facts({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View style={{ gap: space.sm }}>
      <Text style={{ fontWeight: '700', color: colors.secondaryLabel, fontSize: textSize.footnote }}>{title}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
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
  const { session } = useSession();
  const guide = useQuery({ queryKey: ['guide', slug], queryFn: () => getGuide(slug) });
  const reviews = useQuery({ queryKey: ['reviews', guide.data?.id], queryFn: () => listReviews(guide.data!.id), enabled: !!guide.data });
  const [opening, setOpening] = useState(false);
  const guideSlug = guide.data?.slug;
  useEffect(() => {
    if (guideSlug) track(EVENTS.guideViewed, { guide: guideSlug, locale });
  }, [guideSlug, locale]);
  const checkLabels = useCheckLabels(guide.data ?? { identity_checked_at: null, licence_checked_at: null, first_aid_checked_at: null, first_aid_valid_until: null });

  if (!guide.data) {
    return <ScreenState loading={guide.isLoading} error={guide.error} onRetry={() => guide.refetch()} empty emptyText={t.guides.empty} />;
  }
  const g = guide.data;
  const isMe = session?.user.id === g.owner_id;

  async function message() {
    if (!session) return router.push('/sign-in');
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }}>
      <Stack.Title>{g.display_name}</Stack.Title>

      <Card>
        <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
          <Avatar name={g.display_name} uri={g.photo_url} size={88} />
          <View style={{ flex: 1, gap: space.xs }}>
            <Text style={{ fontSize: textSize.title2, fontWeight: '800', color: colors.label }}>{g.display_name}</Text>
            {g.headline && <Muted>{g.headline}</Muted>}
            {g.rating_count > 0 && g.rating_avg != null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Stars value={g.rating_avg} />
                <Text style={{ fontWeight: '700', color: colors.label }}>{Number(g.rating_avg).toFixed(1)}</Text>
                <Text style={{ color: colors.secondaryLabel }}>({g.rating_count})</Text>
              </View>
            )}
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <Badge label={`✓ ${t.guides.verified}`} />
          {checkLabels.map((label) => <Badge key={label} label={`✓ ${label}`} />)}
          {g.female_guide && <Badge label={t.guides.female} tone="sand" />}
          {g.open_to_partners && <Badge label={t.guides.partners} tone="night" />}
          {g.plan === 'pro' && <Badge label={t.guides.pro} tone="gold" />}
        </View>
        <Muted>
          {[g.years_experience != null && `${g.years_experience} ${t.guides.years}`, g.summits ? `${g.summits} ${t.guides.summits}` : null, `${t.guides.groupUpTo} ${g.max_group_size}`]
            .filter(Boolean)
            .join(' · ')}
        </Muted>
        {!isMe && g.call_enabled && (
          <Button title={`${t.calls.book}${g.call_price_usd != null ? ` · ${formatUsd(g.call_price_usd)}` : ''}`} variant="dark" onPress={() => router.push({ pathname: '/call/[guideId]', params: { guideId: g.id, slug: g.slug } })} />
        )}
        {!isMe && <Button title={t.profile.contactTitle} variant="outline" onPress={() => {
          track(EVENTS.enquiryStarted, { kind: 'guide', guide: g.slug, locale });
          router.push({ pathname: '/contact/[guideId]', params: { guideId: g.id, name: g.display_name } });
        }} />}
        <Button title={t.share.share} variant="outline" onPress={() => shareLink(`/${locale}/guides/${g.slug}`, `${t.share.shareGuide}: ${g.display_name}`)} />
      </Card>

      <GuideChecksCard guide={g} />

      {g.bio && (
        <Card>
          <SectionTitle>{t.profile.about}</SectionTitle>
          <Text selectable style={{ color: colors.label, fontSize: textSize.callout, lineHeight: 22 }}>{g.bio}</Text>
        </Card>
      )}

      <Card>
        <Facts title={t.profile.specialties} items={g.specialties.map((s) => specialtyName(s, locale))} />
        <Facts title={t.guides.languages} items={g.languages.map(languageName)} />
        <Facts title={t.profile.expertise} items={expertiseOf(g.expertise).map((e) => e.label[locale])} />
        <Facts title={t.profile.regions} items={[g.base_region, ...g.regions.filter((r) => r !== g.base_region)]} />
        <Facts title={t.profile.certifications} items={[...g.certifications, ...(g.association ? [g.association] : [])]} />
      </Card>

      <View style={{ gap: space.md }}>
        <SectionTitle>{t.reviews.title}</SectionTitle>
        <ScreenState loading={reviews.isLoading} error={reviews.error} onRetry={() => reviews.refetch()} empty={reviews.data?.length === 0} emptyText={t.reviews.none} />
        {(reviews.data ?? []).map((r) => (
          <Card key={r.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Stars value={r.rating} />
              <Text style={{ color: colors.secondaryLabel, fontSize: textSize.caption }}>{dateFormat.format(new Date(r.created_at))}</Text>
            </View>
            <Text selectable style={{ color: colors.label, lineHeight: 21 }}>{r.body}</Text>
            <Text style={{ fontWeight: '700', color: colors.label }}>— {r.author_name}</Text>
          </Card>
        ))}
        {session && !isMe ? (
          <Button title={t.reviews.write} variant="outline" onPress={() => router.push({ pathname: '/review/[guideId]', params: { guideId: g.id, name: g.display_name } })} />
        ) : (
          <Text style={{ color: brand.forest, fontSize: textSize.footnote }}>{t.reviews.onlyAfter}</Text>
        )}
      </View>
    </ScrollView>
    {!isMe && (
      <BottomBar>
        <Button title={t.profile.askName.replace('{name}', g.display_name)} onPress={message} loading={opening} />
      </BottomBar>
    )}
    </View>
  );
}
