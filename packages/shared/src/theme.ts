// Kwetuly design tokens ("savanna sunset"), shared by the website and the mobile app.

export const colors = {
  night: '#7F7F7F', // grey for dark surfaces (text on it is white)
  shade: '#3A3A3A', // darker grey for fades over photos
  forest: '#187A16', // primary brand green
  forestDark: '#11590F',
  mint: '#E5F5E3', // soft green tint: badges, selections
  leaf: '#1D951A', // green for icons, accents and fills; button backgrounds use forest #187A16 (contrast); use leafDark for small text on white
  leafDark: '#187A16',
  gold: '#FFB627', // highlights
  sand: '#FFF8EE', // warm background sections
  charcoal: '#2B3631', // body text
  muted: '#5F6B66',
  border: '#E7E5E0',
  surface: '#F7F6F3',
  white: '#FFFFFF',
  danger: '#B42318',
} as const;

export const radius = 16;

export const fontFamily = 'Plus Jakarta Sans';
