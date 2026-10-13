import { ds, type Dictionary } from '@rafrika/shared';
import { Display, VerifiedChip } from './parts';

const { color, space, type } = ds;

export type ProviderHeaderProps = {
  name: string;
  verified: boolean;
  city: string;
  vehicle?: string | null;
  plate?: string | null;
  labels: Dictionary['market'];
};

// Who you are dealing with: name, verified, where they work, and the vehicle you will sit in.
export function ProviderHeader({ name, verified, city, vehicle, plate, labels }: ProviderHeaderProps) {
  return (
    <header style={{ paddingBottom: space.s16, borderBottom: `1px solid ${color.rule}`, color: color.ink }}>
      <Display size={type.title + 4}>{name}</Display>
      <div style={{ marginTop: space.s8, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space.s8, fontSize: type.small }}>
        {verified && <VerifiedChip label={labels.verified} />}
        <span>{city}</span>
      </div>
      {(vehicle || plate) && (
        <p style={{ margin: `${space.s8}px 0 0`, fontSize: type.small, color: color.inkSoft }}>
          {vehicle}
          {vehicle && plate ? ' · ' : ''}
          {plate && <span style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>{plate}</span>}
        </p>
      )}
    </header>
  );
}
