import type { ReactNode } from 'react';
import { Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { useFonts } from 'expo-font';
import { ds } from '@rafrika/shared';

const { color, space, radius, type } = ds;

// Font files for the marketplace screens (see packages/shared/src/design.ts).
export function useMarketFonts() {
  const [loaded] = useFonts({ AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold, Fraunces_600SemiBold });
  return loaded;
}

// Android needs one family per weight.
export const ui: TextStyle = { fontFamily: 'AtkinsonHyperlegible_400Regular', color: color.ink };
export const uiBold: TextStyle = { fontFamily: 'AtkinsonHyperlegible_700Bold', color: color.ink };
export const display: TextStyle = { fontFamily: 'Fraunces_600SemiBold', color: color.ink };
export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

/** Card surface: sheet colour, 1px rule, 12px radius, no shadow. */
export const sheet: ViewStyle = {
  backgroundColor: color.sheet,
  borderWidth: 1,
  borderColor: color.rule,
  borderRadius: radius.card,
  padding: space.s16,
};

/** Quiet uppercase label: tiers, column labels. */
export function Label({ children, tone = color.inkSoft }: { children: ReactNode; tone?: string }) {
  return <Text style={[uiBold, { fontSize: type.label, letterSpacing: 1, textTransform: 'uppercase', color: tone }]}>{children}</Text>;
}

/** The only mint on a screen. */
export function VerifiedChip({ label }: { label: string }) {
  return (
    <View style={{ backgroundColor: color.mint, borderRadius: radius.chip, paddingHorizontal: space.s8, paddingVertical: 2, alignSelf: 'flex-start' }}>
      <Text style={[uiBold, { fontSize: type.label }]}>{label}</Text>
    </View>
  );
}

export function Price({ amount, size = type.price }: { amount: string; size?: number }) {
  return <Text style={[display, tabular, { fontSize: size }]}>{amount}</Text>;
}
