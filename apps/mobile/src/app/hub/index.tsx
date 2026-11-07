import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { Stack, router, type Href } from 'expo-router';
import { CALL_TOPICS, HUB_MENU, formatUsd } from '@kwetuly/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GLYPHS, type GlyphName } from '@/components/glyph';
import { Badge, Button, Card, EmptyState, Field, ListGroup, ListRow, MetaItems, Muted, ScreenState, Section } from '@/components/ui';
import { getMyGuide, listHubInbox, respondToCall, type HubCall } from '@/lib/api-more';
import { listMyDeposits } from '@/lib/api-requests';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useType } from '@/lib/use-type';
import { brand, colors, layout, space } from '@/theme';

function CallRequest({ call, onDone }: { call: HubCall; onDone: () => void }) {
  const { t, locale } = useI18n();
  const { type, font } = useType();
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
        <Text style={{ ...type.cardTitle, flexShrink: 1 }}>{CALL_TOPICS.find((x) => x.id === call.topic)?.[locale] ?? call.topic}</Text>
        <Badge label={h.status[call.status as keyof typeof h.status] ?? call.status} tone={call.status === 'requested' ? 'sand' : 'mint'} />
      </View>
      {call.preferred_times && <Muted selectable>{call.preferred_times}</Muted>}
      {call.message && <Text selectable style={type.callout}>{call.message}</Text>}
      {call.traveler_contact && <Text selectable style={{ ...type.callout, ...font.semibold, color: brand.forest }}>{call.traveler_contact}</Text>}
      <MetaItems items={[call.price_usd != null ? formatUsd(call.price_usd) : null, call.scheduled_at ? new Date(call.scheduled_at).toLocaleString(locale) : null]} />
      {call.status === 'requested' &&
        (accepting ? (
          <>
            <Field label={h.scheduledAt} value={when} onChangeText={setWhen} placeholder="2027-03-14 18:00" />
            <Field label={h.meetingLink} value={link} onChangeText={setLink} placeholder="https://meet.google.com/…" autoCapitalize="none" keyboardType="url" />
            <Button title={h.accept} onPress={() => respond(true)} loading={busy} />
          </>
        ) : (
          // Accept opens the time and link fields; the filled button is the confirm step inside them.
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Button title={h.accept} variant="outline" size="md" style={{ flexGrow: 1 }} onPress={() => setAccepting(true)} />
            <Button title={h.decline} variant="text" size="md" style={{ flexGrow: 1 }} onPress={() => respond(false)} loading={busy} />
          </View>
        ))}
    </Card>
  );
}

// Guide Hub home: only verified guides (the database also hides Hub data from everyone else).
export default function HubScreen() {
  const { t, locale } = useI18n();
  const { type, font } = useType();
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
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: layout.screenX, gap: space.md }}>
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
  const links: { href: Href; label: string; icon: GlyphName }[] = [
    { href: '/requests', label: h.openRequests, icon: GLYPHS.list },
    { href: '/hub/forum', label: hubLabel('forum'), icon: GLYPHS.forum },
    { href: '/hub/news', label: hubLabel('news'), icon: GLYPHS.news },
    { href: '/hub/jobs', label: hubLabel('jobs'), icon: GLYPHS.briefcase },
    { href: '/profile-edit', label: t.dashboard.title, icon: GLYPHS.profile },
    { href: '/my-group-trips', label: t.groups.mine, icon: GLYPHS.calendar },
    { href: '/group-trip/new', label: t.groups.start, icon: GLYPHS.calendarAdd },
    { href: '/chats', label: t.chats.title, icon: GLYPHS.chat },
  ];

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: layout.screenX, gap: layout.sectionGap, paddingBottom: space.xxxl }}
      refreshControl={<RefreshControl refreshing={inbox.isRefetching} onRefresh={() => { inbox.refetch(); }} tintColor={brand.leaf} />}
    >
      <Stack.Title large>{h.title}</Stack.Title>
      <ListGroup>
        {links.map((l) => (
          <ListRow key={l.label} icon={l.icon} title={l.label} onPress={() => router.push(l.href)} />
        ))}
      </ListGroup>

      {/* Deposits as statement rows: date, trip, amount, where the money is. */}
      <Section title={h.depositsTitle}>
        {deposits.isLoading || deposits.error ? (
          <ScreenState loading={deposits.isLoading} error={deposits.error} onRetry={() => deposits.refetch()} />
        ) : deposits.data?.length === 0 ? (
          <EmptyState text={h.noDeposits} />
        ) : (
          <Card style={{ gap: 0, paddingVertical: space.xs }}>
            {(deposits.data ?? []).map((d, i) => (
              <View key={d.id} style={{ flexDirection: 'row', gap: space.md, paddingVertical: space.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                <Text style={{ ...type.meta, minWidth: space.huge, fontVariant: ['tabular-nums'] }}>
                  {new Date(d.paid_at ?? d.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                </Text>
                <Text numberOfLines={2} style={{ ...type.callout, ...font.semibold, flex: 1 }}>
                  {d.description}
                </Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ ...type.callout, ...font.bold, fontVariant: ['tabular-nums'] }}>TSh {d.amount_tzs.toLocaleString('en-US')}</Text>
                  <Text style={type.caption}>{d.status === 'review' ? h.depositChecking : d.payout_done ? h.depositPaidOut : h.depositHeld}</Text>
                </View>
              </View>
            ))}
          </Card>
        )}
      </Section>

      <Section title={h.calls}>
        <ScreenState loading={inbox.isLoading} error={inbox.error} onRetry={() => inbox.refetch()} empty={inbox.data?.calls.length === 0} emptyText={h.noRequests} emptyGlyph={GLYPHS.video} />
        {(inbox.data?.calls ?? []).map((call) => (
          <CallRequest key={call.id} call={call} onDone={() => queryClient.invalidateQueries({ queryKey: ['hub-inbox'] })} />
        ))}
      </Section>

      <Section title={h.requests}>
        {inbox.data?.leads.length === 0 && <EmptyState glyph={GLYPHS.chat} text={h.noRequests} />}
        {(inbox.data?.leads ?? []).map((lead) => (
          <Card key={lead.id}>
            <Text style={type.cardTitle}>{lead.traveler_name}</Text>
            <Text selectable style={{ ...type.callout, ...font.semibold, color: brand.forest }}>{lead.traveler_contact}</Text>
            {lead.guide_packages && <Text style={{ ...type.callout, ...font.bold, color: brand.forest }}>{t.packages.about.replace('{title}', lead.guide_packages.title)}</Text>}
            {lead.message && <Text selectable style={type.callout}>{lead.message}</Text>}
            <Text style={type.meta}>{new Date(lead.created_at).toLocaleDateString()}</Text>
          </Card>
        ))}
      </Section>
    </ScrollView>
  );
}
