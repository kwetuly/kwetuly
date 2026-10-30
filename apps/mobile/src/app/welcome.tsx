import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Chip, Field, FormMessage, Muted } from '@/components/ui';
import { PhoneField, initialPhone } from '@/components/phone-field';
import { completeOnboarding, getInviteOnly } from '@/lib/api-more';
import { useProfile } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { safeNext } from '@/lib/onboarding';
import { colors, space } from '@/theme';

const ROLES = ['traveler', 'guide', 'provider'] as const;

// One-time step after signing up with Google / Facebook / Apple: account type, name and phone.
// Also where unfinished accounts are sent from a form; `next` is the screen they wanted.
export default function WelcomeScreen() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ next?: string; role?: string }>();
  const next = safeNext(params.next);
  const profile = useProfile();
  const queryClient = useQueryClient();
  const [role, setRole] = useState<(typeof ROLES)[number]>(ROLES.find((r) => r === params.role) ?? 'traveler');
  const [name, setName] = useState('');
  // Country from the phone's region setting (Tanzania otherwise); the number as the person types it.
  const [phone, setPhone] = useState(() => initialPhone(null));
  const [inviteCode, setInviteCode] = useState('');
  const inviteOnly = useQuery({ queryKey: ['invite-only'], queryFn: getInviteOnly });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  // Fill in the account name once the profile arrives (adjusting state while rendering, not in an effect).
  const fullName = profile.data?.full_name;
  const [seenName, setSeenName] = useState<string | null | undefined>(undefined);
  if (fullName !== seenName) {
    setSeenName(fullName);
    if (fullName) setName(fullName);
  }

  async function finish() {
    setBusy(true);
    setMessage(null);
    try {
      await completeOnboarding(role, phone.number, name, inviteCode, phone.country);
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      router.replace(next ?? (role === 'guide' ? '/profile-edit' : '/'));
    } catch (e) {
      const reason = e instanceof Error ? e.message : '';
      setMessage({ tone: 'error', text: reason === 'phone' ? t.phone.invalidGeneric : reason === 'invite' ? t.auth.inviteError : reason === 'name' ? t.auth.nameReserved : t.auth.error });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
      <Stack.Title>{t.auth.welcomeTitle}</Stack.Title>
      <Muted>{t.auth.welcomeBody}</Muted>
      <Card>
        <Text style={{ fontWeight: '600', color: colors.label }}>{t.auth.welcomeRole}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {ROLES.map((r) => (
            <Chip key={r} label={t.join[r].title} active={role === r} onPress={() => setRole(r)} />
          ))}
        </View>
        <Muted>{t.join[role].body}</Muted>
        {inviteOnly.data && <Field label={t.auth.inviteCode} value={inviteCode} onChangeText={setInviteCode} autoCapitalize="none" hint={t.auth.inviteHint} />}
        <Field label={t.auth.fullName} value={name} onChangeText={setName} />
        <PhoneField
          label={t.auth.phone}
          number={phone.number}
          country={phone.country}
          onChangeNumber={(number) => setPhone((p) => ({ ...p, number }))}
          onChangeCountry={(country) => setPhone((p) => ({ ...p, country }))}
        />
        <FormMessage message={message} />
        <Button title={t.auth.finish} onPress={finish} loading={busy} />
      </Card>
    </ScrollView>
  );
}
