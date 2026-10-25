import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { PACKAGE_KINDS } from '@kwetuly/shared';
import { PackageCard } from '@/components/guide-packages';
import { Chip, Muted, ScreenState } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { listPackages } from '@/lib/packages';
import { colors, space } from '@/theme';

// Every approved package from verified guides, the same as /packages on the website.
export default function PackagesScreen() {
  const { t, locale } = useI18n();
  const pt = t.packages;
  const params = useLocalSearchParams<{ kind?: string }>();
  const [kind, setKind] = useState<string | undefined>(PACKAGE_KINDS.some((k) => k.id === params.kind) ? params.kind : undefined);
  const packages = useQuery({ queryKey: ['packages', kind], queryFn: () => listPackages(kind) });

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.huge }}>
      <Stack.Title>{pt.catalogTitle}</Stack.Title>
      <Muted>{pt.catalogBody}</Muted>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        <Chip label={pt.all} active={!kind} onPress={() => setKind(undefined)} />
        {PACKAGE_KINDS.map((k) => (
          <Chip key={k.id} label={k[locale]} active={kind === k.id} onPress={() => setKind(k.id)} />
        ))}
      </ScrollView>
      <ScreenState loading={packages.isLoading} error={packages.error} onRetry={() => packages.refetch()} empty={packages.data?.length === 0} emptyText={pt.catalogEmpty} />
      <View style={{ gap: space.md }}>
        {(packages.data ?? []).map((p) =>
          p.guides ? <PackageCard key={p.id} p={p} guideId={p.guides.id} guideName={p.guides.display_name} guideSlug={p.guides.slug} showGuide /> : null,
        )}
      </View>
    </ScrollView>
  );
}
