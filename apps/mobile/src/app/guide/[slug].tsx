import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Avatar, Badge, Button, Card, Muted, ScreenState, SectionTitle, Stars } from '@/components/ui';
import { getGuide, listReviews, openConversation } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { expertiseOf, languageName, specialtyName } from '@/lib/labels';
import { shareLink } from '@/lib/share';
import { brand, colors } from '@/theme/colors';

function Facts({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontWeight: '700', color: colors.secondaryLabel, fontSize: 13 }}>{title}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
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

  if (!guide.data) {
    return <ScreenState loading={guide.isLoading} error={guide.error} empty emptyText={t.guides.empty} />;
  }
  const g = guide.data;
  const isMe = session?.user.id === g.owner_id;

  async function message() {
    if (!session) return router.push('/sign-in');
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
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
      <Stack.Title>{g.display_name}</Stack.Title>

      <Card>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Avatar name={g.display_name} uri={g.photo_url} size={88} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.label }}>{g.display_name}</Text>
            {g.headline && <Muted>{g.headline}</Muted>}
            {g.rating_count > 0 && g.rating_avg != null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Stars value={g.rating_avg} />
                <Text style={{ fontWeight: '700', color: colors.label }}>{Number(g.rating_avg).toFixed(1)}</Text>
                <Text style={{ color: colors.secondaryLabel }}>({g.rating_count})</Text>
              </View>
            )}
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Badge label={`✓ ${t.guides.verified}`} />
          {g.female_guide && <Badge label={t.guides.female} tone="sand" />}
          {g.open_to_partners && <Badge label={t.guides.partners} tone="night" />}
          {g.plan === 'pro' && <Badge label={t.guides.pro} tone="gold" />}
        </View>
        <Muted>
          {[g.years_experience != null && `${g.years_experience} ${t.guides.years}`, g.summits ? `${g.summits} ${t.guides.summits}` : null, `${t.guides.groupUpTo} ${g.max_group_size}`]
            .filter(Boolean)
            .join(' · ')}
        </Muted>
        {!isMe && <Button title={t.messages.messageGuide} onPress={message} loading={opening} />}
        <Button title={t.share.share} variant="outline" onPress={() => shareLink(`/${locale}/guides/${g.slug}`, `${t.share.shareGuide}: ${g.display_name}`)} />
      </Card>

      {g.bio && (
        <Card>
          <SectionTitle>{t.profile.about}</SectionTitle>
          <Text selectable style={{ color: colors.label, fontSize: 15, lineHeight: 22 }}>{g.bio}</Text>
        </Card>
      )}

      <Card>
        <Facts title={t.profile.specialties} items={g.specialties.map((s) => specialtyName(s, locale))} />
        <Facts title={t.guides.languages} items={g.languages.map(languageName)} />
        <Facts title={t.profile.expertise} items={expertiseOf(g.expertise).map((e) => e.label[locale])} />
        <Facts title={t.profile.regions} items={[g.base_region, ...g.regions.filter((r) => r !== g.base_region)]} />
        <Facts title={t.profile.certifications} items={[...g.certifications, ...(g.association ? [g.association] : [])]} />
      </Card>

      <View style={{ gap: 10 }}>
        <SectionTitle>{t.reviews.title}</SectionTitle>
        <ScreenState loading={reviews.isLoading} error={reviews.error} empty={reviews.data?.length === 0} emptyText={t.reviews.none} />
        {(reviews.data ?? []).map((r) => (
          <Card key={r.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Stars value={r.rating} />
              <Text style={{ color: colors.secondaryLabel, fontSize: 12 }}>{dateFormat.format(new Date(r.created_at))}</Text>
            </View>
            <Text selectable style={{ color: colors.label, lineHeight: 21 }}>{r.body}</Text>
            <Text style={{ fontWeight: '700', color: colors.label }}>— {r.author_name}</Text>
          </Card>
        ))}
        <Text style={{ color: brand.forest, fontSize: 13 }}>{t.reviews.onlyAfter}</Text>
      </View>
    </ScrollView>
  );
}
