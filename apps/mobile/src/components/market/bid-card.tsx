import { Text, View } from 'react-native';
import { ds, formatTSh, type Dictionary, type Tier } from '@rafrika/shared';
import { Label, Price, VerifiedChip, sheet, ui, uiBold } from './parts';

const { color, space, type } = ds;

export type BidCardProps = {
  provider: string;
  verified: boolean;
  tier: Tier;
  price: number;
  includes: string;
  city: string;
  labels: Dictionary['market'];
};

// One bid row: who, verified or not, the tier as a quiet label, the price, one line of what is included.
// Tiers are rows on the same footing, not plans: no colour, no badge, VIP is not gold.
export function BidCard({ provider, verified, tier, price, includes, city, labels }: BidCardProps) {
  return (
    <View style={[sheet, { gap: space.s4 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.s12 }}>
        <View style={{ flex: 1, gap: space.s4 }}>
          <Text style={[uiBold, { fontSize: type.body }]}>{provider}</Text>
          {verified && <VerifiedChip label={labels.verified} />}
        </View>
        <Price amount={formatTSh(price)} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.s8 }}>
        <Label>{labels.tier[tier]}</Label>
        <Text style={[ui, { fontSize: type.small, color: color.inkSoft }]}>{city}</Text>
      </View>
      <Text style={[ui, { fontSize: type.small, marginTop: space.s4 }]}>{includes}</Text>
    </View>
  );
}
