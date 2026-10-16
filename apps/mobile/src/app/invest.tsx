import { ScrollView, Text } from 'react-native';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { INVEST_TEXT } from '@rafrika/shared';
import { Button, Card, Muted, SectionTitle } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { colors, space } from '@/theme';

// Invest in Tanzania, like /invest on the website: who handles investment and how to start.
export default function InvestScreen() {
  const { t, locale } = useI18n();
  const x = locale === 'sw' ? INVEST_TEXT.sw : INVEST_TEXT.en;
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.huge }}>
      <Stack.Title>{t.extras.investTitle}</Stack.Title>
      <Muted>{x.intro}</Muted>
      <Card>
        <SectionTitle>{x.whoTitle}</SectionTitle>
        <Text selectable style={{ color: colors.label, lineHeight: 21 }}>{x.who}</Text>
        <Button title={x.official} variant="outline" onPress={() => WebBrowser.openBrowserAsync('https://www.tiseza.go.tz')} />
        <Button title={x.contact} variant="outline" onPress={() => WebBrowser.openBrowserAsync('https://www.tiseza.go.tz/contacts')} />
      </Card>
      <Card>
        <SectionTitle>{x.helpTitle}</SectionTitle>
        {x.help.map((h) => <Text key={h} style={{ color: colors.label }}>• {h}</Text>)}
      </Card>
      <Card>
        <SectionTitle>{x.stepsTitle}</SectionTitle>
        {x.steps.map((s, i) => <Text key={s} style={{ color: colors.label, lineHeight: 21 }}>{i + 1}. {s}</Text>)}
      </Card>
      <Card>
        <SectionTitle>{x.rafrikaTitle}</SectionTitle>
        <Muted>{x.rafrika}</Muted>
      </Card>
      <Muted>{x.checked}</Muted>
    </ScrollView>
  );
}
