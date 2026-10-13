import { Text, View } from 'react-native';
import { ds, type Dictionary } from '@rafrika/shared';
import { VerifiedChip, display, tabular, ui } from './parts';

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
    <View style={{ paddingBottom: space.s16, borderBottomWidth: 1, borderBottomColor: color.rule, gap: space.s8 }}>
      <Text style={[display, { fontSize: type.title + 4 }]}>{name}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s8 }}>
        {verified && <VerifiedChip label={labels.verified} />}
        <Text style={[ui, { fontSize: type.small }]}>{city}</Text>
      </View>
      {vehicle || plate ? (
        <Text style={[ui, tabular, { fontSize: type.small, color: color.inkSoft }]}>
          {[vehicle, plate].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
    </View>
  );
}
