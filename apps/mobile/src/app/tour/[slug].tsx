import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Link, Stack, router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import Animated from 'react-native-reanimated';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ACCOMMODATION_LEVELS,
  EVENTS,
  FITNESS_LEVELS,
  MONTHS,
  STOP_KINDS,
  TOUR_GROUP_TYPES,
  TOUR_THEMES,
  TOUR_TYPES,
  TRANSFER_MODES,
  TRAVEL_STYLES,
  formatPrice,
  hasRecordedCheck,
  straightLineKm,
  tourMatchesTheme,
  tourSummary,
  tourTitle,
  tripPhoto,
  verifiedPrice,
  type TourStop,
} from '@kwetuly/shared';
import { photoSource } from '@/lib/photos';
import { GLYPHS, Glyph, type GlyphName } from '@/components/glyph';
import { Avatar, Badge, BottomBar, Button, Card, DetailRow, HeaderIconButton, MetaItems, Muted, ScreenState, Section, SectionTitle, Stars, contentFadeIn } from '@/components/ui';
import { TourCard } from '@/components/cards';
import TourMap from '@/components/tour-map';
import { AltitudeChart, DayExtras, GoodToKnowCard, PlaceCard } from '@/components/tour-extras';
import { getTourGuides, getTourStops, listPlaces, listSavedTourIds, listTours, setTourSaved, type Guide } from '@/lib/api';
import { track } from '@/lib/analytics';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { openExternal } from '@/lib/open-external';
import { languageName, specialtyName } from '@/lib/labels';
import { shareLink } from '@/lib/share';
import { useType } from '@/lib/use-type';
import { brand, colors, control, icon, iconBox, layout, media, radius, space } from '@/theme';

export default function TourScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, locale } = useI18n();
  const tt = t.tours;
  const { type, font } = useType();
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
    onSuccess: () => {
      if (!isSaved) track(EVENTS.tourSaved, { tour: tour!.slug, locale });
      queryClient.invalidateQueries({ queryKey: ['saved-tours'] });
    },
  });
  const tourSlug = tour?.slug;
  const tourType = tour?.tour_type;
  useEffect(() => {
    if (tourSlug) track(EVENTS.tourViewed, { tour: tourSlug, tour_type: tourType, locale });
  }, [tourSlug, tourType, locale]);
  const kinds = useMemo(() => Object.fromEntries(STOP_KINDS.map((k) => [k.id, k[locale]])), [locale]);
  const mapLabels = useMemo(() => ({ day: tt.dayLabel, kinds, altitude: tt.altitude, view3d: tt.view3d, view2d: tt.view2d }), [tt, kinds]);
  const allPlaces = useQuery({ queryKey: ['places'], queryFn: listPlaces });
  const [focus, setFocus] = useState<string>();

  const placeIds = [...new Set((stops.data ?? []).map((s) => s.place_id).filter(Boolean))];
  const places = placeIds.map((id) => allPlaces.data?.find((p) => p.id === id)).filter((p) => p != null);

  if (!tour) return <ScreenState screen loading={tours.isLoading} error={tours.error} onRetry={() => tours.refetch()} empty emptyText={tt.empty} />;
  const title = tourTitle(tour, locale);
  const price = verifiedPrice(tour, new Date());
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const onRequest = tt.onRequest;
  const themes = TOUR_THEMES.filter((x) => tourMatchesTheme(tour, x.id)).map((x) => x[locale]);
  const styles = TRAVEL_STYLES.filter((x) => tour.travel_styles.includes(x.id)).map((x) => x[locale]);
  const duration = `${tour.days} ${tour.days === 1 ? tt.day : tt.days}${tour.nights ? ` / ${tour.nights} ${tour.nights === 1 ? tt.night : tt.nights}` : ''}`;
  const groupRange = tour.min_group || tour.max_group ? `, ${tour.min_group ?? 1}–${tour.max_group ?? '…'} ${tt.people}` : '';
  const typeName = TOUR_TYPES.find((x) => x.id === tour.tour_type)?.[locale];
  const related = (tours.data ?? [])
    .filter((x) => x.id !== tour.id && TOUR_THEMES.some((th) => tourMatchesTheme(tour, th.id) && tourMatchesTheme(x, th.id)))
    .slice(0, 3);

  function toggleSave() {
    if (!session) return router.push('/sign-in');
    save.mutate();
  }

  const facts = [
    { label: `${tt.start} / ${tt.end}`, value: tour.start_from ? `${tour.start_from} – ${tour.end_at ?? tour.start_from}` : onRequest },
    { label: tt.category, value: [...themes, ...styles].join(', ') || onRequest },
    { label: tt.accommodation, value: ACCOMMODATION_LEVELS.find((x) => x.id === tour.accommodation)?.[locale] ?? onRequest },
    { label: tt.groupType, value: `${TOUR_GROUP_TYPES.find((x) => x.id === tour.group_type)?.[locale] ?? onRequest}${groupRange}` },
    { label: tt.fitness, value: FITNESS_LEVELS.find((x) => x.id === tour.fitness)?.[locale] ?? onRequest },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ gap: space.lg, paddingBottom: layout.sectionGap }}>
        <Stack.Title>{title}</Stack.Title>
        <HeaderIconButton glyph={GLYPHS.share} accessibilityLabel={t.share.share} onPress={() => shareLink(`/${locale}/tours/${tour.slug}`, `${t.share.shareTrip}: ${title}`)} />
        <View>
          <Image source={tour.cover_url ? { uri: tour.cover_url } : photoSource(tripPhoto(tour.slug, tour.categories))} style={{ height: media.detailPhoto }} contentFit="cover" accessibilityLabel={title} />
          <View style={{ position: 'absolute', top: space.md, left: space.md, flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {(typeName || tour.is_signature) && <Badge label={typeName ?? tt.signature} tone={tour.is_signature ? 'gold' : 'sand'} icon={tour.is_signature ? GLYPHS.sparkles : undefined} />}
            {tour.needs_review && <Badge label={tt.needsReview} tone="neutral" />}
          </View>
        </View>

        <Animated.View entering={contentFadeIn} style={{ paddingHorizontal: layout.screenX, gap: space.lg }}>
          <Card>
            <Text selectable accessibilityRole="header" style={type.title2}>{title}</Text>
            <Muted selectable>{tourSummary(tour, locale)}</Muted>
            <Text style={{ ...type.cardTitle, color: brand.forest }}>{duration}</Text>
            <Text selectable style={{ ...type.price, color: price ? brand.forest : colors.secondaryLabel }}>
              {price ? `${tt.priceFrom} ${formatPrice(price.amount, price.currency)}` : tt.priceTbc}
            </Text>
            {price && (
              <View style={{ gap: space.xxs }}>
                {tour.price_conditions ? <Text style={type.meta}>{tour.price_conditions}</Text> : null}
                <Text style={type.meta}>
                  {tt.priceVerified}: {date.format(new Date(tour.price_verified_at!))}
                </Text>
                {tour.price_valid_until ? (
                  <Text style={type.meta}>
                    {tt.priceValidUntil} {date.format(new Date(tour.price_valid_until))}
                  </Text>
                ) : null}
              </View>
            )}
            <Button title={isSaved ? tt.saved : tt.save} variant="outline" size="md" icon={isSaved ? GLYPHS.bookmarkFilled : GLYPHS.bookmark} onPress={toggleSave} loading={save.isPending} />
            {!session && <Muted>{tt.signInToSave}</Muted>}
          </Card>

          <Card>
            {tour.tour_type === 'signature' ? (
              <IconLine glyph={GLYPHS.sparkles} text={tt.signatureNote} strong />
            ) : (
              <>
                <Muted>{tt.operatorTourNote}</Muted>
                {tour.source_url && (
                  <View style={{ gap: space.xxs }}>
                    <Text accessibilityRole="link" onPress={() => openExternal(tour.source_url)} style={{ ...type.callout, ...font.bold, color: brand.link, paddingVertical: space.xs }}>
                      {tt.source}: {tour.tour_operators?.name ?? tt.sourceLink}
                    </Text>
                    {tour.source_checked_at ? (
                      <Text style={type.caption}>
                        {tt.lastChecked} {date.format(new Date(tour.source_checked_at))}
                      </Text>
                    ) : null}
                  </View>
                )}
              </>
            )}
            {tour.tour_operators && (
              <Link href={{ pathname: '/operator/[slug]', params: { slug: tour.tour_operators.slug } }} asChild>
                <Pressable accessibilityRole="link" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: control.touch, opacity: pressed ? 0.7 : 1 })}>
                  <Avatar name={tour.tour_operators.name} uri={tour.tour_operators.logo_url} size={iconBox.md} />
                  <View style={{ flex: 1, gap: space.xxs }}>
                    <Text style={type.caption}>{tt.operator}</Text>
                    <Text style={{ ...type.body, ...font.bold }}>{tour.tour_operators.name}</Text>
                    {tour.tour_operators.verified_at ? <Badge label={tt.verified} icon={GLYPHS.check} /> : null}
                  </View>
                </Pressable>
              </Link>
            )}
          </Card>

          <Card>
            {facts.map((f, i) => (
              <View key={f.label} style={i ? { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md } : undefined}>
                <DetailRow label={f.label} value={f.value} selectable />
              </View>
            ))}
          </Card>

          {tour.highlights.length > 0 && (
            <Card>
              <SectionTitle>{tt.highlights}</SectionTitle>
              {tour.highlights.map((h) => (
                <IconLine key={h} glyph={GLYPHS.sparkles} text={h} />
              ))}
            </Card>
          )}

          {(stops.data?.length ?? 0) > 0 && (
            <Card>
              <SectionTitle>{tt.map}</SectionTitle>
              <Muted>{tt.mapHelp}</Muted>
              <View style={{ height: media.map, borderRadius: radius.card, overflow: 'hidden', borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border }}>
                <TourMap stops={stops.data!} labels={mapLabels} focus={focus} dom={{ scrollEnabled: false, style: { height: media.map }, matchContents: false }} />
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
                <View key={`${day.day}-${i}`} style={{ flexDirection: 'row', gap: space.md, paddingTop: i ? space.md : 0, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                  <NumberSquare value={day.day} />
                  <View style={{ flex: 1, gap: space.xxs }}>
                    <Text style={{ ...type.body, ...font.bold }}>{day.title}</Text>
                    <Muted>{day.body}</Muted>
                    <DayExtras day={day} stops={stops.data ?? []} />
                    {dayStops.length > 0 && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: space.xxs }}>
                        {dayStops.map((s) => (
                          <Text key={s.id} style={{ ...type.caption, ...font.bold, color: brand.forest }}>
                            {s.position}. {s.name}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </Card>

          {places.length > 0 && (
            <Section title={tt.aboutPlaces}>
              {places.map((place) => (
                <PlaceCard key={place.id} place={place} />
              ))}
            </Section>
          )}

          <Card>
            <SectionTitle>{tt.includes}</SectionTitle>
            {tour.includes.map((x) => (
              <IconLine key={x} glyph={GLYPHS.check} text={x} />
            ))}
            <SectionTitle>{tt.excludes}</SectionTitle>
            {tour.excludes.map((x) => (
              <IconLine key={x} glyph={GLYPHS.close} text={x} muted />
            ))}
          </Card>

          <Card>
            <SectionTitle>{tt.bestTime}</SectionTitle>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              {MONTHS[locale].map((m, i) => {
                const good = tour.best_months.includes(i + 1);
                return (
                  <View
                    key={m}
                    accessible
                    accessibilityLabel={m}
                    accessibilityState={{ selected: good }}
                    style={{ width: '15%', paddingVertical: space.xs, borderRadius: radius.chip, borderCurve: 'continuous', backgroundColor: good ? brand.primary : colors.fill, alignItems: 'center' }}
                  >
                    <Text maxFontSizeMultiplier={1.2} style={{ ...type.caption, ...font.bold, color: good ? brand.onDark : colors.secondaryLabel }}>
                      {m}
                    </Text>
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
                <IconLine key={x} glyph={GLYPHS.check} text={x} />
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
              {team.data!.guides.some((g) => g.is_sample) && <Muted>{t.extras.sampleGuideNote}</Muted>}
            </Card>
          )}

          {related.length > 0 && (
            <Section title={tt.related}>
              {related.map((x) => (
                <TourCard key={x.id} tour={x} />
              ))}
            </Section>
          )}
        </Animated.View>
      </ScrollView>
      <BottomBar>
        <Button
          title={tt.enquireTitle}
          onPress={() => {
            track(EVENTS.enquiryStarted, { kind: 'tour', tour: tour.slug, locale });
            router.push({ pathname: '/enquire/[slug]', params: { slug: tour.slug } });
          }}
        />
      </BottomBar>
    </View>
  );
}

/** One line with a small leading icon (instead of a ✓, ✦ or ✕ character). */
function IconLine({ glyph, text, muted, strong }: { glyph: GlyphName; text: string; muted?: boolean; strong?: boolean }) {
  const { type, font } = useType();
  return (
    <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
      <View style={{ paddingTop: space.xxs }}>
        <Glyph name={glyph} size={icon.inline} color={muted ? colors.secondaryLabel : brand.forest} />
      </View>
      <Text style={{ ...type.callout, ...(strong ? font.bold : null), color: muted ? colors.secondaryLabel : colors.label, flex: 1 }}>{text}</Text>
    </View>
  );
}

/** A day or stop number on a green square (forest, so the white number passes contrast); peaks are gold with dark text. */
function NumberSquare({ value, peak }: { value: number | string; peak?: boolean }) {
  const { type, font } = useType();
  return (
    <View style={{ width: iconBox.sm, height: iconBox.sm, borderRadius: radius.chip, borderCurve: 'continuous', backgroundColor: peak ? brand.gold : brand.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text maxFontSizeMultiplier={1.2} style={{ ...type.label, ...font.bold, color: peak ? brand.ink : brand.onDark }}>
        {value}
      </Text>
    </View>
  );
}

// Numbered stops with the leg from the previous stop: a checked distance and time, or only the
// straight-line distance, clearly labelled.
function StopList({ stops, kinds, onFocus }: { stops: TourStop[]; kinds: Record<string, string>; onFocus: (position: number) => void }) {
  const { t, locale } = useI18n();
  const { type, font } = useType();
  const tt = t.tours;
  return (
    <View style={{ gap: space.sm }}>
      {stops.map((stop, i) => {
        const previous = stops[i - 1];
        const crow = previous ? Math.round(straightLineKm({ lat: Number(previous.lat), lng: Number(previous.lng) }, { lat: Number(stop.lat), lng: Number(stop.lng) })) : 0;
        const checked = stop.distance_km || stop.transfer_hours;
        const mode = stop.transfer_mode ? `${TRANSFER_MODES[stop.transfer_mode][locale]}: ` : '';
        const km = stop.distance_km ? `${Math.round(Number(stop.distance_km))} km` : '';
        const hours = stop.transfer_hours ? `≈ ${Number(stop.transfer_hours)} h` : '';
        const source = stop.distance_source ? `(${tt.source}: ${stop.distance_source})` : null;
        // The same facts as before, as separate items instead of "A · B".
        const leg = checked ? (km ? [`${mode}${km}`, hours, source] : [`${mode}${hours}`, source]) : [`≈ ${crow} km ${tt.straightLine}`, tt.transferTbc];
        return (
          <Pressable key={stop.id} onPress={() => onFocus(stop.position)} accessibilityRole="button" accessibilityLabel={stop.name} style={({ pressed }) => ({ flexDirection: 'row', gap: space.md, minHeight: control.touch, opacity: pressed ? 0.7 : 1 })}>
            <NumberSquare value={stop.position} peak={stop.kind === 'peak'} />
            <View style={{ flex: 1, gap: space.xxs }}>
              <Text style={{ ...type.body, ...font.bold }}>{stop.name}</Text>
              <MetaItems items={[kinds[stop.kind], stop.day ? `${tt.dayLabel} ${stop.day}` : null, stop.elevation_m != null ? `≈ ${stop.elevation_m.toLocaleString('en-US')} m` : null]} />
              {previous && crow > 0 && <MetaItems items={leg} />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// Sample guides get the "Sample guide" badge and no "New guide" line; the tick only shows
// once Kwetuly has recorded a document check (same rule as the guide cards).
function GuideRow({ guide }: { guide: Guide }) {
  const { t, locale } = useI18n();
  const { type, font } = useType();
  const checked = !guide.is_sample && guide.verification_status === 'approved' && hasRecordedCheck(guide);
  return (
    <Link href={`/guide/${guide.slug}`} asChild>
      <Pressable accessibilityRole="link" style={({ pressed }) => ({ flexDirection: 'row', gap: space.md, alignItems: 'center', paddingVertical: space.xs, opacity: pressed ? 0.7 : 1 })}>
        <Avatar name={guide.display_name} uri={guide.photo_url} size={iconBox.lg + space.sm} />
        <View style={{ flex: 1, gap: space.xxs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <Text style={{ ...type.body, ...font.bold, flexShrink: 1 }}>{guide.display_name}</Text>
            {checked && (
              <View accessible accessibilityLabel={t.guides.verified}>
                <Glyph name={GLYPHS.check} size={icon.inline} color={brand.leafDark} />
              </View>
            )}
          </View>
          {guide.is_sample && <Badge label={t.extras.sampleGuide} tone="sand" />}
          <MetaItems items={[guide.specialties.slice(0, 2).map((s) => specialtyName(s, locale)).join(', '), guide.years_experience != null ? `${guide.years_experience} ${t.tours.yearsShort}` : null]} />
          <Text numberOfLines={1} style={{ ...type.caption, ...font.semibold, color: brand.forest }}>
            {guide.languages.map(languageName).join(', ')}
          </Text>
          {guide.is_sample ? null : guide.rating_count > 0 && guide.rating_avg != null ? (
            <Stars value={guide.rating_avg} size={12} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <Glyph name={GLYPHS.sparkles} size={icon.badge} color={brand.leafDark} />
              <Text style={{ ...type.caption, ...font.bold, color: brand.leafDark }}>{t.reviews.newGuide}</Text>
            </View>
          )}
        </View>
        <Text style={{ ...type.caption, ...font.bold, color: brand.link }}>{t.tours.viewProfile}</Text>
      </Pressable>
    </Link>
  );
}
