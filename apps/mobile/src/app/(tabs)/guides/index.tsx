import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { GUIDE_EXPERTISE, GUIDE_LANGUAGES, GUIDE_SPECIALTIES } from '@rafrika/shared';
import { GuideCard } from '@/components/cards';
import { Chip, ScreenState } from '@/components/ui';
import { listGuides, type GuideFilters } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { brand, colors, space } from '@/theme';

function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}>
      {children}
    </ScrollView>
  );
}

export default function GuidesScreen() {
  const { t, locale } = useI18n();
  const params = useLocalSearchParams<{ specialty?: string; expertise?: string; language?: string; female?: string; partners?: string }>();
  // Filters start from the link that opened this tab (e.g. a "Special trips" chip on Explore).
  const [filters, setFilters] = useState<GuideFilters>(() => ({
    specialty: params.specialty,
    expertise: params.expertise,
    language: params.language,
    female: params.female === '1' || undefined,
    partners: params.partners === '1' || undefined,
  }));
  const toggle = <K extends keyof GuideFilters>(key: K, value: GuideFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: current[key] === value ? undefined : value }));

  const guides = useQuery({ queryKey: ['guides', filters], queryFn: () => listGuides(filters) });
  const filtered = Object.values(filters).some(Boolean);

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      data={guides.data ?? []}
      keyExtractor={(g) => g.id}
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: space.lg }}>
          <GuideCard guide={item} />
        </View>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      contentContainerStyle={{ paddingBottom: space.xxl }}
      refreshControl={<RefreshControl refreshing={guides.isRefetching} onRefresh={() => guides.refetch()} tintColor={brand.leaf} />}
      ListHeaderComponent={
        <View style={{ gap: space.md, paddingVertical: space.md }}>
          <Stack.Title large>{t.guides.title}</Stack.Title>
          <ChipRow>
            {GUIDE_SPECIALTIES.map((s) => (
              <Chip key={s.id} label={s[locale]} active={filters.specialty === s.id} onPress={() => toggle('specialty', s.id)} />
            ))}
          </ChipRow>
          <ChipRow>
            {GUIDE_LANGUAGES.map((l) => (
              <Chip key={l.code} label={l.name} active={filters.language === l.code} onPress={() => toggle('language', l.code)} />
            ))}
          </ChipRow>
          <ChipRow>
            <Chip label={t.guides.femaleOnly} active={!!filters.female} onPress={() => toggle('female', true)} />
            <Chip label={t.guides.partnersOnly} active={!!filters.partners} onPress={() => toggle('partners', true)} />
            {GUIDE_EXPERTISE.map((e) => (
              <Chip key={e.id} label={e.label[locale]} active={filters.expertise === e.id} onPress={() => toggle('expertise', e.id)} />
            ))}
          </ChipRow>
          {filtered && (
            <Text onPress={() => setFilters({})} style={{ color: brand.leafDark, fontWeight: '700', paddingHorizontal: space.lg }}>
              ✕ {t.guides.clear}
            </Text>
          )}
        </View>
      }
      ListEmptyComponent={
        <ScreenState
          loading={guides.isLoading}
          error={guides.error}
          empty
          emptyText={t.guides.empty}
          onRetry={() => guides.refetch()}
          retryLabel={t.app.retry}
        />
      }
    />
  );
}
