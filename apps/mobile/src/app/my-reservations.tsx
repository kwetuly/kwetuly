import { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { answerByTime, findMenuItem, fillText, formatReservationTime, reserveText, travellerReservationActions, type ReserveText } from '@kwetuly/shared';
import { GLYPHS } from '@/components/glyph';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { Badge, Button, Card, EmptyState, Field, FormMessage, FormScreen, Muted, ScreenState } from '@/components/ui';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { appHref } from '@/lib/menu';
import { actOnReservation, answerVisit, loadMyReservations, reserveError, type ActionResult, type MyReservation } from '@/lib/reservations';
import { useType } from '@/lib/use-type';
import { brand, layout, radius, space } from '@/theme';

type Message = { tone: 'ok' | 'error'; text: string } | null;

// The traveller's reservations, the same as /reservations on the website: status, the business's answer,
// the other time offered, cancel, and "Did your visit happen?".
export default function MyReservationsScreen() {
  const { locale } = useI18n();
  const r = reserveText(locale);
  const { session } = useSession();
  const { sent } = useLocalSearchParams<{ sent?: string }>();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['my-reservations', session?.user.id], queryFn: loadMyReservations, enabled: !!session });
  const title = <Stack.Screen options={{ title: r.myTitle }} />;

  if (!session) {
    return (
      <FormScreen>
        {title}
        <SignInPrompt />
      </FormScreen>
    );
  }
  if (!list.data) {
    return (
      <>
        {title}
        <ScreenState screen loading={list.isLoading} error={list.error} onRetry={() => list.refetch()} retryLabel={r.retry} />
      </>
    );
  }
  const reload = () => queryClient.invalidateQueries({ queryKey: ['my-reservations'] });
  // ?sent= is a flag or the new reservation's id; the business name comes from the database (L-C).
  const sentRow = sent ? (list.data.rows.find((x) => x.id === sent) ?? null) : null;
  const sentAnswerBy = sentRow ? answerByTime(sentRow.answer_by, locale) : null;
  const sentText = sentRow ? [fillText(r.sent, { business: sentRow.business_name }), sentAnswerBy ? fillText(r.answerBy, { business: sentRow.business_name, time: sentAnswerBy }) : ''].filter(Boolean).join(' ') : r.done;
  return (
    <FormScreen>
      {title}
      {sent ? <FormMessage message={{ tone: 'ok', text: sentText }} /> : null}
      {list.data.soon && <Note text={r.soon} />}
      {list.data.rows.length === 0 ? (
        <>
          <EmptyState glyph={GLYPHS.calendar} text={r.myEmpty} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: layout.inlineGap, justifyContent: 'center' }}>
            {([
              [r.findFood, 'food'],
              [r.findSpa, 'massage'],
              [r.findSalon, 'salons'],
            ] as const).map(([label, item]) => (
              <Button key={item} title={label} variant="outline" size="md" onPress={() => { const found = findMenuItem('local', item); if (found) router.push(appHref(found.section, found.item)); }} />
            ))}
          </View>
        </>
      ) : (
        list.data.rows.map((row) => <Row key={row.id} r={r} locale={locale} row={row} onChanged={reload} />)
      )}
    </FormScreen>
  );
}

function Note({ text }: { text: string }) {
  const { type, font } = useType();
  return (
    <Text accessibilityRole="alert" style={{ ...type.callout, ...font.semibold, color: brand.ink, backgroundColor: brand.sand, padding: space.md, borderRadius: radius.button, overflow: 'hidden' }}>
      {text}
    </Text>
  );
}

function Row({ r, locale, row, onChanged }: { r: ReserveText; locale: string; row: MyReservation; onChanged: () => void }) {
  const { type, font } = useType();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const b = { business: row.business_name };
  const actions = travellerReservationActions(row);
  const [people, setPeople] = useState(String(row.party_size));
  const label = { accept_offer: r.acceptOffer, refuse_offer: r.refuseOffer, cancel: r.cancel };

  async function run(work: () => Promise<ActionResult>, ok: string) {
    setBusy(true);
    setMessage(null);
    const result = await work().catch((): ActionResult => ({ ok: false, error: 'failed' }));
    setBusy(false);
    setMessage(result.ok ? { tone: 'ok', text: ok } : { tone: 'error', text: reserveError(r, result) });
    if (result.ok) onChanged();
  }
  function cancel() {
    const go = () => run(() => actOnReservation(row.id, 'cancel'), r.done);
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(r.cancelConfirm)) go();
      return;
    }
    Alert.alert(r.cancel, r.cancelConfirm, [
      { text: t.ux.cancel, style: 'cancel' },
      { text: r.cancel, style: 'destructive', onPress: go },
    ]);
  }

  let reason: string | null = null;
  if (row.status === 'declined' && row.decline_reason === 'no_answer') reason = r.declinedNoAnswer;
  if (row.status === 'declined' && row.decline_reason === 'offer_refused') reason = r.declinedOfferRefused;
  if (row.status === 'cancelled' && row.cancelled_by === 'business') reason = fillText(r.cancelledByBusiness, b);
  const good = row.status === 'confirmed' || row.status === 'completed';
  const waiting = row.status === 'requested' || row.status === 'other_time_offered';

  return (
    <Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.sm }}>
        <Text accessibilityRole="header" style={{ ...type.cardTitle, flexShrink: 1 }}>{row.business_name}</Text>
        <Badge label={r.statuses[row.status]} tone={good ? 'mint' : waiting ? 'sand' : 'neutral'} />
      </View>
      <Muted>{[row.service_name, formatReservationTime(row.starts_at, locale), fillText(r.people, { n: row.party_size })].filter(Boolean).join(' · ')}</Muted>
      {reason && <Text style={type.callout}>{reason}</Text>}
      {row.status === 'requested' && answerByTime(row.answer_by, locale) ? <Muted>{fillText(r.answerBy, { ...b, time: answerByTime(row.answer_by, locale)! })}</Muted> : null}
      {row.status === 'other_time_offered' && row.offered_starts_at && <Note text={fillText(r.offered, { ...b, time: formatReservationTime(row.offered_starts_at, locale) })} />}
      {row.business_note ? <Text selectable style={type.callout}><Text style={font.bold}>{fillText(r.messageFrom, b)}: </Text>{row.business_note}</Text> : null}
      {row.note ? <Text selectable style={type.callout}><Text style={font.bold}>{r.noteLabel}: </Text>{row.note}</Text> : null}
      {row.diet_line ? <Text selectable style={type.callout}><Text style={font.bold}>{r.dietLabel}: </Text>{row.diet_line}</Text> : null}

      {row.can_answer_visit && (
        <View style={{ gap: space.sm }}>
          <Text style={{ ...type.body, ...font.bold }}>{r.visitQuestion}</Text>
          {row.asks_people_count && <Field label={r.visitPeople} value={people} onChangeText={setPeople} keyboardType="number-pad" maxLength={3} />}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: layout.inlineGap }}>
            <Button title={r.visitYes} variant="outline" size="md" disabled={busy} onPress={() => run(() => answerVisit(row.id, true, row.asks_people_count ? Number(people) : null), r.visitThanks)} />
            <Button title={r.visitNo} variant="outline" size="md" disabled={busy} onPress={() => run(() => answerVisit(row.id, false), r.visitThanks)} />
          </View>
        </View>
      )}
      {actions.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: layout.inlineGap }}>
          {actions.map((a) =>
            a === 'cancel' ? (
              <Button key={a} title={label[a]} variant="danger" size="md" disabled={busy} accessibilityLabel={`${label[a]}: ${row.business_name}`} onPress={cancel} />
            ) : (
              <Button key={a} title={label[a]} variant="outline" size="md" loading={busy} accessibilityLabel={`${label[a]}: ${row.business_name}`} onPress={() => run(() => actOnReservation(row.id, a), r.done)} />
            ),
          )}
        </View>
      )}
      <FormMessage message={message} />
    </Card>
  );
}
