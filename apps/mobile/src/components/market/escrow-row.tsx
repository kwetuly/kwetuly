import { Text, View } from 'react-native';
import { ds, formatDateSpan, formatTSh, type Dictionary, type EscrowStatus } from '@rafrika/shared';
import { tabular, ui, uiBold } from './parts';

const { color, space, radius, type } = ds;

export type EscrowRowProps = {
  date: string;
  trip: string;
  counterparty: string;
  amount: number;
  status: EscrowStatus;
  releaseDate?: string | null;
  labels: Dictionary['market'];
};

// A statement row, like M-Pesa: date, what, amount, state. Only a refund gets colour (clay).
export function EscrowRow({ date, trip, counterparty, amount, status, releaseDate, labels }: EscrowRowProps) {
  const tone = status === 'refunded' ? color.clay : color.ink;
  return (
    <View style={{ flexDirection: 'row', gap: space.s12, paddingVertical: space.s12, borderBottomWidth: 1, borderBottomColor: color.rule }}>
      <Text style={[ui, tabular, { width: 52, fontSize: type.small, color: color.inkSoft }]}>{formatDateSpan(date)}</Text>
      <View style={{ flex: 1, gap: space.s4 }}>
        <Text style={[uiBold, { fontSize: type.body }]}>{trip}</Text>
        <Text style={[ui, { fontSize: type.small, color: color.inkSoft }]}>{counterparty}</Text>
        {status === 'held' && releaseDate ? (
          <Text style={[ui, { fontSize: type.small, color: color.inkSoft }]}>{labels.releases.replace('{date}', formatDateSpan(releaseDate))}</Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: space.s4 }}>
        <Text style={[uiBold, tabular, { fontSize: type.body, color: tone }]}>
          {status === 'refunded' ? '− ' : ''}
          {formatTSh(amount)}
        </Text>
        <View style={{ borderWidth: 1, borderColor: status === 'refunded' ? color.clay : color.rule, borderRadius: radius.chip, paddingHorizontal: space.s8, paddingVertical: 1 }}>
          <Text style={[uiBold, { fontSize: type.label, color: tone }]}>{labels.status[status]}</Text>
        </View>
      </View>
    </View>
  );
}
