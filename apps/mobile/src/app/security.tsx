import { useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { GLYPHS } from '@/components/glyph';
import { Button, Card, Field, FormMessage, FormScreen, IconSquare, Muted, ScreenState } from '@/components/ui';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { useType } from '@/lib/use-type';
import { brand, colors, radius, space, textSize } from '@/theme';

type Setup = { factorId: string; secret: string; uri: string };

// Two-step sign-in (authenticator app codes, Supabase TOTP), the same as /security on the website.
export default function SecurityScreen() {
  const { t } = useI18n();
  const { type, font } = useType();
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

  // Cancel starts over: no half-typed code and no error left from the last try.
  function cancelSetup() {
    // Remove the half-finished factor too; if this fails, start() clears it next time.
    if (setup) supabase.auth.mfa.unenroll({ factorId: setup.factorId }).catch(() => {});
    setSetup(null);
    setCode('');
    setMessage(null);
  }

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
    <FormScreen>
      <Stack.Screen options={{ title: t.ux.securityTitle }} />
      {!session ? (
        <SignInPrompt />
      ) : !factors.data ? (
        <ScreenState loading={factors.isLoading} error={factors.error} onRetry={() => factors.refetch()} />
      ) : (
        <Card>
          <Text accessibilityRole="header" style={type.cardTitle}>{t.ux.twoStepTitle}</Text>
          <Muted>{t.ux.twoStepBody}</Muted>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.button, borderCurve: 'continuous', backgroundColor: enabled ? brand.mint : colors.background }}>
            {enabled && <IconSquare glyph={GLYPHS.lock} />}
            <Text style={{ ...type.body, ...font.bold, flex: 1, color: enabled ? brand.forest : colors.label }}>{enabled ? t.ux.twoStepOn : t.ux.twoStepOff}</Text>
          </View>
          <FormMessage message={message} />

          {enabled ? (
            <Button title={t.ux.turnOff} variant="outline" size="md" onPress={turnOff} loading={busy} />
          ) : setup ? (
            <>
              <Muted>{t.ux.phoneSetup}</Muted>
              <Button title={t.ux.openAuthApp} variant="outline" size="md" onPress={() => Linking.openURL(setup.uri).catch(() => undefined)} />
              <Text style={type.label}>{t.ux.setupKey}</Text>
              <Text
                selectable
                style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: textSize.footnote, color: colors.label, padding: space.md, borderRadius: radius.button, borderCurve: 'continuous', backgroundColor: colors.background, overflow: 'hidden' }}
              >
                {setup.secret}
              </Text>
              <Field label={t.ux.code} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={7} code />
              <Button title={t.ux.confirmCode} onPress={confirm} loading={busy} />
              <Button title={t.ux.cancel} variant="text" size="md" onPress={cancelSetup} />
            </>
          ) : (
            <Button title={t.ux.turnOn} onPress={start} loading={busy} />
          )}
        </Card>
      )}
    </FormScreen>
  );
}
