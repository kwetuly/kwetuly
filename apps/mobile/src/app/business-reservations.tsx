import { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { Stack, router, type Href } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fillText,
  formatReservationTime,
  formatTzs,
  isReservableType,
  monthStart,
  ownerReservationActions,
  recentMonths,
  reservationInboxText,
  reservationRules,
  tanzaniaParts,
  tanzaniaStartsAt,
  tanzaniaToday,
  type ReservationAction,
  type ReservationInboxText,
} from '@kwetuly/shared';
import { GLYPHS } from '@/components/glyph';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { Badge, Button, Card, Chip, ChipRow, EmptyState, Field, FormMessage, FormScreen, IconSquare, Muted, ScreenState } from '@/components/ui';
import { useSession } from '@/lib/auth';
import { getMyBusiness } from '@/lib/businesses';
import { useI18n } from '@/lib/i18n';
import { actOnReservation, loadBusinessReservations, type ActionResult, type OwnerReservation, type StatementRow } from '@/lib/reservations';
import { useType } from '@/lib/use-type';
import { brand, colors, layout, radius, space } from '@/theme';

type Message = { tone: 'ok' | 'error'; text: string } | null;

function errorText(x: ReservationInboxText, result: ActionResult): string {
  if (result.ok) return '';
  if (result.error === 'soon') return x.soon;
  if (result.error === 'refused' && result.code && result.code in x.actionRefusals) return x.actionRefusals[result.code as keyof ReservationInboxText['actionRefusals']];
  return x.saveError;
}

// The business owner's reservations, the same as /dashboard/business/reservations on the website:
// requests to answer, guests to mark as came or did not come, and the monthly statement
// ("for information, no charge" while billing is off). From 30 days ago to 60 days ahead.
export default function BusinessReservationsScreen() {
  const { locale } = useI18n();
  const x = reservationInboxText(locale);
  const { session } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const today = tanzaniaToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const mine = useQuery({ queryKey: ['my-business', userId], queryFn: () => getMyBusiness(userId!), enabled: !!userId });
  const business = mine.data;
  const reservable = !!business && isReservableType(business.business_type);
  const list = useQuery({ queryKey: ['business-reservations', business?.id, month], queryFn: () => loadBusinessReservations(business!.id, monthStart(month, today)), enabled: reservable });
  const title = <Stack.Screen options={{ title: x.title }} />;

  if (!session) {
    return (
      <FormScreen>
        {title}
        <SignInPrompt />
      </FormScreen>
    );
  }
  if (mine.isLoading || mine.error) {
    return (
      <>
        {title}
        <ScreenState screen loading={mine.isLoading} error={mine.error} onRetry={() => mine.refetch()} retryLabel={x.retry} />
      </>
    );
  }
  if (!business || !reservable) {
    return (
      <FormScreen>
        {title}
        <EmptyState glyph={GLYPHS.store} text={x.noBusiness} action={{ label: x.backToBusiness, onPress: () => router.push('/my-business') }} />
      </FormScreen>
    );
  }
  if (!list.data) {
    return (
      <>
        {title}
        <ScreenState screen loading={list.isLoading} error={list.error} onRetry={() => list.refetch()} retryLabel={x.retry} />
      </>
    );
  }
  const reload = () => queryClient.invalidateQueries({ queryKey: ['business-reservations', business.id] });
  // "Now" is when the list was loaded (render stays pure for the React Compiler).
  const now = list.dataUpdatedAt;
  const rows = list.data.rows;
  const groups = {
    waiting: rows.filter((r) => r.status === 'requested' && new Date(r.starts_at).getTime() > now),
    toMark: rows.filter((r) => r.status === 'confirmed' && new Date(r.starts_at).getTime() <= now),
    upcoming: rows.filter((r) => (r.status === 'confirmed' || r.status === 'other_time_offered') && new Date(r.starts_at).getTime() > now),
    earlier: [] as OwnerReservation[],
  };
  const grouped = new Set([...groups.waiting, ...groups.toMark, ...groups.upcoming].map((r) => r.id));
  groups.earlier = rows.filter((r) => !grouped.has(r.id)).reverse();

  return (
    <FormScreen>
      {title}
      <Muted>{x.intro}</Muted>
      {list.data.soon && <Note text={x.soon} />}
      <View style={{ alignItems: 'flex-start' }}>
        <Button title={x.setupLink} variant="text" size="md" onPress={() => router.push('/reservations-setup' as Href)} />
      </View>
      <Muted>{x.range}</Muted>
      {rows.length === 0 && <EmptyState glyph={GLYPHS.calendar} text={x.empty} />}
      {(['waiting', 'toMark', 'upcoming', 'earlier'] as const).map((key) =>
        groups[key].length === 0 ? null : (
          <View key={key} style={{ gap: space.md }}>
            <GroupTitle text={x.groups[key]} />
            {groups[key].map((r) => (
              <Row key={r.id} x={x} locale={locale} row={r} soon={list.data!.soon} onChanged={reload} />
            ))}
          </View>
        ),
      )}
      <Statement x={x} locale={locale} month={month} months={recentMonths(today, 12)} onMonth={setMonth} rows={list.data.statement} billingOn={list.data.billingOn} />
    </FormScreen>
  );
}

function GroupTitle({ text }: { text: string }) {
  const { type } = useType();
  return <Text accessibilityRole="header" style={type.cardTitle}>{text}</Text>;
}

function Note({ text }: { text: string }) {
  const { type, font } = useType();
  return (
    <Text accessibilityRole="alert" style={{ ...type.callout, ...font.semibold, color: brand.ink, backgroundColor: brand.sand, padding: space.md, borderRadius: radius.button, overflow: 'hidden' }}>
      {text}
    </Text>
  );
}

function Row({ x, locale, row, soon, onChanged }: { x: ReservationInboxText; locale: string; row: OwnerReservation; soon: boolean; onChanged: () => void }) {
  const { type, font } = useType();
  const { t } = useI18n();
  const own = tanzaniaParts(row.starts_at);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [note, setNote] = useState('');
  const [offering, setOffering] = useState(false);
  const [offerDay, setOfferDay] = useState(own.day);
  const [offerAt, setOfferAt] = useState(own.time);
  const [came, setCame] = useState(String(row.party_size));
  const actions = ownerReservationActions(row);
  const answering = actions.includes('confirm');

  async function run(action: ReservationAction, extra: Parameters<typeof actOnReservation>[2] = {}) {
    setBusy(true);
    setMessage(null);
    const result = await actOnReservation(row.id, action, extra).catch((): ActionResult => ({ ok: false, error: 'failed' }));
    setBusy(false);
    if (result.ok) {
      setOffering(false);
      setMessage({ tone: 'ok', text: x.done[action as keyof ReservationInboxText['done']] ?? x.done.confirm });
      onChanged();
    } else setMessage({ tone: 'error', text: errorText(x, result) });
  }
  function cancel() {
    const go = () => run('cancel');
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(x.cancelConfirm)) go();
      return;
    }
    Alert.alert(x.cancel, x.cancelConfirm, [
      { text: t.ux.cancel, style: 'cancel' },
      { text: x.cancel, style: 'destructive', onPress: go },
    ]);
  }

  const good = row.status === 'confirmed' || row.status === 'completed';
  const waiting = row.status === 'requested' || row.status === 'other_time_offered';
  const off = soon || busy;

  return (
    <Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.sm }}>
        <Text style={{ ...type.body, ...font.bold, flexShrink: 1 }}>{formatReservationTime(row.starts_at, locale)}</Text>
        <View style={{ flexDirection: 'row', gap: space.xs }}>
          {row.is_sample && <Badge label={x.sample} tone="neutral" />}
          <Badge label={x.statuses[row.status]} tone={good ? 'mint' : waiting ? 'sand' : 'neutral'} />
        </View>
      </View>
      <Muted>{[row.traveller_first_name, row.service_name ?? x.table, fillText(x.people, { n: row.party_size })].join(' · ')}</Muted>
      {row.note ? <Text selectable style={type.callout}><Text style={font.bold}>{x.guestNote}: </Text>{row.note}</Text> : null}
      {row.diet_line ? <Note text={`${x.diet}: ${row.diet_line}`} /> : null}
      {row.offered_starts_at ? <Text style={{ ...type.callout, ...font.semibold }}>{fillText(x.offered, { time: formatReservationTime(row.offered_starts_at, locale) })}</Text> : null}
      {row.business_note ? <Text selectable style={{ ...type.callout, color: colors.secondaryLabel }}><Text style={font.bold}>{x.yourNote}: </Text>{row.business_note}</Text> : null}
      {row.status === 'cancelled' && <Text style={type.callout}>{row.cancelled_by === 'business' ? x.cancelledByBusiness : x.cancelledByTraveller}</Text>}
      {row.status === 'completed' && row.came_count != null && <Text style={type.callout}>{fillText(x.came, { n: row.came_count })}</Text>}
      {row.disputed && <Note text={x.disputed} />}
      {row.status === 'completed' && row.commission_tzs != null ? (
        <Text style={type.callout}>{fillText(x.commissionLine, { amount: formatTzs(row.commission_tzs) })} · {x.commissionStatuses[row.commission_status]}</Text>
      ) : row.status === 'confirmed' || row.status === 'requested' ? (
        <Muted>{x.commissionAfter}</Muted>
      ) : null}

      {answering && <Field label={x.note} value={note} onChangeText={setNote} multiline maxLength={reservationRules.noteMax} hint={x.noteHint} />}
      {offering && (
        <View style={{ gap: space.md, padding: space.md, borderRadius: radius.button, borderWidth: 1, borderColor: brand.primary }}>
          <Field label={x.offerDay} value={offerDay} onChangeText={setOfferDay} keyboardType="numbers-and-punctuation" maxLength={10} placeholder="YYYY-MM-DD" />
          <Field label={x.offerAt} value={offerAt} onChangeText={setOfferAt} keyboardType="numbers-and-punctuation" maxLength={5} placeholder="19:30" />
          <Button title={x.sendOffer} variant="outline" size="md" disabled={off} onPress={() => run('offer_time', { offeredStartsAt: tanzaniaStartsAt(offerDay.trim(), offerAt.trim()), note })} />
        </View>
      )}
      {actions.includes('mark_came') && <Field label={x.cameCount} value={came} onChangeText={setCame} keyboardType="number-pad" maxLength={3} />}

      {actions.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: layout.inlineGap }}>
          {actions.map((a) => {
            switch (a) {
              case 'confirm':
                return <Button key={a} title={x.confirm} variant="outline" size="md" disabled={off} onPress={() => run('confirm', { note })} />;
              case 'decline':
                return <Button key={a} title={x.decline} variant="outline" size="md" disabled={off} onPress={() => run('decline', { note })} />;
              case 'offer_time':
                return <Button key={a} title={offering ? x.close : x.offerTime} variant="text" size="md" onPress={() => setOffering((o) => !o)} />;
              case 'cancel':
                return <Button key={a} title={x.cancel} variant="danger" size="md" disabled={off} onPress={cancel} />;
              case 'mark_came':
                return <Button key={a} title={x.markCame} variant="outline" size="md" disabled={off} onPress={() => run('mark_came', { cameCount: Number(came) })} />;
              case 'mark_no_show':
                return <Button key={a} title={x.markNoShow} variant="danger" size="md" disabled={off} onPress={() => run('mark_no_show')} />;
              default:
                return null;
            }
          })}
        </View>
      )}
      <FormMessage message={message} />
    </Card>
  );
}

function Statement({ x, locale, month, months, onMonth, rows, billingOn }: { x: ReservationInboxText; locale: string; month: string; months: string[]; onMonth: (m: string) => void; rows: StatementRow[]; billingOn: boolean }) {
  const { type, font } = useType();
  const total = rows.reduce((sum, r) => sum + Number(r.commission_tzs), 0);
  const label = (m: string) => {
    try {
      return new Date(`${m}-01T00:00:00Z`).toLocaleDateString(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' });
    } catch {
      return m;
    }
  };
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        <IconSquare glyph={GLYPHS.document} />
        <Text accessibilityRole="header" style={{ ...type.cardTitle, flex: 1 }}>{x.statementTitle}</Text>
      </View>
      <Note text={billingOn ? x.statementBilling : x.statementInfo} />
      <Text style={type.label}>{x.statementMonth}</Text>
      <ChipRow bleed>
        {months.map((m) => (
          <Chip key={m} label={label(m)} active={m === month} onPress={() => onMonth(m)} />
        ))}
      </ChipRow>
      {rows.length === 0 ? (
        <Muted>{x.statementEmpty}</Muted>
      ) : (
        <>
          {rows.map((r) => (
            <View key={r.commission_status} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...type.callout, ...font.bold }}>{x.commissionStatuses[r.commission_status]}</Text>
                <Muted>{fillText(x.statementRow, { count: r.reservation_count, guests: r.guests_counted })}</Muted>
              </View>
              <Text style={{ ...type.callout, ...font.bold }}>{formatTzs(Number(r.commission_tzs))}</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.sm }}>
            <Text style={{ ...type.body, ...font.bold }}>{x.statementTotal}</Text>
            <Text style={{ ...type.body, ...font.bold }}>{formatTzs(total)}</Text>
          </View>
        </>
      )}
    </Card>
  );
}
