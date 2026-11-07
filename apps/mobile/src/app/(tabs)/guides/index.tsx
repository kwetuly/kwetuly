import { useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { GUIDE_EXPERTISE, GUIDE_LANGUAGES, GUIDE_SPECIALTIES } from '@kwetuly/shared';
import { GuideCard } from '@/components/cards';
import { GLYPHS } from '@/components/glyph';
import { Button, Chip, ChipRow, ScreenState } from '@/components/ui';
import { listGuides, type GuideFilters } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useType } from '@/lib/use-type';
import { brand, colors, layout, space } from '@/theme';

export default function GuidesScreen() {
  const { t, locale } = useI18n();
  const { type } = useType();
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
  // Small headings over each chip row, so it is clear what each row filters.
  const heading = (text: string) => (
    <Text accessibilityRole="header" style={{ ...type.label, paddingHorizontal: layout.screenX }}>
      {text}
    </Text>
  );

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      data={guides.data ?? []}
      keyExtractor={(g) => g.id}
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: layout.screenX }}>
          <GuideCard guide={item} />
        </View>
      )}
      ItemSeparatorComponent={() => <View style={{ height: layout.listGap }} />}
      contentContainerStyle={{ paddingBottom: space.xxxl }}
      refreshControl={<RefreshControl refreshing={guides.isRefetching} onRefresh={() => { guides.refetch(); }} tintColor={brand.leaf} />}
      ListHeaderComponent={
        <View style={{ gap: space.sm, paddingTop: space.md, paddingBottom: space.lg }}>
          <Stack.Title large>{t.guides.title}</Stack.Title>
          {heading(t.profile.specialties)}
          <ChipRow>
            {GUIDE_SPECIALTIES.map((s) => (
              <Chip key={s.id} label={s[locale]} active={filters.specialty === s.id} onPress={() => toggle('specialty', s.id)} />
            ))}
          </ChipRow>
          {heading(t.guides.languages)}
          <ChipRow>
            {GUIDE_LANGUAGES.map((l) => (
              <Chip key={l.code} label={l.name} active={filters.language === l.code} onPress={() => toggle('language', l.code)} />
            ))}
          </ChipRow>
          {heading(t.guides.expertise)}
          <ChipRow>
            <Chip label={t.guides.femaleOnly} active={!!filters.female} onPress={() => toggle('female', true)} />
            <Chip label={t.guides.partnersOnly} active={!!filters.partners} onPress={() => toggle('partners', true)} />
            {GUIDE_EXPERTISE.map((e) => (
              <Chip key={e.id} label={e.label[locale]} active={filters.expertise === e.id} onPress={() => toggle('expertise', e.id)} />
            ))}
          </ChipRow>
          {/* Hidden when nothing matches: the empty state then offers Clear itself. */}
          {filtered && (guides.data?.length ?? 0) > 0 && (
            <View style={{ paddingHorizontal: space.sm, alignItems: 'flex-start' }}>
              <Button title={t.guides.clear} variant="text" size="md" icon={GLYPHS.close} onPress={() => setFilters({})} />
            </View>
          )}
        </View>
      }
      ListEmptyComponent={
        <View style={{ paddingHorizontal: layout.screenX }}>
          <ScreenState
            loading={guides.isLoading}
            loadingCount={3}
            error={guides.error}
            empty
            emptyText={t.guides.empty}
            emptyGlyph={GLYPHS.people}
            emptyAction={filtered ? { label: t.guides.clear, onPress: () => setFilters({}) } : undefined}
            onRetry={() => guides.refetch()}
            retryLabel={t.app.retry}
          />
        </View>
      }
    />
  );
}
