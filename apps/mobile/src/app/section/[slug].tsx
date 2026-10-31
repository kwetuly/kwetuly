import { Pressable, ScrollView, Text, View } from 'react-native';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { ALL_SECTIONS, MENU } from '@kwetuly/shared';
import { Glyph } from '@/components/glyph';
import { Muted, ScreenState } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { appHref } from '@/lib/menu';
import { menuIcon } from '@/lib/menu-icons';
import { brand, colors, radius, space, textSize } from '@/theme';

// One menu section with all its links (Group trips, Transport, Shop…), the step behind the main menu.
export default function SectionScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, locale } = useI18n();
  // The main menu may rename a section (Experiences is "Trips" there), so look there first.
  const section = MENU.find((s) => s.slug === slug) ?? ALL_SECTIONS.find((s) => s.slug === slug);
  if (!section) return <ScreenState empty emptyText={t.ux.notFoundTitle} />;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.huge }}>
      <Stack.Title>{section.label[locale]}</Stack.Title>
      <Muted>{section.tagline[locale]}</Muted>
      <View style={{ backgroundColor: colors.card, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.separator, overflow: 'hidden' }}>
        {section.items.filter((item) => !item.webOnly).map((item, i) => (
          <Link key={item.slug} href={appHref(section, item)} asChild>
            <Pressable accessibilityRole="link" style={{ borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg }}>
                <View style={{ width: 40, height: 40, borderRadius: radius.button, backgroundColor: brand.mint, alignItems: 'center', justifyContent: 'center' }}>
                  <Glyph name={menuIcon(item.icon)} size={20} color={brand.forest} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontWeight: '700', color: colors.label, fontSize: textSize.body }}>{item.label[locale]}</Text>
                  <Text style={{ color: colors.secondaryLabel, fontSize: textSize.footnote }}>{item.blurb[locale]}</Text>
                </View>
                {item.status !== 'live' && <Text style={{ color: brand.leafDark, fontSize: textSize.caption, fontWeight: '700' }}>{t.nav.soon}</Text>}
                <Glyph name={{ ios: 'chevron.right', android: 'chevron_right' }} size={14} color={colors.secondaryLabel as string} />
              </View>
            </Pressable>
          </Link>
        ))}
      </View>
    </ScrollView>
  );
}
