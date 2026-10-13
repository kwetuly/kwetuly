import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { brand, colors, radius } from '@/theme/colors';

// Small building blocks shared by every screen, in Rafrika's colours and 15px button corners.

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: colors.card, borderRadius: radius.card, borderCurve: 'continuous', padding: 16, gap: 10, boxShadow: '0 4px 16px rgba(10,31,23,0.08)' }, style]}>
      {children}
    </View>
  );
}

export function Button({ title, onPress, variant = 'primary', disabled, loading }: { title: string; onPress: () => void; variant?: 'primary' | 'dark' | 'outline'; disabled?: boolean; loading?: boolean }) {
  const background = variant === 'primary' ? brand.sunset : variant === 'dark' ? brand.night : 'transparent';
  const color = variant === 'outline' ? brand.forest : '#ffffff';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => ({
        backgroundColor: background,
        borderWidth: variant === 'outline' ? 2 : 0,
        borderColor: brand.forest,
        borderRadius: radius.button,
        borderCurve: 'continuous',
        paddingVertical: 14,
        paddingHorizontal: 18,
        alignItems: 'center',
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      {loading ? <ActivityIndicator color={color} /> : <Text style={{ color, fontWeight: '700', fontSize: 16 }}>{title}</Text>}
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
        paddingVertical: 7,
        paddingHorizontal: 12,
      }}
    >
      <Text style={{ color: active ? '#ffffff' : colors.label, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'mint' }: { label: string; tone?: 'mint' | 'sand' | 'night' | 'gold' }) {
  const styles = {
    mint: { backgroundColor: brand.mint, color: brand.forest },
    sand: { backgroundColor: brand.sand, color: brand.sunsetDark },
    night: { backgroundColor: brand.night, color: '#ffffff' },
    gold: { backgroundColor: '#ffe7b0', color: brand.night },
  }[tone];
  return (
    <View style={{ backgroundColor: styles.backgroundColor, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }}>
      <Text style={{ color: styles.color, fontSize: 12, fontWeight: '700' }}>{label}</Text>
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
  return <Text style={{ fontSize: 20, fontWeight: '800', color: colors.label }}>{children}</Text>;
}

export function Muted({ children, selectable }: { children: ReactNode; selectable?: boolean }) {
  return (
    <Text selectable={selectable} style={{ color: colors.secondaryLabel, fontSize: 14, lineHeight: 20 }}>
      {children}
    </Text>
  );
}

/** Loading, error and empty states in one place. */
export function ScreenState({ loading, error, empty, emptyText, onRetry, retryLabel }: { loading?: boolean; error?: unknown; empty?: boolean; emptyText?: string; onRetry?: () => void; retryLabel?: string }) {
  if (loading) return <ActivityIndicator style={{ padding: 32 }} color={brand.sunset} />;
  if (error) {
    return (
      <View style={{ padding: 24, gap: 12 }}>
        <Text selectable style={{ color: '#b42318' }}>{error instanceof Error ? error.message : String(error)}</Text>
        {onRetry && retryLabel && <Button title={retryLabel} variant="outline" onPress={onRetry} />}
      </View>
    );
  }
  if (empty && emptyText) return <Text style={{ padding: 24, color: colors.secondaryLabel, fontSize: 15 }}>{emptyText}</Text>;
  return null;
}
