import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cancelGroupTrip, listTripRequests, respondToTripRequest } from '@/lib/api-more';
import { useI18n } from '@/lib/i18n';

import { Badge, Button, Card, Muted, SectionTitle } from './ui';
import { brand, colors, space } from '@/theme';

// Organiser view on a group trip: requests to join (accept / decline) and cancelling the trip.
export function TripRequests({ tripId, cancelled }: { tripId: string; cancelled: boolean }) {
  const { t } = useI18n();
  const g = t.groups;
  const queryClient = useQueryClient();
  const requests = useQuery({ queryKey: ['trip-requests', tripId], queryFn: () => listTripRequests(tripId) });
  const [busy, setBusy] = useState<string | null>(null);

  async function respond(id: string, accept: boolean) {
    setBusy(id);
    try {
      await respondToTripRequest(id, accept);
    } catch {
      Alert.alert(g.full);
    } finally {
      setBusy(null);
      queryClient.invalidateQueries({ queryKey: ['trip-requests', tripId] });
      queryClient.invalidateQueries({ queryKey: ['group-trip', tripId] });
    }
  }

  const label: Record<string, string> = { requested: g.stateRequested, accepted: g.stateAccepted, declined: g.stateDeclined };

  return (
    <View style={{ gap: space.md }}>
      <SectionTitle>{g.requestsTitle}</SectionTitle>
      {requests.data?.length === 0 && <Muted>{g.noRequests}</Muted>}
      {(requests.data ?? []).map((r) => (
        <Card key={r.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '800', color: colors.label }}>
              {r.traveler_name} · {r.seats} {g.people}
            </Text>
            <Badge label={label[r.status] ?? r.status} tone={r.status === 'accepted' ? 'mint' : 'sand'} />
          </View>
          <Text selectable style={{ color: brand.forest, fontWeight: '600' }}>{r.traveler_contact}</Text>
          {r.message && <Text selectable style={{ color: colors.label }}>{r.message}</Text>}
          {r.status === 'requested' && (
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Button title={t.hub.accept} onPress={() => respond(r.id, true)} loading={busy === r.id} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title={t.hub.decline} variant="outline" onPress={() => respond(r.id, false)} />
              </View>
            </View>
          )}
        </Card>
      ))}
      {!cancelled && (
        <Button
          title={g.cancelTrip}
          variant="outline"
          onPress={() =>
            Alert.alert(g.cancelTrip, undefined, [
              { text: t.app.clear, style: 'cancel' },
              {
                text: g.cancelTrip,
                style: 'destructive',
                onPress: () => cancelGroupTrip(tripId).then(() => queryClient.invalidateQueries({ queryKey: ['group-trip', tripId] })),
              },
            ])
          }
        />
      )}
    </View>
  );
}
