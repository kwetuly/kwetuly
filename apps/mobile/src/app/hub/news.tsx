import { FlatList, RefreshControl, Text } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { HUB_MENU } from '@kwetuly/shared';
import { GLYPHS } from '@/components/glyph';
import { Card, MetaItems, ScreenState } from '@/components/ui';
import { listHubPosts } from '@/lib/api-more';
import { useI18n } from '@/lib/i18n';
import { useType } from '@/lib/use-type';
import { brand, colors, layout, space } from '@/theme';

// Official field news (park updates, rules) posted by Kwetuly.
export default function NewsScreen() {
  const { t, locale } = useI18n();
  const { type } = useType();
  const news = useQuery({ queryKey: ['hub-posts', 'news'], queryFn: () => listHubPosts('news') });
  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      data={news.data ?? []}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: layout.screenX, gap: layout.listGap, paddingBottom: space.xxxl }}
      refreshControl={<RefreshControl refreshing={news.isRefetching} onRefresh={() => { news.refetch(); }} tintColor={brand.leaf} />}
      ListHeaderComponent={<Stack.Title>{HUB_MENU.find((i) => i.slug === 'news')?.label[locale]}</Stack.Title>}
      ListEmptyComponent={<ScreenState loading={news.isLoading} loadingCount={3} error={news.error} onRetry={() => news.refetch()} empty emptyText={t.hub.noNews} emptyGlyph={GLYPHS.news} />}
      renderItem={({ item }) => (
        <Card>
          <Text style={type.cardTitle}>{item.title}</Text>
          <MetaItems items={[item.source, item.region, new Date(item.created_at).toLocaleDateString(locale)]} />
          <Text selectable style={type.callout}>{item.body}</Text>
        </Card>
      )}
    />
  );
}
