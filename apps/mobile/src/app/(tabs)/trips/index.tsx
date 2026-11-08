import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ACCOMMODATION_LEVELS, TOUR_DURATIONS, TOUR_GROUP_TYPES, TOUR_THEMES, TOUR_TYPES, TRAVEL_STYLES, filterTours, readTourFilters, type TourFilters } from '@kwetuly/shared';
import { GroupTripCard, TourCard } from '@/components/cards';
import { GLYPHS } from '@/components/glyph';
import { Button, Chip, ChipRow, ScreenState, SearchField } from '@/components/ui';
import { listGroupTrips, listSavedTourIds, listTours, type GroupTrip, type Tour } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useType } from '@/lib/use-type';
import { brand, colors, control, layout, space } from '@/theme';

type Item = { kind: 'group'; trip: GroupTrip } | { kind: 'tour'; tour: Tour };

// Group trips with open spots, and the tour catalogue with search and filters.
export default function TripsScreen() {
  const { t, locale } = useI18n();
  const tt = t.tours;
  const { type, font } = useType();
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
  const clearAll = () => {
    setFilters({});
    setSavedOnly(false);
  };
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
        <View style={{ paddingHorizontal: layout.screenX }}>{item.kind === 'group' ? <GroupTripCard trip={item.trip} /> : <TourCard tour={item.tour} />}</View>
      )}
      ItemSeparatorComponent={() => <View style={{ height: layout.listGap }} />}
      contentContainerStyle={{ paddingBottom: space.xxxl }}
      refreshControl={<RefreshControl refreshing={active.isRefetching} onRefresh={() => { active.refetch(); }} tintColor={brand.leaf} />}
      ListHeaderComponent={
        <View style={{ gap: space.md, paddingTop: space.md, paddingBottom: space.lg }}>
          <Stack.Title large>{t.app.tabTrips}</Stack.Title>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: layout.inlineGap, paddingHorizontal: layout.screenX }}>
            <Chip label={t.app.groupTrips} active={view === 'groups'} onPress={() => setView('groups')} />
            <Chip label={t.app.tours} active={view === 'tours'} onPress={() => setView('tours')} />
          </View>
          {view === 'tours' && (
            <>
              <View style={{ paddingHorizontal: layout.screenX }}>
                <SearchField label={tt.searchButton} value={filters.q ?? ''} onChangeText={(q) => setFilters((current) => ({ ...current, q: q || undefined }))} placeholder={tt.search} clearLabel={tt.clear} />
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
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, paddingLeft: layout.screenX, paddingRight: space.sm, minHeight: control.touch }}>
                <Text style={{ ...type.meta, ...font.semibold, fontVariant: ['tabular-nums'] }}>
                  {shownTours.length} {shownTours.length === 1 ? tt.tourOne : tt.tourMany}
                </Text>
                {/* Hidden when nothing matches: the empty state then offers Clear itself. */}
                {filtered && shownTours.length > 0 && <Button title={tt.clear} variant="text" size="md" icon={GLYPHS.close} onPress={clearAll} />}
              </View>
            </>
          )}
        </View>
      }
      ListEmptyComponent={
        <View style={{ paddingHorizontal: layout.screenX }}>
          <ScreenState
            loading={active.isLoading}
            loadingCount={3}
            error={active.error}
            empty
            // "Finalising" only when there are no tours at all; with a search or filters on, say nothing matches.
            emptyText={view === 'groups' ? t.groups.none : savedOnly && !saved.data?.length ? tt.noSaved : filtered && (tours.data?.length ?? 0) > 0 ? tt.noMatch : tt.empty}
            emptyGlyph={view === 'groups' ? GLYPHS.calendar : GLYPHS.search}
            // No group trips: the text says "or start your own group", so offer exactly that.
            emptyAction={
              view === 'groups'
                ? { label: t.groups.start, onPress: () => router.push('/group-trip/new') }
                : filtered
                  ? { label: tt.clear, onPress: clearAll }
                  : undefined
            }
            onRetry={() => active.refetch()}
            retryLabel={t.app.retry}
          />
        </View>
      }
      ListFooterComponent={
        view === 'tours' ? (
          <View style={{ paddingHorizontal: layout.screenX, paddingTop: layout.sectionGap, gap: space.sm }}>
            <Text accessibilityRole="header" style={type.cardTitle}>{tt.groupDepartures}</Text>
            <Text style={type.muted}>{tt.groupDeparturesBody}</Text>
            <Button title={tt.seeGroupTrips} variant="outline" size="md" onPress={() => setView('groups')} />
            <View style={{ alignItems: 'flex-start' }}>
              <Button title={tt.operatorsTitle} variant="text" size="md" onPress={() => router.push('/operators')} />
            </View>
          </View>
        ) : undefined
      }
    />
  );
}
