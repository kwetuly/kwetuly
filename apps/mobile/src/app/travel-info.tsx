import { ScrollView, Text } from 'react-native';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { EVENTS, TRAVEL_LINKS } from '@rafrika/shared';
import { Button, Card, Muted, SectionTitle } from '@/components/ui';
import { track } from '@/lib/analytics';
import { useI18n } from '@/lib/i18n';
import { brand, colors, radius, space } from '@/theme';

// Visa and the mandatory inbound travel insurance, with links to the official government sites only.
export default function TravelInfoScreen() {
  const { t } = useI18n();
  const tr = t.travel;
  const open = (url: string, what: string) => {
    track(EVENTS.ctaClicked, { cta: what });
    WebBrowser.openBrowserAsync(url);
  };
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.huge }}>
      <Stack.Title>{tr.title}</Stack.Title>
      <Muted>{tr.intro}</Muted>
      <Card>
        <SectionTitle>{tr.visaTitle}</SectionTitle>
        <Text style={{ color: colors.label, lineHeight: 21 }}>{tr.visaBody}</Text>
        <Button title={tr.visaLink} variant="outline" onPress={() => open(TRAVEL_LINKS.visa, 'travel_visa')} />
        <Muted>{tr.visaWarn}</Muted>
      </Card>
      <Card>
        <SectionTitle>{tr.insuranceTitle}</SectionTitle>
        <Text style={{ color: colors.label, lineHeight: 21 }}>{tr.insuranceBody}</Text>
        <Text style={{ color: brand.forest, fontWeight: '700', backgroundColor: brand.mint, padding: space.md, borderRadius: radius.button }}>{tr.insuranceOne}</Text>
        <Button title={tr.mainlandLink} variant="outline" onPress={() => open(TRAVEL_LINKS.mainland, 'travel_insurance_mainland')} />
        <Button title={tr.zanzibarLink} variant="outline" onPress={() => open(TRAVEL_LINKS.zanzibar, 'travel_insurance_zanzibar')} />
        <Text style={{ color: colors.label }}>{tr.proof}</Text>
        <Muted>{tr.insuranceExempt}</Muted>
      </Card>
      <Muted>
        {tr.checkNote} {tr.checked}.
      </Muted>
    </ScrollView>
  );
}
