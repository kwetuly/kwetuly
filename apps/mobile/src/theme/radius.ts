// Corner sizes. Pair every non-capsule radius with borderCurve: 'continuous'.
export const radius = {
  bar: 4, // progress bars
  chip: 12,
  media: 14, // photos and videos in chats
  button: 15, // same as the website's buttons
  bubble: 18, // chat bubbles
  card: 20,
  hero: 28, // the large photo panel on Explore
  full: 999, // capsules and dots
} as const;
