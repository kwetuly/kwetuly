import { FlatList, Pressable, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Avatar, Card, Muted, ScreenState } from '@/components/ui';
import { listOperators } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { brand, colors, space, textSize } from '@/theme';

// Tour operators whose tours Rafrika lists.
export default function OperatorsScreen() {
  const { t } = useI18n();
  const tt = t.tours;
  const operators = useQuery({ queryKey: ['operators'], queryFn: listOperators });
  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: space.lg, gap: space.md }}
      data={operators.data ?? []}
      keyExtractor={(op) => op.id}
      ListHeaderComponent={
        <View style={{ gap: space.sm }}>
          <Stack.Title>{tt.operatorsTitle}</Stack.Title>
          <Muted>{tt.operatorsSubtitle}</Muted>
        </View>
      }
      renderItem={({ item: op }) => (
        <Link href={{ pathname: '/operator/[slug]', params: { slug: op.slug } }} asChild>
          <Pressable accessibilityRole="link">
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Avatar name={op.name} uri={op.logo_url} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.label, fontWeight: '800', fontSize: textSize.headline }}>
                  {op.name}
                  {op.verified_at ? <Text style={{ color: brand.leafDark }}>  ✓ {tt.verified}</Text> : null}
                </Text>
                {op.location && <Muted>{op.location}</Muted>}
              </View>
            </Card>
          </Pressable>
        </Link>
      )}
      ListEmptyComponent={<ScreenState loading={operators.isLoading} error={operators.error} onRetry={() => operators.refetch()} empty emptyText={tt.noOperators} />}
    />
  );
}
