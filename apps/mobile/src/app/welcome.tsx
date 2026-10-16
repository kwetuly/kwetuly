import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Chip, Field, FormMessage, Muted } from '@/components/ui';
import { completeOnboarding, getInviteOnly } from '@/lib/api-more';
import { useProfile } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { colors, space } from '@/theme';

const ROLES = ['traveler', 'guide', 'provider'] as const;

// One-time step after signing up with Google / Facebook / Apple: account type, name and phone.
export default function WelcomeScreen() {
  const { t } = useI18n();
  const profile = useProfile();
  const queryClient = useQueryClient();
  const [role, setRole] = useState<(typeof ROLES)[number]>('traveler');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const inviteOnly = useQuery({ queryKey: ['invite-only'], queryFn: getInviteOnly });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (profile.data?.full_name) setName(profile.data.full_name);
  }, [profile.data?.full_name]);

  async function finish() {
    setBusy(true);
    setMessage(null);
    try {
      await completeOnboarding(role, phone, name, inviteCode);
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      router.replace(role === 'guide' ? '/profile-edit' : '/');
    } catch (e) {
      const reason = e instanceof Error ? e.message : '';
      setMessage({ tone: 'error', text: reason === 'phone' ? t.auth.phoneError : reason === 'invite' ? t.auth.inviteError : t.auth.error });
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
        <Field label={t.auth.phone} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+255 712 345 678" hint={t.auth.phoneHint} />
        <FormMessage message={message} />
        <Button title={t.auth.finish} onPress={finish} loading={busy} />
      </Card>
    </ScrollView>
  );
}
