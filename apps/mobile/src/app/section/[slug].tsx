import { ScrollView, Text } from 'react-native';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { ALL_SECTIONS } from '@rafrika/shared';
import { Muted, ScreenState } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { appHref } from '@/lib/menu';
import { colors, radius, space, textSize } from '@/theme';

// One menu section with all its links (Special trips, Transport, Gear & Shop…), the step behind
// the short main menu.
export default function SectionScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, locale } = useI18n();
  const section = ALL_SECTIONS.find((s) => s.slug === slug);
  if (!section) return <ScreenState empty emptyText={t.ux.notFoundTitle} />;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.huge }}>
      <Stack.Title>{section.label[locale]}</Stack.Title>
      <Muted>{section.tagline[locale]}</Muted>
      {section.items.map((item) => (
        <Link key={item.slug} href={appHref(section, item)} asChild>
          <Text
            accessibilityRole="link"
            style={{ backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.separator, padding: space.lg, overflow: 'hidden' }}
          >
            <Text style={{ fontWeight: '800', color: colors.label, fontSize: textSize.body }}>
              {item.label[locale]}
              {item.status === 'live' ? '' : ` · ${t.nav.soon}`}
              {'\n'}
            </Text>
            <Text style={{ color: colors.secondaryLabel, fontSize: textSize.footnote }}>{item.blurb[locale]}</Text>
          </Text>
        </Link>
      ))}
    </ScrollView>
  );
}
