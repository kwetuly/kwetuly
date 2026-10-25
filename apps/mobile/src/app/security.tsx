import { useState } from 'react';
import { Linking, ScrollView, Text, TextInput } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { Button, Card, FormMessage, Muted, ScreenState } from '@/components/ui';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { brand, colors, radius, space, textSize } from '@/theme';

type Setup = { factorId: string; secret: string; uri: string };

// Two-step sign-in (authenticator app codes, Supabase TOTP), the same as /security on the website.
export default function SecurityScreen() {
  const { t } = useI18n();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const factors = useQuery({
    queryKey: ['mfa-factors', session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data.totp;
    },
    enabled: !!session,
  });
  const enabled = (factors.data ?? []).some((f) => f.status === 'verified');
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['mfa-factors'] });

  async function start() {
    setBusy(true);
    setMessage(null);
    // Remove half-finished setups first, so a new code can be created.
    const { data: all } = await supabase.auth.mfa.listFactors();
    for (const f of all?.all ?? []) {
      if (f.factor_type === 'totp' && f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'Kwetuly' });
    setBusy(false);
    if (error || !data) return setMessage({ tone: 'error', text: t.ux.errorBody });
    setSetup({ factorId: data.id, secret: data.totp.secret, uri: data.totp.uri });
  }

  async function confirm() {
    if (!setup) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: setup.factorId, code: code.replace(/\s/g, '') });
    setBusy(false);
    if (error) return setMessage({ tone: 'error', text: t.ux.codeError });
    setSetup(null);
    setCode('');
    refresh();
  }

  async function turnOff() {
    setBusy(true);
    setMessage(null);
    for (const f of factors.data ?? []) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
      if (error) {
        setBusy(false);
        return setMessage({ tone: 'error', text: t.ux.turnOffNote });
      }
    }
    // Drop the now-unneeded second-step level from the session.
    await supabase.auth.refreshSession();
    setBusy(false);
    refresh();
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
      <Stack.Screen options={{ title: t.ux.securityTitle }} />
      {!session ? (
        <SignInPrompt />
      ) : !factors.data ? (
        <ScreenState loading={factors.isLoading} error={factors.error} onRetry={() => factors.refetch()} />
      ) : (
        <Card>
          <Text style={{ fontSize: textSize.headline, fontWeight: '800', color: colors.label }}>{t.ux.twoStepTitle}</Text>
          <Muted>{t.ux.twoStepBody}</Muted>
          <Text style={{ padding: space.md, borderRadius: radius.button, backgroundColor: enabled ? brand.mint : colors.background, color: enabled ? brand.forest : colors.label, fontWeight: '700' }}>
            {enabled ? `✓ ${t.ux.twoStepOn}` : t.ux.twoStepOff}
          </Text>
          <FormMessage message={message} />

          {enabled ? (
            <Button title={t.ux.turnOff} variant="outline" onPress={turnOff} loading={busy} />
          ) : setup ? (
            <>
              <Muted>{t.ux.phoneSetup}</Muted>
              <Button title={t.ux.openAuthApp} variant="outline" onPress={() => Linking.openURL(setup.uri).catch(() => undefined)} />
              <Text style={{ fontWeight: '700', color: colors.label }}>{t.ux.setupKey}</Text>
              <Text selectable style={{ fontFamily: 'monospace', fontSize: textSize.footnote, color: colors.label, padding: space.md, borderRadius: radius.button, backgroundColor: colors.background }}>
                {setup.secret}
              </Text>
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder={t.ux.code}
                placeholderTextColor={colors.secondaryLabel}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={7}
                accessibilityLabel={t.ux.code}
                style={{ backgroundColor: colors.background, borderRadius: radius.button, borderCurve: 'continuous', padding: space.md, fontSize: 24, letterSpacing: 8, textAlign: 'center', color: colors.label }}
              />
              <Button title={t.ux.confirmCode} onPress={confirm} loading={busy} />
              <Button title={t.ux.cancel} variant="outline" onPress={() => setSetup(null)} />
            </>
          ) : (
            <Button title={t.ux.turnOn} onPress={start} loading={busy} />
          )}
        </Card>
      )}
    </ScrollView>
  );
}
