import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';

export type GlyphName = { ios: SFSymbol; android: AndroidSymbol };

// One icon for iOS (SF Symbols) and Android/web (Material Symbols). Medium weight on iOS; Android uses its
// regular Material weight. Icons are decorative: the text next to them (or the button's label) is what a
// screen reader reads.
export function Glyph({ name, size, color }: { name: GlyphName; size: number; color: string }) {
  return (
    <SymbolView
      name={{ ios: name.ios, android: name.android, web: name.android }}
      size={size}
      tintColor={color}
      weight="medium"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/** Icons used by the shared components and several screens, so the same idea always gets the same icon. */
export const GLYPHS = {
  check: { ios: 'checkmark', android: 'check' },
  share: { ios: 'square.and.arrow.up', android: 'share' },
  calendar: { ios: 'calendar', android: 'calendar_month' },
  calendarClosed: { ios: 'calendar.badge.exclamationmark', android: 'event_busy' },
  chat: { ios: 'bubble.left.and.bubble.right', android: 'chat' },
  sparkles: { ios: 'sparkles', android: 'auto_awesome' },
  empty: { ios: 'tray', android: 'inbox' },
  error: { ios: 'exclamationmark.triangle', android: 'error' },
  close: { ios: 'xmark', android: 'close' },
  search: { ios: 'magnifyingglass', android: 'search' },
  hub: { ios: 'square.grid.2x2', android: 'dashboard' },
  profile: { ios: 'person.crop.circle', android: 'account_circle' },
  view: { ios: 'eye', android: 'visibility' },
  store: { ios: 'storefront', android: 'storefront' },
  briefcase: { ios: 'briefcase', android: 'work' },
  people: { ios: 'person.2', android: 'group' },
  calendarAdd: { ios: 'calendar.badge.plus', android: 'calendar_add_on' },
  handshake: { ios: 'person.2.badge.plus', android: 'handshake' },
  write: { ios: 'square.and.pencil', android: 'edit_note' },
  list: { ios: 'list.bullet', android: 'list' },
  bell: { ios: 'bell', android: 'notifications' },
  video: { ios: 'video', android: 'videocam' },
  hiking: { ios: 'figure.hiking', android: 'hiking' },
  lock: { ios: 'lock', android: 'lock' },
  power: { ios: 'power', android: 'power_settings_new' },
  photos: { ios: 'photo.on.rectangle', android: 'photo_library' },
  globe: { ios: 'globe', android: 'public' },
  news: { ios: 'newspaper', android: 'newspaper' },
  forum: { ios: 'text.bubble', android: 'forum' },
  phone: { ios: 'phone', android: 'call' },
  mail: { ios: 'envelope', android: 'mail' },
} as const satisfies Record<string, GlyphName>;
