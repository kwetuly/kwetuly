import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { catalogueText, sampleMediaPaths, type PhotoCredit } from '@kwetuly/shared';
import { Badge, Button, Card, Muted, SectionTitle } from '@/components/ui';
import { getPhotoCredits, getSampleListings } from '@/lib/businesses';
import { useI18n } from '@/lib/i18n';
import { openExternal } from '@/lib/open-external';
import { brand, colors, radius, space, textSize } from '@/theme';

// Read-only "What they offer" list on a SAMPLE business (security finding F1: real owners' items
// are not shown until the catalogue review rules exist; the query filters on is_sample too).
export function SampleOffer({ providerId }: { providerId: string }) {
  const { t, locale } = useI18n();
  const c = catalogueText(locale);
  const items = useQuery({ queryKey: ['sample-listings', providerId], queryFn: () => getSampleListings(providerId) });

  if (items.isLoading) return <ActivityIndicator style={{ padding: space.lg }} color={brand.leaf} />;
  if (items.error) {
    return (
      <Card>
        <SectionTitle>{c.whatTheyOffer}</SectionTitle>
        <Text accessibilityRole="alert" style={{ color: brand.danger }}>{c.loadError}</Text>
        <Button title={t.ux.tryAgain} variant="outline" onPress={() => items.refetch()} />
      </Card>
    );
  }
  // Empty: nothing to show, so the section is left out.
  if (!items.data?.length) return null;
  return (
    <View style={{ gap: space.md }}>
      <View style={{ gap: space.xs }}>
        <SectionTitle>{c.whatTheyOffer}</SectionTitle>
        <Badge label={t.extras.sampleBadge} tone="sand" />
        <Muted>{c.sampleItemsNote}</Muted>
      </View>
      {items.data.map((item) => (
        <Card key={item.id} style={{ flexDirection: 'row', gap: space.md }}>
          {item.photos[0] && (
            <Image source={{ uri: item.photos[0] }} accessibilityLabel={item.title} style={{ width: 80, height: 80, borderRadius: radius.button }} contentFit="cover" />
          )}
          <View style={{ flex: 1, gap: space.xs }}>
            <Text style={{ color: colors.label, fontWeight: '700', fontSize: textSize.body }}>{item.title}</Text>
            {item.description && <Text style={{ color: colors.label, fontSize: textSize.subhead }}>{item.description}</Text>}
            {item.price_note && <Muted>{item.price_note}</Muted>}
          </View>
        </Card>
      ))}
      <PhotoCredits urls={items.data.flatMap((i) => i.photos)} />
    </View>
  );
}

// "Photo credits": a tap opens the credit line and source of each stock photo on a sample page.
// Shows nothing for photos outside the sample-media bucket or while the credits table is missing.
export function PhotoCredits({ urls }: { urls: (string | null | undefined)[] }) {
  const { locale } = useI18n();
  const c = catalogueText(locale);
  const paths = sampleMediaPaths(urls);
  const [open, setOpen] = useState(false);
  const credits = useQuery({ queryKey: ['photo-credits', paths], queryFn: () => getPhotoCredits(paths), enabled: paths.length > 0, staleTime: 60 * 60 * 1000 });
  const ordered = paths.map((p) => credits.data?.find((x) => x.path === p)).filter((x): x is PhotoCredit => !!x);
  if (ordered.length === 0) return null;
  return (
    <View style={{ gap: space.xs }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        hitSlop={8}
        style={{ alignSelf: 'flex-start', paddingVertical: space.xs }}
      >
        <Text style={{ color: brand.forest, fontWeight: '700', fontSize: textSize.footnote }}>
          {c.photoCredits} ({ordered.length})
        </Text>
      </Pressable>
      {open && (
        <View style={{ gap: space.xs }}>
          <Muted>{c.photoCreditsNote}</Muted>
          {ordered.map((x) => (
            <Text key={x.path} style={{ color: colors.secondaryLabel, fontSize: textSize.caption }}>
              {x.credit}.{' '}
              <Text accessibilityRole="link" onPress={() => openExternal(x.source_url, { inApp: true })} style={{ color: brand.forest, textDecorationLine: 'underline' }}>
                {c.source}
              </Text>
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
