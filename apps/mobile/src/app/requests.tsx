import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Link, Stack, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Card, Muted, ScreenState, SectionTitle } from '@/components/ui';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { useCanOffer } from '@/hooks/use-can-offer';
import { listMyOffers, listMyRequests, listOpenRequests, lowestOffers, type TripRequest } from '@/lib/api-requests';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { formatDateRange, specialtyName } from '@/lib/labels';
import { brand, colors } from '@/theme/colors';
import { formatUsd } from '@rafrika/shared';

export default function RequestsScreen() {
  const { t, locale } = useI18n();
  const r = t.requests;
  const o = t.offers;
  const { session } = useSession();
  const userId = session?.user.id;
  const { canOffer } = useCanOffer();
  const mine = useQuery({ queryKey: ['my-requests', userId], queryFn: () => listMyRequests(userId!), enabled: !!userId });
  const lowest = useQuery({ queryKey: ['my-requests-lowest', mine.data?.map((req) => req.id).join(',')], queryFn: () => lowestOffers((mine.data ?? []).map((req) => req.id)), enabled: !!mine.data?.length });
  const open = useQuery({ queryKey: ['open-requests', userId], queryFn: () => listOpenRequests(userId!), enabled: !!userId && canOffer });
  const offers = useQuery({ queryKey: ['my-offers', userId], queryFn: () => listMyOffers(userId!), enabled: !!userId && canOffer });

  if (!userId) return <SignInPrompt />;

  const row = (req: TripRequest, showName?: boolean) => (
    <Link key={req.id} href={{ pathname: '/request/[id]', params: { id: req.id } }} asChild>
      <Pressable>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ flex: 1, fontWeight: '800', fontSize: 16, color: colors.label }}>{req.title}</Text>
            <Badge label={r.status[req.status]} tone={req.status === 'open' ? 'mint' : 'sand'} />
          </View>
          <Muted>
            {specialtyName(req.specialty, locale)}
            {showName ? ` · ${req.traveler_name}` : ''}
          </Muted>
          <Muted>
            {req.start_date ? formatDateRange(req.start_date, req.end_date ?? req.start_date, locale) : r.datesFlexible} · {req.adults + req.children} {r.people}
          </Muted>
          <Text style={{ color: brand.sunsetDark, fontWeight: '700' }}>
            {r.offersTitle}: {req.offers_count}
            {!showName && lowest.data?.[req.id] != null ? ` · ${r.fromPrice.replace('{price}', formatUsd(lowest.data[req.id]))}` : ''}
          </Text>
        </Card>
      </Pressable>
    </Link>
  );

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={mine.isRefetching || open.isRefetching}
          onRefresh={() => {
            mine.refetch();
            open.refetch();
            offers.refetch();
          }}
          tintColor={brand.sunset}
        />
      }
    >
      <Stack.Title>{r.title}</Stack.Title>
      <Muted>{r.subtitle}</Muted>
      <Button title={r.post} onPress={() => router.push('/request/new')} />

      <SectionTitle>{r.mine}</SectionTitle>
      <ScreenState loading={mine.isLoading} error={mine.error} />
      {mine.data?.length === 0 && <Muted>{r.none}</Muted>}
      {mine.data?.map((req) => row(req))}

      {canOffer && (
        <>
          <SectionTitle>{o.boardTitle}</SectionTitle>
          <Muted>{o.boardBody}</Muted>
          <ScreenState loading={open.isLoading} error={open.error} />
          {open.data?.length === 0 && <Muted>{o.noneOpen}</Muted>}
          {open.data?.map((req) => row(req, true))}

          <SectionTitle>{o.myOffers}</SectionTitle>
          {offers.data?.length === 0 && <Muted>{o.noOffers}</Muted>}
          {offers.data?.map((offer) => (
            <Link key={offer.id} href={{ pathname: '/request/[id]', params: { id: offer.request_id } }} asChild>
              <Pressable>
                <Card>
                  <Text style={{ fontWeight: '700', color: colors.label }}>{offer.trip_requests?.title}</Text>
                  <Muted>
                    {formatUsd(offer.price_total_usd)} · {r.offerStatus[offer.status]}
                  </Muted>
                </Card>
              </Pressable>
            </Link>
          ))}
        </>
      )}
    </ScrollView>
  );
}
