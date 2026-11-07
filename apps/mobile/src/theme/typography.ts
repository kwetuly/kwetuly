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

export const fontFiles = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

type FontKey = keyof typeof fontFiles;
type Weight = '400' | '500' | '600' | '700' | '800';
export type FontFace = { fontFamily?: string; fontWeight?: Weight };

const WEIGHTS: Record<FontKey, Weight> = { regular: '400', medium: '500', semibold: '600', bold: '700', extrabold: '800' };

/**
 * The font for each weight, per language.
 * - Chinese: Plus Jakarta Sans has no Chinese characters, so Chinese uses the phone's own font with a real weight.
 * - Other languages: Plus Jakarta Sans, the website's font, loaded in the root layout; each weight is its own font.
 *   iOS also gets the matching weight (it then picks the right face). Android and web get only the font: a weight
 *   on top of a single-weight font makes Android fake the weight, and the browser draws a fake bold.
 */
function fontsFor(locale: string): Record<FontKey, FontFace> {
  const face = (k: FontKey): FontFace =>
    locale === 'zh' ? { fontWeight: WEIGHTS[k] } : Platform.OS === 'ios' ? { fontFamily: fontFiles[k], fontWeight: WEIGHTS[k] } : { fontFamily: fontFiles[k] };
  return { regular: face('regular'), medium: face('medium'), semibold: face('semibold'), bold: face('bold'), extrabold: face('extrabold') };
}

// Named text styles for the recurring roles. Extrabold (800) only for display, title1 and price.
function typeFor(font: Record<FontKey, FontFace>) {
  return {
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
}

function buildText(locale: string) {
  const font = fontsFor(locale);
  return {
    font,
    type: typeFor(font),
    /** Header text for every stack: titles in bold, large titles in extrabold. */
    headerFonts: {
      headerTitleStyle: { ...font.bold, color: colors.label },
      headerLargeTitleStyle: { ...font.extrabold, color: colors.label },
    },
  };
}

export type ThemeText = ReturnType<typeof buildText>;
const cache = new Map<string, ThemeText>();

/** Fonts and text styles for one language, cached so they stay the same objects between renders. Screens use `useType()`. */
export function themeText(locale: string): ThemeText {
  let text = cache.get(locale);
  if (!text) {
    text = buildText(locale);
    cache.set(locale, text);
  }
  return text;
}

// Defaults for code outside the app's providers. Inside the app use `useType()`, so Chinese gets the system font.
export const { font, type, headerFonts } = themeText('en');
