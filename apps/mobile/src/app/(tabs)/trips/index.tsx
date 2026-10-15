import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ACCOMMODATION_LEVELS, TOUR_DURATIONS, TOUR_GROUP_TYPES, TOUR_THEMES, TOUR_TYPES, TRAVEL_STYLES, filterTours, readTourFilters, type TourFilters } from '@rafrika/shared';
import { GroupTripCard, TourCard } from '@/components/cards';
import { Button, Chip, ScreenState } from '@/components/ui';
import { listGroupTrips, listSavedTourIds, listTours, type GroupTrip, type Tour } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { brand, colors, radius, space, textSize } from '@/theme';

type Item = { kind: 'group'; trip: GroupTrip } | { kind: 'tour'; tour: Tour };

function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}>
      {children}
    </ScrollView>
  );
}

// Group trips with open spots, and the tour catalogue with search and filters.
export default function TripsScreen() {
  const { t, locale } = useI18n();
  const tt = t.tours;
  const params = useLocalSearchParams<Record<string, string>>();
  const { session } = useSession();
  const [view, setView] = useState<'groups' | 'tours'>(params.view === 'tours' ? 'tours' : 'groups');
  // Filters start from the link that opened this tab (e.g. "VIP & luxury trips" in the menu).
  const [filters, setFilters] = useState<TourFilters>(() => readTourFilters((key) => params[key]));
  const [savedOnly, setSavedOnly] = useState(false);
  const toggle = <K extends keyof TourFilters>(key: K, value: TourFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: current[key] === value ? undefined : value }));

  const groups = useQuery({ queryKey: ['group-trips'], queryFn: listGroupTrips });
  const tours = useQuery({ queryKey: ['tours'], queryFn: listTours, enabled: view === 'tours' });
  const saved = useQuery({ queryKey: ['saved-tours', session?.user.id], queryFn: () => listSavedTourIds(session!.user.id), enabled: !!session && view === 'tours' });
  const active = view === 'groups' ? groups : tours;

  const shownTours = useMemo(() => {
    const list = filterTours(tours.data ?? [], filters);
    return savedOnly ? list.filter((tour) => saved.data?.includes(tour.id)) : list;
  }, [tours.data, filters, savedOnly, saved.data]);
  const filtered = savedOnly || Object.values(filters).some((v) => v !== undefined && v !== '');

  const items: Item[] =
    view === 'groups' ? (groups.data ?? []).map((trip) => ({ kind: 'group', trip })) : shownTours.map((tour) => ({ kind: 'tour', tour }));

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: colors.background }}
      data={items}
      keyExtractor={(item) => (item.kind === 'group' ? item.trip.id : item.tour.id)}
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: space.lg }}>{item.kind === 'group' ? <GroupTripCard trip={item.trip} /> : <TourCard tour={item.tour} />}</View>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
      contentContainerStyle={{ paddingBottom: space.xxl }}
      refreshControl={<RefreshControl refreshing={active.isRefetching} onRefresh={() => active.refetch()} tintColor={brand.leaf} />}
      ListHeaderComponent={
        <View style={{ gap: space.md, paddingVertical: space.lg }}>
          <Stack.Title large>{t.app.tabTrips}</Stack.Title>
          <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg }}>
            <Chip label={t.app.groupTrips} active={view === 'groups'} onPress={() => setView('groups')} />
            <Chip label={t.app.tours} active={view === 'tours'} onPress={() => setView('tours')} />
          </View>
          {view === 'tours' && (
            <>
              <View style={{ paddingHorizontal: space.lg }}>
                <TextInput
                  value={filters.q ?? ''}
                  onChangeText={(q) => setFilters((current) => ({ ...current, q: q || undefined }))}
                  placeholder={tt.search}
                  placeholderTextColor={colors.secondaryLabel}
                  returnKeyType="search"
                  accessibilityLabel={tt.search}
                  style={{ backgroundColor: colors.card, borderColor: colors.separator, borderWidth: 1, borderRadius: radius.chip, paddingHorizontal: space.md, paddingVertical: space.md, fontSize: textSize.body, color: colors.label }}
                />
              </View>
              <ChipRow>
                {TOUR_THEMES.map((theme) => (
                  <Chip key={theme.id} label={theme[locale]} active={filters.theme === theme.id} onPress={() => toggle('theme', theme.id)} />
                ))}
              </ChipRow>
              <ChipRow>
                {TOUR_TYPES.map((x) => (
                  <Chip key={x.id} label={x[locale]} active={filters.type === x.id} onPress={() => toggle('type', x.id)} />
                ))}
                {TRAVEL_STYLES.filter((s) => ['vip', 'honeymoon', 'family'].includes(s.id)).map((s) => (
                  <Chip key={s.id} label={s[locale]} active={filters.style === s.id} onPress={() => toggle('style', s.id)} />
                ))}
                <Chip label={TOUR_GROUP_TYPES[1][locale]} active={filters.group === 'group'} onPress={() => toggle('group', 'group')} />
                <Chip label={TOUR_GROUP_TYPES[0][locale]} active={filters.group === 'private'} onPress={() => toggle('group', 'private')} />
              </ChipRow>
              <ChipRow>
                {TOUR_DURATIONS.map((d) => (
                  <Chip key={d.id} label={d[locale]} active={filters.duration === d.id} onPress={() => toggle('duration', d.id)} />
                ))}
                {ACCOMMODATION_LEVELS.map((a) => (
                  <Chip key={a.id} label={a[locale]} active={filters.accommodation === a.id} onPress={() => toggle('accommodation', a.id)} />
                ))}
                {session && <Chip label={tt.savedTours} active={savedOnly} onPress={() => setSavedOnly((v) => !v)} />}
              </ChipRow>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.lg }}>
                <Text style={{ color: colors.secondaryLabel, fontWeight: '600' }}>
                  {shownTours.length} {shownTours.length === 1 ? tt.tourOne : tt.tourMany}
                </Text>
                {filtered && (
                  <Text accessibilityRole="button" onPress={() => { setFilters({}); setSavedOnly(false); }} style={{ color: brand.leafDark, fontWeight: '700' }}>
                    {tt.clear}
                  </Text>
                )}
              </View>
            </>
          )}
        </View>
      }
      ListEmptyComponent={
        <ScreenState
          loading={active.isLoading}
          error={active.error}
          empty
          emptyText={view === 'groups' ? t.groups.none : savedOnly && !saved.data?.length ? tt.noSaved : tt.empty}
          onRetry={() => active.refetch()}
          retryLabel={t.app.retry}
        />
      }
      ListFooterComponent={
        view === 'tours' ? (
          <View style={{ padding: space.lg, gap: space.sm }}>
            <Text style={{ fontWeight: '800', fontSize: textSize.headline, color: colors.label }}>{tt.groupDepartures}</Text>
            <Text style={{ color: colors.secondaryLabel }}>{tt.groupDeparturesBody}</Text>
            <Button title={tt.seeGroupTrips} variant="outline" onPress={() => setView('groups')} />
            <Text accessibilityRole="link" onPress={() => router.push('/operators')} style={{ color: brand.leafDark, fontWeight: '700', marginTop: space.sm }}>
              {tt.operatorsTitle}
            </Text>
          </View>
        ) : null
      }
    />
  );
}
