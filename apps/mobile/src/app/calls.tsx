import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CALL_TOPICS } from '@rafrika/shared';
import { GuideCard } from '@/components/cards';
import { Card, Chip, Muted, ScreenState } from '@/components/ui';
import { listCallGuides } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { brand, colors, space } from '@/theme';

// Guides who offer 1-on-1 prep calls, optionally by topic. Booking happens on the guide's profile.
export default function CallsScreen() {
  const { t, locale } = useI18n();
  const [topic, setTopic] = useState<string | undefined>();
  const guides = useQuery({ queryKey: ['call-guides', topic], queryFn: () => listCallGuides(topic) });

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      data={guides.data ?? []}
      keyExtractor={(g) => g.id}
      contentContainerStyle={{ padding: space.lg, gap: space.md }}
      refreshControl={<RefreshControl refreshing={guides.isRefetching} onRefresh={() => guides.refetch()} tintColor={brand.sunset} />}
      ListHeaderComponent={
        <View style={{ gap: space.md }}>
          <Stack.Title>{t.calls.book}</Stack.Title>
          <Card>
            <Muted>{t.calls.subtitle}</Muted>
            {t.calls.how.map((step, i) => (
              <Muted key={step}>
                {i + 1}. {step}
              </Muted>
            ))}
            <Muted>{t.calls.payNote}</Muted>
          </Card>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            <Chip label={t.calls.allTopics} active={!topic} onPress={() => setTopic(undefined)} />
            {CALL_TOPICS.map((c) => (
              <Chip key={c.id} label={c[locale]} active={topic === c.id} onPress={() => setTopic(c.id)} />
            ))}
          </ScrollView>
        </View>
      }
      ListEmptyComponent={<ScreenState loading={guides.isLoading} error={guides.error} empty emptyText={t.calls.none} />}
      renderItem={({ item }) => <GuideCard guide={item} />}
    />
  );
}
