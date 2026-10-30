import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { getLocales } from 'expo-localization';
import { SafeAreaView } from 'react-native-safe-area-context';
import { normalizePhone, phoneCountries, phoneCountryOrDefault, phoneExample, searchPhoneCountries, splitPhone } from '@kwetuly/shared';
import { Glyph } from '@/components/glyph';
import { useI18n } from '@/lib/i18n';
import { brand, colors, radius, space, textSize, type } from '@/theme';

/** The phone's own region (Settings, not location) as the first guess for the country, else Tanzania. */
export function devicePhoneCountry(): string {
  return phoneCountryOrDefault(getLocales().find((l) => l.regionCode)?.regionCode);
}

/**
 * Starting values for a phone field: a saved international number (+255…) is split into its
 * country and the local way of writing it; otherwise the device region is the first guess.
 */
export function initialPhone(saved: string | null | undefined): { country: string; number: string } {
  const { country, national } = splitPhone(saved, devicePhoneCountry());
  return { country, number: national };
}

const CHEVRON = { ios: 'chevron.down', android: 'keyboard_arrow_down' } as const;
const SEARCH = { ios: 'magnifyingglass', android: 'search' } as const;

// Phone number with a searchable country picker (Tanzania first). People type the number the way
// they know it, with or without the first 0; screens save normalizePhone(number, country), the
// same shared rule as the website, so the 0 never causes a problem.
export function PhoneField({
  label,
  number,
  country,
  onChangeNumber,
  onChangeCountry,
}: {
  label: string;
  number: string;
  country: string;
  onChangeNumber: (value: string) => void;
  onChangeCountry: (code: string) => void;
}) {
  const { t, locale } = useI18n();
  const p = t.phone;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [checked, setChecked] = useState(false);
  const countries = useMemo(() => phoneCountries(locale), [locale]);
  const matches = useMemo(() => searchPhoneCountries(countries, query), [countries, query]);
  const current = countries.find((c) => c.code === country) ?? countries[0];
  const example = phoneExample(current.code);
  const looksWrong = checked && number.trim() !== '' && normalizePhone(number, current.code) === null;

  return (
    <View style={{ gap: space.sm }}>
      <Text style={type.label}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Pressable
          onPress={() => {
            setQuery('');
            setOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={p.chooseCountry.replace('{country}', `${current.name} ${current.dial}`)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.xs,
            backgroundColor: colors.background,
            borderRadius: radius.button,
            borderCurve: 'continuous',
            paddingHorizontal: space.md,
            minHeight: 44,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ fontSize: textSize.headline }}>{current.flag}</Text>
          <Text style={{ fontSize: textSize.body, fontWeight: '600', color: colors.label }}>{current.dial}</Text>
          <Glyph name={CHEVRON} size={14} color={colors.secondaryLabel} />
        </Pressable>
        <TextInput
          value={number}
          onChangeText={(value) => onChangeNumber(value)}
          onBlur={() => setChecked(true)}
          placeholder={example}
          placeholderTextColor={colors.secondaryLabel}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          maxLength={40}
          accessibilityLabel={label}
          accessibilityHint={p.example.replace('{example}', example)}
          style={{
            flex: 1,
            minWidth: 0,
            backgroundColor: colors.background,
            borderRadius: radius.button,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: looksWrong ? brand.danger : 'transparent',
            paddingHorizontal: space.lg,
            paddingVertical: space.md,
            fontSize: textSize.body,
            color: colors.label,
          }}
        />
      </View>
      {looksWrong && (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: brand.danger, fontSize: textSize.footnote, fontWeight: '600' }}>
          {p.invalid.replace('{country}', current.name)}
        </Text>
      )}
      <Text style={type.caption}>
        {current.name} {current.dial}. {example ? p.example.replace('{example}', example) : ''}
      </Text>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderBottomWidth: 1, borderColor: colors.separator }}>
            <Text accessibilityRole="header" style={[type.headline, { flex: 1 }]}>{p.country}</Text>
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
                    onChangeCountry(matches[0].code);
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
              const selected = item.code === current.code;
              return (
                <Pressable
                  onPress={() => {
                    onChangeCountry(item.code);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${item.name} ${item.dial}`}
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
                  <Text style={{ fontSize: textSize.body, color: colors.secondaryLabel }}>{item.dial}</Text>
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}
