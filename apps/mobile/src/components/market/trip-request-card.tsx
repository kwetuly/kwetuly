import { Text, View } from 'react-native';
import { ds, formatDateSpan, formatTSh, type Dictionary } from '@rafrika/shared';
import { Price, display, sheet, tabular, ui, uiBold } from './parts';

const { color, space, type } = ds;

export type TripRequestCardProps = {
  from: string;
  to: string;
  start: string;
  end?: string | null;
  people: number;
  note?: string | null;
  bidCount: number;
  bestPrice?: number | null;
  labels: Dictionary['market'];
};

// One open request: the route is the object, then dates and party, then what the bids say.
export function TripRequestCard({ from, to, start, end, people, note, bidCount, bestPrice, labels }: TripRequestCardProps) {
  const bids = bidCount === 0 ? labels.noBids : bidCount === 1 ? labels.oneBid : `${bidCount} ${labels.bids}`;
  return (
    <View style={sheet}>
      <Text style={[display, { fontSize: type.title }]}>
        {from} → {to}
      </Text>
      <Text style={[ui, tabular, { fontSize: type.body, marginTop: space.s4 }]}>
        {formatDateSpan(start, end)} · {people} {labels.people}
      </Text>
      {note ? <Text style={[ui, { fontSize: type.small, color: color.inkSoft, marginTop: space.s8 }]}>“{note}”</Text> : null}
      <View
        style={{
          marginTop: space.s12,
          paddingTop: space.s12,
          borderTopWidth: 1,
          borderTopColor: color.rule,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: space.s12,
        }}
      >
        <Text style={[uiBold, { fontSize: type.small }]}>{bids}</Text>
        {bestPrice != null && bidCount > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.s4 }}>
            <Text style={[ui, { fontSize: type.small, color: color.inkSoft }]}>{labels.best}</Text>
            <Price amount={formatTSh(bestPrice)} size={type.body + 2} />
          </View>
        )}
      </View>
    </View>
  );
}
