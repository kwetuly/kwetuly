import { Pressable, ScrollView, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { GUIDE_EXPERTISE, GUIDE_SPECIALTIES, PHOTOS, photoUrl } from '@rafrika/shared';
import { GroupTripCard } from '@/components/cards';
import { Chip, SectionTitle } from '@/components/ui';
import { listGroupTrips } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { brand, colors, radius } from '@/theme/colors';

export default function ExploreScreen() {
  const { t, locale } = useI18n();
  const groups = useQuery({ queryKey: ['group-trips'], queryFn: listGroupTrips });
  const hero = PHOTOS.safariSunset;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 32, gap: 24 }} style={{ backgroundColor: colors.background }}>
      <Stack.Title large>Rafrika</Stack.Title>

      {/* Hero */}
      <View style={{ marginHorizontal: 16, height: 260, borderRadius: 28, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: brand.night }}>
        <Image source={{ uri: photoUrl(hero, 1200) }} style={{ position: 'absolute', inset: 0 }} contentFit="cover" accessibilityLabel={hero.alt} />
        <View style={{ flex: 1, justifyContent: 'flex-end', padding: 20, gap: 8, experimental_backgroundImage: 'linear-gradient(to top, rgba(10,31,23,0.95), rgba(10,31,23,0.1))' }}>
          <Text style={{ color: brand.gold, fontWeight: '800', fontSize: 12, letterSpacing: 2 }}>{t.home.eyebrow.toUpperCase()}</Text>
          <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 28, lineHeight: 32 }}>{t.home.title}</Text>
          <Link href="/guides" asChild>
            <Pressable style={{ backgroundColor: brand.sunset, borderRadius: radius.button, borderCurve: 'continuous', paddingVertical: 12, alignItems: 'center', marginTop: 6 }}>
              <Text style={{ color: '#ffffff', fontWeight: '800' }}>{t.home.search}</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      {/* What do you want to do? */}
      <View style={{ gap: 12, paddingHorizontal: 16 }}>
        <SectionTitle>{t.home.specialtyLabel}</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {GUIDE_SPECIALTIES.map((s) => (
            <Link key={s.id} href={{ pathname: '/guides', params: { specialty: s.id } }} asChild>
              <Chip label={s[locale]} />
            </Link>
          ))}
        </View>
      </View>

      {/* Special trips */}
      <View style={{ gap: 12 }}>
        <View style={{ paddingHorizontal: 16 }}>
          <SectionTitle>{t.guides.expertise}</SectionTitle>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
          <Link href={{ pathname: '/guides', params: { female: '1' } }} asChild>
            <Chip label={t.guides.femaleOnly} />
          </Link>
          {GUIDE_EXPERTISE.map((e) => (
            <Link key={e.id} href={{ pathname: '/guides', params: { expertise: e.id } }} asChild>
              <Chip label={e.label[locale]} />
            </Link>
          ))}
        </ScrollView>
      </View>

      {/* Group trips */}
      <View style={{ gap: 12, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <SectionTitle>{t.groups.title}</SectionTitle>
          <Link href="/trips" style={{ color: brand.sunset, fontWeight: '700' }}>
            {t.explore.more}
          </Link>
        </View>
        {(groups.data ?? []).length === 0 ? (
          <Text style={{ color: colors.secondaryLabel }}>{t.groups.none}</Text>
        ) : (
          groups.data!.slice(0, 3).map((trip) => <GroupTripCard key={trip.id} trip={trip} />)
        )}
      </View>

      {/* Why Rafrika */}
      <View style={{ gap: 12, paddingHorizontal: 16 }}>
        <SectionTitle>{t.home.whyTitle}</SectionTitle>
        {t.home.why.map((item) => (
          <View key={item.title} style={{ backgroundColor: colors.card, borderRadius: radius.card, borderCurve: 'continuous', padding: 16, gap: 4 }}>
            <Text style={{ fontWeight: '800', fontSize: 16, color: colors.label }}>{item.title}</Text>
            <Text style={{ color: colors.secondaryLabel, lineHeight: 20 }}>{item.body}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
