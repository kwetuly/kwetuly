// Fixed sizes for controls, icons and photos. Screens pick one; they never invent a size.

/** Glyph sizes. */
export const icon = { badge: 12, chip: 14, inline: 16, square: 20, action: 22 } as const;

/** Leaf squares with a white glyph. Pairs: sm 32 with a 20 glyph, md 40 with 20, lg 44 with 22. */
export const iconBox = { sm: 32, md: 40, lg: 44 } as const;

/** Control heights. Every tappable thing is at least `touch` high and wide. */
export const control = {
  touch: 44,
  buttonLg: 52,
  buttonMd: 44,
  field: 48,
  fieldMultiline: 100,
  chip: 36,
  row: 56,
  tile: 120, // Explore menu tiles
  bar: 8, // progress bar height
} as const;

/** Photo heights. */
export const media = { thumb: 72, chart: 140, chatMedia: 240, composerMax: 120, cardPhoto: 160, detailPhoto: 220, hero: 260, map: 300 } as const;

/** Largest text scaling for buttons, chips and badges, so long labels wrap instead of being cut off. Body text is not capped. */
export const maxFontScale = 1.4;
