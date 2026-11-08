import { FlatList, RefreshControl, Text } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { HUB_MENU, JOB_ROLES } from '@kwetuly/shared';
import { GLYPHS } from '@/components/glyph';
import { Badge, Card, MetaItems, Muted, ScreenState } from '@/components/ui';
import { listJobs } from '@/lib/api-more';
import { useI18n } from '@/lib/i18n';
import { languageName, specialtyName } from '@/lib/labels';
import { useType } from '@/lib/use-type';
import { brand, colors, layout, space } from '@/theme';

// Jobs and client handovers from companies; only verified guides can see them (database rule).
export default function JobsScreen() {
  const { t, locale } = useI18n();
  const { type, font } = useType();
  const jobs = useQuery({ queryKey: ['jobs'], queryFn: listJobs });
  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      data={jobs.data ?? []}
      keyExtractor={(j) => j.id}
      contentContainerStyle={{ padding: layout.screenX, gap: layout.listGap, paddingBottom: space.xxxl }}
      refreshControl={<RefreshControl refreshing={jobs.isRefetching} onRefresh={() => { jobs.refetch(); }} tintColor={brand.leaf} />}
      ListHeaderComponent={<Stack.Title>{HUB_MENU.find((i) => i.slug === 'jobs')?.label[locale]}</Stack.Title>}
      ListEmptyComponent={<ScreenState loading={jobs.isLoading} loadingCount={3} error={jobs.error} onRetry={() => jobs.refetch()} empty emptyText={t.hub.noJobs} emptyGlyph={GLYPHS.briefcase} />}
      renderItem={({ item: j }) => (
        // Client handovers stand out with a green border.
        <Card style={j.kind === 'handover' ? { borderColor: brand.primary } : undefined}>
          <Badge label={j.kind === 'handover' ? t.jobs.handoverBadge : (JOB_ROLES.find((r) => r.id === j.role_needed)?.[locale] ?? j.role_needed)} tone={j.kind === 'handover' ? 'sand' : 'mint'} />
          <Text style={type.cardTitle}>{j.title}</Text>
          <Muted>{j.company_name}</Muted>
          <MetaItems
            items={[
              j.location,
              j.specialty && specialtyName(j.specialty, locale),
              j.group_size && `${j.group_size} ${t.jobs.travellers}`,
              j.languages.length > 0 && j.languages.map(languageName).join(', '),
              j.start_date && `${j.start_date}${j.end_date ? ` – ${j.end_date}` : ''}`,
            ]}
          />
          {j.description && <Text selectable style={type.callout}>{j.description}</Text>}
          {j.pay && (
            <Text style={type.callout}>
              <Text style={font.bold}>{t.hub.pay}: </Text>
              {j.pay}
            </Text>
          )}
          <Text selectable style={{ ...type.callout, ...font.semibold, color: brand.forest }}>
            {t.hub.apply}: {j.how_to_apply}
          </Text>
        </Card>
      )}
    />
  );
}
