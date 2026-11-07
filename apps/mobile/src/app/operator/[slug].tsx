import { Linking, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { GLYPHS } from '@/components/glyph';
import { Avatar, Badge, Button, Card, EmptyState, MetaItems, Muted, ScreenState, Section } from '@/components/ui';
import { TourCard } from '@/components/cards';
import { getOperator, listTours } from '@/lib/api';
import { openExternal } from '@/lib/open-external';
import { useI18n } from '@/lib/i18n';
import { useType } from '@/lib/use-type';
import { colors, layout, space } from '@/theme';

// An operator's profile: verification, licence and TripAdvisor details (each with the date
// Kwetuly checked it) and all of their tours.
export default function OperatorScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, locale } = useI18n();
  const tt = t.tours;
  const { type } = useType();
  const operator = useQuery({ queryKey: ['operator', slug], queryFn: () => getOperator(slug) });
  const tours = useQuery({ queryKey: ['tours'], queryFn: listTours });
  const op = operator.data;
  if (!op) return <ScreenState screen loading={operator.isLoading} error={operator.error} onRetry={() => operator.refetch()} empty emptyText={tt.noOperators} />;
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const theirs = (tours.data ?? []).filter((tour) => tour.operator_id === op.id);
  const link = (title: string, onPress: () => void) => (
    <View style={{ alignItems: 'flex-start', marginLeft: -space.sm }}>
      <Button title={title} variant="text" size="md" onPress={onPress} />
    </View>
  );

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: layout.screenX, gap: space.lg, paddingBottom: space.xxxl }}>
      <Stack.Title>{op.name}</Stack.Title>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Avatar name={op.name} uri={op.logo_url} size={64} />
          <View style={{ flex: 1, gap: space.xs }}>
            <Text selectable accessibilityRole="header" style={type.title3}>{op.name}</Text>
            {op.verified_at ? (
              <>
                <Badge label={tt.verified} icon={GLYPHS.check} />
                <Text style={type.caption}>{date.format(new Date(op.verified_at))}</Text>
              </>
            ) : (
              <Badge label={tt.notVerified} tone="sand" />
            )}
          </View>
        </View>
        {op.description && <Muted selectable>{op.description}</Muted>}
        {op.location && <Text style={type.callout}>{tt.location}: {op.location}</Text>}
        {op.website && link(tt.website, () => openExternal(op.website))}
        {op.contact_email && link(op.contact_email, () => Linking.openURL(`mailto:${op.contact_email}`))}
        {op.contact_phone && link(op.contact_phone, () => Linking.openURL(`tel:${op.contact_phone!.replace(/\s/g, '')}`))}
        {op.licence_number && op.licence_checked_at && (
          <View style={{ gap: space.xxs }}>
            <Text selectable style={type.callout}>
              {tt.licence}: {op.licence_authority ? `${op.licence_authority} ` : ''}
              {op.licence_number}
            </Text>
            <Text style={type.caption}>
              {tt.lastChecked} {date.format(new Date(op.licence_checked_at))}
            </Text>
          </View>
        )}
        {op.tripadvisor_url && (
          <View style={{ gap: space.xxs }}>
            {link(tt.tripadvisor, () => openExternal(op.tripadvisor_url))}
            {op.tripadvisor_rating != null && op.tripadvisor_checked_at ? (
              <MetaItems
                items={[
                  `${Number(op.tripadvisor_rating).toFixed(1)} / 5`,
                  op.tripadvisor_reviews != null ? `${op.tripadvisor_reviews} ${tt.reviews}` : null,
                  `${tt.lastChecked} ${date.format(new Date(op.tripadvisor_checked_at))}`,
                ]}
              />
            ) : null}
          </View>
        )}
      </Card>
      <Section title={tt.operatorTours} style={{ marginTop: space.lg }}>
        {tours.isLoading ? <ScreenState loading /> : theirs.length === 0 ? <EmptyState glyph={GLYPHS.search} text={tt.empty} /> : theirs.map((tour) => <TourCard key={tour.id} tour={tour} />)}
      </Section>
    </ScrollView>
  );
}
