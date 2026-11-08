// Fixed light colours taken from the website, so the app looks the same as kwetuly.com even when the
// phone is in dark mode or Android picks colours from the wallpaper.
export const colors = {
  label: '#2b3631', // website charcoal
  secondaryLabel: '#5f6b66', // website muted
  separator: '#e7e5e0', // website line
  background: '#f7f6f3', // website surface (page background)
  card: '#ffffff',
  fill: '#eeece7',
  // Role names from the 2026-11 restyle (aliases, no new colours).
  border: '#e7e5e0', // = separator: card and input borders
  pressed: '#f7f6f3', // = background: a row or card while pressed
  disabledFill: '#eeece7', // = fill: a disabled filled button
  disabledLabel: '#5f6b66', // = secondaryLabel: disabled text (4.70:1 on fill)
};

// Brand colours from the website ("savanna sunset").
export const brand = {
  night: '#7f7f7f', // grey for large surfaces with large or bold white text only; never behind small white text
  shade: '#3a3a3a', // darker grey for fades over photos, and small white text on dark
  ink: '#2b3631', // dark text on gold or light surfaces
  forest: '#187a16',
  mint: '#e5f5e3',
  leaf: '#1d951a', // icon squares, progress bar, tab indicator; never under small white text
  leafDark: '#187a16',
  gold: '#ffb627', // highlights only, never a button fill
  sand: '#fff8ee',
  goldSoft: '#ffe7b0', // gold badge background
  danger: '#b42318', // error text
  onDark: '#ffffff', // text on forest, shade or a photo
  // Role names from the 2026-11 restyle (aliases).
  primary: '#187a16', // = forest: every filled action (white text 5.5:1)
  link: '#187a16', // = leafDark: text links and text buttons
};

// Fades over photos, built from shade (#3a3a3a) so white text on the photo stays readable.
export const scrim = {
  hero: 'linear-gradient(to top, rgba(58,58,58,0.9) 0%, rgba(58,58,58,0.75) 50%, rgba(58,58,58,0.35) 100%)',
  heroFlat: 'rgba(58,58,58,0.75)', // the web, which has no gradient here
};
