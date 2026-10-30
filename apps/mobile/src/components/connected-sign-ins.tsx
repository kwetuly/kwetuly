import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { UserIdentity } from '@supabase/supabase-js';
import { Badge, Button, Card, FormMessage, Muted, ScreenState, SectionTitle } from '@/components/ui';
import { useProfile, useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { enabledProviders, linkProvider, PROVIDER_NAMES, SOCIAL_PROVIDERS, unlinkProvider, type ProviderResult, type SocialProvider } from '@/lib/social';
import { supabase } from '@/lib/supabase';
import { brand, colors, space, textSize } from '@/theme';

/** Sign-ins people may connect themselves (Apple comes later). */
const LINKABLE: SocialProvider[] = ['google', 'facebook'];
/** Sign-ins people may remove. Email stays: it is the account's own address. */
const REMOVABLE = ['google', 'facebook', 'apple'];
// Admin texts are English only, like the admin pages on the website.
const ADMIN_NOTE = 'Admin accounts change sign-ins only in a session that has passed two-step sign-in.';
/**
 * Connecting and removing work only once Walter has switched on manual linking in Supabase and set
 * EXPO_PUBLIC_LINKING_ON=1 (EAS). Until then the buttons stay hidden.
 */
const LINKING_ON = process.env.EXPO_PUBLIC_LINKING_ON === '1';

/** Asks once before removing a sign-in. Resolves true when the person confirms. */
function confirmRemove(message: string, removeLabel: string, cancelLabel: string): Promise<boolean> {
  if (process.env.EXPO_OS === 'web') return Promise.resolve(window.confirm(message));
  return new Promise((resolve) => {
    Alert.alert(message, undefined, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: removeLabel, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

function isSocial(value: string): value is SocialProvider {
  return (SOCIAL_PROVIDERS as readonly string[]).includes(value);
}

// "Connected sign-ins" in the Account tab: the ways into this account, connect Google or Facebook,
// and remove one while another way in remains. Same rules as the website's security page.
export function ConnectedSignIns() {
  const { t } = useI18n();
  const u = t.ux;
  const { session } = useSession();
  const userId = session?.user.id;
  const profile = useProfile();
  const identities = useQuery({
    queryKey: ['identities', userId],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUserIdentities();
      if (error) throw error;
      return data.identities;
    },
    enabled: !!userId,
  });
  // Already hides Google and Facebook on iPhone until Apple is switched on (App Store rule).
  const providers = useQuery({ queryKey: ['enabled-providers'], queryFn: enabledProviders, staleTime: 60 * 60 * 1000 });
  const admin = profile.data?.role === 'admin';
  const aal = useQuery({
    queryKey: ['aal', userId],
    queryFn: async () => (await supabase.auth.mfa.getAuthenticatorAssuranceLevel()).data?.currentLevel ?? null,
    enabled: !!userId && admin,
  });
  const locked = admin && aal.data !== 'aal2';
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const list = identities.data ?? [];
  const connected = new Set(list.map((i) => i.provider));
  const canConnect = LINKABLE.filter((p) => (providers.data ?? []).includes(p) && !connected.has(p));
  const name = (provider: string) =>
    provider === 'email' ? u.signInEmail
    : provider === 'phone' ? u.signInPhone
    : isSocial(provider) ? PROVIDER_NAMES[provider]
    : provider.charAt(0).toUpperCase() + provider.slice(1);

  // A success note only when the refreshed list really shows the change.
  async function report(result: ProviderResult, provider: string, done: string, shouldBeConnected: boolean) {
    const fresh = await identities.refetch();
    if (result.ok) {
      const isConnected = (fresh.data ?? []).some((i) => i.provider === provider);
      return setMessage(isConnected === shouldBeConnected ? { tone: 'ok', text: done.replace('{provider}', name(provider)) } : { tone: 'error', text: u.signInChangeError });
    }
    if (result.reason === 'cancelled') return setMessage(null);
    const text =
      result.reason === 'linking_off' ? u.signInLinkingOff
      : result.reason === 'taken' ? u.signInTaken.replace('{provider}', name(provider))
      : result.reason === 'only_one' ? u.signInOnlyOne
      : u.signInChangeError;
    setMessage({ tone: 'error', text });
  }

  async function connect(provider: SocialProvider) {
    setBusy(provider);
    setMessage(null);
    const result = await linkProvider(provider);
    await report(result, provider, u.signInLinked, true);
    setBusy(null);
  }

  async function remove(identity: UserIdentity) {
    const label = name(identity.provider);
    if (!(await confirmRemove(u.signInRemoveConfirm.replace('{provider}', label), u.signInRemove.replace('{provider}', label), u.cancel))) return;
    setBusy(identity.identity_id);
    setMessage(null);
    const result = await unlinkProvider(identity, list.length);
    await report(result, identity.provider, u.signInRemoved, false);
    setBusy(null);
  }

  return (
    <Card>
      <SectionTitle>{u.signInsTitle}</SectionTitle>
      <Muted>{u.signInsBody}</Muted>
      {identities.isLoading ? (
        <ScreenState loading />
      ) : identities.error ? (
        <>
          <Text accessibilityRole="alert" style={{ color: brand.danger, fontWeight: '600' }}>{u.signInLoadError}</Text>
          <Button title={u.tryAgain} variant="outline" onPress={() => identities.refetch()} />
        </>
      ) : (
        <>
          <FormMessage message={message} />
          {list.map((identity) => {
            const label = name(identity.provider);
            const email = typeof identity.identity_data?.email === 'string' ? identity.identity_data.email : null;
            return (
              <View key={identity.identity_id} style={{ gap: space.sm, paddingVertical: space.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
                  <Text style={{ flex: 1, fontWeight: '700', fontSize: textSize.body, color: colors.label }}>{label}</Text>
                  <Badge label={u.signInConnected} tone="mint" />
                </View>
                {email && <Muted selectable>{email}</Muted>}
                {REMOVABLE.includes(identity.provider) && list.length > 1 && !locked && LINKING_ON && (
                  <Button title={u.signInRemove.replace('{provider}', label)} variant="outline" loading={busy === identity.identity_id} disabled={!!busy} onPress={() => remove(identity)} />
                )}
              </View>
            );
          })}
          {list.length === 1 && <Muted>{u.signInOnlyOne}</Muted>}
          {locked ? (
            <Muted>{ADMIN_NOTE}</Muted>
          ) : !LINKING_ON ? (
            <Muted>{u.signInLinkingOff}</Muted>
          ) : providers.isLoading ? null : canConnect.length > 0 ? (
            canConnect.map((p) => (
              <Button key={p} title={u.signInConnect.replace('{provider}', PROVIDER_NAMES[p])} variant="outline" loading={busy === p} disabled={!!busy} onPress={() => connect(p)} />
            ))
          ) : (
            <Muted>{u.signInNoMore}</Muted>
          )}
        </>
      )}
    </Card>
  );
}
