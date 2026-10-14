// Corner sizes. Pair every non-capsule radius with borderCurve: 'continuous'.
export const radius = {
  bar: 4, // progress bars
  chip: 5, // same as buttons
  media: 5, // photos and videos in chats
  button: 5, // buttons and inputs, same as the website
  bubble: 5, // chat bubbles
  card: 5,
  hero: 5, // the large photo panel on Explore
  full: 999, // dots only (progress dots on the intro)
} as const;
