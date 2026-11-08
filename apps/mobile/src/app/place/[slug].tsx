import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { STOP_KINDS, type TourStop } from '@kwetuly/shared';
import { GLYPHS, Glyph } from '@/components/glyph';
import { Card, EmptyState, Muted, ScreenState, Section } from '@/components/ui';
import { TourCard } from '@/components/cards';
import TourMap from '@/components/tour-map';
import { PlaceFacts, PlaceSource } from '@/components/tour-extras';
import { getPlace, listTours, tourIdsVisiting } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useType } from '@/lib/use-type';
import { brand, colors, icon, layout, media, radius, space } from '@/theme';

// A park or site: summary, facts with their source, wildlife, things to do, map and tours that go there.
export default function PlaceScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, locale } = useI18n();
  const tt = t.tours;
  const { type } = useType();
  const place = useQuery({ queryKey: ['place', slug], queryFn: () => getPlace(slug) });
  const tours = useQuery({ queryKey: ['tours'], queryFn: listTours });
  const tourIds = useQuery({ queryKey: ['place-tours', place.data?.id], queryFn: () => tourIdsVisiting(place.data!.id), enabled: !!place.data });
  const kinds = useMemo(() => Object.fromEntries(STOP_KINDS.map((k) => [k.id, k[locale]])), [locale]);
  const labels = useMemo(() => ({ day: tt.dayLabel, kinds, altitude: tt.altitude, view3d: tt.view3d, view2d: tt.view2d }), [tt, kinds]);
  const p = place.data;
  const pin = useMemo<TourStop[]>(
    () =>
      p?.lat != null && p.lng != null
        ? [{ id: p.id, position: 1, day: null, name: p.name, kind: 'park', lat: Number(p.lat), lng: Number(p.lng), note: null, transfer_mode: null, distance_km: null, transfer_hours: null, distance_source: null, place_id: p.id, elevation_m: null }]
        : [],
    [p],
  );
  if (!p) return <ScreenState screen loading={place.isLoading} error={place.error} onRetry={() => place.refetch()} empty />;
  const theirs = (tours.data ?? []).filter((tour) => tourIds.data?.includes(tour.id));

  const chips = (label: string, items: string[]) =>
    items.length > 0 && (
      <View style={{ gap: space.xs }}>
        <Text style={type.label}>{label}</Text>
        <Text selectable style={type.muted}>{items.join(', ')}</Text>
      </View>
    );

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: layout.screenX, gap: space.lg, paddingBottom: space.xxxl }}>
      <Stack.Title>{p.name}</Stack.Title>
      <Card>
        <Text selectable accessibilityRole="header" style={type.title2}>{p.name}</Text>
        <Muted selectable>{p.summary}</Muted>
        <PlaceFacts place={p} />
        {p.known_for.map((x) => (
          <View key={x} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
            <View style={{ paddingTop: space.xxs }}>
              <Glyph name={GLYPHS.sparkles} size={icon.badge} color={brand.leafDark} />
            </View>
            <Text style={{ ...type.callout, flex: 1 }}>{x}</Text>
          </View>
        ))}
        {chips(tt.wildlifeLabel, p.wildlife)}
        {chips(tt.placeActivities, p.activities)}
        <PlaceSource place={p} />
      </Card>
      {pin.length > 0 && (
        <View style={{ height: media.hero, borderRadius: radius.card, overflow: 'hidden', borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border }}>
          <TourMap stops={pin} labels={labels} dom={{ scrollEnabled: false, style: { height: media.hero }, matchContents: false }} />
        </View>
      )}
      <Section title={`${tt.toursHere} ${p.name}`} style={{ marginTop: space.lg }}>
        {tours.isLoading || tourIds.isLoading ? (
          <ScreenState loading />
        ) : theirs.length === 0 ? (
          <EmptyState glyph={GLYPHS.search} text={tt.empty} />
        ) : (
          theirs.map((tour) => <TourCard key={tour.id} tour={tour} />)
        )}
      </Section>
    </ScrollView>
  );
}
