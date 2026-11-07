import { Platform, type TextStyle } from 'react-native';
import { brand, colors } from './colors';

// Text sizes, close to the iOS text styles. Screens pick a step; they never invent a size.
export const textSize = {
  caption: 12,
  footnote: 13,
  subhead: 14,
  callout: 15,
  body: 16,
  headline: 17,
  title3: 20,
  title2: 22,
  title1: 28,
  display: 38, // big prices and numbers
  hero: 48, // the welcome screen's wordmark
} as const;

// Plus Jakarta Sans, the website's font, loaded in the root layout. Each weight is its own font, so text sets
// `...font.bold` (and so on) instead of a bare `fontWeight`. iOS also gets the matching weight (it then picks the
// right face, and Chinese text that falls back to the system font keeps its weight); Android gets only the
// family, because a weight on top of a custom font makes Android fake the weight.
type FontFace = { fontFamily: string; fontWeight?: '400' | '500' | '600' | '700' | '800' };

function face(fontFamily: string, fontWeight: NonNullable<FontFace['fontWeight']>): FontFace {
  return Platform.OS === 'ios' ? { fontFamily, fontWeight } : { fontFamily };
}

export const fontFiles = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const font = {
  regular: face(fontFiles.regular, '400'),
  medium: face(fontFiles.medium, '500'),
  semibold: face(fontFiles.semibold, '600'),
  bold: face(fontFiles.bold, '700'),
  extrabold: face(fontFiles.extrabold, '800'),
} as const;

// Named text styles for the recurring roles. Extrabold (800) only for display, title1 and price.
export const type = {
  display: { fontSize: textSize.display, lineHeight: 44, ...font.extrabold, color: colors.label },
  title1: { fontSize: textSize.title1, lineHeight: 34, ...font.extrabold, color: colors.label },
  title2: { fontSize: textSize.title2, lineHeight: 28, ...font.bold, color: colors.label },
  title3: { fontSize: textSize.title3, lineHeight: 26, ...font.bold, color: colors.label },
  section: { fontSize: textSize.title3, lineHeight: 26, ...font.bold, color: colors.label },
  cardTitle: { fontSize: textSize.headline, lineHeight: 22, ...font.bold, color: colors.label },
  body: { fontSize: textSize.body, lineHeight: 24, ...font.regular, color: colors.label },
  callout: { fontSize: textSize.callout, lineHeight: 22, ...font.regular, color: colors.label },
  label: { fontSize: textSize.subhead, lineHeight: 20, ...font.semibold, color: colors.label },
  meta: { fontSize: textSize.footnote, lineHeight: 18, ...font.regular, color: colors.secondaryLabel },
  caption: { fontSize: textSize.caption, lineHeight: 16, ...font.regular, color: colors.secondaryLabel },
  price: { fontSize: textSize.title2, lineHeight: 28, ...font.extrabold, color: brand.primary, fontVariant: ['tabular-nums'] },
  link: { fontSize: textSize.callout, lineHeight: 22, ...font.semibold, color: brand.link },
  // Older names, kept so existing screens keep working.
  title: { fontSize: textSize.title3, lineHeight: 26, ...font.bold, color: colors.label },
  headline: { fontSize: textSize.headline, lineHeight: 22, ...font.bold, color: colors.label },
  muted: { fontSize: textSize.subhead, lineHeight: 20, ...font.regular, color: colors.secondaryLabel },
} as const satisfies Record<string, TextStyle>;

/** Header text for every stack: titles in bold, large titles in extrabold, both in the website's font. */
export const headerFonts = {
  headerTitleStyle: { ...font.bold, color: colors.label },
  headerLargeTitleStyle: { ...font.extrabold, color: colors.label },
};
