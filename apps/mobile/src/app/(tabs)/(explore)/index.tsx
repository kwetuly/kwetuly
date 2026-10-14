import { Pressable, ScrollView, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { GUIDE_EXPERTISE, GUIDE_SPECIALTIES, MENU, PHOTOS } from '@rafrika/shared';
import { GroupTripCard } from '@/components/cards';
import { Chip, SectionTitle } from '@/components/ui';
import { listGroupTrips } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { appHref } from '@/lib/menu';
import { photoSource } from '@/lib/photos';
import { brand, colors, radius, space, textSize } from '@/theme';

export default function ExploreScreen() {
  const { t, locale } = useI18n();
  const groups = useQuery({ queryKey: ['group-trips'], queryFn: listGroupTrips });
  const hero = PHOTOS.saddleHikers;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: space.xxl, gap: space.xl }} style={{ backgroundColor: colors.background }}>
      <Stack.Title large>Rafrika</Stack.Title>

      {/* Hero */}
      <View style={{ marginHorizontal: space.lg, height: 260, borderRadius: radius.hero, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: brand.night }}>
        <Image source={photoSource(hero)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" accessibilityLabel={hero.alt} />
        <View style={{ flex: 1, justifyContent: 'flex-end', padding: space.xl, gap: space.sm, experimental_backgroundImage: 'linear-gradient(to top, rgba(58,58,58,0.95), rgba(58,58,58,0.1))' }}>
          <Text style={{ color: brand.gold, fontWeight: '700', fontSize: textSize.body }}>{t.home.eyebrow}</Text>
          <Text style={{ color: brand.onDark, fontWeight: '800', fontSize: textSize.title1, lineHeight: 32 }}>{t.home.title}</Text>
          <Link href="/guides" asChild>
            <Pressable style={{ backgroundColor: brand.leaf, borderRadius: radius.button, borderCurve: 'continuous', paddingVertical: space.md, alignItems: 'center', marginTop: space.sm }}>
              <Text style={{ color: brand.onDark, fontWeight: '800' }}>{t.home.search}</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      {/* AI concierge: shown once EXPO_PUBLIC_AI_ENABLED=1 (after the API key is set on the website). */}
      {process.env.EXPO_PUBLIC_AI_ENABLED === '1' && (
        <View style={{ paddingHorizontal: space.lg }}>
          <Link href="/assistant" asChild>
            <Pressable style={{ backgroundColor: brand.gold, borderRadius: radius.button, borderCurve: 'continuous', padding: space.lg }}>
              <Text style={{ color: brand.ink, fontWeight: '800', fontSize: textSize.body }}>✦ {t.concierge.open}</Text>
            </Pressable>
          </Link>
        </View>
      )}

      {/* What do you want to do? */}
      <View style={{ gap: space.md, paddingHorizontal: space.lg }}>
        <SectionTitle>{t.home.specialtyLabel}</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {GUIDE_SPECIALTIES.map((s) => (
            <Link key={s.id} href={{ pathname: '/guides', params: { specialty: s.id } }} asChild>
              <Chip label={s[locale]} />
            </Link>
          ))}
        </View>
      </View>

      {/* Special trips */}
      <View style={{ gap: space.md }}>
        <View style={{ paddingHorizontal: space.lg }}>
          <SectionTitle>{t.guides.expertise}</SectionTitle>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingHorizontal: space.lg }}>
          <Link href={{ pathname: '/guides', params: { female: '1' } }} asChild>
            <Chip label={t.guides.femaleOnly} />
          </Link>
          {GUIDE_EXPERTISE.map((e) => (
            <Link key={e.id} href={{ pathname: '/guides', params: { expertise: e.id } }} asChild>
              <Chip label={e.label[locale]} />
            </Link>
          ))}
        </ScrollView>
      </View>

      {/* Group trips */}
      <View style={{ gap: space.md, paddingHorizontal: space.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <SectionTitle>{t.groups.title}</SectionTitle>
          <Link href="/trips" style={{ color: brand.leafDark, fontWeight: '700' }}>
            {t.explore.more}
          </Link>
        </View>
        {(groups.data ?? []).length === 0 ? (
          <Text style={{ color: colors.secondaryLabel }}>{t.groups.none}</Text>
        ) : (
          groups.data!.slice(0, 3).map((trip) => <GroupTripCard key={trip.id} trip={trip} />)
        )}
      </View>

      {/* Everything on Rafrika: the same sections as the website menu */}
      <View style={{ gap: space.md, paddingHorizontal: space.lg }}>
        <SectionTitle>{t.explore.title}</SectionTitle>
        {MENU.map((section) => (
          <View key={section.slug} style={{ backgroundColor: colors.card, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.separator, padding: space.lg, gap: space.sm }}>
            <Text style={{ fontWeight: '800', fontSize: textSize.headline, color: colors.label }}>{section.label[locale]}</Text>
            <Text style={{ color: colors.secondaryLabel, fontSize: textSize.footnote }}>{section.tagline[locale]}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {section.items.map((item) => (
                <Link key={item.slug} href={appHref(section, item)} asChild>
                  <Chip label={item.status === 'live' ? item.label[locale] : `${item.label[locale]} · ${t.nav.soon}`} />
                </Link>
              ))}
            </View>
          </View>
        ))}
      </View>

      {/* Why Rafrika */}
      <View style={{ gap: space.md, paddingHorizontal: space.lg }}>
        <SectionTitle>{t.home.whyTitle}</SectionTitle>
        <View style={{ backgroundColor: colors.card, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.separator, paddingHorizontal: space.lg }}>
          {t.home.why.map((item, i) => (
            <View key={item.title} style={{ flexDirection: 'row', gap: space.md, paddingVertical: space.lg, borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator }}>
              <View style={{ flex: 1, gap: space.xs }}>
                <Text style={{ fontWeight: '800', fontSize: textSize.body, color: colors.label }}>{item.title}</Text>
                <Text style={{ color: colors.secondaryLabel, lineHeight: 20 }}>{item.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
