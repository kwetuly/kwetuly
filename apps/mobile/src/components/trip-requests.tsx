import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cancelGroupTrip, listTripRequests, respondToTripRequest } from '@/lib/api-more';
import { useI18n } from '@/lib/i18n';
import { useType } from '@/lib/use-type';

import { GLYPHS } from './glyph';
import { Badge, Button, Card, EmptyState, MetaItems, ScreenState, Section } from './ui';
import { brand, space } from '@/theme';

// Organiser view on a group trip: requests to join (accept / decline) and cancelling the trip.
export function TripRequests({ tripId, cancelled }: { tripId: string; cancelled: boolean }) {
  const { t } = useI18n();
  const { type, font } = useType();
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
    <Section title={g.requestsTitle}>
      <ScreenState loading={requests.isLoading} error={requests.error} onRetry={() => requests.refetch()} />
      {requests.data?.length === 0 && <EmptyState glyph={GLYPHS.people} text={g.noRequests} />}
      {(requests.data ?? []).map((r) => (
        <Card key={r.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.sm }}>
            <View style={{ flex: 1, gap: space.xxs }}>
              <Text style={type.cardTitle}>{r.traveler_name}</Text>
              <MetaItems items={[`${r.seats} ${g.people}`]} />
            </View>
            <Badge label={label[r.status] ?? r.status} tone={r.status === 'accepted' ? 'mint' : 'sand'} />
          </View>
          <Text selectable style={{ ...type.callout, ...font.semibold, color: brand.forest }}>{r.traveler_contact}</Text>
          {r.message && <Text selectable style={type.callout}>{r.message}</Text>}
          {r.status === 'requested' && (
            // Several requests can be open at once, so these are not filled buttons.
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              <Button title={t.hub.accept} variant="outline" size="md" style={{ flexGrow: 1 }} onPress={() => respond(r.id, true)} loading={busy === r.id} />
              <Button title={t.hub.decline} variant="text" size="md" style={{ flexGrow: 1 }} onPress={() => respond(r.id, false)} />
            </View>
          )}
        </Card>
      ))}
      {!cancelled && (
        <View style={{ alignItems: 'flex-start' }}>
          <Button
            title={g.cancelTrip}
            variant="danger"
            size="md"
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
        </View>
      )}
    </Section>
  );
}
