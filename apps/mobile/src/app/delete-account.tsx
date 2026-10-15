import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { Stack, router } from 'expo-router';
import { Button, Card, Field, FormMessage, Muted } from '@/components/ui';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { signOut } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import { brand, colors, space, textSize } from '@/theme';

// Permanently deletes the signed-in account after the person types their email address.
// Uploaded files go first; the database then removes everything else (payments are kept
// for the accounts, without the person's name).
export default function DeleteAccountScreen() {
  const { t } = useI18n();
  const { session } = useSession();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function remove() {
    const own = session?.user.email?.toLowerCase();
    if (!own || email.trim().toLowerCase() !== own) return setMessage({ tone: 'error', text: t.ux.deleteMismatch });
    setBusy(true);
    setMessage(null);
    try {
      const { data: files } = await supabase.rpc('my_uploaded_files');
      const byBucket = new Map<string, string[]>();
      for (const f of (files ?? []) as { bucket_id: string; name: string }[]) byBucket.set(f.bucket_id, [...(byBucket.get(f.bucket_id) ?? []), f.name]);
      for (const [bucket, names] of byBucket) {
        for (let i = 0; i < names.length; i += 100) await supabase.storage.from(bucket).remove(names.slice(i, i + 100));
      }
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw error;
      await signOut().catch(() => undefined);
      setMessage({ tone: 'ok', text: t.ux.deleteDone });
      setTimeout(() => router.replace('/'), 1500);
    } catch {
      setMessage({ tone: 'error', text: t.ux.errorBody });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
      <Stack.Screen options={{ title: t.ux.deleteTitle }} />
      <Card>
        <Text style={{ fontSize: textSize.headline, fontWeight: '800', color: brand.danger }}>{t.ux.deleteTitle}</Text>
        <Muted>{t.ux.deleteBody}</Muted>
        <Field label={t.ux.deleteConfirm} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <FormMessage message={message} />
        <Button title={t.ux.deleteButton} variant="dark" onPress={remove} loading={busy} disabled={!session} />
      </Card>
    </ScrollView>
  );
}
