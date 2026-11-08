import { useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { Link, Stack, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { HUB_MENU, REGIONS } from '@kwetuly/shared';
import { GLYPHS } from '@/components/glyph';
import { Button, Card, ChipSelect, Field, FormMessage, MetaItems, ScreenState } from '@/components/ui';
import { createHubPost, listHubPosts } from '@/lib/api-more';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useType } from '@/lib/use-type';
import { brand, colors, layout, space } from '@/theme';

export default function ForumScreen() {
  const { t, locale } = useI18n();
  const h = t.hub;
  const { type } = useType();
  const { session } = useSession();
  const posts = useQuery({ queryKey: ['hub-posts', 'forum'], queryFn: () => listHubPosts('forum') });
  const [writing, setWriting] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [region, setRegion] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function post() {
    if (!title.trim() || !body.trim() || !session) return setMessage({ tone: 'error', text: t.auth.error });
    setBusy(true);
    try {
      const id = await createHubPost(session.user.id, title, body, region[0] ?? null);
      router.push({ pathname: '/hub/post/[id]', params: { id } });
      setWriting(false);
      setTitle('');
      setBody('');
      posts.refetch();
    } catch {
      setMessage({ tone: 'error', text: t.auth.error });
    } finally {
      setBusy(false);
    }
  }

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      data={posts.data ?? []}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: layout.screenX, gap: layout.listGap, paddingBottom: space.xxxl }}
      refreshControl={<RefreshControl refreshing={posts.isRefetching} onRefresh={() => { posts.refetch(); }} tintColor={brand.leaf} />}
      ListHeaderComponent={
        <View style={{ gap: space.md, paddingBottom: space.xs }}>
          <Stack.Title>{HUB_MENU.find((i) => i.slug === 'forum')?.label[locale]}</Stack.Title>
          {writing ? (
            <Card>
              <Text style={{ ...type.caption, color: brand.danger }}>{h.sightingWarning}</Text>
              <Field label={h.postTitle} value={title} onChangeText={setTitle} />
              <Field label={h.postBody} value={body} onChangeText={setBody} multiline />
              <ChipSelect label={h.region} options={REGIONS.map((r) => ({ value: r, label: r }))} selected={region} onChange={setRegion} multiple={false} />
              <FormMessage message={message} />
              <Button title={h.post} onPress={post} loading={busy} />
            </Card>
          ) : (
            <Button title={h.newPost} onPress={() => setWriting(true)} />
          )}
        </View>
      }
      ListEmptyComponent={<ScreenState loading={posts.isLoading} loadingCount={3} error={posts.error} onRetry={() => posts.refetch()} empty emptyText={h.noPosts} emptyGlyph={GLYPHS.forum} />}
      renderItem={({ item }) => (
        <Link href={{ pathname: '/hub/post/[id]', params: { id: item.id } }} asChild>
          <Card accessibilityRole="link">
            <Text style={type.cardTitle}>{item.title}</Text>
            <Text numberOfLines={2} style={type.muted}>
              {item.body}
            </Text>
            <MetaItems items={[item.author_name, item.region, `${item.hub_replies?.[0]?.count ?? 0} ${h.replies}`]} />
          </Card>
        </Link>
      )}
    />
  );
}
