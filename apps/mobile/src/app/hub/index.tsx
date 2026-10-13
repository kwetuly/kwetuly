import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { Stack, router, type Href } from 'expo-router';
import { CALL_TOPICS, HUB_MENU } from '@rafrika/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, Field, Muted, ScreenState, SectionTitle } from '@/components/ui';
import { getMyGuide, listHubInbox, respondToCall, type HubCall } from '@/lib/api-more';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { brand, colors } from '@/theme/colors';

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
      {call.price_usd != null && <Muted>${call.price_usd}</Muted>}
      {call.scheduled_at && <Muted>{new Date(call.scheduled_at).toLocaleString(locale)}</Muted>}
      {call.status === 'requested' &&
        (accepting ? (
          <>
            <Field label={h.scheduledAt} value={when} onChangeText={setWhen} placeholder="2027-03-14 18:00" />
            <Field label={h.meetingLink} value={link} onChangeText={setLink} placeholder="https://meet.google.com/…" autoCapitalize="none" keyboardType="url" />
            <Button title={h.accept} onPress={() => respond(true)} loading={busy} />
          </>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
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

  if (!guide || guide.verification_status !== 'approved') {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Stack.Title>{h.title}</Stack.Title>
        <ScreenState loading={mine.isLoading} error={mine.error} />
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
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={inbox.isRefetching} onRefresh={() => inbox.refetch()} tintColor={brand.sunset} />}
    >
      <Stack.Title large>{h.title}</Stack.Title>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {links.map((l) => (
          <Button key={l.label} title={l.label} variant="outline" onPress={() => router.push(l.href)} />
        ))}
      </View>

      <SectionTitle>{h.calls}</SectionTitle>
      <ScreenState loading={inbox.isLoading} error={inbox.error} empty={inbox.data?.calls.length === 0} emptyText={h.noRequests} />
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
