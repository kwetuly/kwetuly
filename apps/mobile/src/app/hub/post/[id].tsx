import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Field, Muted, ScreenState, SectionTitle } from '@/components/ui';
import { createHubReply, getHubPost } from '@/lib/api-more';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { colors } from '@/theme/colors';

export default function ForumPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const { session } = useSession();
  const post = useQuery({ queryKey: ['hub-post', id], queryFn: () => getHubPost(id) });
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  if (!post.data) return <ScreenState loading={post.isLoading} error={post.error} />;
  const p = post.data;
  const date = (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

  async function send() {
    if (!reply.trim() || !session) return;
    setBusy(true);
    try {
      await createHubReply(session.user.id, id, reply);
      setReply('');
      post.refetch();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      <Stack.Title>{p.title}</Stack.Title>
      <Card>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.label }}>{p.title}</Text>
        <Muted>{[p.author_name, p.region, date(p.created_at)].filter(Boolean).join(' · ')}</Muted>
        <Text selectable style={{ color: colors.label, fontSize: 15, lineHeight: 22 }}>{p.body}</Text>
      </Card>
      <SectionTitle>
        {p.hub_replies.length} {t.hub.replies}
      </SectionTitle>
      {p.hub_replies.map((r) => (
        <Card key={r.id}>
          <Text selectable style={{ color: colors.label, lineHeight: 21 }}>{r.body}</Text>
          <Muted>{[r.author_name, date(r.created_at)].filter(Boolean).join(' · ')}</Muted>
        </Card>
      ))}
      <Card>
        <Field label={t.hub.reply} value={reply} onChangeText={setReply} multiline />
        <Button title={t.hub.reply} onPress={send} loading={busy} disabled={!reply.trim()} />
      </Card>
    </ScrollView>
  );
}
