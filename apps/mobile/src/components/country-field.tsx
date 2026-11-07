import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { billingCountries } from '@kwetuly/shared';
import { Glyph } from '@/components/glyph';
import { useI18n } from '@/lib/i18n';
import { brand, colors, radius, space, textSize, type } from '@/theme';

const CHEVRON = { ios: 'chevron.down', android: 'keyboard_arrow_down' } as const;
const SEARCH = { ios: 'magnifyingglass', android: 'search' } as const;

// Lower case without accents, so "cote" finds Côte d’Ivoire.
const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();

// A labelled country picker (two-letter ISO codes, names in the app language, Tanzania first) with
// search, in the same sheet style as the phone country picker.
export function CountryField({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (code: string) => void }) {
  const { t, locale } = useI18n();
  const p = t.phone;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const countries = useMemo(() => billingCountries(locale), [locale]);
  const matches = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return countries;
    return countries.filter((c) => c.code.toLowerCase() === q || fold(c.name).includes(q));
  }, [countries, query]);
  const current = countries.find((c) => c.code === value);

  return (
    <View style={{ gap: space.sm }}>
      <Text style={type.label}>{label}</Text>
      <Pressable
        onPress={() => {
          setQuery('');
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.name ?? placeholder}`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          backgroundColor: colors.background,
          borderRadius: radius.button,
          borderCurve: 'continuous',
          paddingHorizontal: space.lg,
          minHeight: 48,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        {current && <Text style={{ fontSize: textSize.headline }}>{current.flag}</Text>}
        <Text numberOfLines={1} style={{ flex: 1, fontSize: textSize.body, color: current ? colors.label : colors.secondaryLabel }}>
          {current?.name ?? placeholder}
        </Text>
        <Glyph name={CHEVRON} size={14} color={colors.secondaryLabel} />
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderBottomWidth: 1, borderColor: colors.separator }}>
            <Text accessibilityRole="header" style={[type.headline, { flex: 1 }]}>{label}</Text>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" hitSlop={space.md} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ color: brand.leafDark, fontWeight: '700', fontSize: textSize.body }}>{p.close}</Text>
            </Pressable>
          </View>
          <View style={{ padding: space.lg, paddingBottom: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.background, borderRadius: radius.button, borderCurve: 'continuous', paddingHorizontal: space.md }}>
              <Glyph name={SEARCH} size={16} color={colors.secondaryLabel} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={p.search}
                placeholderTextColor={colors.secondaryLabel}
                accessibilityLabel={p.search}
                autoCorrect={false}
                autoCapitalize="none"
                autoFocus
                returnKeyType="search"
                onSubmitEditing={() => {
                  if (matches[0]) {
                    onChange(matches[0].code);
                    setOpen(false);
                  }
                }}
                style={{ flex: 1, paddingVertical: space.md, fontSize: textSize.body, color: colors.label }}
              />
            </View>
          </View>
          <FlatList
            data={matches}
            keyExtractor={(c) => c.code}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            ListEmptyComponent={<Text style={[type.muted, { padding: space.lg }]}>{p.noMatch}</Text>}
            renderItem={({ item }) => {
              const selected = item.code === value;
              return (
                <Pressable
                  onPress={() => {
                    onChange(item.code);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={item.name}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.md,
                    paddingHorizontal: space.lg,
                    minHeight: 48,
                    backgroundColor: selected ? brand.mint : pressed ? colors.fill : colors.card,
                  })}
                >
                  <Text style={{ fontSize: textSize.title3 }}>{item.flag}</Text>
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: textSize.body, color: selected ? brand.forest : colors.label, fontWeight: selected ? '700' : '400' }}>
                    {item.name}
                  </Text>
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}
