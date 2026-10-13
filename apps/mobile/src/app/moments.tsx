import { FlatList, RefreshControl, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ChatMedia } from '@/components/chat-media';
import { Card, Muted, ScreenState } from '@/components/ui';
import { listMoments } from '@/lib/api-more';
import { useI18n } from '@/lib/i18n';
import { brand, colors } from '@/theme/colors';

// Photos, videos and tips travellers agreed to share and Rafrika featured (enforced by the database).
export default function MomentsScreen() {
  const { t } = useI18n();
  const moments = useQuery({ queryKey: ['moments'], queryFn: listMoments });
  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      data={moments.data ?? []}
      keyExtractor={(m) => m.id}
      contentContainerStyle={{ padding: 16, gap: 14 }}
      refreshControl={<RefreshControl refreshing={moments.isRefetching} onRefresh={() => moments.refetch()} tintColor={brand.sunset} />}
      ListHeaderComponent={
        <View style={{ gap: 6 }}>
          <Stack.Title>{t.moments.title}</Stack.Title>
          <Muted>{t.moments.subtitle}</Muted>
        </View>
      }
      ListEmptyComponent={<ScreenState loading={moments.isLoading} error={moments.error} empty emptyText={t.moments.none} />}
      renderItem={({ item }) => (
        <Card>
          {item.media_url && item.media_type && <ChatMedia url={item.media_url} type={item.media_type} />}
          {item.body && <Text style={{ color: colors.label, fontSize: 15, lineHeight: 21 }}>{item.body}</Text>}
          <Muted>
            {t.moments.sharedBy} {item.sender_name}
          </Muted>
        </Card>
      )}
    />
  );
}
