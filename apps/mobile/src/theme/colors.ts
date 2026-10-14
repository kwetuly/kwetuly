import { Platform } from 'react-native';
import { Color } from 'expo-router';

// Native semantic colours (adapt to light/dark mode automatically) plus Rafrika brand colours.
export const colors = {
  label: Platform.select({ ios: Color.ios.label, android: Color.android.dynamic.onSurface, default: '#2b3631' })!,
  secondaryLabel: Platform.select({ ios: Color.ios.secondaryLabel, android: Color.android.dynamic.onSurfaceVariant, default: '#5f6b66' })!,
  separator: Platform.select({ ios: Color.ios.separator, android: Color.android.dynamic.outlineVariant, default: '#e7e5e0' })!,
  background: Platform.select({ ios: Color.ios.systemGroupedBackground, android: Color.android.dynamic.surface, default: '#f7f6f3' })!,
  card: Platform.select({ ios: Color.ios.secondarySystemGroupedBackground, android: Color.android.dynamic.surfaceContainer, default: '#ffffff' })!,
  fill: Platform.select({ ios: Color.ios.tertiarySystemFill, android: Color.android.dynamic.surfaceContainerHigh, default: '#eeece7' })!,
};

// Brand colours from the website ("savanna sunset"); the same in light and dark mode.
export const brand = {
  night: '#1c3a2e',
  forest: '#187a16',
  mint: '#e5f5e3',
  leaf: '#1d951a', // green for buttons and fills; links use leafDark
  leafDark: '#187a16',
  gold: '#ffb627',
  sand: '#fff8ee',
  goldSoft: '#ffe7b0', // gold badge background
  danger: '#b42318', // error text
  onDark: '#ffffff', // text on night, leaf, forest or a photo
};

