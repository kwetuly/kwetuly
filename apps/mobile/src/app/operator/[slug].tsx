import { Linking, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Avatar, Badge, Card, Muted, ScreenState, SectionTitle } from '@/components/ui';
import { TourCard } from '@/components/cards';
import { getOperator, listTours } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { brand, colors, space, textSize } from '@/theme';

// An operator's profile: verification, licence and TripAdvisor details (each with the date
// Rafrika checked it) and all of their tours.
export default function OperatorScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, locale } = useI18n();
  const tt = t.tours;
  const operator = useQuery({ queryKey: ['operator', slug], queryFn: () => getOperator(slug) });
  const tours = useQuery({ queryKey: ['tours'], queryFn: listTours });
  const op = operator.data;
  if (!op) return <ScreenState loading={operator.isLoading} error={operator.error} empty emptyText={tt.noOperators} />;
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const theirs = (tours.data ?? []).filter((tour) => tour.operator_id === op.id);
  const link = { color: brand.leafDark, fontWeight: '700' as const };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
      <Stack.Title>{op.name}</Stack.Title>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Avatar name={op.name} uri={op.logo_url} size={64} />
          <View style={{ flex: 1, gap: space.xs }}>
            <Text selectable style={{ fontSize: textSize.title3, fontWeight: '800', color: colors.label }}>{op.name}</Text>
            {op.verified_at ? <Badge label={`✓ ${tt.verified} · ${date.format(new Date(op.verified_at))}`} /> : <Badge label={tt.notVerified} tone="sand" />}
          </View>
        </View>
        {op.description && <Muted selectable>{op.description}</Muted>}
        {op.location && <Text style={{ color: colors.label }}>{tt.location}: {op.location}</Text>}
        {op.website && <Text accessibilityRole="link" onPress={() => Linking.openURL(op.website!)} style={link}>{tt.website}</Text>}
        {op.contact_email && <Text accessibilityRole="link" onPress={() => Linking.openURL(`mailto:${op.contact_email}`)} style={link}>{op.contact_email}</Text>}
        {op.contact_phone && <Text accessibilityRole="link" onPress={() => Linking.openURL(`tel:${op.contact_phone!.replace(/\s/g, '')}`)} style={link}>{op.contact_phone}</Text>}
        {op.licence_number && op.licence_checked_at && (
          <Text selectable style={{ color: colors.label }}>
            {tt.licence}: {op.licence_authority ? `${op.licence_authority} ` : ''}{op.licence_number}
            <Text style={{ color: colors.secondaryLabel }}> · {tt.lastChecked} {date.format(new Date(op.licence_checked_at))}</Text>
          </Text>
        )}
        {op.tripadvisor_url && (
          <Text accessibilityRole="link" onPress={() => Linking.openURL(op.tripadvisor_url!)} style={link}>
            {tt.tripadvisor}
            {op.tripadvisor_rating != null && op.tripadvisor_checked_at
              ? `: ${Number(op.tripadvisor_rating).toFixed(1)} / 5${op.tripadvisor_reviews != null ? ` · ${op.tripadvisor_reviews} ${tt.reviews}` : ''} (${tt.lastChecked} ${date.format(new Date(op.tripadvisor_checked_at))})`
              : ''}
          </Text>
        )}
      </Card>
      <SectionTitle>{tt.operatorTours}</SectionTitle>
      {theirs.length === 0 ? <Muted>{tt.empty}</Muted> : theirs.map((tour) => <TourCard key={tour.id} tour={tour} />)}
    </ScrollView>
  );
}
