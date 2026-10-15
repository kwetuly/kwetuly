import { FlatList, Pressable, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { PLACE_KINDS } from '@rafrika/shared';
import { Card, Muted, ScreenState } from '@/components/ui';
import { listPlaces } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { brand, colors, space, textSize } from '@/theme';

// Guides to the parks, heritage sites and villages on Rafrika's tours.
export default function PlacesScreen() {
  const { t, locale } = useI18n();
  const places = useQuery({ queryKey: ['places'], queryFn: listPlaces });
  const order = PLACE_KINDS.map((k) => k.id as string);
  const sorted = [...(places.data ?? [])].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.name.localeCompare(b.name));
  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: space.lg, gap: space.md }}
      data={sorted}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={
        <View style={{ gap: space.sm }}>
          <Stack.Title>{t.tours.placesTitle}</Stack.Title>
          <Muted>{t.tours.placesSubtitle}</Muted>
        </View>
      }
      renderItem={({ item: place }) => (
        <Link href={{ pathname: '/place/[slug]', params: { slug: place.slug } }} asChild>
          <Pressable accessibilityRole="link">
            <Card>
              <Text style={{ color: brand.leafDark, fontSize: textSize.caption, fontWeight: '700' }}>
                {PLACE_KINDS.find((k) => k.id === place.kind)?.[locale]}{place.region ? ` · ${place.region}` : ''}
              </Text>
              <Text style={{ color: colors.label, fontWeight: '800', fontSize: textSize.headline }}>{place.name}</Text>
              <Text numberOfLines={3} style={{ color: colors.secondaryLabel }}>{place.summary}</Text>
            </Card>
          </Pressable>
        </Link>
      )}
      ListEmptyComponent={<ScreenState loading={places.isLoading} error={places.error} empty />}
    />
  );
}
