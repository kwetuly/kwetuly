import { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { GroupTripCard, TourCard } from '@/components/cards';
import { Chip, ScreenState } from '@/components/ui';
import { listGroupTrips, listTours, type GroupTrip, type Tour } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { brand, colors, space } from '@/theme';

type Item = { kind: 'group'; trip: GroupTrip } | { kind: 'tour'; tour: Tour };

// Group trips with open spots, and the tour catalogue.
export default function TripsScreen() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<'groups' | 'tours'>(params.view === 'tours' ? 'tours' : 'groups');
  const groups = useQuery({ queryKey: ['group-trips'], queryFn: listGroupTrips });
  const tours = useQuery({ queryKey: ['tours'], queryFn: listTours, enabled: view === 'tours' });
  const active = view === 'groups' ? groups : tours;

  const items: Item[] =
    view === 'groups' ? (groups.data ?? []).map((trip) => ({ kind: 'group', trip })) : (tours.data ?? []).map((tour) => ({ kind: 'tour', tour }));

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      data={items}
      keyExtractor={(item) => (item.kind === 'group' ? item.trip.id : item.tour.id)}
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: space.lg }}>{item.kind === 'group' ? <GroupTripCard trip={item.trip} /> : <TourCard tour={item.tour} />}</View>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
      contentContainerStyle={{ paddingBottom: space.xxl }}
      refreshControl={<RefreshControl refreshing={active.isRefetching} onRefresh={() => active.refetch()} tintColor={brand.sunset} />}
      ListHeaderComponent={
        <View style={{ flexDirection: 'row', gap: space.sm, padding: space.lg }}>
          <Stack.Title large>{t.app.tabTrips}</Stack.Title>
          <Chip label={t.app.groupTrips} active={view === 'groups'} onPress={() => setView('groups')} />
          <Chip label={t.app.tours} active={view === 'tours'} onPress={() => setView('tours')} />
        </View>
      }
      ListEmptyComponent={
        <ScreenState
          loading={active.isLoading}
          error={active.error}
          empty
          emptyText={view === 'groups' ? t.groups.none : t.tours.empty}
          onRetry={() => active.refetch()}
          retryLabel={t.app.retry}
        />
      }
    />
  );
}
