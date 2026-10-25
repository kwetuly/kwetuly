import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { EVENTS, PACKAGE_KINDS, packageDuration, packagePrice, type GuidePackage } from '@kwetuly/shared';
import { Button, Card, SectionTitle } from '@/components/ui';
import { track } from '@/lib/analytics';
import { useI18n } from '@/lib/i18n';
import { brand, colors, radius, space, textSize } from '@/theme';

/**
 * A guide's approved packages. Each card opens in place, and "Ask about this package" goes
 * straight to the contact form with the package filled in, like on the website.
 */
export function GuidePackages({ packages, guideId, guideName, guideSlug }: { packages: GuidePackage[]; guideId: string; guideName: string; guideSlug: string }) {
  const { t } = useI18n();
  if (packages.length === 0) return null;
  return (
    <View style={{ gap: space.md }}>
      <SectionTitle>{t.packages.byGuide.replace('{name}', guideName)}</SectionTitle>
      {packages.map((p) => (
        <PackageCard key={p.id} p={p} guideId={guideId} guideName={guideName} guideSlug={guideSlug} />
      ))}
    </View>
  );
}

/** One package that opens in place. `showGuide` adds a link to the guide, for lists away from the profile. */
export function PackageCard({ p, guideId, guideName, guideSlug, showGuide }: { p: GuidePackage; guideId: string; guideName: string; guideSlug: string; showGuide?: boolean }) {
  const { t, locale } = useI18n();
  const pt = t.packages;
  const [open, setOpen] = useState(false);
  const duration = packageDuration(p, pt);
  const facts = [packagePrice(p, pt), duration, p.max_group === 1 ? t.extras.justYou : p.max_group ? pt.upTo.replace('{n}', String(p.max_group)) : null].filter(Boolean).join(' · ');

  return (
    <Card style={open ? { borderColor: brand.leaf } : undefined}>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ flexDirection: 'row', gap: space.md }}>
        {p.photo_url && <Image source={{ uri: p.photo_url }} style={{ width: 76, height: 76, borderRadius: radius.button }} contentFit="cover" />}
        <View style={{ flex: 1, gap: space.xxs }}>
          <Text style={{ color: brand.leafDark, fontWeight: '700', fontSize: textSize.caption }}>{PACKAGE_KINDS.find((k) => k.id === p.kind)?.[locale]}</Text>
          <Text style={{ color: colors.label, fontWeight: '800', fontSize: textSize.body }}>{p.title}</Text>
          <Text style={{ color: colors.secondaryLabel, fontSize: textSize.footnote }}>{p.summary}</Text>
          <Text style={{ color: brand.forest, fontWeight: '700', fontSize: textSize.footnote }}>{facts}</Text>
          {!open && <Text style={{ color: brand.forest, fontWeight: '700', textDecorationLine: 'underline', fontSize: textSize.footnote }}>{pt.details}</Text>}
        </View>
      </Pressable>
      {open && (
        <View style={{ gap: space.md, borderTopWidth: 1, borderTopColor: colors.separator, paddingTop: space.md }}>
          {p.details && <Text selectable style={{ color: colors.label, lineHeight: 21 }}>{p.details}</Text>}
          {p.includes.length > 0 && (
            <View style={{ gap: space.xxs }}>
              <Text style={{ fontWeight: '700', color: colors.label }}>{pt.included}</Text>
              {p.includes.map((item) => (
                <Text key={item} style={{ color: colors.secondaryLabel }}>• {item}</Text>
              ))}
            </View>
          )}
          {p.meeting_point && (
            <Text style={{ color: colors.label }}>
              <Text style={{ fontWeight: '700' }}>{pt.meetingPoint}: </Text>
              {p.meeting_point}
            </Text>
          )}
          {showGuide && (
            <Text accessibilityRole="link" onPress={() => router.push({ pathname: '/guide/[slug]', params: { slug: guideSlug } })} style={{ color: brand.forest, fontWeight: '700', textDecorationLine: 'underline' }}>
              {guideName}
            </Text>
          )}
          <Button
            title={pt.ask}
            onPress={() => {
              track(EVENTS.enquiryStarted, { kind: 'package', guide: guideSlug, locale });
              router.push({ pathname: '/contact/[guideId]', params: { guideId, name: guideName, packageId: p.id, packageTitle: p.title, sample: guideSlug.startsWith('sample-') ? '1' : '' } });
            }}
          />
        </View>
      )}
    </Card>
  );
}
