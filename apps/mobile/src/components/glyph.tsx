import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';

export type GlyphName = { ios: SFSymbol; android: AndroidSymbol };

// One icon for iOS (SF Symbols) and Android/web (Material Symbols).
export function Glyph({ name, size, color }: { name: GlyphName; size: number; color: string }) {
  return <SymbolView name={{ ios: name.ios, android: name.android, web: name.android }} size={size} tintColor={color} />;
}
