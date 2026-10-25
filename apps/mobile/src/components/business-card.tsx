import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { BADGE_CHECKS, BUSINESS_TYPES, hasValidBadge, type Business } from '@kwetuly/shared';
import { Badge, Card } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { brand, colors, radius, space, textSize } from '@/theme';

const todayIso = () => new Date().toISOString().slice(0, 10);

/** The paid "Checked by Kwetuly" badge: what was checked and when, never a recommendation. */
export function BusinessBadge({ business, full }: { business: Business; full?: boolean }) {
  const { t, locale } = useI18n();
  const bt = t.business;
  // Sample listings were added by Kwetuly from public information; say so plainly.
  if (business.is_sample) {
    return full ? (
      <Text style={{ color: colors.label, backgroundColor: brand.sand, padding: space.md, borderRadius: radius.button }}>
        <Text style={{ fontWeight: '700' }}>{t.extras.sampleBadge}. </Text>
        {t.extras.sampleNote}
      </Text>
    ) : (
      <Badge label={t.extras.sampleBadge} tone="sand" />
    );
  }
  if (!hasValidBadge(business, todayIso())) {
    return full ? (
      <Text style={{ color: colors.secondaryLabel, backgroundColor: colors.fill, padding: space.md, borderRadius: radius.button }}>
        <Text style={{ fontWeight: '700' }}>{bt.listed}. </Text>
        {bt.listedExplain}
      </Text>
    ) : (
      <Badge label={bt.listed} tone="night" />
    );
  }
  if (!full) return <Badge label={`✓ ${bt.checked}`} tone="mint" />;
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return (
    <View style={{ gap: space.xs, backgroundColor: brand.mint, padding: space.md, borderRadius: radius.button, borderWidth: 1, borderColor: brand.leaf }}>
      <Text style={{ color: brand.forest, fontWeight: '800' }}>✓ {bt.checked}</Text>
      <Text style={{ color: brand.forest }}>
        {bt.checkedOn.replace('{date}', date.format(new Date(business.badge_checked_at ?? business.badge_valid_until!))).replace('{until}', date.format(new Date(business.badge_valid_until!)))}
      </Text>
      <Text style={{ color: brand.forest, fontWeight: '700', marginTop: space.xs }}>{bt.checkedWhat}</Text>
      {BADGE_CHECKS.filter((c) => business.badge_checks.includes(c.id)).map((c) => (
        <Text key={c.id} style={{ color: brand.forest }}>✓ {c[locale]}</Text>
      ))}
      <Text style={{ color: colors.label, fontSize: textSize.caption, marginTop: space.xs }}>{bt.badgeExplain}</Text>
    </View>
  );
}

export function BusinessCard({ business }: { business: Business }) {
  const { locale } = useI18n();
  return (
    <Pressable onPress={() => router.push({ pathname: '/business/[id]', params: { id: business.id } })} accessibilityRole="link">
      <Card style={{ flexDirection: 'row', gap: space.md }}>
        {business.photo_url && <Image source={{ uri: business.photo_url }} style={{ width: 72, height: 72, borderRadius: radius.button }} contentFit="cover" />}
        <View style={{ flex: 1, gap: space.xxs }}>
          <Text style={{ color: brand.leafDark, fontWeight: '700', fontSize: textSize.caption }}>{BUSINESS_TYPES.find((b) => b.id === business.business_type)?.[locale]}</Text>
          <Text style={{ color: colors.label, fontWeight: '800' }}>{business.business_name}</Text>
          <Text style={{ color: colors.secondaryLabel, fontSize: textSize.footnote }}>{[business.location, business.base_region].filter(Boolean).join(', ')}</Text>
          <View style={{ flexDirection: 'row' }}>
            <BusinessBadge business={business} />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
