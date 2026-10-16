import { Text, View } from 'react-native';
import { guideChecks, type GuideCheckFields, type GuideCheckId } from '@rafrika/shared';
import { Card, Muted, SectionTitle } from '@/components/ui';
import { Glyph, type GlyphName } from '@/components/glyph';
import { useI18n } from '@/lib/i18n';
import { brand, colors, radius, space, textSize } from '@/theme';

const ICONS: Record<GuideCheckId, GlyphName> = {
  identity: { ios: 'person.text.rectangle.fill', android: 'badge' },
  licence: { ios: 'checkmark.seal.fill', android: 'verified' },
  firstAid: { ios: 'cross.case.fill', android: 'medical_services' },
};

// "What Rafrika checked": each check in plain words, with the date. The documents themselves stay private.
// `approved`: Rafrika approved the profile, which is said plainly when no document has been checked yet.
export function GuideChecksCard({ guide, approved }: { guide: GuideCheckFields; approved?: boolean }) {
  const { t, locale } = useI18n();
  const c = t.checks;
  const checks = guideChecks(guide);
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const text: Record<GuideCheckId, { label: string; body: string }> = {
    identity: { label: c.identity, body: c.identityBody },
    licence: { label: c.licence, body: c.licenceBody },
    firstAid: { label: c.firstAid, body: c.firstAidBody },
  };

  return (
    <Card>
      <SectionTitle>{c.title}</SectionTitle>
      {checks.length === 0 ? (
        <Muted>{approved ? t.extras.approvedGuideBody : c.none}</Muted>
      ) : (
        <>
          <Muted>{c.intro}</Muted>
          {checks.map((check) => (
            <View key={check.id} style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
              <View style={{ width: 36, height: 36, borderRadius: radius.button, borderCurve: 'continuous', backgroundColor: brand.leaf, alignItems: 'center', justifyContent: 'center' }}>
                <Glyph name={ICONS[check.id]} size={20} color={brand.onDark} />
              </View>
              <View style={{ flex: 1, gap: space.xxs }}>
                <Text style={{ fontWeight: '700', color: colors.label, fontSize: textSize.callout }}>{text[check.id].label}</Text>
                <Text style={{ color: colors.secondaryLabel, fontSize: textSize.footnote, lineHeight: 18 }}>{text[check.id].body}</Text>
                <Text style={{ color: colors.secondaryLabel, fontSize: textSize.caption }}>
                  {c.checkedOn} {date.format(new Date(check.checkedAt))}
                  {check.validUntil ? ` · ${c.validUntil} ${date.format(new Date(check.validUntil))}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </>
      )}
    </Card>
  );
}

/** Short labels for the header: exactly which checks Rafrika has done. */
export function useCheckLabels(guide: GuideCheckFields) {
  const { t } = useI18n();
  const label: Record<GuideCheckId, string> = { identity: t.checks.identity, licence: t.checks.licence, firstAid: t.checks.firstAid };
  return guideChecks(guide).map((check) => label[check.id]);
}
