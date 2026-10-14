import { Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Image } from 'expo-image';
import { photoUrl, specialtyPhoto, tripPhoto, formatUsd } from '@rafrika/shared';
import type { GroupTrip, Guide, Tour } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { expertiseOf, formatDateRange, languageName, specialtyName } from '@/lib/labels';
import { brand, colors, radius } from '@/theme/colors';
import { Avatar, Badge, Card, Stars } from './ui';

// A guide at a glance: who they are, what they do, languages, special trips and badges.
export function GuideCard({ guide }: { guide: Guide }) {
  const { t, locale } = useI18n();
  return (
    <Link href={`/guide/${guide.slug}`} asChild>
      <Pressable accessibilityRole="link">
        <Card>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <Avatar name={guide.display_name} uri={guide.photo_url} size={64} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.label }}>{guide.display_name}</Text>
              {guide.headline && <Text numberOfLines={2} style={{ color: colors.secondaryLabel, fontSize: 14 }}>{guide.headline}</Text>}
              {guide.rating_count > 0 && guide.rating_avg != null ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Stars value={guide.rating_avg} />
                  <Text style={{ fontWeight: '700', color: colors.label, fontVariant: ['tabular-nums'] }}>{Number(guide.rating_avg).toFixed(1)}</Text>
                  <Text style={{ color: colors.secondaryLabel }}>({guide.rating_count})</Text>
                </View>
              ) : (
                <Text style={{ color: brand.sunsetDark, fontSize: 12, fontWeight: '700' }}>✦ {t.reviews.newGuide}</Text>
              )}
              <Text style={{ color: colors.secondaryLabel, fontSize: 12 }}>
                {guide.base_region}
                {guide.years_experience ? ` · ${guide.years_experience} ${t.guides.years}` : ''}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Badge label={`✓ ${t.guides.verified}`} />
            {guide.female_guide && <Badge label={t.guides.female} tone="sand" />}
            {guide.open_to_partners && <Badge label={t.guides.partners} tone="night" />}
            {guide.plan === 'pro' && <Badge label={t.guides.pro} tone="gold" />}
          </View>
          <Text style={{ color: colors.label, fontSize: 13 }}>{guide.specialties.map((s) => specialtyName(s, locale)).join(', ')}</Text>
          <Text style={{ color: brand.forest, fontSize: 13, fontWeight: '600' }}>{guide.languages.map(languageName).join(', ')}</Text>
          {guide.expertise.length > 0 && (
            <Text style={{ color: colors.secondaryLabel, fontSize: 12 }}>{expertiseOf(guide.expertise).map((e) => e.label[locale]).join(', ')}</Text>
          )}
        </Card>
      </Pressable>
    </Link>
  );
}

function PhotoHeader({ uri, label, price }: { uri: string; label: string; price?: string }) {
  return (
    <View style={{ height: 160, marginHorizontal: -16, marginTop: -16, marginBottom: 2, overflow: 'hidden', borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card }}>
      <Image source={{ uri }} style={{ flex: 1 }} contentFit="cover" transition={200} />
      <View style={{ position: 'absolute', top: 12, left: 12 }}>
        <Badge label={label} tone="gold" />
      </View>
      {price && (
        <View style={{ position: 'absolute', bottom: 12, right: 12, backgroundColor: brand.night, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ color: brand.gold, fontWeight: '800' }}>{price}</Text>
        </View>
      )}
    </View>
  );
}

export function SpotsBar({ taken, max, labels }: { taken: number; max: number; labels: { spotsLeft: string; full: string } }) {
  const left = Math.max(max - taken, 0);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.fill, overflow: 'hidden' }}>
        <View style={{ width: `${Math.min(100, (taken / max) * 100)}%`, height: '100%', backgroundColor: brand.sunset }} />
      </View>
      <Text style={{ color: left === 0 ? colors.secondaryLabel : brand.sunsetDark, fontWeight: '700', fontSize: 12, fontVariant: ['tabular-nums'] }}>
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
          <PhotoHeader uri={photoUrl(specialtyPhoto(trip.specialty), 900)} label={specialtyName(trip.specialty, locale)} price={`${formatUsd(trip.price_per_person_usd)} ${t.groups.perPerson}`} />
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.label }}>{trip.title}</Text>
          <Text style={{ color: colors.secondaryLabel }}>
            {formatDateRange(trip.start_date, trip.end_date, locale)} · {trip.region}
          </Text>
          {(trip.guides?.display_name || trip.company_name) && (
            <Text style={{ color: colors.secondaryLabel, fontSize: 13 }}>
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
            uri={photoUrl(tripPhoto(tour.slug, tour.categories), 900)}
            label={`${tour.days} ${tour.days === 1 ? t.tours.day : t.tours.days}`}
            price={tour.price_from_usd != null ? `${t.tours.priceFrom} ${formatUsd(tour.price_from_usd)}` : undefined}
          />
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.label }}>{title}</Text>
          <Text numberOfLines={2} style={{ color: colors.secondaryLabel }}>{(locale === 'sw' && tour.summary_sw) || tour.summary_en}</Text>
        </Card>
      </Pressable>
    </Link>
  );
}
