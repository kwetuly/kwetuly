import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Link } from 'expo-router';
import { Image } from 'expo-image';
import { TOUR_TYPES, formatPrice, hasRecordedCheck, formatUsd, groupPriceOnRequest, specialtyPhoto, tourSummary, tourTitle, tripPhoto, verifiedPrice, type Photo } from '@kwetuly/shared';
import { photoSource } from '@/lib/photos';
import type { GroupTrip, Guide, Tour } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { expertiseOf, formatDateRange, languageName, specialtyName } from '@/lib/labels';

import { GLYPHS, Glyph } from './glyph';
import { Avatar, Badge, Card, Muted, Stars } from './ui';
import { brand, colors, control, font, icon, layout, media, motion, radius, space, textSize, type } from '@/theme';

/** Short facts side by side with a gap instead of "A · B · C"; they wrap on narrow phones. */
function MetaItems({ items }: { items: (string | null | undefined | false)[] }) {
  const shown = items.filter((x): x is string => !!x);
  if (shown.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: space.xxs }}>
      {shown.map((item) => (
        <Text key={item} style={type.meta}>
          {item}
        </Text>
      ))}
    </View>
  );
}

// A guide at a glance: who they are, what they do, languages, special trips and badges.
export function GuideCard({ guide }: { guide: Guide }) {
  const { t, locale } = useI18n();
  return (
    <Link href={`/guide/${guide.slug}`} asChild>
      <Card accessibilityRole="link">
        <View style={{ flexDirection: 'row', gap: space.lg }}>
          <Avatar name={guide.display_name} uri={guide.photo_url} size={64} />
          <View style={{ flex: 1, gap: space.xs }}>
            <Text style={type.cardTitle}>{guide.display_name}</Text>
            {guide.headline && <Text numberOfLines={2} style={{ ...type.muted }}>{guide.headline}</Text>}
            {guide.rating_count > 0 && guide.rating_avg != null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Stars value={guide.rating_avg} />
                <Text style={{ ...font.bold, color: colors.label, fontVariant: ['tabular-nums'] }}>{Number(guide.rating_avg).toFixed(1)}</Text>
                <Text style={type.meta}>({guide.rating_count})</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                <Glyph name={GLYPHS.sparkles} size={icon.badge} color={brand.leafDark} />
                <Text style={{ color: brand.leafDark, fontSize: textSize.caption, ...font.bold }}>{t.reviews.newGuide}</Text>
              </View>
            )}
            <MetaItems items={[guide.base_region, guide.years_experience ? `${guide.years_experience} ${t.guides.years}` : null]} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: layout.inlineGap }}>
          {guide.is_sample ? <Badge label={t.extras.sampleGuide} tone="sand" /> : hasRecordedCheck(guide) ? <Badge label={t.guides.verified} icon={GLYPHS.check} /> : null}
          {guide.female_guide && <Badge label={t.guides.female} tone="sand" />}
          {guide.open_to_partners && <Badge label={t.guides.partners} tone="neutral" />}
          {guide.plan === 'pro' && <Badge label={t.guides.pro} tone="gold" />}
        </View>
        <Text style={{ ...type.meta, color: colors.label }}>{guide.specialties.map((s) => specialtyName(s, locale)).join(', ')}</Text>
        <Text style={{ ...type.meta, ...font.semibold, color: brand.forest }}>{guide.languages.map(languageName).join(', ')}</Text>
        {guide.expertise.length > 0 && <Text style={type.caption}>{expertiseOf(guide.expertise).map((e) => e.label[locale]).join(', ')}</Text>}
      </Card>
    </Link>
  );
}

function PhotoHeader({ photo, uri, label, price, tone = 'gold', signature }: { photo: Photo; uri?: string | null; label: string; price?: string; tone?: 'gold' | 'sand'; signature?: boolean }) {
  return (
    <View style={{ height: media.cardPhoto, marginHorizontal: -layout.cardPadding, marginTop: -layout.cardPadding, marginBottom: space.xxs, overflow: 'hidden', borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card }}>
      <Image source={uri ? { uri } : photoSource(photo, 900)} style={{ flex: 1 }} accessibilityLabel={photo.alt} contentFit="cover" transition={200} />
      {!!label && (
        <View style={{ position: 'absolute', top: space.md, left: space.md }}>
          <Badge label={label} tone={tone} icon={signature ? GLYPHS.sparkles : undefined} />
        </View>
      )}
      {price && (
        // Small white text sits on the dark shade, not on grey (contrast).
        <View style={{ position: 'absolute', bottom: space.md, right: space.md, backgroundColor: brand.shade, borderRadius: radius.chip, borderCurve: 'continuous', paddingHorizontal: space.md, paddingVertical: space.sm }}>
          <Text style={{ color: brand.onDark, ...font.bold, fontVariant: ['tabular-nums'] }}>{price}</Text>
        </View>
      )}
    </View>
  );
}

/** How full a group is: a thin bar that fills on mount (instantly with Reduce Motion), then "{left} spots left" and "{taken}/{max}". */
export function SpotsBar({ taken, max, labels }: { taken: number; max: number; labels: { spotsLeft: string; full: string } }) {
  const left = Math.max(max - taken, 0);
  const share = max > 0 ? Math.min(100, (taken / max) * 100) : 0;
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withTiming(share, { duration: motion.spots, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System });
  }, [share, width]);
  const fill = useAnimatedStyle(() => ({ width: `${width.value}%` }));
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ height: control.bar, borderRadius: radius.bar, backgroundColor: colors.fill, overflow: 'hidden' }}>
        <Animated.View style={[{ height: '100%', backgroundColor: brand.leaf }, fill]} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Text style={{ color: left === 0 ? colors.secondaryLabel : brand.leafDark, ...font.bold, fontSize: textSize.caption, fontVariant: ['tabular-nums'] }}>
          {left === 0 ? labels.full : `${left} ${labels.spotsLeft}`}
        </Text>
        <Text style={{ ...type.caption, fontVariant: ['tabular-nums'] }}>
          {taken}/{max}
        </Text>
      </View>
    </View>
  );
}

export function GroupTripCard({ trip }: { trip: GroupTrip }) {
  const { t, locale } = useI18n();
  return (
    <Link href={`/group-trip/${trip.id}`} asChild>
      <Card accessibilityRole="link">
        <PhotoHeader photo={specialtyPhoto(trip.specialty)} label={specialtyName(trip.specialty, locale)} price={groupPriceOnRequest(trip) ? t.extras.priceOnRequest : `${formatUsd(trip.price_per_person_usd)} ${t.groups.perPerson}`} />
        {trip.guides?.is_sample && <Badge label={t.extras.sampleTrip} tone="sand" />}
        <Text style={type.cardTitle}>{trip.title}</Text>
        <View style={{ gap: space.xxs }}>
          <Text style={type.meta}>{formatDateRange(trip.start_date, trip.end_date, locale)}</Text>
          <Text style={type.meta}>{trip.region}</Text>
        </View>
        {trip.organizer_kind === 'traveller' && <Muted>{t.extras.byTraveller}</Muted>}
        {trip.already_going > 0 && <Muted>{t.extras.alreadyGoingShort.replace('{n}', String(trip.already_going))}</Muted>}
        {trip.organizer_kind !== 'traveller' && (trip.guides?.display_name || trip.company_name) && (
          <Text style={type.meta}>
            {t.groups.organisedBy} {trip.guides?.display_name ?? trip.company_name}
          </Text>
        )}
        <SpotsBar taken={trip.seats_taken + (trip.already_going ?? 0)} max={trip.max_people} labels={t.groups} />
      </Card>
    </Link>
  );
}

export function TourCard({ tour }: { tour: Tour }) {
  const { t, locale } = useI18n();
  const price = verifiedPrice(tour, new Date());
  const days = `${tour.days} ${tour.days === 1 ? t.tours.day : t.tours.days}`;
  const nights = tour.nights ? ` / ${tour.nights} ${tour.nights === 1 ? t.tours.night : t.tours.nights}` : '';
  return (
    <Link href={`/tour/${tour.slug}`} asChild>
      <Card accessibilityRole="link">
        <PhotoHeader
          photo={tripPhoto(tour.slug, tour.categories)}
          uri={tour.cover_url}
          label={TOUR_TYPES.find((x) => x.id === tour.tour_type)?.[locale] ?? ''}
          tone={tour.is_signature ? 'gold' : 'sand'}
          signature={tour.is_signature}
          price={price ? `${t.tours.priceFrom} ${formatPrice(price.amount, price.currency)}` : undefined}
        />
        <Text style={type.cardTitle}>{tourTitle(tour, locale)}</Text>
        <Text numberOfLines={2} style={type.muted}>
          {tourSummary(tour, locale)}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.md, rowGap: space.xxs }}>
          <Text style={{ ...type.caption, ...font.semibold }}>
            {days}
            {nights}
          </Text>
          {tour.start_from ? <Text style={{ ...type.caption, ...font.semibold }}>{tour.start_from}</Text> : null}
          {tour.tour_operators ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xxs }}>
              <Text style={{ ...type.caption, ...font.semibold }}>{tour.tour_operators.name}</Text>
              {tour.tour_operators.verified_at ? <Glyph name={GLYPHS.check} size={icon.badge} color={brand.leafDark} /> : null}
            </View>
          ) : null}
        </View>
        {!price && <Text style={{ color: brand.leafDark, fontSize: textSize.caption, ...font.bold }}>{t.tours.priceTbc}</Text>}
      </Card>
    </Link>
  );
}
