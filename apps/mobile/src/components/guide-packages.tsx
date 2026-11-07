import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { EVENTS, PACKAGE_KINDS, packageDuration, packagePrice, type GuidePackage } from '@kwetuly/shared';
import { Badge, Button, Card, Muted, Section } from '@/components/ui';
import { track } from '@/lib/analytics';
import { useI18n } from '@/lib/i18n';
import { useType } from '@/lib/use-type';
import { brand, colors, media, radius, space } from '@/theme';

/**
 * A guide's approved packages. Each card opens in place, and "Ask about this package" goes
 * straight to the contact form with the package filled in, like on the website.
 */
export function GuidePackages({ packages, guideId, guideName, guideSlug, sample }: { packages: GuidePackage[]; guideId: string; guideName: string; guideSlug: string; sample: boolean }) {
  const { t } = useI18n();
  if (packages.length === 0) return null;
  return (
    <Section title={t.packages.byGuide.replace('{name}', guideName)}>
      {packages.map((p) => (
        <PackageCard key={p.id} p={p} guideId={guideId} guideName={guideName} guideSlug={guideSlug} sample={sample} />
      ))}
    </Section>
  );
}

/**
 * One package that opens in place. `showGuide` adds a link to the guide, for lists away from the profile.
 * `sample` marks a package from a sample guide (test data): it gets the sample badge and note.
 * The ask button is outline: the screen's own main action stays the one filled button.
 */
export function PackageCard({ p, guideId, guideName, guideSlug, sample, showGuide }: { p: GuidePackage; guideId: string; guideName: string; guideSlug: string; sample: boolean; showGuide?: boolean }) {
  const { t, locale } = useI18n();
  const { type, font } = useType();
  const pt = t.packages;
  const [open, setOpen] = useState(false);
  const duration = packageDuration(p, pt);
  const facts = [packagePrice(p, pt), duration, p.max_group === 1 ? t.extras.justYou : p.max_group ? pt.upTo.replace('{n}', String(p.max_group)) : null];

  return (
    <Card style={open ? { borderColor: brand.primary } : undefined}>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ flexDirection: 'row', gap: space.md }}>
        {p.photo_url && <Image source={{ uri: p.photo_url }} style={{ backgroundColor: colors.fill, width: media.thumb, height: media.thumb, borderRadius: radius.media }} contentFit="cover" />}
        <View style={{ flex: 1, gap: space.xxs }}>
          <Text style={{ ...type.caption, ...font.bold, color: brand.link }}>{PACKAGE_KINDS.find((k) => k.id === p.kind)?.[locale]}</Text>
          {sample && <Badge label={t.extras.samplePackage} tone="sand" />}
          <Text style={type.cardTitle}>{p.title}</Text>
          <Text style={type.meta}>{p.summary}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: space.xxs }}>
            {facts.filter((x): x is string => !!x).map((f) => (
              <Text key={f} style={{ ...type.meta, ...font.bold, color: brand.forest }}>
                {f}
              </Text>
            ))}
          </View>
          {!open && <Text style={{ ...type.meta, ...font.bold, color: brand.link, textDecorationLine: 'underline' }}>{pt.details}</Text>}
        </View>
      </Pressable>
      {open && (
        <View style={{ gap: space.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md }}>
          {p.details && <Text selectable style={type.callout}>{p.details}</Text>}
          {p.includes.length > 0 && (
            <View style={{ gap: space.xxs }}>
              <Text style={type.label}>{pt.included}</Text>
              {p.includes.map((item) => (
                <Text key={item} style={type.muted}>• {item}</Text>
              ))}
            </View>
          )}
          {p.meeting_point && (
            <Text style={type.callout}>
              <Text style={font.bold}>{pt.meetingPoint}: </Text>
              {p.meeting_point}
            </Text>
          )}
          {showGuide && (
            <View style={{ alignItems: 'flex-start' }}>
              <Button title={guideName} variant="text" size="md" onPress={() => router.push({ pathname: '/guide/[slug]', params: { slug: guideSlug } })} />
            </View>
          )}
          {sample && <Muted>{t.extras.sampleGuideNote}</Muted>}
          <Button
            title={pt.ask}
            variant="outline"
            size="md"
            onPress={() => {
              track(EVENTS.enquiryStarted, { kind: 'package', guide: guideSlug, locale });
              router.push({ pathname: '/contact/[guideId]', params: { guideId, name: guideName, packageId: p.id, packageTitle: p.title, sample: sample ? '1' : '' } });
            }}
          />
        </View>
      )}
    </Card>
  );
}

