import type { ReactNode } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { Link, Stack, router } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { GUIDE_EXPERTISE, GUIDE_SPECIALTIES, MENU, PHOTOS } from '@kwetuly/shared';
import { GroupTripCard } from '@/components/cards';
import { GLYPHS, Glyph } from '@/components/glyph';
import { Button, Card, Chip, EmptyState, ErrorState, ListGroup, ListRow, Section, SkeletonCard, contentFadeIn } from '@/components/ui';
import { listGroupTrips } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { appHref } from '@/lib/menu';
import { menuIcon } from '@/lib/menu-icons';
import { photoSource } from '@/lib/photos';
import { brand, colors, control, font, icon, iconBox, layout, media, radius, scrim, space, textSize, type } from '@/theme';

/** A row of chips that scrolls sideways edge to edge, with the screen inset at both ends. */
function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -layout.screenX }}
      // Vertical padding keeps the chips' taller touch area inside the scroll view.
      contentContainerStyle={{ gap: layout.inlineGap, paddingHorizontal: layout.screenX, paddingVertical: space.xs }}
    >
      {children}
    </ScrollView>
  );
}

export default function ExploreScreen() {
  const { t, locale } = useI18n();
  const { width } = useWindowDimensions();
  const groups = useQuery({ queryKey: ['group-trips'], queryFn: listGroupTrips });
  const hero = PHOTOS.saddleHikers;
  // Two equal columns; an odd last tile keeps its width instead of stretching.
  const tileWidth = (width - layout.screenX * 2 - space.md) / 2;
  const trips = groups.data ?? [];

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: space.xxxl, gap: layout.sectionGap }}
      style={{ backgroundColor: colors.background }}
    >
      <Stack.Title large>Kwetuly</Stack.Title>

      {/* Hero: the screen's one filled button. */}
      <View style={{ marginHorizontal: layout.screenX, height: media.hero, borderRadius: radius.hero, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: brand.shade }}>
        <Image source={photoSource(hero)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" accessibilityLabel={hero.alt} />
        <View style={{ flex: 1, justifyContent: 'flex-end', padding: space.xl, gap: space.sm, experimental_backgroundImage: scrim.hero }}>
          <Text style={{ color: brand.gold, ...font.bold, fontSize: textSize.callout, lineHeight: 20 }}>{t.home.eyebrow}</Text>
          <Text accessibilityRole="header" style={{ ...type.title1, color: brand.onDark }}>
            {t.home.title}
          </Text>
          <Button title={t.home.search} onPress={() => router.push('/guides')} style={{ marginTop: space.sm }} />
        </View>
      </View>

      {/* AI concierge: shown once EXPO_PUBLIC_AI_ENABLED=1 (after the API key is set on the website). */}
      {process.env.EXPO_PUBLIC_AI_ENABLED === '1' && (
        <View style={{ paddingHorizontal: layout.screenX }}>
          <ListGroup>
            <ListRow icon={GLYPHS.sparkles} title={t.concierge.open} onPress={() => router.push('/assistant')} accessibilityRole="link" />
          </ListGroup>
        </View>
      )}

      {/* What do you want to do? Specialties, then women guides and special trips. */}
      <Section title={t.home.specialtyLabel} style={{ paddingHorizontal: layout.screenX }}>
        <ChipRow>
          {GUIDE_SPECIALTIES.map((s) => (
            <Link key={s.id} href={{ pathname: '/guides', params: { specialty: s.id } }} asChild>
              <Chip label={s[locale]} />
            </Link>
          ))}
        </ChipRow>
        <Text style={type.label}>{t.guides.expertise}</Text>
        <ChipRow>
          <Link href={{ pathname: '/guides', params: { female: '1' } }} asChild>
            <Chip label={t.guides.femaleOnly} />
          </Link>
          {GUIDE_EXPERTISE.map((e) => (
            <Link key={e.id} href={{ pathname: '/guides', params: { expertise: e.id } }} asChild>
              <Chip label={e.label[locale]} />
            </Link>
          ))}
        </ChipRow>
      </Section>

      {/* Group trips: loading, error, empty or up to 3 trips. */}
      <Section title={t.groups.title} action={{ label: t.explore.more, onPress: () => router.push('/trips') }} style={{ paddingHorizontal: layout.screenX }}>
        {groups.isLoading ? (
          <SkeletonCard photo />
        ) : groups.error ? (
          <ErrorState onRetry={() => groups.refetch()} />
        ) : trips.length === 0 ? (
          <EmptyState glyph={GLYPHS.calendar} text={t.groups.none} />
        ) : (
          <Animated.View entering={contentFadeIn} style={{ gap: layout.listGap }}>
            {trips.slice(0, 3).map((trip) => (
              <GroupTripCard key={trip.id} trip={trip} />
            ))}
          </Animated.View>
        )}
      </Section>

      {/* Everything on Kwetuly: the same sections as the website menu, as icon tiles. */}
      <Section title={t.explore.title} style={{ paddingHorizontal: layout.screenX }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
          {MENU.map((section) => (
            <Link
              key={section.slug}
              href={section.items.length === 1 ? appHref(section, section.items[0]) : { pathname: '/section/[slug]', params: { slug: section.slug } }}
              asChild
            >
              <Card accessibilityRole="link" style={{ width: tileWidth, minHeight: control.tile, gap: space.sm }}>
                <View style={{ width: iconBox.md, height: iconBox.md, borderRadius: radius.button, borderCurve: 'continuous', backgroundColor: brand.leaf, alignItems: 'center', justifyContent: 'center' }}>
                  <Glyph name={menuIcon(section.icon)} size={icon.square} color={brand.onDark} />
                </View>
                <Text numberOfLines={2} style={{ ...type.cardTitle, fontSize: textSize.body }}>
                  {section.label[locale]}
                </Text>
                <Text numberOfLines={2} style={type.caption}>
                  {section.tagline[locale]}
                </Text>
              </Card>
            </Link>
          ))}
        </View>
      </Section>

      {/* Why Kwetuly */}
      <Section title={t.home.whyTitle} style={{ paddingHorizontal: layout.screenX }}>
        <Text style={{ ...type.cardTitle, color: brand.primary }}>{t.home.hook}</Text>
        <Text style={{ ...type.callout, color: colors.secondaryLabel }}>{t.home.story}</Text>
        <View style={{ backgroundColor: colors.card, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, paddingHorizontal: layout.cardPadding }}>
          {t.home.why.map((item, i) => (
            <View key={item.title} style={{ gap: space.xs, paddingVertical: space.lg, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
              <Text style={{ ...type.body, ...font.bold }}>{item.title}</Text>
              <Text style={type.muted}>{item.body}</Text>
            </View>
          ))}
        </View>
      </Section>
    </ScrollView>
  );
}
