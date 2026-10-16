import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Link, Stack, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Card, Muted, ScreenState, SectionTitle } from '@/components/ui';
import { getMyGuide, listMyJoinedTrips, listMyOrganisedTrips, type OrganisedTrip } from '@/lib/api-more';
import { useCanOffer } from '@/hooks/use-can-offer';
import { useProfile, useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { formatDateRange } from '@/lib/labels';
import { brand, colors, space, textSize } from '@/theme';

export default function MyGroupTripsScreen() {
  const { t, locale } = useI18n();
  const g = t.groups;
  const { session } = useSession();
  const userId = session?.user.id;
  const profile = useProfile();
  const organised = useQuery({ queryKey: ['my-organised', userId], queryFn: () => listMyOrganisedTrips(userId!), enabled: !!userId });
  const joined = useQuery({ queryKey: ['my-joined', userId], queryFn: () => listMyJoinedTrips(userId!), enabled: !!userId });
  const guide = useQuery({ queryKey: ['my-guide', userId], queryFn: () => getMyGuide(userId!), enabled: !!userId });
  const { approvedBusiness } = useCanOffer();
  const canOrganise = guide.data?.guide?.verification_status === 'approved' || approvedBusiness || profile.data?.role === 'admin';

  const state = (trip: OrganisedTrip) => (trip.cancelled ? g.cancelledTrip : trip.status === 'pending' ? g.statusPending : trip.status === 'rejected' ? g.statusRejected : null);
  const requestLabel: Record<string, string> = { requested: g.stateRequested, accepted: g.stateAccepted, declined: g.stateDeclined };

  const row = (trip: OrganisedTrip, note: string | null) => (
    <Link key={trip.id} href={{ pathname: '/group-trip/[id]', params: { id: trip.id } }} asChild>
      <Pressable>
        <Card>
          <Text style={{ fontWeight: '800', fontSize: textSize.body, color: colors.label }}>{trip.title}</Text>
          <Muted>
            {formatDateRange(trip.start_date, trip.end_date, locale)} · {trip.seats_taken + (trip.already_going ?? 0)}/{trip.max_people}
          </Muted>
          {note && <Badge label={note} tone="sand" />}
        </Card>
      </Pressable>
    </Link>
  );

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }}
      refreshControl={
        <RefreshControl
          refreshing={organised.isRefetching || joined.isRefetching}
          onRefresh={() => {
            organised.refetch();
            joined.refetch();
          }}
          tintColor={brand.leaf}
        />
      }
    >
      <Stack.Title>{g.mine}</Stack.Title>
      <ScreenState loading={organised.isLoading || joined.isLoading} error={organised.error ?? joined.error} />
      {(organised.data?.length ?? 0) > 0 && (
        <View style={{ gap: space.md }}>
          <SectionTitle>{g.organising}</SectionTitle>
          {organised.data!.map((trip) => row(trip, state(trip)))}
        </View>
      )}
      <View style={{ gap: space.md }}>
        <SectionTitle>{g.joined}</SectionTitle>
        {joined.data?.length === 0 && <Muted>{g.noneJoined}</Muted>}
        {(joined.data ?? []).map((j) => row(j.group_trips!, state(j.group_trips!) ?? requestLabel[j.status] ?? null))}
      </View>
      {canOrganise && <Button title={g.start} onPress={() => router.push('/group-trip/new')} />}
    </ScrollView>
  );
}
