import { ds, formatDateSpan, formatTSh, type Dictionary } from '@rafrika/shared';
import { Display, Price, sheet, tabular } from './parts';

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
    <article style={{ ...sheet, padding: space.s16 }}>
      <Display>
        {from} → {to}
      </Display>
      <p style={{ margin: `${space.s4}px 0 0`, fontSize: type.body, ...tabular }}>
        {formatDateSpan(start, end)} · {people} {labels.people}
      </p>
      {note && <p style={{ margin: `${space.s8}px 0 0`, fontSize: type.small, color: color.inkSoft }}>“{note}”</p>}
      <div
        style={{
          marginTop: space.s12,
          paddingTop: space.s12,
          borderTop: `1px solid ${color.rule}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: space.s12,
        }}
      >
        <span style={{ fontSize: type.small, fontWeight: 700 }}>{bids}</span>
        {bestPrice != null && bidCount > 0 && (
          <span style={{ fontSize: type.small, color: color.inkSoft }}>
            {labels.best} <Price amount={formatTSh(bestPrice)} size={type.body + 2} />
          </span>
        )}
      </div>
    </article>
  );
}
