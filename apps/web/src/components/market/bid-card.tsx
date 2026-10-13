import { ds, formatTSh, type Dictionary, type Tier } from '@rafrika/shared';
import { Label, Price, VerifiedChip, sheet } from './parts';

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
    <article style={{ ...sheet, padding: space.s16, display: 'grid', gridTemplateColumns: '1fr auto', columnGap: space.s12, rowGap: space.s4 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space.s8, minWidth: 0 }}>
        <span style={{ fontSize: type.body, fontWeight: 700 }}>{provider}</span>
        {verified && <VerifiedChip label={labels.verified} />}
      </div>
      <Price amount={formatTSh(price)} />
      <div style={{ display: 'flex', gap: space.s8, alignItems: 'baseline' }}>
        <Label>{labels.tier[tier]}</Label>
        <span style={{ fontSize: type.small, color: color.inkSoft }}>{city}</span>
      </div>
      <span />
      <p style={{ gridColumn: '1 / -1', margin: `${space.s4}px 0 0`, fontSize: type.small }}>{includes}</p>
    </article>
  );
}
