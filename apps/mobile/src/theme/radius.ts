// Corner sizes. Pair every non-capsule radius with borderCurve: 'continuous'.
export const radius = {
  bar: 4, // progress bars
  chip: 5, // same as buttons
  media: 14, // photos and videos in chats
  button: 5, // buttons and inputs, same as the website
  bubble: 18, // chat bubbles
  card: 20,
  hero: 28, // the large photo panel on Explore
  full: 999, // capsules and dots
} as const;
