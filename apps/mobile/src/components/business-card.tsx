import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { BADGE_CHECKS, BUSINESS_TYPES, hasValidBadge, type Business } from '@kwetuly/shared';
import { GLYPHS, Glyph } from '@/components/glyph';
import { Badge, Card } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { useType } from '@/lib/use-type';
import { brand, colors, icon, media, radius, space } from '@/theme';

const todayIso = () => new Date().toISOString().slice(0, 10);

/** The paid "Checked by Kwetuly" badge: what was checked and when, never a recommendation. */
export function BusinessBadge({ business, full }: { business: Business; full?: boolean }) {
  const { t, locale } = useI18n();
  const { type, font } = useType();
  const bt = t.business;
  const panel = { padding: space.md, borderRadius: radius.button, borderCurve: 'continuous' as const };
  // Sample listings were added by Kwetuly from public information; say so plainly.
  if (business.is_sample) {
    return full ? (
      <Text style={{ ...type.callout, backgroundColor: brand.sand, ...panel, overflow: 'hidden' }}>
        <Text style={font.bold}>{t.extras.sampleBadge}. </Text>
        {t.extras.sampleNote}
      </Text>
    ) : (
      <Badge label={t.extras.sampleBadge} tone="sand" />
    );
  }
  if (!hasValidBadge(business, todayIso())) {
    return full ? (
      <Text style={{ ...type.callout, color: colors.secondaryLabel, backgroundColor: colors.background, ...panel, overflow: 'hidden' }}>
        <Text style={font.bold}>{bt.listed}. </Text>
        {bt.listedExplain}
      </Text>
    ) : (
      <Badge label={bt.listed} tone="neutral" />
    );
  }
  if (!full) return <Badge label={bt.checked} tone="mint" icon={GLYPHS.check} />;
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const check = (text: string, key?: string) => (
    <View key={key} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
      <View style={{ paddingTop: space.xxs }}>
        <Glyph name={GLYPHS.check} size={icon.inline} color={brand.forest} />
      </View>
      <Text style={{ ...type.callout, color: brand.forest, flex: 1 }}>{text}</Text>
    </View>
  );
  return (
    <View style={{ gap: space.xs, backgroundColor: brand.mint, ...panel, borderWidth: 1, borderColor: brand.primary }}>
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
        <Glyph name={GLYPHS.check} size={icon.square} color={brand.forest} />
        <Text style={{ ...type.cardTitle, color: brand.forest, flex: 1 }}>{bt.checked}</Text>
      </View>
      <Text style={{ ...type.callout, color: brand.forest }}>
        {bt.checkedOn.replace('{date}', date.format(new Date(business.badge_checked_at ?? business.badge_valid_until!))).replace('{until}', date.format(new Date(business.badge_valid_until!)))}
      </Text>
      <Text style={{ ...type.callout, ...font.bold, color: brand.forest, marginTop: space.xs }}>{bt.checkedWhat}</Text>
      {BADGE_CHECKS.filter((c) => business.badge_checks.includes(c.id)).map((c) => check(c[locale], c.id))}
      <Text style={{ ...type.caption, color: colors.label, marginTop: space.xs }}>{bt.badgeExplain}</Text>
    </View>
  );
}

export function BusinessCard({ business }: { business: Business }) {
  const { locale } = useI18n();
  const { type, font } = useType();
  return (
    <Card accessibilityRole="link" onPress={() => router.push({ pathname: '/business/[id]', params: { id: business.id } })} style={{ flexDirection: 'row', gap: space.md }}>
      {business.photo_url && <Image source={{ uri: business.photo_url }} style={{ backgroundColor: colors.fill, width: media.thumb, height: media.thumb, borderRadius: radius.media }} contentFit="cover" />}
      <View style={{ flex: 1, gap: space.xxs }}>
        <Text style={{ ...type.caption, ...font.bold, color: brand.link }}>{BUSINESS_TYPES.find((b) => b.id === business.business_type)?.[locale]}</Text>
        <Text style={type.cardTitle}>{business.business_name}</Text>
        <Text style={type.meta}>{[business.location, business.base_region].filter(Boolean).join(', ')}</Text>
        <View style={{ flexDirection: 'row' }}>
          <BusinessBadge business={business} />
        </View>
      </View>
    </Card>
  );
}
