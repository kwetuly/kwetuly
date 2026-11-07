// One spacing scale on a 4-point grid. Screen edges use `lg`; use the nearest step, never a new number.
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 64,
} as const;

// Semantic names on the same scale, so every screen spaces things the same way.
export const layout = {
  screenX: space.lg, // screen edges
  sectionGap: space.xxl, // between sections
  cardPadding: space.lg, // keep at 16: PhotoHeader uses -16 margins
  cardGap: space.md, // inside cards
  listGap: space.md, // between cards in lists
  inlineGap: space.sm, // chips, badges, meta items
  titleGap: space.md, // section title to content
} as const;
