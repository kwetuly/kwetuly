import { FlatList, RefreshControl, Text } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { HUB_MENU } from '@rafrika/shared';
import { Card, Muted, ScreenState } from '@/components/ui';
import { listHubPosts } from '@/lib/api-more';
import { useI18n } from '@/lib/i18n';
import { brand, colors, space, textSize } from '@/theme';

// Official field news (park updates, rules) posted by Rafrika.
export default function NewsScreen() {
  const { t, locale } = useI18n();
  const news = useQuery({ queryKey: ['hub-posts', 'news'], queryFn: () => listHubPosts('news') });
  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      data={news.data ?? []}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: space.lg, gap: space.md }}
      refreshControl={<RefreshControl refreshing={news.isRefetching} onRefresh={() => news.refetch()} tintColor={brand.sunset} />}
      ListHeaderComponent={<Stack.Title>{HUB_MENU.find((i) => i.slug === 'news')?.label[locale]}</Stack.Title>}
      ListEmptyComponent={<ScreenState loading={news.isLoading} error={news.error} empty emptyText={t.hub.noNews} />}
      renderItem={({ item }) => (
        <Card>
          <Text style={{ fontWeight: '800', fontSize: textSize.body, color: colors.label }}>{item.title}</Text>
          <Muted>{[item.source, item.region, new Date(item.created_at).toLocaleDateString(locale)].filter(Boolean).join(' · ')}</Muted>
          <Text selectable style={{ color: colors.label, lineHeight: 21 }}>{item.body}</Text>
        </Card>
      )}
    />
  );
}
