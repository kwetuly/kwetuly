import { ds, formatDateSpan, formatTSh, type Dictionary, type EscrowStatus } from '@rafrika/shared';
import { tabular } from './parts';

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
  const statusColor = status === 'refunded' ? color.clay : color.ink;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '56px 1fr auto',
        columnGap: space.s12,
        padding: `${space.s12}px 0`,
        borderBottom: `1px solid ${color.rule}`,
        fontFamily: 'inherit',
        color: color.ink,
        fontSize: type.small,
      }}
    >
      <span style={{ ...tabular, color: color.inkSoft }}>{formatDateSpan(date)}</span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: type.body }}>{trip}</p>
        <p style={{ margin: `${space.s4}px 0 0`, color: color.inkSoft }}>{counterparty}</p>
        {status === 'held' && releaseDate && (
          <p style={{ margin: `${space.s4}px 0 0`, color: color.inkSoft }}>{labels.releases.replace('{date}', formatDateSpan(releaseDate))}</p>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: type.body, whiteSpace: 'nowrap', color: statusColor, ...tabular }}>
          {status === 'refunded' ? '− ' : ''}
          {formatTSh(amount)}
        </p>
        <span
          style={{
            display: 'inline-block',
            marginTop: space.s4,
            border: `1px solid ${status === 'refunded' ? color.clay : color.rule}`,
            borderRadius: radius.chip,
            padding: `1px ${space.s8}px`,
            fontSize: type.label,
            fontWeight: 700,
            color: statusColor,
          }}
        >
          {labels.status[status]}
        </span>
      </div>
    </div>
  );
}
