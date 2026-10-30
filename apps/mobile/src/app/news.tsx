import { ScrollView, Text } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Muted, ScreenState } from '@/components/ui';
import { listTravelNews } from '@/lib/businesses';
import { useI18n } from '@/lib/i18n';
import { openExternal } from '@/lib/open-external';
import { safeExternalUrl } from '@kwetuly/shared';
import { brand, colors, space, textSize } from '@/theme';

// News for travellers, like /news on the website. Guides read Field news in the Hub.
export default function NewsScreen() {
  const { t, locale } = useI18n();
  const x = t.extras;
  const news = useQuery({ queryKey: ['travel-news'], queryFn: listTravelNews });
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  if (!news.data) return <ScreenState loading={news.isLoading} error={news.error} onRetry={() => news.refetch()} />;
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.huge }}>
      <Stack.Title>{x.newsTitle}</Stack.Title>
      <Muted>{x.newsSubtitle}</Muted>
      {news.data.length === 0 && <Muted>{x.newsNone}</Muted>}
      {news.data.map((n) => (
        <Card key={n.id}>
          <Text style={{ color: brand.leafDark, fontWeight: '700' }}>
            {date.format(new Date(n.published_on))}
            {n.region ? ` · ${n.region}` : ''}
          </Text>
          <Text selectable style={{ color: colors.label, fontWeight: '800', fontSize: textSize.headline }}>{n.title}</Text>
          <Text selectable style={{ color: colors.label, lineHeight: 21 }}>{n.body}</Text>
          {safeExternalUrl(n.source_url) && (
            <Button title={`${x.newsSource}: ${n.source_name ?? new URL(safeExternalUrl(n.source_url)!).hostname}`} variant="outline" onPress={() => openExternal(n.source_url, { inApp: true })} />
          )}
        </Card>
      ))}
    </ScrollView>
  );
}
