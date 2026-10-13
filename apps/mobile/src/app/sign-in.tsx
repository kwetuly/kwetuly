import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { normalizePhone } from '@rafrika/shared';
import { Button, Card, Chip, Muted } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { SITE_URL, supabase } from '@/lib/supabase';
import { enabledProviders, signInWithProvider, type SocialProvider } from '@/lib/social';
import { colors, radius } from '@/theme/colors';

const ROLES = ['traveler', 'guide', 'provider'] as const;

const input = {
  backgroundColor: colors.card,
  borderRadius: radius.button,
  borderCurve: 'continuous' as const,
  paddingHorizontal: 14,
  paddingVertical: 13,
  fontSize: 16,
  color: colors.label,
};

// Sign in, or create an account (with account type and phone number, like the website).
export default function SignInScreen() {
  const { t, locale } = useI18n();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<'signIn' | 'join'>(params.mode === 'join' ? 'join' : 'signIn');
  const [role, setRole] = useState<(typeof ROLES)[number]>('traveler');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null);
  const [providers, setProviders] = useState<SocialProvider[]>([]);

  useEffect(() => {
    enabledProviders().then(setProviders);
  }, []);

  async function social(provider: SocialProvider) {
    setMessage(null);
    const ok = await signInWithProvider(provider);
    if (!ok) return setMessage({ tone: 'error', text: t.auth.error });
    // New social accounts still need an account type and phone number.
    const { data } = await supabase.from('profiles').select('onboarded_at').single();
    router.replace(data?.onboarded_at ? '/' : '/welcome');
  }

  async function submit() {
    setMessage(null);
    if (mode === 'signIn') {
      setBusy(true);
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(false);
      if (error) setMessage({ tone: 'error', text: t.auth.error });
      else router.back();
      return;
    }

    const normalized = normalizePhone(phone);
    if (!normalized) return setMessage({ tone: 'error', text: t.auth.phoneError });
    if (!fullName.trim() || password.length < 8) return setMessage({ tone: 'error', text: t.auth.error });
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim(), role, phone: normalized, preferred_language: locale },
        // The confirmation link opens the website, which confirms the account.
        emailRedirectTo: `${SITE_URL}/auth/confirm?next=/${locale}/dashboard`,
      },
    });
    setBusy(false);
    setMessage(error ? { tone: 'error', text: t.auth.error } : { tone: 'ok', text: t.app.checkEmail });
    if (!error) setMode('signIn');
  }

  return (
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label={t.auth.signIn} active={mode === 'signIn'} onPress={() => setMode('signIn')} />
          <Chip label={t.nav.signUp} active={mode === 'join'} onPress={() => setMode('join')} />
        </View>

        {message && (
          <Text selectable style={{ color: message.tone === 'error' ? '#b42318' : '#0e6b4f', fontWeight: '600' }}>
            {message.text}
          </Text>
        )}

        {providers.length > 0 && (
          <Card>
            {providers.map((p) => (
              <Button key={p} title={`${t.auth.continueWith} ${p === 'google' ? 'Google' : p === 'facebook' ? 'Facebook' : 'Apple'}`} variant="outline" onPress={() => social(p)} />
            ))}
            <Text style={{ textAlign: 'center', color: colors.secondaryLabel, fontSize: 12, fontWeight: '700' }}>{t.auth.orEmail.toUpperCase()}</Text>
          </Card>
        )}

        <Card>
          {mode === 'join' && (
            <>
              <Muted>{t.auth.welcomeRole}</Muted>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {ROLES.map((r) => (
                  <Chip key={r} label={t.join[r].title} active={role === r} onPress={() => setRole(r)} />
                ))}
              </View>
              <Muted>{t.join[role].body}</Muted>
              <TextInput value={fullName} onChangeText={setFullName} placeholder={t.auth.fullName} placeholderTextColor={colors.secondaryLabel} autoComplete="name" textContentType="name" style={input} />
              <TextInput value={phone} onChangeText={setPhone} placeholder={t.auth.phone} placeholderTextColor={colors.secondaryLabel} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" style={input} />
              <Text style={{ color: colors.secondaryLabel, fontSize: 12 }}>{t.auth.phoneHint}</Text>
            </>
          )}
          <TextInput value={email} onChangeText={setEmail} placeholder={t.auth.email} placeholderTextColor={colors.secondaryLabel} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" style={input} />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={t.auth.password}
            placeholderTextColor={colors.secondaryLabel}
            secureTextEntry
            autoComplete={mode === 'join' ? 'new-password' : 'current-password'}
            textContentType={mode === 'join' ? 'newPassword' : 'password'}
            style={input}
          />
          <Button title={mode === 'join' ? t.auth.createAccount : t.auth.signIn} onPress={submit} loading={busy} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
