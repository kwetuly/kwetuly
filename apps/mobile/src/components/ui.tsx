import { Children, Fragment, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  type AccessibilityRole,
  type GestureResponderEvent,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  FadeIn,
  Keyframe,
  ReduceMotion,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { HeaderHeightContext } from 'expo-router/react-navigation';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useI18n } from '@/lib/i18n';
import { brand, colors, control, icon, iconBox, layout, maxFontScale, media, motion, radius, space, textSize } from '@/theme';
import { useType } from '@/lib/use-type';
import { GLYPHS, Glyph, type GlyphName } from './glyph';

// Small building blocks shared by every screen. Values come from '@/theme'; screens compose these
// instead of styling text, buttons or cards themselves.

const timing = (duration: number) => ({ duration, reduceMotion: ReduceMotion.System });

/** Fades content in when it arrives after loading (off with Reduce Motion). */
export const contentFadeIn = FadeIn.duration(motion.fadeIn).reduceMotion(ReduceMotion.System);

export function Card({
  children,
  style,
  onPress,
  tone = 'default',
  accessibilityRole,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Makes the whole card tappable; it highlights while pressed. */
  onPress?: () => void;
  /** `plain`: no background or border, for page sections that only need the spacing. */
  tone?: 'default' | 'plain';
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
}) {
  const base: ViewStyle = {
    backgroundColor: tone === 'plain' ? 'transparent' : colors.card,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    padding: tone === 'plain' ? 0 : layout.cardPadding,
    gap: layout.cardGap,
    borderWidth: tone === 'plain' ? 0 : 1,
    borderColor: colors.border,
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, pressed && tone !== 'plain' ? { backgroundColor: colors.pressed } : null, style]}
    >
      {children}
    </Pressable>
  );
}

type ButtonVariant = 'primary' | 'outline' | 'text' | 'danger' | 'dark';

/**
 * One filled `primary` button per screen; everything else is `outline` or `text`.
 * `dark` is an old name and now draws as `outline` (white text on grey failed contrast).
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon: leading,
  disabled,
  loading,
  style,
  accessibilityLabel,
  detail,
}: {
  title: string;
  /** A short second line under the title, for example a price. */
  detail?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'lg' | 'md';
  /** A leading icon, for example share or call. */
  icon?: GlyphName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { font } = useType();
  const kind = variant === 'dark' ? 'outline' : variant;
  const reduceMotion = useReducedMotion();
  const press = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    opacity: 1 - press.value * (1 - (kind === 'primary' ? motion.pressOpacity : 0.6)),
    transform: [{ scale: kind === 'primary' && !reduceMotion ? 1 - press.value * (1 - motion.pressScale) : 1 }],
  }));

  const off = !!disabled;
  const palette = {
    primary: { bg: off ? colors.disabledFill : brand.primary, border: 'transparent', fg: off ? colors.disabledLabel : brand.onDark },
    outline: { bg: colors.card, border: off ? colors.border : brand.primary, fg: off ? colors.disabledLabel : brand.primary },
    text: { bg: 'transparent', border: 'transparent', fg: off ? colors.disabledLabel : brand.link },
    danger: { bg: 'transparent', border: 'transparent', fg: off ? colors.disabledLabel : brand.danger },
  }[kind];
  const filledOrOutline = kind === 'primary' || kind === 'outline';
  const minHeight = filledOrOutline ? (size === 'lg' ? control.buttonLg : control.buttonMd) : control.touch;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      onPressIn={() => {
        press.value = withTiming(1, timing(motion.pressIn));
      }}
      onPressOut={() => {
        press.value = withTiming(0, timing(motion.pressOut));
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={[{ minHeight: control.touch }, style]}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            {
              flexGrow: 1,
              minHeight,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.sm,
              backgroundColor: kind === 'outline' && pressed ? colors.pressed : palette.bg,
              borderWidth: kind === 'outline' ? 1 : 0,
              borderColor: palette.border,
              borderRadius: radius.button,
              borderCurve: 'continuous',
              paddingVertical: space.sm,
              paddingHorizontal: filledOrOutline ? space.lg : space.sm,
            },
            animated,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={palette.fg} />
          ) : (
            <>
              {leading && <Glyph name={leading} size={icon.square} color={palette.fg} />}
              <View style={{ flexShrink: 1, alignItems: 'center' }}>
                <Text
                  numberOfLines={2}
                  maxFontSizeMultiplier={maxFontScale}
                  style={{ textAlign: 'center', color: palette.fg, fontSize: textSize.body, lineHeight: 22, ...(filledOrOutline ? font.bold : font.semibold) }}
                >
                  {title}
                </Text>
                {detail ? (
                  <Text numberOfLines={1} maxFontSizeMultiplier={maxFontScale} style={{ textAlign: 'center', color: palette.fg, fontSize: textSize.subhead, lineHeight: 20, ...font.semibold }}>
                    {detail}
                  </Text>
                ) : null}
              </View>
            </>
          )}
        </Animated.View>
      )}
    </Pressable>
  );
}

/** A 44x44 icon-only button. The label is required: it is what a screen reader says. */
export function IconButton({
  glyph,
  onPress,
  accessibilityLabel,
  tone = 'plain',
  disabled,
}: {
  glyph: GlyphName;
  onPress: () => void;
  accessibilityLabel: string;
  /** `plain`: link-coloured icon; `tonal`: mint square; `primary`: forest square with a white icon (send buttons). */
  tone?: 'plain' | 'tonal' | 'primary';
  disabled?: boolean;
}) {
  const bg = { plain: 'transparent', tonal: brand.mint, primary: disabled ? colors.disabledFill : brand.primary }[tone];
  const fg = disabled ? colors.disabledLabel : tone === 'primary' ? brand.onDark : brand.link;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => ({
        width: control.touch,
        height: control.touch,
        borderRadius: radius.button,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed && tone === 'plain' ? colors.fill : bg,
        opacity: pressed && tone !== 'plain' ? motion.pressOpacity : 1,
      })}
    >
      <Glyph name={glyph} size={icon.action} color={fg} />
    </Pressable>
  );
}

/** An icon button on the right of the page header, for example Share. Render it anywhere in the screen. */
export function HeaderIconButton(props: { glyph: GlyphName; onPress: () => void; accessibilityLabel: string }) {
  return <Stack.Screen options={{ headerRight: () => <IconButton {...props} /> }} />;
}

export function Chip({
  label,
  active,
  onPress,
  accessibilityRole,
}: {
  label: string;
  active?: boolean;
  /** Gets the press event, which `Link asChild` needs to navigate on the web. */
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityRole?: AccessibilityRole;
}) {
  const { type } = useType();
  const on = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    on.value = withTiming(active ? 1 : 0, timing(motion.chip));
  }, [active, on]);
  const animated = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [colors.card, brand.mint]),
    borderColor: interpolateColor(on.value, [0, 1], [colors.border, brand.primary]),
  }));
  // Toggle chips (with `active`) tick under the finger; chips that only open a page do not.
  const press = onPress
    ? (event: GestureResponderEvent) => {
        if (active !== undefined) Haptics.selectionAsync().catch(() => {});
        onPress(event);
      }
    : undefined;
  return (
    <Pressable
      onPress={press}
      accessibilityRole={accessibilityRole ?? (onPress ? 'button' : 'text')}
      accessibilityState={{ selected: !!active }}
      hitSlop={{ top: (control.touch - control.chip) / 2, bottom: (control.touch - control.chip) / 2 }}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            {
              minHeight: control.chip,
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.xs,
              borderWidth: 1,
              borderRadius: radius.chip,
              borderCurve: 'continuous',
              paddingHorizontal: space.md,
              paddingVertical: space.xs,
              opacity: pressed ? motion.pressOpacity : 1,
            },
            animated,
          ]}
        >
          {active && <Glyph name={GLYPHS.check} size={icon.chip} color={brand.primary} />}
          <Text maxFontSizeMultiplier={maxFontScale} style={{ ...type.label, color: active ? brand.primary : colors.label }}>
            {label}
          </Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

export function Badge({ label, tone = 'mint', icon: leading }: { label: string; tone?: 'mint' | 'sand' | 'neutral' | 'night' | 'gold'; icon?: GlyphName }) {
  const { font } = useType();
  // `night` is an old name: it now draws as `neutral` (white text on grey failed contrast).
  const styles = {
    mint: { backgroundColor: brand.mint, color: brand.forest },
    sand: { backgroundColor: brand.sand, color: brand.leafDark },
    neutral: { backgroundColor: colors.fill, color: colors.label },
    night: { backgroundColor: colors.fill, color: colors.label },
    gold: { backgroundColor: brand.goldSoft, color: brand.ink },
  }[tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: styles.backgroundColor, borderRadius: radius.chip, borderCurve: 'continuous', paddingHorizontal: space.sm, paddingVertical: space.xs, alignSelf: 'flex-start' }}>
      {leading && <Glyph name={leading} size={icon.badge} color={styles.color} />}
      <Text maxFontSizeMultiplier={maxFontScale} style={{ color: styles.color, fontSize: textSize.caption, lineHeight: 16, ...font.bold }}>
        {label}
      </Text>
    </View>
  );
}

export function Avatar({ name, uri, size = 56 }: { name: string; uri?: string | null; size?: number }) {
  const { font } = useType();
  // A photo that fails to load (deleted, offline, bad link) falls back to the initial letter.
  const [failedUri, setFailedUri] = useState<string | null>(null);
  if (uri && uri !== failedUri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius.chip, backgroundColor: colors.fill }} contentFit="cover" accessibilityLabel={name} onError={() => setFailedUri(uri)} />;
  }
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={name} style={{ width: size, height: size, borderRadius: radius.chip, borderCurve: 'continuous', backgroundColor: brand.mint, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: brand.forest, ...font.extrabold, fontSize: size / 2.5 }}>{name.charAt(0)}</Text>
    </View>
  );
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const filled = Math.round(value);
  return (
    <Text accessibilityLabel={`${value} / 5`} style={{ fontSize: size, letterSpacing: 1 }}>
      <Text style={{ color: brand.gold }}>{'★'.repeat(filled)}</Text>
      <Text style={{ color: colors.separator }}>{'★'.repeat(5 - filled)}</Text>
    </Text>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const { type } = useType();
  return (
    <Text accessibilityRole="header" style={type.section}>
      {children}
    </Text>
  );
}

/** A page section: title (with an optional text button on the right), then the content 12 below. Parents space sections `layout.sectionGap` apart. */
export function Section({ title, action, children, style }: { title: string; action?: { label: string; onPress: () => void }; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: layout.titleGap }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
        <View style={{ flexShrink: 1 }}>
          <SectionTitle>{title}</SectionTitle>
        </View>
        {action && <Button title={action.label} variant="text" size="md" onPress={action.onPress} />}
      </View>
      {children}
    </View>
  );
}

export function Muted({ children, selectable }: { children: ReactNode; selectable?: boolean }) {
  const { type } = useType();
  return (
    <Text selectable={selectable} style={type.muted}>
      {children}
    </Text>
  );
}

/** A leaf square with a white icon. */
export function IconSquare({ glyph, size = 'sm' }: { glyph: GlyphName; size?: keyof typeof iconBox }) {
  const box = iconBox[size];
  return (
    <View style={{ width: box, height: box, borderRadius: radius.button, borderCurve: 'continuous', backgroundColor: brand.leaf, alignItems: 'center', justifyContent: 'center' }}>
      <Glyph name={glyph} size={size === 'lg' ? icon.action : icon.square} color={brand.onDark} />
    </View>
  );
}

/** Tappable rows split by 1px lines inside one card (Account, Hub, the concierge entry). */
export function ListGroup({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
      {rows.map((row, i) => (
        <Fragment key={i}>
          {i > 0 && <View style={{ height: 1, backgroundColor: colors.border, marginLeft: layout.cardPadding }} />}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

/** One row in a ListGroup. No chevron: the whole row is the button. */
export function ListRow({
  icon: glyph,
  leading,
  title,
  subtitle,
  subtitleLines,
  strong,
  onPress,
  accessory,
  accessibilityRole = 'button',
}: {
  icon?: GlyphName;
  /** Instead of an icon, for example an Avatar. */
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  subtitleLines?: number;
  /** Bolder title, for example an unread chat. */
  strong?: boolean;
  onPress?: () => void;
  accessory?: ReactNode;
  accessibilityRole?: AccessibilityRole;
}) {
  const { type, font } = useType();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? accessibilityRole : undefined}
      style={({ pressed }) => ({ minHeight: control.row, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: layout.cardPadding, paddingVertical: space.md, backgroundColor: pressed ? colors.pressed : colors.card })}
    >
      {leading ?? (glyph && <IconSquare glyph={glyph} />)}
      <View style={{ flex: 1, gap: space.xxs }}>
        <Text style={{ ...type.body, ...(strong ? font.bold : font.semibold) }}>{title}</Text>
        {subtitle ? (
          <Text numberOfLines={subtitleLines} style={type.meta}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {accessory}
    </Pressable>
  );
}

/** A label above its value, stacked so long languages fit. */
export function DetailRow({ label, value, selectable }: { label: string; value: ReactNode; selectable?: boolean }) {
  const { type } = useType();
  return (
    <View style={{ gap: space.xxs }}>
      <Text style={type.meta}>{label}</Text>
      <Text selectable={selectable} style={type.body}>
        {value}
      </Text>
    </View>
  );
}

/** 2 or 3 equal figures, each a value over a short label. Cells wrap on narrow phones. */
/** Figures side by side: the number on top, its label below, so the numbers share one line. */
export function StatRow({ items }: { items: { value: string; label: string }[] }) {
  const { type } = useType();
  if (items.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {items.map((item) => (
        <View
          key={item.label}
          accessible
          accessibilityLabel={`${item.label}: ${item.value}`}
          style={{ flexGrow: 1, flexBasis: 96, minWidth: 0, backgroundColor: colors.background, borderRadius: radius.card, borderCurve: 'continuous', padding: space.md, gap: space.xxs }}
        >
          <Text style={{ ...type.title3, fontVariant: ['tabular-nums'] }}>{item.value}</Text>
          <Text style={type.meta}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** A grey placeholder block that gently pulses while content loads (it stays still with Reduce Motion on). */
export function Skeleton({ height, width = '100%' }: { height: number; width?: ViewStyle['width'] }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withRepeat(withTiming(motion.skeletonOpacity, { duration: motion.skeleton }), -1, true);
  }, [opacity, reduceMotion]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ height, width, backgroundColor: colors.fill, borderRadius: radius.card, borderCurve: 'continuous' }, animated]} />;
}

/** A card-shaped placeholder: optional photo block, then two lines. */
export function SkeletonCard({ photo }: { photo?: boolean }) {
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, padding: layout.cardPadding, gap: layout.cardGap }}>
      {photo && <Skeleton height={media.cardPhoto} />}
      <Skeleton height={textSize.headline + space.xs} width="70%" />
      <Skeleton height={textSize.footnote + space.xs} width="45%" />
    </View>
  );
}

function Loading({ count = 1 }: { count?: number }) {
  return (
    <View accessibilityRole="progressbar" accessibilityState={{ busy: true }} style={{ gap: layout.listGap }}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

/** Nothing here yet: a leaf square, the existing text and an optional next step. */
export function EmptyState({ glyph = GLYPHS.empty, text, action }: { glyph?: GlyphName; text: string; action?: { label: string; onPress: () => void } }) {
  const { type } = useType();
  return (
    <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl, paddingHorizontal: space.lg }}>
      <IconSquare glyph={glyph} size="lg" />
      <Text style={{ ...type.callout, color: colors.secondaryLabel, textAlign: 'center' }}>{text}</Text>
      {action && <Button title={action.label} variant="outline" size="md" onPress={action.onPress} />}
    </View>
  );
}

/** Something went wrong, in plain words, with Try again. */
export function ErrorState({ onRetry, retryLabel }: { onRetry?: () => void; retryLabel?: string }) {
  const { type } = useType();
  const { t } = useI18n();
  return (
    <View accessibilityRole="alert" style={{ gap: space.md, paddingVertical: space.xl, paddingHorizontal: space.lg, alignItems: 'center' }}>
      <Text style={{ ...type.cardTitle, textAlign: 'center' }}>{t.ux.errorTitle}</Text>
      <Text style={{ ...type.callout, color: colors.secondaryLabel, textAlign: 'center' }}>{t.ux.errorBody}</Text>
      {onRetry && <Button title={retryLabel ?? t.ux.tryAgain} variant="outline" size="md" onPress={onRetry} />}
    </View>
  );
}

/**
 * Loading, error and empty states in one place.
 * `screen`: the state is the whole screen (an early return). It then scrolls under the header like any page,
 * so it never sits under a see-through iOS header.
 */
export function ScreenState({
  loading,
  error,
  empty,
  emptyText,
  emptyGlyph,
  emptyAction,
  onRetry,
  retryLabel,
  screen,
  loadingCount,
}: {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  emptyText?: string;
  emptyGlyph?: GlyphName;
  /** A way on from the empty state, for example back to the list. */
  emptyAction?: { label: string; onPress: () => void };
  onRetry?: () => void;
  retryLabel?: string;
  screen?: boolean;
  /** How many placeholder cards while loading (default 3 for a screen, 1 inline). */
  loadingCount?: number;
}) {
  let content: ReactNode = null;
  if (loading) content = <Loading count={loadingCount ?? (screen ? 3 : 1)} />;
  // Plain words instead of the technical message, like the website's error page.
  else if (error) content = <ErrorState onRetry={onRetry} retryLabel={retryLabel} />;
  else if (empty && emptyText) content = <EmptyState glyph={emptyGlyph} text={emptyText} action={emptyAction} />;
  if (!screen) return content;
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ flexGrow: 1, padding: layout.screenX, justifyContent: loading ? 'flex-start' : 'center' }}
    >
      {content}
    </ScrollView>
  );
}

// The browser's own focus ring is replaced by the green border.
// RN's types have no 'none' outline style, but react-native-web needs it to drop the ring.
const noWebOutline: TextStyle | null = Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as unknown as TextStyle) : null;

const fieldInput = {
  backgroundColor: colors.card,
  borderWidth: 1,
  borderRadius: radius.button,
  borderCurve: 'continuous' as const,
  minHeight: control.field,
  paddingHorizontal: space.lg,
  paddingVertical: space.md,
  fontSize: textSize.body,
  color: colors.label,
};

/** Labelled text input used by every form. The border turns green while typing and red with an error. */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  maxLength,
  hint,
  error,
  accessibilityLabel,
  autoComplete,
  textContentType,
  secureTextEntry,
  autoFocus,
  code,
  returnKeyType,
  onSubmitEditing,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
  maxLength?: number;
  hint?: string;
  error?: string | null;
  /** Defaults to the label. */
  accessibilityLabel?: string;
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  secureTextEntry?: boolean;
  autoFocus?: boolean;
  /** A short code (sign-in code): large, spaced and centred. */
  code?: boolean;
  /** The keyboard's Enter key, e.g. "go" on the last field of a form that `onSubmitEditing` submits. */
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
}) {
  const { type, font } = useType();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space.sm }}>
      <Text style={type.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.secondaryLabel}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        maxLength={maxLength}
        autoComplete={autoComplete}
        textContentType={textContentType}
        secureTextEntry={secureTextEntry}
        autoFocus={autoFocus}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing ? () => onSubmitEditing() : undefined}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={hint}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[fieldInput, font.regular, noWebOutline, { borderColor: error ? brand.danger : focused ? brand.primary : colors.border }, multiline ? { minHeight: control.fieldMultiline, textAlignVertical: 'top' } : null, code ? { fontSize: textSize.title2, letterSpacing: space.sm, textAlign: 'center' } : null]}
      />
      {error ? <ErrorText>{error}</ErrorText> : hint ? <Text style={type.caption}>{hint}</Text> : null}
    </View>
  );
}

/** A yes/no setting: the label, then a switch. The whole row is at least 44pt high. */
export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const { type } = useType();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, minHeight: control.touch }}>
      <Text style={{ ...type.body, flex: 1 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: brand.primary }} accessibilityLabel={label} />
    </View>
  );
}

/**
 * A form page: scrolls under the header, keeps fields and the bottom bar (`bar`, the main action where the
 * thumb reaches it) above the keyboard.
 *
 * Both platforms pad: Expo apps are edge-to-edge on Android, so the window no longer resizes for the keyboard
 * (app.json leaves softwareKeyboardLayoutMode at its default; never set it to "pan", which would move the view
 * twice). The offset is the header height (status bar included), because this view starts below the header.
 */
export function FormScreen({ children, bar, centred }: { children: ReactNode; bar?: ReactNode; centred?: boolean }) {
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ flexGrow: 1, padding: layout.screenX, gap: space.lg, paddingBottom: layout.sectionGap, justifyContent: centred ? 'center' : 'flex-start' }}
      >
        {children}
      </ScrollView>
      {bar ? <BottomBar>{bar}</BottomBar> : null}
    </KeyboardAvoidingView>
  );
}

/** A search box: magnifier, the text, and a clear button once something is typed. */
export function SearchField({
  label,
  value,
  onChangeText,
  placeholder,
  clearLabel,
}: {
  /** A short visible label above the box; long placeholders get cut off on small phones. */
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  /** Also the screen reader label. */
  placeholder: string;
  clearLabel: string;
}) {
  const { font, type } = useType();
  const [focused, setFocused] = useState(false);
  const box = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        minHeight: control.field,
        paddingLeft: space.md,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: focused ? brand.primary : colors.border,
        borderRadius: radius.button,
        borderCurve: 'continuous',
      }}
    >
      <Glyph name={GLYPHS.search} size={icon.inline} color={colors.secondaryLabel} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.secondaryLabel}
        returnKeyType="search"
        accessibilityLabel={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[{ flex: 1, minHeight: control.field, paddingVertical: space.sm, fontSize: textSize.body, color: colors.label, ...font.regular }, noWebOutline]}
      />
      {value ? <IconButton glyph={GLYPHS.close} accessibilityLabel={clearLabel} onPress={() => onChangeText('')} /> : <View style={{ width: space.sm }} />}
    </View>
  );
  if (!label) return box;
  return (
    <View style={{ gap: space.sm }}>
      <Text style={type.label}>{label}</Text>
      {box}
    </View>
  );
}

/** A row of chips that scrolls sideways, inset like the screen edges. Inside padded content, pass `bleed` to reach the screen edges. */
export function ChipRow({ children, bleed }: { children: ReactNode; bleed?: boolean }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={bleed ? { marginHorizontal: -layout.screenX } : undefined}
      // Vertical padding keeps the chips' taller touch area inside the scroll view.
      contentContainerStyle={{ gap: layout.inlineGap, paddingHorizontal: layout.screenX, paddingVertical: space.xs }}
    >
      {children}
    </ScrollView>
  );
}

/** Short facts side by side with a gap instead of "A · B · C"; they wrap on narrow phones. */
export function MetaItems({ items, selectable }: { items: (string | null | undefined | false | 0)[]; selectable?: boolean }) {
  const { type } = useType();
  const shown = items.filter((x): x is string => !!x);
  if (shown.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: space.xxs }}>
      {shown.map((item, i) => (
        <Text key={`${i}-${item}`} selectable={selectable} style={type.meta}>
          {item}
        </Text>
      ))}
    </View>
  );
}

/** Pick one or several options shown as chips. */
export function ChipSelect<T extends string>({
  label,
  options,
  selected,
  onChange,
  multiple = true,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (selected: T[]) => void;
  multiple?: boolean;
}) {
  const { type } = useType();
  const toggle = (value: T) => {
    if (!multiple) return onChange([value]);
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };
  return (
    <View style={{ gap: space.sm }}>
      <Text style={type.label}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: layout.inlineGap }}>
        {options.map((o) => (
          <Chip key={o.value} label={o.label} active={selected.includes(o.value)} onPress={() => toggle(o.value)} />
        ))}
      </View>
    </View>
  );
}

/** An error message; renders nothing when there is none. */
export function ErrorText({ children }: { children?: string | null }) {
  const { type } = useType();
  return children ? (
    <Text selectable accessibilityRole="alert" style={{ ...type.callout, color: brand.danger }}>
      {children}
    </Text>
  ) : null;
}

const successIn = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.8 }] },
  100: { opacity: 1, transform: [{ scale: 1 }] },
})
  .duration(motion.success)
  .reduceMotion(ReduceMotion.System);

/** A leaf square with a white check that pops in once. `haptic`: also tick the phone, right after the person's own action. */
export function SuccessCheck({ haptic }: { haptic?: boolean }) {
  useEffect(() => {
    if (haptic) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [haptic]);
  return (
    <Animated.View entering={successIn}>
      <IconSquare glyph={GLYPHS.check} />
    </Animated.View>
  );
}

/** Success or error line under a form. */
export function FormMessage({ message }: { message: { tone: 'ok' | 'error'; text: string } | null }) {
  const { type, font } = useType();
  if (!message) return null;
  if (message.tone === 'error') return <ErrorText>{message.text}</ErrorText>;
  return (
    <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <SuccessCheck key={message.text} haptic />
      <Text selectable style={{ flex: 1, ...type.callout, ...font.semibold, color: brand.primary }}>
        {message.text}
      </Text>
    </View>
  );
}

/** The screen's main action, pinned at the bottom where a thumb reaches it. Give the scroll view extra bottom padding. */
export function BottomBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingHorizontal: layout.screenX, paddingTop: space.md, paddingBottom: Math.max(insets.bottom, space.md), gap: space.sm, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border }}>
      {children}
    </View>
  );
}
