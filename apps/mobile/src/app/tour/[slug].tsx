import { ScrollView, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { tripPhoto, formatUsd } from '@rafrika/shared';
import { photoSource } from '@/lib/photos';
import { BottomBar, Button, Card, Muted, ScreenState, SectionTitle } from '@/components/ui';
import { listTours } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { shareLink } from '@/lib/share';
import { brand, colors, space, textSize } from '@/theme';

export default function TourScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, locale } = useI18n();
  // Reuses the cached catalogue from the Trips tab.
  const tours = useQuery({ queryKey: ['tours'], queryFn: listTours });
  const tour = tours.data?.find((x) => x.slug === slug);

  if (!tour) return <ScreenState loading={tours.isLoading} error={tours.error} empty emptyText={t.tours.empty} />;
  const title = (locale === 'sw' && tour.title_sw) || tour.title_en;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ gap: space.lg, paddingBottom: space.xxxl }}>
      <Stack.Title>{title}</Stack.Title>
      <Image source={photoSource(tripPhoto(tour.slug, tour.categories))} style={{ height: 220 }} contentFit="cover" />
      <View style={{ paddingHorizontal: space.lg, gap: space.lg }}>
        <Card>
          <Text style={{ fontSize: textSize.title2, fontWeight: '800', color: colors.label }}>{title}</Text>
          <Muted selectable>{(locale === 'sw' && tour.summary_sw) || tour.summary_en}</Muted>
          <Text style={{ color: brand.forest, fontWeight: '800', fontSize: textSize.headline }}>
            {tour.days} {tour.days === 1 ? t.tours.day : t.tours.days}
            {tour.price_from_usd != null ? ` · ${t.tours.priceFrom} ${formatUsd(tour.price_from_usd)}` : ` · ${t.tours.priceOnRequest}`}
          </Text>
          <Button title={t.share.share} variant="outline" onPress={() => shareLink(`/${locale}/tours/${tour.slug}`, `${t.share.shareTrip}: ${title}`)} />
        </Card>

        {tour.highlights.length > 0 && (
          <Card>
            <SectionTitle>{t.tours.highlights}</SectionTitle>
            {tour.highlights.map((h) => (
              <Text key={h} style={{ color: colors.label, lineHeight: 21 }}>✦ {h}</Text>
            ))}
          </Card>
        )}

        <Card>
          <SectionTitle>{t.tours.itinerary}</SectionTitle>
          {tour.itinerary.map((day, i) => (
            <View key={`${day.day}-${i}`} style={{ gap: space.xxs }}>
              <Text style={{ fontWeight: '800', color: brand.leafDark }}>{day.day}</Text>
              <Text style={{ fontWeight: '700', color: colors.label }}>{day.title}</Text>
              <Muted>{day.body}</Muted>
            </View>
          ))}
        </Card>

        <Card>
          <SectionTitle>{t.tours.includes}</SectionTitle>
          {tour.includes.map((x) => (
            <Text key={x} style={{ color: colors.label }}>✓ {x}</Text>
          ))}
          <SectionTitle>{t.tours.excludes}</SectionTitle>
          {tour.excludes.map((x) => (
            <Text key={x} style={{ color: colors.secondaryLabel }}>✕ {x}</Text>
          ))}
        </Card>
      </View>
    </ScrollView>
    <BottomBar>
      <Button title={t.tours.enquireTitle} onPress={() => router.push({ pathname: '/enquire/[slug]', params: { slug: tour.slug } })} />
    </BottomBar>
    </View>
  );
}
