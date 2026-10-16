import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { EVENTS, normalizePhone } from '@rafrika/shared';
import { Button, Card, Chip, Muted } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { getInviteOnly } from '@/lib/api-more';
import { track } from '@/lib/analytics';
import { needsSecondStep } from '@/lib/auth';
import { SITE_URL, supabase } from '@/lib/supabase';
import { enabledProviders, signInWithProvider, type SocialProvider } from '@/lib/social';
import { brand, colors, radius, space, textSize } from '@/theme';

const ROLES = ['traveler', 'guide', 'provider'] as const;

const input = {
  backgroundColor: colors.card,
  borderRadius: radius.button,
  borderCurve: 'continuous' as const,
  paddingHorizontal: space.lg,
  paddingVertical: space.md,
  fontSize: textSize.body,
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
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteOnly, setInviteOnly] = useState(false);

  useEffect(() => {
    enabledProviders().then(setProviders);
    getInviteOnly().then(setInviteOnly, () => setInviteOnly(false));
  }, []);
  useEffect(() => {
    if (mode === 'join') track(EVENTS.signupStarted, { role, locale });
    // Once per switch to the sign-up form, not on every role change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const done = () => (router.canGoBack() ? router.back() : router.replace('/'));

  async function verifyCode() {
    if (!factorId) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, '') });
    setBusy(false);
    if (error) return setMessage({ tone: 'error', text: t.ux.codeError });
    track(EVENTS.signinCompleted, { two_step: true });
    done();
  }

  async function cancelCode() {
    await supabase.auth.signOut();
    setFactorId(null);
    setCode('');
  }

  if (factorId) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <Card>
          <Text style={{ fontSize: textSize.title2, fontWeight: '800', color: colors.label }}>{t.ux.verifyTitle}</Text>
          <Muted>{t.ux.verifyBody}</Muted>
          {message && <Text selectable style={{ color: brand.danger, fontWeight: '600' }}>{message.text}</Text>}
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder={t.ux.code}
            placeholderTextColor={colors.secondaryLabel}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={7}
            autoFocus
            accessibilityLabel={t.ux.code}
            style={[input, { fontSize: 24, letterSpacing: 8, textAlign: 'center' }]}
          />
          <Button title={t.auth.signIn} onPress={verifyCode} loading={busy} />
          <Button title={t.ux.cancel} variant="outline" onPress={cancelCode} />
        </Card>
      </ScrollView>
    );
  }

  async function social(provider: SocialProvider) {
    setMessage(null);
    const ok = await signInWithProvider(provider);
    if (!ok) return setMessage({ tone: 'error', text: t.auth.error });
    const { data: current } = await supabase.auth.getSession();
    if (needsSecondStep(current.session)) {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp.find((f) => f.status === 'verified');
      if (factor) return setFactorId(factor.id);
    }
    // New social accounts still need an account type and phone number.
    const { data } = await supabase.from('profiles').select('onboarded_at').single();
    router.replace(data?.onboarded_at ? '/' : '/welcome');
  }

  async function submit() {
    setMessage(null);
    if (mode === 'signIn') {
      setBusy(true);
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(false);
      if (error) return setMessage({ tone: 'error', text: t.auth.error });
      // Accounts with two-step sign-in also need the code from their authenticator app.
      if (needsSecondStep(data.session)) {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const factor = factors?.totp.find((f) => f.status === 'verified');
        if (factor) return setFactorId(factor.id);
      }
      track(EVENTS.signinCompleted, {});
      // Accounts that have not finished sign-up (e.g. no valid invite code yet) go to the welcome step.
      const { data: profile } = await supabase.from('profiles').select('onboarded_at').single();
      if (profile && !profile.onboarded_at) return router.replace('/welcome');
      done();
      return;
    }

    const normalized = normalizePhone(phone);
    if (!normalized) return setMessage({ tone: 'error', text: t.auth.phoneError });
    if (!fullName.trim() || password.length < 8) return setMessage({ tone: 'error', text: t.auth.error });
    // Invite-only: the database checks the code when the account is created. A wrong code is refused
    // there, so no account is created and no email is sent.
    const invite = inviteCode.trim().slice(0, 200);
    if (inviteOnly && !invite) return setMessage({ tone: 'error', text: t.auth.inviteError });
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim(), role, phone: normalized, preferred_language: locale, ...(invite ? { invite_code: invite } : {}) },
        // The confirmation link opens the website, which confirms the account.
        emailRedirectTo: `${SITE_URL}/auth/confirm?next=/${locale}/dashboard`,
      },
    });
    setBusy(false);
    if (!error) track(EVENTS.signupCompleted, { role, locale });
    // Supabase Auth reports the database's refusal of the code only as a generic sign-up failure
    // ("Database error saving new user", code unexpected_failure).
    const inviteRefused = Boolean(
      error && inviteOnly && invite
      && (error.code === 'unexpected_failure'
          || error.message.includes('Database error saving new user')
          || error.message.includes('invite_code_invalid')),
    );
    setMessage(
      inviteRefused ? { tone: 'error', text: t.auth.inviteError }
      : error ? { tone: 'error', text: t.auth.error }
      : { tone: 'ok', text: t.app.checkEmail },
    );
    if (!error) setMode('signIn');
  }

  return (
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Chip label={t.auth.signIn} active={mode === 'signIn'} onPress={() => setMode('signIn')} />
          <Chip label={t.nav.signUp} active={mode === 'join'} onPress={() => setMode('join')} />
        </View>

        {message && (
          <Text selectable style={{ color: message.tone === 'error' ? brand.danger : brand.forest, fontWeight: '600' }}>
            {message.text}
          </Text>
        )}

        {providers.length > 0 && (
          <Card>
            {providers.map((p) => (
              <Button key={p} title={`${t.auth.continueWith} ${p === 'google' ? 'Google' : p === 'facebook' ? 'Facebook' : 'Apple'}`} variant="outline" onPress={() => social(p)} />
            ))}
            <Text style={{ textAlign: 'center', color: colors.secondaryLabel, fontSize: textSize.caption, fontWeight: '700' }}>{t.auth.orEmail}</Text>
          </Card>
        )}

        <Card>
          {mode === 'join' && (
            <>
              <Muted>{t.auth.welcomeRole}</Muted>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {ROLES.map((r) => (
                  <Chip key={r} label={t.join[r].title} active={role === r} onPress={() => setRole(r)} />
                ))}
              </View>
              <Muted>{t.join[role].body}</Muted>
              <TextInput value={fullName} onChangeText={setFullName} placeholder={t.auth.fullName} placeholderTextColor={colors.secondaryLabel} autoComplete="name" textContentType="name" style={input} />
              <TextInput value={phone} onChangeText={setPhone} placeholder={t.auth.phone} placeholderTextColor={colors.secondaryLabel} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" style={input} />
              <Text style={{ color: colors.secondaryLabel, fontSize: textSize.caption }}>{t.auth.phoneHint}</Text>
              {inviteOnly && (
                <>
                  <TextInput
                    value={inviteCode}
                    onChangeText={setInviteCode}
                    placeholder={t.auth.inviteCode}
                    placeholderTextColor={colors.secondaryLabel}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    maxLength={200}
                    accessibilityLabel={t.auth.inviteCode}
                    style={input}
                  />
                  <Text style={{ color: colors.secondaryLabel, fontSize: textSize.caption }}>{t.auth.inviteHint}</Text>
                </>
              )}
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
