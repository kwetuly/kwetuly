import { Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Image } from 'expo-image';
import { specialtyPhoto, tripPhoto, formatUsd, type Photo } from '@rafrika/shared';
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
                <Text style={{ color: brand.sunsetDark, fontSize: textSize.caption, fontWeight: '700' }}>✦ {t.reviews.newGuide}</Text>
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

function PhotoHeader({ photo, label, price }: { photo: Photo; label: string; price?: string }) {
  return (
    <View style={{ height: 160, marginHorizontal: -16, marginTop: -16, marginBottom: space.xxs, overflow: 'hidden', borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card }}>
      <Image source={photoSource(photo, 900)} style={{ flex: 1 }} accessibilityLabel={photo.alt} contentFit="cover" transition={200} />
      <View style={{ position: 'absolute', top: 12, left: 12 }}>
        <Badge label={label} tone="gold" />
      </View>
      {price && (
        <View style={{ position: 'absolute', bottom: 12, right: 12, backgroundColor: brand.night, borderRadius: radius.chip, paddingHorizontal: space.md, paddingVertical: space.sm }}>
          <Text style={{ color: brand.gold, fontWeight: '800' }}>{price}</Text>
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
        <View style={{ width: `${Math.min(100, (taken / max) * 100)}%`, height: '100%', backgroundColor: brand.sunset }} />
      </View>
      <Text style={{ color: left === 0 ? colors.secondaryLabel : brand.sunsetDark, fontWeight: '700', fontSize: textSize.caption, fontVariant: ['tabular-nums'] }}>
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
  const title = (locale === 'sw' && tour.title_sw) || tour.title_en;
  return (
    <Link href={`/tour/${tour.slug}`} asChild>
      <Pressable accessibilityRole="link">
        <Card>
          <PhotoHeader
            photo={tripPhoto(tour.slug, tour.categories)}
            label={`${tour.days} ${tour.days === 1 ? t.tours.day : t.tours.days}`}
            price={tour.price_from_usd != null ? `${t.tours.priceFrom} ${formatUsd(tour.price_from_usd)}` : undefined}
          />
          <Text style={{ fontSize: textSize.headline, fontWeight: '800', color: colors.label }}>{title}</Text>
          <Text numberOfLines={2} style={{ color: colors.secondaryLabel }}>{(locale === 'sw' && tour.summary_sw) || tour.summary_en}</Text>
        </Card>
      </Pressable>
    </Link>
  );
}
