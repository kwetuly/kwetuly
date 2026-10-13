import { ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { SAMPLE_DATA, ds } from '@rafrika/shared';
import { BidCard } from '@/components/market/bid-card';
import { EscrowRow } from '@/components/market/escrow-row';
import { Label, ui, useMarketFonts } from '@/components/market/parts';
import { ProviderHeader } from '@/components/market/provider-header';
import { TripRequestCard } from '@/components/market/trip-request-card';
import { useI18n } from '@/lib/i18n';

const { color, space } = ds;

// Review screen for the four marketplace components, built with SAMPLE_DATA. Delete before launch.
export default function DesignPreviewScreen() {
  const { t } = useI18n();
  const m = t.market;
  const s = SAMPLE_DATA;
  const fontsReady = useMarketFonts();
  const route = `${s.request.from} → ${s.request.to}`;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: color.paper }} contentContainerStyle={{ padding: space.s16, gap: space.s32, paddingBottom: space.s48 }}>
      <Stack.Screen options={{ title: 'Components', headerStyle: { backgroundColor: color.paper }, headerTintColor: color.ink, headerShadowVisible: false }} />
      {!fontsReady ? null : (
        <>
          <View style={{ gap: space.s12 }}>
            <Label>Trip request card</Label>
            <TripRequestCard {...s.request} bidCount={s.bids.length} bestPrice={Math.min(...s.bids.map((b) => b.price))} labels={m} />
            <TripRequestCard from="Moshi" to="Materuni" start="2026-10-20" people={2} bidCount={0} labels={m} />
          </View>

          <View style={{ gap: space.s12 }}>
            <Label>Bid card</Label>
            {s.bids.map((bid) => (
              <BidCard key={bid.tier} provider={s.provider.name} verified={s.provider.verified} city={s.provider.city} {...bid} labels={m} />
            ))}
          </View>

          <View style={{ gap: space.s12 }}>
            <Label>Escrow row</Label>
            <View>
              <EscrowRow date={s.escrow.date} trip={route} counterparty={s.provider.name} amount={s.escrow.amount} status="held" releaseDate={s.escrow.releaseDate} labels={m} />
              <EscrowRow date="2026-09-02" trip="Arusha → Tarangire" counterparty={s.provider.name} amount={420000} status="released" labels={m} />
              <EscrowRow date="2026-08-21" trip="Moshi → Marangu" counterparty={s.provider.name} amount={150000} status="refunded" labels={m} />
            </View>
          </View>

          <View style={{ gap: space.s12 }}>
            <Label>Provider header</Label>
            <ProviderHeader {...s.provider} labels={m} />
          </View>

          <Text style={[ui, { fontSize: 12, color: color.inkSoft }]}>
            SAMPLE_DATA · {s.traveller.name}, {s.traveller.city}
          </Text>
        </>
      )}
    </ScrollView>
  );
}
