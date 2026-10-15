import { Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Image } from 'expo-image';
import { TOUR_TYPES, formatPrice, formatUsd, specialtyPhoto, tourSummary, tourTitle, tripPhoto, verifiedPrice, type Photo } from '@rafrika/shared';
import { photoSource } from '@/lib/photos';
import type { GroupTrip, Guide, Tour } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { expertiseOf, formatDateRange, languageName, specialtyName } from '@/lib/labels';

import { Avatar, Badge, Card, Stars } from './ui';
import { brand, colors, radius, space, textSize } from '@/theme';

// A guide at a glance: who they are, what they do, languages, special trips and badges.
export function GuideCard({ guide }: { guide: Guide }) {
  const { t, locale } = useI18n();
  return (
    <Link href={`/guide/${guide.slug}`} asChild>
      <Pressable accessibilityRole="link">
        <Card>
          <View style={{ flexDirection: 'row', gap: space.lg }}>
            <Avatar name={guide.display_name} uri={guide.photo_url} size={64} />
            <View style={{ flex: 1, gap: space.xs }}>
              <Text style={{ fontSize: textSize.headline, fontWeight: '800', color: colors.label }}>{guide.display_name}</Text>
              {guide.headline && <Text numberOfLines={2} style={{ color: colors.secondaryLabel, fontSize: textSize.subhead }}>{guide.headline}</Text>}
              {guide.rating_count > 0 && guide.rating_avg != null ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <Stars value={guide.rating_avg} />
                  <Text style={{ fontWeight: '700', color: colors.label, fontVariant: ['tabular-nums'] }}>{Number(guide.rating_avg).toFixed(1)}</Text>
                  <Text style={{ color: colors.secondaryLabel }}>({guide.rating_count})</Text>
                </View>
              ) : (
                <Text style={{ color: brand.leafDark, fontSize: textSize.caption, fontWeight: '700' }}>✦ {t.reviews.newGuide}</Text>
              )}
              <Text style={{ color: colors.secondaryLabel, fontSize: textSize.caption }}>
                {guide.base_region}
                {guide.years_experience ? ` · ${guide.years_experience} ${t.guides.years}` : ''}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Badge label={`✓ ${t.guides.verified}`} />
            {guide.female_guide && <Badge label={t.guides.female} tone="sand" />}
            {guide.open_to_partners && <Badge label={t.guides.partners} tone="night" />}
            {guide.plan === 'pro' && <Badge label={t.guides.pro} tone="gold" />}
          </View>
          <Text style={{ color: colors.label, fontSize: textSize.footnote }}>{guide.specialties.map((s) => specialtyName(s, locale)).join(', ')}</Text>
          <Text style={{ color: brand.forest, fontSize: textSize.footnote, fontWeight: '600' }}>{guide.languages.map(languageName).join(', ')}</Text>
          {guide.expertise.length > 0 && (
            <Text style={{ color: colors.secondaryLabel, fontSize: textSize.caption }}>{expertiseOf(guide.expertise).map((e) => e.label[locale]).join(', ')}</Text>
          )}
        </Card>
      </Pressable>
    </Link>
  );
}

function PhotoHeader({ photo, uri, label, price, tone = 'gold' }: { photo: Photo; uri?: string | null; label: string; price?: string; tone?: 'gold' | 'sand' }) {
  return (
    <View style={{ height: 160, marginHorizontal: -16, marginTop: -16, marginBottom: space.xxs, overflow: 'hidden', borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card }}>
      <Image source={uri ? { uri } : photoSource(photo, 900)} style={{ flex: 1 }} accessibilityLabel={photo.alt} contentFit="cover" transition={200} />
      <View style={{ position: 'absolute', top: 12, left: 12 }}>
        <Badge label={label} tone={tone} />
      </View>
      {price && (
        <View style={{ position: 'absolute', bottom: 12, right: 12, backgroundColor: brand.night, borderRadius: radius.chip, paddingHorizontal: space.md, paddingVertical: space.sm }}>
          <Text style={{ color: brand.onDark, fontWeight: '800' }}>{price}</Text>
        </View>
      )}
    </View>
  );
}

export function SpotsBar({ taken, max, labels }: { taken: number; max: number; labels: { spotsLeft: string; full: string } }) {
  const left = Math.max(max - taken, 0);
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ height: 8, borderRadius: radius.bar, backgroundColor: colors.fill, overflow: 'hidden' }}>
        <View style={{ width: `${Math.min(100, (taken / max) * 100)}%`, height: '100%', backgroundColor: brand.leaf }} />
      </View>
      <Text style={{ color: left === 0 ? colors.secondaryLabel : brand.leafDark, fontWeight: '700', fontSize: textSize.caption, fontVariant: ['tabular-nums'] }}>
        {left === 0 ? labels.full : `${left} ${labels.spotsLeft}`} · {taken}/{max}
      </Text>
    </View>
  );
}

export function GroupTripCard({ trip }: { trip: GroupTrip }) {
  const { t, locale } = useI18n();
  return (
    <Link href={`/group-trip/${trip.id}`} asChild>
      <Pressable accessibilityRole="link">
        <Card>
          <PhotoHeader photo={specialtyPhoto(trip.specialty)} label={specialtyName(trip.specialty, locale)} price={`${formatUsd(trip.price_per_person_usd)} ${t.groups.perPerson}`} />
          <Text style={{ fontSize: textSize.headline, fontWeight: '800', color: colors.label }}>{trip.title}</Text>
          <Text style={{ color: colors.secondaryLabel }}>
            {formatDateRange(trip.start_date, trip.end_date, locale)} · {trip.region}
          </Text>
          {(trip.guides?.display_name || trip.company_name) && (
            <Text style={{ color: colors.secondaryLabel, fontSize: textSize.footnote }}>
              {t.groups.organisedBy} {trip.guides?.display_name ?? trip.company_name}
            </Text>
          )}
          <SpotsBar taken={trip.seats_taken} max={trip.max_people} labels={t.groups} />
        </Card>
      </Pressable>
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
      <Pressable accessibilityRole="link">
        <Card>
          <PhotoHeader
            photo={tripPhoto(tour.slug, tour.categories)}
            uri={tour.cover_url}
            label={`${tour.is_signature ? '✦ ' : ''}${TOUR_TYPES.find((x) => x.id === tour.tour_type)?.[locale] ?? ''}`}
            tone={tour.is_signature ? 'gold' : 'sand'}
            price={price ? `${t.tours.priceFrom} ${formatPrice(price.amount, price.currency)}` : undefined}
          />
          <Text style={{ fontSize: textSize.headline, fontWeight: '800', color: colors.label }}>{tourTitle(tour, locale)}</Text>
          <Text numberOfLines={2} style={{ color: colors.secondaryLabel }}>{tourSummary(tour, locale)}</Text>
          <Text style={{ color: colors.secondaryLabel, fontSize: textSize.caption, fontWeight: '600' }}>
            {days}{nights}{tour.start_from ? ` · ${tour.start_from}` : ''}
            {tour.tour_operators ? ` · ${tour.tour_operators.name}${tour.tour_operators.verified_at ? ' ✓' : ''}` : ''}
          </Text>
          {!price && <Text style={{ color: brand.leafDark, fontSize: textSize.caption, fontWeight: '700' }}>{t.tours.priceTbc}</Text>}
        </Card>
      </Pressable>
    </Link>
  );
}
