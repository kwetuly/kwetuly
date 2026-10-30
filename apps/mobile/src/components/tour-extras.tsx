import { Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { PLACE_KINDS, altitudeProfile, overnightFor, type ItineraryDay, type Place, type TourStop } from '@kwetuly/shared';
import { Card, Muted, SectionTitle } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { openExternal } from '@/lib/open-external';
import { brand, colors, radius, space, textSize } from '@/theme';

const metres = (n: number) => `${Math.round(n).toLocaleString('en-US')} m`;

/** Altitude for tours that climb: one column per stop, summit in gold. */
export function AltitudeChart({ stops }: { stops: TourStop[] }) {
  const { t } = useI18n();
  const profile = altitudeProfile(stops);
  if (!profile) return null;
  const bottom = Math.max(0, Math.floor(profile.min / 500) * 500 - 500);
  const height = 140;
  return (
    <Card>
      <SectionTitle>{t.tours.altitudeProfile}</SectionTitle>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: height + 34 }} accessibilityLabel={profile.stops.map((s) => `${s.name} ${metres(s.elevation_m)}`).join(', ')}>
        {profile.stops.map((s) => {
          const peak = s.elevation_m === profile.max;
          return (
            <View key={s.id} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
              <Text style={{ fontSize: 9, color: colors.secondaryLabel, fontVariant: ['tabular-nums'] }}>{Math.round(s.elevation_m / 100) / 10}k</Text>
              <View
                style={{
                  width: '100%',
                  height: Math.max(6, ((s.elevation_m - bottom) / (profile.max - bottom)) * height),
                  backgroundColor: peak ? brand.gold : brand.leaf,
                  borderTopLeftRadius: radius.chip,
                  borderTopRightRadius: radius.chip,
                }}
              />
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.label }}>{s.position}</Text>
            </View>
          );
        })}
      </View>
      <Muted>
        {t.tours.altitude}: {metres(profile.min)} → {metres(profile.max)}. {t.tours.altitudeNote}
      </Muted>
    </Card>
  );
}

/** Overnight, meals, activities and the day's highest altitude, under an itinerary day. */
export function DayExtras({ day, stops }: { day: ItineraryDay; stops: TourStop[] }) {
  const { t } = useI18n();
  const tt = t.tours;
  const dayStops = stops.filter((s) => String(s.day) === String(day.day));
  const overnight = overnightFor(day, stops);
  const highest = Math.max(...dayStops.map((s) => s.elevation_m ?? -Infinity));
  const mealNames = { B: tt.breakfast, L: tt.lunch, D: tt.dinner };
  const lines = [
    overnight && `${tt.overnight}: ${overnight}`,
    day.meals?.length && `${tt.meals}: ${day.meals.map((m) => mealNames[m]).join(', ')}`,
    day.activities?.length && `${tt.dayActivities}: ${day.activities.join(', ')}`,
    Number.isFinite(highest) && highest > 2500 && `${tt.altitude} ≈ ${metres(highest)}`,
  ].filter(Boolean) as string[];
  if (lines.length === 0) return null;
  return (
    <View style={{ gap: 2 }}>
      {lines.map((line) => (
        <Text key={line} style={{ color: colors.label, fontSize: textSize.caption, fontWeight: '600' }}>{line}</Text>
      ))}
    </View>
  );
}

export function PlaceFacts({ place }: { place: Place }) {
  const { t, locale } = useI18n();
  const tt = t.tours;
  const facts: [string, string][] = [[PLACE_KINDS.find((k) => k.id === place.kind)?.[locale] ?? place.kind, place.region ?? '–']];
  if (place.area_km2) facts.push([tt.area, `${Number(place.area_km2).toLocaleString('en-US')} km²`]);
  if (place.established) facts.push([tt.established, String(place.established)]);
  if (place.unesco_year) facts.push([tt.unesco, String(place.unesco_year)]);
  if (place.highest_point) facts.push([tt.highestPoint, place.highest_point]);
  if (place.managed_by) facts.push([tt.managedBy, place.managed_by]);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {facts.map(([label, value]) => (
        <View key={label} style={{ backgroundColor: colors.fill, borderRadius: radius.chip, paddingHorizontal: space.md, paddingVertical: space.sm, minWidth: '47%', flexGrow: 1 }}>
          <Text style={{ color: colors.secondaryLabel, fontSize: textSize.caption }}>{label}</Text>
          <Text selectable style={{ color: colors.label, fontWeight: '700' }}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

export function PlaceSource({ place }: { place: Place }) {
  const { t, locale } = useI18n();
  const tt = t.tours;
  if (!place.source_url) return <Muted>{tt.writtenByGuides}</Muted>;
  const date = place.source_checked_at ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(place.source_checked_at)) : null;
  return (
    <Text accessibilityRole="link" onPress={() => openExternal(place.source_url)} style={{ color: brand.leafDark, fontSize: textSize.caption, fontWeight: '700' }}>
      {tt.factsFrom} {place.source_name ?? place.source_url}{date ? ` · ${tt.lastChecked}: ${date}` : ''}
    </Text>
  );
}

/** Short guide to a park or site, linking to its full page. */
export function PlaceCard({ place }: { place: Place }) {
  const { t } = useI18n();
  const tt = t.tours;
  return (
    <Card>
      <Text style={{ fontSize: textSize.headline, fontWeight: '800', color: colors.label }}>{place.name}</Text>
      <Muted selectable>{place.summary}</Muted>
      <PlaceFacts place={place} />
      {place.known_for.slice(0, 4).map((x) => (
        <Text key={x} style={{ color: colors.label, lineHeight: 20 }}>✦ {x}</Text>
      ))}
      {place.wildlife.length > 0 && (
        <Text style={{ color: colors.secondaryLabel, fontSize: textSize.footnote }}>
          <Text style={{ fontWeight: '700', color: colors.label }}>{tt.wildlifeLabel}: </Text>
          {place.wildlife.join(', ')}
        </Text>
      )}
      <PlaceSource place={place} />
      <Link href={{ pathname: '/place/[slug]', params: { slug: place.slug } }} asChild>
        <Pressable accessibilityRole="link">
          <Text style={{ color: brand.leafDark, fontWeight: '700' }}>{tt.moreAboutPlace}</Text>
        </Pressable>
      </Link>
    </Card>
  );
}

export function GoodToKnowCard({ items }: { items: string[] | undefined }) {
  const { t } = useI18n();
  if (!items?.length) return null;
  return (
    <View style={{ borderWidth: 1, borderColor: brand.gold, backgroundColor: brand.goldSoft, borderRadius: radius.card, padding: space.lg, gap: space.sm }}>
      <SectionTitle>{t.tours.goodToKnow}</SectionTitle>
      {items.map((x) => (
        <Text key={x} selectable style={{ color: brand.ink, lineHeight: 20 }}>• {x}</Text>
      ))}
    </View>
  );
}
