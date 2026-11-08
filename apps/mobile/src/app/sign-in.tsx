import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { EVENTS, isReservedDisplayName, normalizePhone } from '@kwetuly/shared';
import { Button, Card, Chip, Field, FormMessage, FormScreen, Muted } from '@/components/ui';
import { PhoneField, initialPhone } from '@/components/phone-field';
import { useI18n } from '@/lib/i18n';
import { getInviteOnly } from '@/lib/api-more';
import { track } from '@/lib/analytics';
import { needsSecondStep } from '@/lib/auth';
import { SITE_URL, supabase } from '@/lib/supabase';
import { enabledProviders, PROVIDER_NAMES, signInWithProvider, type SocialProvider } from '@/lib/social';
import { useType } from '@/lib/use-type';
import { layout } from '@/theme';

const ROLES = ['traveler', 'guide', 'provider'] as const;

// Sign in, or create an account (with account type and phone number, like the website).
export default function SignInScreen() {
  const { t, locale } = useI18n();
  const { type } = useType();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<'signIn' | 'join'>(params.mode === 'join' ? 'join' : 'signIn');
  const [role, setRole] = useState<(typeof ROLES)[number]>('traveler');
  const [fullName, setFullName] = useState('');
  // Country from the phone's region setting (Tanzania otherwise); the number as the person types it.
  const [phone, setPhone] = useState(() => initialPhone(null));
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
    setMessage(null);
  }

  if (factorId) {
    return (
      <FormScreen>
        <Card>
          <Text accessibilityRole="header" style={type.title2}>{t.ux.verifyTitle}</Text>
          <Muted>{t.ux.verifyBody}</Muted>
          <Field
            label={t.ux.code}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={7}
            autoFocus
            code
            returnKeyType="go"
            onSubmitEditing={() => {
              if (!busy) verifyCode();
            }}
            error={message?.tone === 'error' ? message.text : null}
          />
          <Button title={t.auth.signIn} onPress={verifyCode} loading={busy} />
          <Button title={t.ux.cancel} variant="text" size="md" onPress={cancelCode} />
        </Card>
      </FormScreen>
    );
  }

  async function social(provider: SocialProvider) {
    setMessage(null);
    const result = await signInWithProvider(provider);
    if (!result.ok) {
      if (result.reason === 'cancelled') return;
      // Facebook or X shared no email, so Supabase refused to create the account: say so plainly.
      return setMessage({ tone: 'error', text: result.reason === 'no_email' ? t.ux.noEmail.replace('{provider}', PROVIDER_NAMES[provider]) : t.auth.error });
    }
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

    const normalized = normalizePhone(phone.number, phone.country);
    if (!normalized) return setMessage({ tone: 'error', text: t.phone.invalidGeneric });
    if (!fullName.trim() || password.length < 8) return setMessage({ tone: 'error', text: t.auth.error });
    // Names that look like Kwetuly are kept for its own team (the database refuses them too).
    if (isReservedDisplayName(fullName)) return setMessage({ tone: 'error', text: t.auth.nameReserved });
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
      && (error.message.includes('Database error saving new user')
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
    <FormScreen>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: layout.inlineGap }}>
        <Chip label={t.auth.signIn} active={mode === 'signIn'} onPress={() => setMode('signIn')} />
        <Chip label={t.nav.signUp} active={mode === 'join'} onPress={() => setMode('join')} />
      </View>

      {providers.length > 0 && (
        <Card>
          {providers.map((p) => (
            <Button key={p} title={`${t.auth.continueWith} ${PROVIDER_NAMES[p]}`} variant="outline" size="md" onPress={() => social(p)} />
          ))}
          <Text style={{ ...type.caption, textAlign: 'center' }}>{t.auth.orEmail}</Text>
        </Card>
      )}

      <Card>
        {mode === 'join' && (
          <>
            <Muted>{t.auth.welcomeRole}</Muted>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: layout.inlineGap }}>
              {ROLES.map((r) => (
                <Chip key={r} label={t.join[r].title} active={role === r} onPress={() => setRole(r)} />
              ))}
            </View>
            <Muted>{t.join[role].body}</Muted>
            <Field label={t.auth.fullName} value={fullName} onChangeText={setFullName} autoComplete="name" textContentType="name" />
            <PhoneField
              label={t.auth.phone}
              number={phone.number}
              country={phone.country}
              onChangeNumber={(number) => setPhone((p) => ({ ...p, number }))}
              onChangeCountry={(country) => setPhone((p) => ({ ...p, country }))}
            />
            {inviteOnly && (
              <Field
                label={t.auth.inviteCode}
                value={inviteCode}
                onChangeText={setInviteCode}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                maxLength={200}
                hint={t.auth.inviteHint}
              />
            )}
          </>
        )}
        <Field label={t.auth.email} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
        <Field
          label={t.auth.password}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'join' ? 'new-password' : 'current-password'}
          textContentType={mode === 'join' ? 'newPassword' : 'password'}
          returnKeyType="go"
          onSubmitEditing={() => {
            if (!busy) submit();
          }}
        />
        {/* Errors and "check your email" sit right above the button that caused them. */}
        <FormMessage message={message} />
        <Button title={mode === 'join' ? t.auth.createAccount : t.auth.signIn} onPress={submit} loading={busy} />
      </Card>
    </FormScreen>
  );
}
