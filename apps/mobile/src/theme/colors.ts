import { Platform } from 'react-native';
import { Color } from 'expo-router';

// Native semantic colours (adapt to light/dark mode automatically) plus Rafrika brand colours.
export const colors = {
  label: Platform.select({ ios: Color.ios.label, android: Color.android.dynamic.onSurface, default: '#16211c' })!,
  secondaryLabel: Platform.select({ ios: Color.ios.secondaryLabel, android: Color.android.dynamic.onSurfaceVariant, default: '#5f6b66' })!,
  separator: Platform.select({ ios: Color.ios.separator, android: Color.android.dynamic.outlineVariant, default: '#e7e5e0' })!,
  background: Platform.select({ ios: Color.ios.systemGroupedBackground, android: Color.android.dynamic.surface, default: '#f7f6f3' })!,
  card: Platform.select({ ios: Color.ios.secondarySystemGroupedBackground, android: Color.android.dynamic.surfaceContainer, default: '#ffffff' })!,
  fill: Platform.select({ ios: Color.ios.tertiarySystemFill, android: Color.android.dynamic.surfaceContainerHigh, default: '#eeece7' })!,
};

// Brand colours from the website ("savanna sunset"); the same in light and dark mode.
export const brand = {
  night: '#0a1f17',
  forest: '#0e6b4f',
  mint: '#e3f6ee',
  sunset: '#ff6a2b',
  sunsetDark: '#e5521a',
  gold: '#ffb627',
  sand: '#fff8ee',
};

export const radius = { card: 20, button: 15, chip: 12 };
