import { FlatList, RefreshControl, Text } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { HUB_MENU, JOB_ROLES } from '@kwetuly/shared';
import { Badge, Card, Muted, ScreenState } from '@/components/ui';
import { listJobs } from '@/lib/api-more';
import { useI18n } from '@/lib/i18n';
import { languageName, specialtyName } from '@/lib/labels';
import { brand, colors, space, textSize } from '@/theme';

// Jobs and client handovers from companies; only verified guides can see them (database rule).
export default function JobsScreen() {
  const { t, locale } = useI18n();
  const jobs = useQuery({ queryKey: ['jobs'], queryFn: listJobs });
  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      data={jobs.data ?? []}
      keyExtractor={(j) => j.id}
      contentContainerStyle={{ padding: space.lg, gap: space.md }}
      refreshControl={<RefreshControl refreshing={jobs.isRefetching} onRefresh={() => jobs.refetch()} tintColor={brand.leaf} />}
      ListHeaderComponent={<Stack.Title>{HUB_MENU.find((i) => i.slug === 'jobs')?.label[locale]}</Stack.Title>}
      ListEmptyComponent={<ScreenState loading={jobs.isLoading} error={jobs.error} onRetry={() => jobs.refetch()} empty emptyText={t.hub.noJobs} />}
      renderItem={({ item: j }) => (
        <Card style={j.kind === 'handover' ? { borderWidth: 2, borderColor: brand.leaf } : undefined}>
          <Badge label={j.kind === 'handover' ? t.jobs.handoverBadge : (JOB_ROLES.find((r) => r.id === j.role_needed)?.[locale] ?? j.role_needed)} tone={j.kind === 'handover' ? 'sand' : 'mint'} />
          <Text style={{ fontWeight: '800', fontSize: textSize.body, color: colors.label }}>{j.title}</Text>
          <Muted>{j.company_name}</Muted>
          <Muted>
            {[
              j.location,
              j.specialty && specialtyName(j.specialty, locale),
              j.group_size && `${j.group_size} ${t.jobs.travellers}`,
              j.languages.length > 0 && j.languages.map(languageName).join(', '),
              j.start_date && `${j.start_date}${j.end_date ? ` → ${j.end_date}` : ''}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Muted>
          {j.description && <Text selectable style={{ color: colors.label, lineHeight: 21 }}>{j.description}</Text>}
          {j.pay && (
            <Text style={{ color: colors.label }}>
              <Text style={{ fontWeight: '700' }}>{t.hub.pay}: </Text>
              {j.pay}
            </Text>
          )}
          <Text selectable style={{ color: brand.forest, fontWeight: '600' }}>
            {t.hub.apply}: {j.how_to_apply}
          </Text>
        </Card>
      )}
    />
  );
}
