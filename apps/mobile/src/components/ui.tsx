import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { brand, colors, radius, space, textSize, type } from '@/theme';

// Small building blocks shared by every screen. Values come from '@/theme'; screens compose these
// instead of styling text, buttons or cards themselves.

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: colors.card, borderRadius: radius.card, borderCurve: 'continuous', padding: space.lg, gap: space.md, borderWidth: 1, borderColor: colors.separator }, style]}>
      {children}
    </View>
  );
}

export function Button({ title, onPress, variant = 'primary', disabled, loading, style }: { title: string; onPress: () => void; variant?: 'primary' | 'dark' | 'outline'; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle> }) {
  const background = variant === 'primary' ? brand.leaf : variant === 'dark' ? brand.night : 'transparent';
  const color = variant === 'outline' ? brand.forest : brand.onDark;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [{
        backgroundColor: background,
        borderWidth: variant === 'outline' ? 2 : 0,
        borderColor: brand.forest,
        borderRadius: radius.button,
        borderCurve: 'continuous',
        paddingVertical: space.lg,
        paddingHorizontal: space.lg,
        alignItems: 'center',
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      }, style]}
    >
      {loading ? <ActivityIndicator color={color} /> : <Text style={{ color, fontWeight: '700', fontSize: textSize.body }}>{title}</Text>}
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: active }}
      style={{
        backgroundColor: active ? brand.night : colors.card,
        borderColor: active ? brand.night : colors.separator,
        borderWidth: 1,
        borderRadius: radius.chip,
        borderCurve: 'continuous',
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
      }}
    >
      <Text style={{ color: active ? brand.onDark : colors.label, fontWeight: '600', fontSize: textSize.footnote }}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'mint' }: { label: string; tone?: 'mint' | 'sand' | 'night' | 'gold' }) {
  const styles = {
    mint: { backgroundColor: brand.mint, color: brand.forest },
    sand: { backgroundColor: brand.sand, color: brand.leafDark },
    night: { backgroundColor: brand.night, color: brand.onDark },
    gold: { backgroundColor: brand.goldSoft, color: brand.night },
  }[tone];
  return (
    <View style={{ backgroundColor: styles.backgroundColor, borderRadius: radius.full, paddingHorizontal: space.md, paddingVertical: space.xs, alignSelf: 'flex-start' }}>
      <Text style={{ color: styles.color, fontSize: textSize.caption, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Avatar({ name, uri, size = 56 }: { name: string; uri?: string | null; size?: number }) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size * 0.3 }} contentFit="cover" accessibilityLabel={name} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: brand.mint, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: brand.forest, fontWeight: '800', fontSize: size / 2.5 }}>{name.charAt(0)}</Text>
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
  return <Text style={type.title}>{children}</Text>;
}

export function Muted({ children, selectable }: { children: ReactNode; selectable?: boolean }) {
  return (
    <Text selectable={selectable} style={type.muted}>
      {children}
    </Text>
  );
}

/** Loading, error and empty states in one place. */
export function ScreenState({ loading, error, empty, emptyText, onRetry, retryLabel }: { loading?: boolean; error?: unknown; empty?: boolean; emptyText?: string; onRetry?: () => void; retryLabel?: string }) {
  if (loading) return <ActivityIndicator style={{ padding: space.xxl }} color={brand.leaf} />;
  if (error) {
    return (
      <View style={{ padding: space.xl, gap: space.md }}>
        <Text selectable style={{ color: brand.danger }}>{error instanceof Error ? error.message : String(error)}</Text>
        {onRetry && retryLabel && <Button title={retryLabel} variant="outline" onPress={onRetry} />}
      </View>
    );
  }
  if (empty && emptyText) return <Text style={{ padding: space.xl, color: colors.secondaryLabel, fontSize: textSize.callout }}>{emptyText}</Text>;
  return null;
}

const fieldInput = {
  backgroundColor: colors.background,
  borderRadius: radius.button,
  borderCurve: 'continuous' as const,
  paddingHorizontal: space.lg,
  paddingVertical: space.md,
  fontSize: textSize.body,
  color: colors.label,
};

/** Labelled text input used by every form. */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  hint?: string;
}) {
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
        accessibilityLabel={label}
        style={[fieldInput, multiline ? { minHeight: 100, textAlignVertical: 'top' } : null]}
      />
      {hint ? <Text style={{ color: colors.secondaryLabel, fontSize: textSize.caption }}>{hint}</Text> : null}
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
  const toggle = (value: T) => {
    if (!multiple) return onChange([value]);
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };
  return (
    <View style={{ gap: space.sm }}>
      <Text style={type.label}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {options.map((o) => (
          <Chip key={o.value} label={o.label} active={selected.includes(o.value)} onPress={() => toggle(o.value)} />
        ))}
      </View>
    </View>
  );
}

/** An error message; renders nothing when there is none. */
export function ErrorText({ children }: { children?: string | null }) {
  return children ? <Text selectable style={{ color: brand.danger }}>{children}</Text> : null;
}

/** Success or error line under a form. */
export function FormMessage({ message }: { message: { tone: 'ok' | 'error'; text: string } | null }) {
  if (!message) return null;
  return (
    <Text selectable style={{ color: message.tone === 'ok' ? brand.forest : brand.danger, fontWeight: '600' }}>
      {message.tone === 'ok' ? '✓ ' : ''}
      {message.text}
    </Text>
  );
}

/** The screen's main action, pinned at the bottom where a thumb reaches it. Give the scroll view extra bottom padding. */
export function BottomBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: Math.max(insets.bottom, 12), gap: space.sm, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.separator }}>
      {children}
    </View>
  );
}
