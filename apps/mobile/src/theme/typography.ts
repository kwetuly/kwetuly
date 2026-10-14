import type { TextStyle } from 'react-native';
import { colors } from './colors';

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

// Named text styles for the recurring roles.
export const type = {
  title: { fontSize: textSize.title3, fontWeight: '800', color: colors.label },
  headline: { fontSize: textSize.headline, fontWeight: '700', color: colors.label },
  body: { fontSize: textSize.body, color: colors.label },
  label: { fontSize: textSize.subhead, fontWeight: '600', color: colors.label },
  muted: { fontSize: textSize.subhead, lineHeight: 20, color: colors.secondaryLabel },
  caption: { fontSize: textSize.caption, color: colors.secondaryLabel },
} as const satisfies Record<string, TextStyle>;
