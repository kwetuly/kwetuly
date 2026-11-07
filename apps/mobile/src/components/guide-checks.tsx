import { Text, View } from 'react-native';
import { guideChecks, type GuideCheckFields, type GuideCheckId } from '@kwetuly/shared';
import { Card, IconSquare, Muted, SectionTitle } from '@/components/ui';
import type { GlyphName } from '@/components/glyph';
import { useI18n } from '@/lib/i18n';
import { font, space, type } from '@/theme';

const ICONS: Record<GuideCheckId, GlyphName> = {
  identity: { ios: 'person.text.rectangle.fill', android: 'badge' },
  licence: { ios: 'checkmark.seal.fill', android: 'verified' },
  firstAid: { ios: 'cross.case.fill', android: 'medical_services' },
};

// "What Kwetuly checked": each check in plain words, with the date. The documents themselves stay private.
// `approved`: Kwetuly approved the profile, which is said plainly when no document has been checked yet.
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
              <IconSquare glyph={ICONS[check.id]} size="sm" />
              <View style={{ flex: 1, gap: space.xxs }}>
                <Text style={{ ...type.callout, ...font.bold }}>{text[check.id].label}</Text>
                <Text style={type.meta}>{text[check.id].body}</Text>
                <Text style={type.caption}>
                  {c.checkedOn} {date.format(new Date(check.checkedAt))}
                </Text>
                {check.validUntil ? (
                  <Text style={type.caption}>
                    {c.validUntil} {date.format(new Date(check.validUntil))}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </>
      )}
    </Card>
  );
}

/** Short labels for the header: exactly which checks Kwetuly has done. */
export function useCheckLabels(guide: GuideCheckFields) {
  const { t } = useI18n();
  const label: Record<GuideCheckId, string> = { identity: t.checks.identity, licence: t.checks.licence, firstAid: t.checks.firstAid };
  return guideChecks(guide).map((check) => label[check.id]);
}
