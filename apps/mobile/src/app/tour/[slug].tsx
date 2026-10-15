import { useMemo, useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Link, Stack, router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ACCOMMODATION_LEVELS,
  FITNESS_LEVELS,
  MONTHS,
  STOP_KINDS,
  TOUR_GROUP_TYPES,
  TOUR_THEMES,
  TOUR_TYPES,
  TRANSFER_MODES,
  TRAVEL_STYLES,
  formatPrice,
  straightLineKm,
  tourMatchesTheme,
  tourSummary,
  tourTitle,
  tripPhoto,
  verifiedPrice,
  type TourStop,
} from '@rafrika/shared';
import { photoSource } from '@/lib/photos';
import { Avatar, Badge, BottomBar, Button, Card, Muted, ScreenState, SectionTitle, Stars } from '@/components/ui';
import { TourCard } from '@/components/cards';
import TourMap from '@/components/tour-map';
import { AltitudeChart, DayExtras, GoodToKnowCard, PlaceCard } from '@/components/tour-extras';
import { getTourGuides, getTourStops, listPlaces, listSavedTourIds, listTours, setTourSaved, type Guide } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { languageName, specialtyName } from '@/lib/labels';
import { shareLink } from '@/lib/share';
import { brand, colors, radius, space, textSize } from '@/theme';

export default function TourScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, locale } = useI18n();
  const tt = t.tours;
  const { session } = useSession();
  const queryClient = useQueryClient();
  // Reuses the cached catalogue from the Trips tab.
  const tours = useQuery({ queryKey: ['tours'], queryFn: listTours });
  const tour = tours.data?.find((x) => x.slug === slug);
  const stops = useQuery({ queryKey: ['tour-stops', tour?.id], queryFn: () => getTourStops(tour!.id), enabled: !!tour });
  const team = useQuery({ queryKey: ['tour-guides', tour?.id], queryFn: () => getTourGuides(tour!.id, tour!.categories), enabled: !!tour });
  const saved = useQuery({ queryKey: ['saved-tours', session?.user.id], queryFn: () => listSavedTourIds(session!.user.id), enabled: !!session });
  const isSaved = !!tour && !!saved.data?.includes(tour.id);
  const save = useMutation({
    mutationFn: () => setTourSaved(session!.user.id, tour!.id, !isSaved),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-tours'] }),
  });
  const kinds = useMemo(() => Object.fromEntries(STOP_KINDS.map((k) => [k.id, k[locale]])), [locale]);
  const mapLabels = useMemo(() => ({ day: tt.dayLabel, kinds, altitude: tt.altitude, view3d: tt.view3d, view2d: tt.view2d }), [tt, kinds]);
  const allPlaces = useQuery({ queryKey: ['places'], queryFn: listPlaces });
  const [focus, setFocus] = useState<string>();

  const placeIds = [...new Set((stops.data ?? []).map((s) => s.place_id).filter(Boolean))];
  const places = placeIds.map((id) => allPlaces.data?.find((p) => p.id === id)).filter((p) => p != null);

  if (!tour) return <ScreenState loading={tours.isLoading} error={tours.error} empty emptyText={tt.empty} />;
  const title = tourTitle(tour, locale);
  const price = verifiedPrice(tour, new Date());
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const onRequest = tt.onRequest;
  const themes = TOUR_THEMES.filter((x) => tourMatchesTheme(tour, x.id)).map((x) => x[locale]);
  const styles = TRAVEL_STYLES.filter((x) => tour.travel_styles.includes(x.id)).map((x) => x[locale]);
  const duration = `${tour.days} ${tour.days === 1 ? tt.day : tt.days}${tour.nights ? ` / ${tour.nights} ${tour.nights === 1 ? tt.night : tt.nights}` : ''}`;
  const groupRange = tour.min_group || tour.max_group ? ` · ${tour.min_group ?? 1}–${tour.max_group ?? '…'} ${tt.people}` : '';
  const related = (tours.data ?? [])
    .filter((x) => x.id !== tour.id && TOUR_THEMES.some((th) => tourMatchesTheme(tour, th.id) && tourMatchesTheme(x, th.id)))
    .slice(0, 3);

  function toggleSave() {
    if (!session) return router.push('/sign-in');
    save.mutate();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ gap: space.lg, paddingBottom: space.xxxl }}>
        <Stack.Title>{title}</Stack.Title>
        <View>
          <Image source={tour.cover_url ? { uri: tour.cover_url } : photoSource(tripPhoto(tour.slug, tour.categories))} style={{ height: 230 }} contentFit="cover" />
          <View style={{ position: 'absolute', top: space.md, left: space.md, flexDirection: 'row', gap: space.sm }}>
            <Badge label={`${tour.is_signature ? '✦ ' : ''}${TOUR_TYPES.find((x) => x.id === tour.tour_type)?.[locale]}`} tone={tour.is_signature ? 'gold' : 'sand'} />
            {tour.needs_review && <Badge label={tt.needsReview} tone="night" />}
          </View>
        </View>

        <View style={{ paddingHorizontal: space.lg, gap: space.lg }}>
          <Card>
            <Text selectable style={{ fontSize: textSize.title2, fontWeight: '800', color: colors.label }}>{title}</Text>
            <Muted selectable>{tourSummary(tour, locale)}</Muted>
            <Text style={{ color: brand.forest, fontWeight: '800', fontSize: textSize.headline }}>{duration}</Text>
            <Text selectable style={{ color: price ? brand.forest : colors.secondaryLabel, fontWeight: '800', fontSize: textSize.headline }}>
              {price ? `${tt.priceFrom} ${formatPrice(price.amount, price.currency)}` : tt.priceTbc}
            </Text>
            {price && (
              <Muted>
                {tour.price_conditions ? `${tour.price_conditions}. ` : ''}
                {tt.priceVerified}: {date.format(new Date(tour.price_verified_at!))}
                {tour.price_valid_until ? ` · ${tt.priceValidUntil} ${date.format(new Date(tour.price_valid_until))}` : ''}
              </Muted>
            )}
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button title={isSaved ? tt.saved : tt.save} variant={isSaved ? 'dark' : 'outline'} onPress={toggleSave} loading={save.isPending} style={{ flex: 1 }} />
              <Button title={t.share.share} variant="outline" onPress={() => shareLink(`/${locale}/tours/${tour.slug}`, `${t.share.shareTrip}: ${title}`)} style={{ flex: 1 }} />
            </View>
            {!session && <Muted>{tt.signInToSave}</Muted>}
          </Card>

          <Card>
            {tour.tour_type === 'signature' ? (
              <Text style={{ color: colors.label, fontWeight: '700' }}>✦ {tt.signatureNote}</Text>
            ) : (
              <>
                <Muted>{tt.operatorTourNote}</Muted>
                {tour.source_url && (
                  <Text accessibilityRole="link" onPress={() => Linking.openURL(tour.source_url!)} style={{ color: brand.leafDark, fontWeight: '700' }}>
                    {tt.source}: {tour.tour_operators?.name ?? tt.sourceLink}
                    {tour.source_checked_at ? ` · ${tt.lastChecked} ${date.format(new Date(tour.source_checked_at))}` : ''}
                  </Text>
                )}
              </>
            )}
            {tour.tour_operators && (
              <Link href={{ pathname: '/operator/[slug]', params: { slug: tour.tour_operators.slug } }} asChild>
                <Pressable accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <Avatar name={tour.tour_operators.name} uri={tour.tour_operators.logo_url} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.secondaryLabel, fontSize: textSize.caption }}>{tt.operator}</Text>
                    <Text style={{ color: colors.label, fontWeight: '800' }}>
                      {tour.tour_operators.name}
                      {tour.tour_operators.verified_at ? `  ✓ ${tt.verified}` : ''}
                    </Text>
                  </View>
                </Pressable>
              </Link>
            )}
          </Card>

          <Card>
            <Fact label={`${tt.start} / ${tt.end}`} value={tour.start_from ? `${tour.start_from} → ${tour.end_at ?? tour.start_from}` : onRequest} />
            <Fact label={tt.category} value={[...themes, ...styles].join(', ') || onRequest} />
            <Fact label={tt.accommodation} value={ACCOMMODATION_LEVELS.find((x) => x.id === tour.accommodation)?.[locale] ?? onRequest} />
            <Fact label={tt.groupType} value={`${TOUR_GROUP_TYPES.find((x) => x.id === tour.group_type)?.[locale] ?? onRequest}${groupRange}`} />
            <Fact label={tt.fitness} value={FITNESS_LEVELS.find((x) => x.id === tour.fitness)?.[locale] ?? onRequest} />
          </Card>

          {tour.highlights.length > 0 && (
            <Card>
              <SectionTitle>{tt.highlights}</SectionTitle>
              {tour.highlights.map((h) => (
                <Text key={h} style={{ color: colors.label, lineHeight: 21 }}>✦ {h}</Text>
              ))}
            </Card>
          )}

          {(stops.data?.length ?? 0) > 0 && (
            <Card>
              <SectionTitle>{tt.map}</SectionTitle>
              <Muted>{tt.mapHelp}</Muted>
              <View style={{ height: 300, borderRadius: radius.card, overflow: 'hidden', borderCurve: 'continuous' }}>
                <TourMap stops={stops.data!} labels={mapLabels} focus={focus} dom={{ scrollEnabled: false, style: { height: 300 }, matchContents: false }} />
              </View>
              <StopList stops={stops.data!} kinds={kinds} onFocus={(position) => setFocus(`${position}-${Date.now()}`)} />
              <Muted>{tt.mapNote}</Muted>
            </Card>
          )}

          <AltitudeChart stops={stops.data ?? []} />

          <Card>
            <SectionTitle>{tt.itinerary}</SectionTitle>
            {tour.itinerary.map((day, i) => {
              const dayStops = (stops.data ?? []).filter((s) => String(s.day) === String(day.day));
              return (
                <View key={`${day.day}-${i}`} style={{ flexDirection: 'row', gap: space.md }}>
                  <View style={{ width: 34, height: 34, borderRadius: radius.chip, backgroundColor: brand.leaf, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: brand.onDark, fontWeight: '800' }}>{day.day}</Text>
                  </View>
                  <View style={{ flex: 1, gap: space.xxs }}>
                    <Text style={{ fontWeight: '700', color: colors.label }}>{day.title}</Text>
                    <Muted>{day.body}</Muted>
                    <DayExtras day={day} stops={stops.data ?? []} />
                    {dayStops.length > 0 && (
                      <Text style={{ color: brand.forest, fontSize: textSize.caption, fontWeight: '700' }}>{dayStops.map((s) => `${s.position}. ${s.name}`).join('  ·  ')}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </Card>

          {places.length > 0 && (
            <View style={{ gap: space.md }}>
              <SectionTitle>{tt.aboutPlaces}</SectionTitle>
              {places.map((place) => <PlaceCard key={place.id} place={place} />)}
            </View>
          )}

          <Card>
            <SectionTitle>{tt.includes}</SectionTitle>
            {tour.includes.map((x) => (
              <Text key={x} style={{ color: colors.label }}>✓ {x}</Text>
            ))}
            <SectionTitle>{tt.excludes}</SectionTitle>
            {tour.excludes.map((x) => (
              <Text key={x} style={{ color: colors.secondaryLabel }}>✕ {x}</Text>
            ))}
          </Card>

          <Card>
            <SectionTitle>{tt.bestTime}</SectionTitle>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              {MONTHS[locale].map((m, i) => {
                const good = tour.best_months.includes(i + 1);
                return (
                  <View key={m} style={{ width: '15%', paddingVertical: space.xs, borderRadius: radius.chip, backgroundColor: good ? brand.forest : colors.fill, alignItems: 'center' }}>
                    <Text style={{ color: good ? brand.onDark : colors.secondaryLabel, fontWeight: '700', fontSize: textSize.caption }}>{m}</Text>
                  </View>
                );
              })}
            </View>
            {tour.best_time_note && <Muted>{tour.best_time_note}</Muted>}
          </Card>

          {tour.packing.length > 0 && (
            <Card>
              <SectionTitle>{tt.packing}</SectionTitle>
              {tour.packing.map((x) => (
                <Text key={x} style={{ color: colors.label }}>✓ {x}</Text>
              ))}
            </Card>
          )}

          <GoodToKnowCard items={tour.good_to_know} />

          {(team.data?.guides.length ?? 0) > 0 && (
            <Card>
              <SectionTitle>{tt.meetGuides}</SectionTitle>
              <Muted>{team.data!.assigned ? tt.meetGuidesIntro : tt.suggestedGuides}</Muted>
              {team.data!.guides.map((g) => (
                <GuideRow key={g.id} guide={g} />
              ))}
            </Card>
          )}

          {related.length > 0 && (
            <View style={{ gap: space.md }}>
              <SectionTitle>{tt.related}</SectionTitle>
              {related.map((x) => (
                <TourCard key={x.id} tour={x} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      <BottomBar>
        <Button title={tt.enquireTitle} onPress={() => router.push({ pathname: '/enquire/[slug]', params: { slug: tour.slug } })} />
      </BottomBar>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
      <Text style={{ color: colors.secondaryLabel, flexShrink: 0 }}>{label}</Text>
      <Text selectable style={{ color: colors.label, fontWeight: '700', flex: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

// Numbered stops with the leg from the previous stop: a checked distance and time, or only the
// straight-line distance, clearly labelled.
function StopList({ stops, kinds, onFocus }: { stops: TourStop[]; kinds: Record<string, string>; onFocus: (position: number) => void }) {
  const { t, locale } = useI18n();
  const tt = t.tours;
  return (
    <View style={{ gap: space.sm }}>
      {stops.map((stop, i) => {
        const previous = stops[i - 1];
        const crow = previous ? Math.round(straightLineKm({ lat: Number(previous.lat), lng: Number(previous.lng) }, { lat: Number(stop.lat), lng: Number(stop.lng) })) : 0;
        const checked = stop.distance_km || stop.transfer_hours;
        return (
          <Pressable key={stop.id} onPress={() => onFocus(stop.position)} accessibilityRole="button" accessibilityLabel={stop.name} style={{ flexDirection: 'row', gap: space.md }}>
            <View style={{ width: 26, height: 26, borderRadius: radius.chip, backgroundColor: stop.kind === 'peak' ? brand.gold : brand.leaf, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: stop.kind === 'peak' ? brand.ink : brand.onDark, fontWeight: '800', fontSize: textSize.caption }}>{stop.position}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.label, fontWeight: '700' }}>
                {stop.name}
                <Text style={{ color: colors.secondaryLabel, fontWeight: '400' }}> · {kinds[stop.kind]}{stop.day ? ` · ${tt.dayLabel} ${stop.day}` : ''}{stop.elevation_m != null ? ` · ≈ ${stop.elevation_m.toLocaleString('en-US')} m` : ''}</Text>
              </Text>
              {previous && crow > 0 && (
                <Text style={{ color: colors.secondaryLabel, fontSize: textSize.caption }}>
                  {checked
                    ? `${stop.transfer_mode ? `${TRANSFER_MODES[stop.transfer_mode][locale]}: ` : ''}${stop.distance_km ? `${Math.round(Number(stop.distance_km))} km` : ''}${stop.distance_km && stop.transfer_hours ? ' · ' : ''}${stop.transfer_hours ? `≈ ${Number(stop.transfer_hours)} h` : ''}${stop.distance_source ? ` (${tt.source}: ${stop.distance_source})` : ''}`
                    : `≈ ${crow} km ${tt.straightLine} · ${tt.transferTbc}`}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function GuideRow({ guide }: { guide: Guide }) {
  const { t, locale } = useI18n();
  return (
    <Link href={`/guide/${guide.slug}`} asChild>
      <Pressable accessibilityRole="link" style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        <Avatar name={guide.display_name} uri={guide.photo_url} size={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.label, fontWeight: '800' }}>{guide.display_name} <Text style={{ color: brand.leafDark }}>✓</Text></Text>
          <Text numberOfLines={1} style={{ color: colors.secondaryLabel, fontSize: textSize.caption }}>
            {guide.specialties.slice(0, 2).map((s) => specialtyName(s, locale)).join(', ')}
            {guide.years_experience != null ? ` · ${guide.years_experience} ${t.tours.yearsShort}` : ''}
          </Text>
          <Text numberOfLines={1} style={{ color: brand.forest, fontSize: textSize.caption, fontWeight: '600' }}>{guide.languages.map(languageName).join(', ')}</Text>
          {guide.rating_count > 0 && guide.rating_avg != null ? (
            <Stars value={guide.rating_avg} size={12} />
          ) : (
            <Text style={{ color: brand.leafDark, fontSize: textSize.caption, fontWeight: '700' }}>✦ {t.reviews.newGuide}</Text>
          )}
        </View>
        <Text style={{ color: brand.leafDark, fontWeight: '700', fontSize: textSize.caption }}>{t.tours.viewProfile}</Text>
      </Pressable>
    </Link>
  );
}
