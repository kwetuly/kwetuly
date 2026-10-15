import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { Stack, router, type Href } from 'expo-router';
import { CALL_TOPICS, HUB_MENU, formatUsd } from '@rafrika/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, Field, Muted, ScreenState, SectionTitle } from '@/components/ui';
import { getMyGuide, listHubInbox, respondToCall, type HubCall } from '@/lib/api-more';
import { listMyDeposits } from '@/lib/api-requests';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { brand, colors, space, textSize } from '@/theme';

function CallRequest({ call, onDone }: { call: HubCall; onDone: () => void }) {
  const { t, locale } = useI18n();
  const h = t.hub;
  const [accepting, setAccepting] = useState(false);
  const [when, setWhen] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);

  async function respond(accept: boolean) {
    setBusy(true);
    try {
      await respondToCall(call.id, accept, when, link);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontWeight: '800', color: colors.label }}>{CALL_TOPICS.find((x) => x.id === call.topic)?.[locale] ?? call.topic}</Text>
        <Badge label={h.status[call.status as keyof typeof h.status] ?? call.status} tone={call.status === 'requested' ? 'sand' : 'mint'} />
      </View>
      {call.preferred_times && <Muted selectable>{call.preferred_times}</Muted>}
      {call.message && <Text selectable style={{ color: colors.label }}>{call.message}</Text>}
      {call.traveler_contact && <Text selectable style={{ color: brand.forest, fontWeight: '600' }}>{call.traveler_contact}</Text>}
      {call.price_usd != null && <Muted>{formatUsd(call.price_usd)}</Muted>}
      {call.scheduled_at && <Muted>{new Date(call.scheduled_at).toLocaleString(locale)}</Muted>}
      {call.status === 'requested' &&
        (accepting ? (
          <>
            <Field label={h.scheduledAt} value={when} onChangeText={setWhen} placeholder="2027-03-14 18:00" />
            <Field label={h.meetingLink} value={link} onChangeText={setLink} placeholder="https://meet.google.com/…" autoCapitalize="none" keyboardType="url" />
            <Button title={h.accept} onPress={() => respond(true)} loading={busy} />
          </>
        ) : (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button title={h.accept} onPress={() => setAccepting(true)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={h.decline} variant="outline" onPress={() => respond(false)} loading={busy} />
            </View>
          </View>
        ))}
    </Card>
  );
}

// Guide Hub home: only verified guides (the database also hides Hub data from everyone else).
export default function HubScreen() {
  const { t, locale } = useI18n();
  const h = t.hub;
  const { session } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const mine = useQuery({ queryKey: ['my-guide', userId], queryFn: () => getMyGuide(userId!), enabled: !!userId });
  const guide = mine.data?.guide;
  const inbox = useQuery({ queryKey: ['hub-inbox', guide?.id], queryFn: () => listHubInbox(guide!.id), enabled: guide?.verification_status === 'approved' });
  const deposits = useQuery({ queryKey: ['hub-deposits', userId], queryFn: () => listMyDeposits(userId!), enabled: !!userId && guide?.verification_status === 'approved' });

  if (!guide || guide.verification_status !== 'approved') {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.md }}>
        <Stack.Title>{h.title}</Stack.Title>
        <ScreenState loading={mine.isLoading} error={mine.error} onRetry={() => mine.refetch()} />
        {!mine.isLoading && (
          <Card>
            <Muted>{guide ? t.dashboard.statusPending : h.subtitle}</Muted>
            <Button title={guide ? t.dashboard.title : t.nav.join} onPress={() => router.push('/profile-edit')} />
          </Card>
        )}
      </ScrollView>
    );
  }

  const hubLabel = (slug: string) => HUB_MENU.find((i) => i.slug === slug)?.label[locale] ?? slug;
  const links: { href: Href; label: string }[] = [
    { href: '/requests', label: h.openRequests },
    { href: '/hub/forum', label: hubLabel('forum') },
    { href: '/hub/news', label: hubLabel('news') },
    { href: '/hub/jobs', label: hubLabel('jobs') },
    { href: '/profile-edit', label: t.dashboard.title },
    { href: '/my-group-trips', label: t.groups.mine },
    { href: '/group-trip/new', label: t.groups.start },
    { href: '/chats', label: t.chats.title },
  ];

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }}
      refreshControl={<RefreshControl refreshing={inbox.isRefetching} onRefresh={() => inbox.refetch()} tintColor={brand.leaf} />}
    >
      <Stack.Title large>{h.title}</Stack.Title>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {links.map((l) => (
          <Button key={l.label} title={l.label} variant="outline" onPress={() => router.push(l.href)} />
        ))}
      </View>

      {/* Deposits as statement rows: date, trip, amount, where the money is. */}
      <SectionTitle>{h.depositsTitle}</SectionTitle>
      <Card style={{ gap: 0, paddingVertical: space.xs }}>
        {deposits.data?.length === 0 && <View style={{ paddingVertical: space.md }}><Muted>{h.noDeposits}</Muted></View>}
        {(deposits.data ?? []).map((d, i) => (
          <View key={d.id} style={{ flexDirection: 'row', gap: space.md, paddingVertical: space.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator }}>
            <Text style={{ width: 52, color: colors.secondaryLabel, fontVariant: ['tabular-nums'] }}>
              {d.paid_at ? new Date(d.paid_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : ''}
            </Text>
            <Text numberOfLines={2} style={{ flex: 1, color: colors.label, fontWeight: '600' }}>{d.description}</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: colors.label, fontWeight: '800', fontVariant: ['tabular-nums'] }}>TSh {d.amount_tzs.toLocaleString('en-US')}</Text>
              <Text style={{ color: colors.secondaryLabel, fontSize: textSize.caption }}>{d.payout_done ? h.depositPaidOut : h.depositHeld}</Text>
            </View>
          </View>
        ))}
      </Card>

      <SectionTitle>{h.calls}</SectionTitle>
      <ScreenState loading={inbox.isLoading} error={inbox.error} onRetry={() => inbox.refetch()} empty={inbox.data?.calls.length === 0} emptyText={h.noRequests} />
      {(inbox.data?.calls ?? []).map((call) => (
        <CallRequest key={call.id} call={call} onDone={() => queryClient.invalidateQueries({ queryKey: ['hub-inbox'] })} />
      ))}

      <SectionTitle>{h.requests}</SectionTitle>
      {inbox.data?.leads.length === 0 && <Muted>{h.noRequests}</Muted>}
      {(inbox.data?.leads ?? []).map((lead) => (
        <Card key={lead.id}>
          <Text style={{ fontWeight: '800', color: colors.label }}>{lead.traveler_name}</Text>
          <Text selectable style={{ color: brand.forest, fontWeight: '600' }}>{lead.traveler_contact}</Text>
          {lead.message && <Text selectable style={{ color: colors.label }}>{lead.message}</Text>}
          <Muted>{new Date(lead.created_at).toLocaleDateString()}</Muted>
        </Card>
      ))}
    </ScrollView>
  );
}
