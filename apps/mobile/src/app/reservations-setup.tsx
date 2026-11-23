import { useState, type ReactNode } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { Stack, router, type Href } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  closedDateRange,
  fillText,
  formatTzs,
  hoursByWeekday,
  isReservableType,
  reservationLimits,
  reservationText,
  weekdaysMondayFirst,
  type OpeningPeriod,
  type ReservationBlocker,
  type ReservationRate,
  type ReservationText,
} from '@kwetuly/shared';
import { GLYPHS, type GlyphName } from '@/components/glyph';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { Badge, Button, Card, EmptyState, ErrorText, Field, FormMessage, FormScreen, IconSquare, Muted, ScreenState, Toggle } from '@/components/ui';
import { useSession } from '@/lib/auth';
import { getMyBusiness } from '@/lib/businesses';
import { useI18n } from '@/lib/i18n';
import {
  acceptTerms,
  addClosedDate,
  loadReservationSetup,
  orderServices,
  removeClosedDate,
  removeService,
  saveHours,
  saveRules,
  saveService,
  setReservationsOn,
  setServiceActive,
  updateClosedNote,
  type SetupData,
  type SetupResult,
  type SetupService,
} from '@/lib/reservations';
import { useType } from '@/lib/use-type';
import { brand, colors, layout, radius, space } from '@/theme';

type Message = { tone: 'ok' | 'error'; text: string } | null;
type Ctx = { r: ReservationText; locale: string; providerId: string; businessName: string; care: boolean; data: SetupData; reload: () => void };

function formatDay(iso: string | null | undefined, locale: string) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: iso.length === 10 ? 'UTC' : 'Africa/Dar_es_Salaam' });
}

const errorText = (r: ReservationText, result: SetupResult) => (result.ok ? '' : result.error === 'soon' ? r.soon : r.saveError);

/** Asks before a removal; the web build of the app has no native alert buttons. */
function confirmThen(title: string, body: string, cancel: string, run: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(body)) run();
    return;
  }
  Alert.alert(title, body, [
    { text: cancel, style: 'cancel' },
    { text: title, style: 'destructive', onPress: run },
  ]);
}

// Reservations setup for restaurant, spa and salon owners, the same as the website's
// /dashboard/business/reservations-setup: the switch and what still stops it, Kwetuly's commission,
// the terms, opening hours, closed dates, services and the reservation rules. While the database part
// is not switched on, every card is still shown, with "opens soon" and the save buttons off.
export default function ReservationsSetupScreen() {
  const { locale } = useI18n();
  const r = reservationText(locale);
  const { session } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const mine = useQuery({ queryKey: ['my-business', userId], queryFn: () => getMyBusiness(userId!), enabled: !!userId });
  const business = mine.data;
  const reservable = !!business && isReservableType(business.business_type);
  const setup = useQuery({
    queryKey: ['reservation-setup', business?.id],
    queryFn: () => loadReservationSetup(business!.id, business!.business_type),
    enabled: reservable,
  });

  const title = <Stack.Screen options={{ title: r.title }} />;
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
        <ScreenState screen loading={mine.isLoading} error={mine.error} onRetry={() => mine.refetch()} retryLabel={r.retry} />
      </>
    );
  }
  if (!business || !reservable) {
    return (
      <FormScreen>
        {title}
        <EmptyState glyph={GLYPHS.store} text={business ? r.notReservable : r.noBusiness} action={{ label: r.backToBusiness, onPress: () => router.push('/my-business') }} />
      </FormScreen>
    );
  }
  if (!setup.data) {
    return (
      <>
        {title}
        <ScreenState screen loading={setup.isLoading} error={setup.error} onRetry={() => setup.refetch()} retryLabel={r.retry} />
      </>
    );
  }
  const ctx: Ctx = {
    r,
    locale,
    providerId: business.id,
    businessName: business.business_name,
    care: business.business_type !== 'restaurant',
    data: setup.data,
    reload: () => queryClient.invalidateQueries({ queryKey: ['reservation-setup', business.id] }),
  };
  return (
    <FormScreen>
      {title}
      <Muted>{r.intro}</Muted>
      {setup.data.soon && <SoonNote text={r.soon} />}
      <StatusCard ctx={ctx} />
      <RateCard ctx={ctx} />
      <TermsCard ctx={ctx} />
      <HoursCard ctx={ctx} />
      <ClosedCard ctx={ctx} />
      <ServicesCard ctx={ctx} />
      <RulesCard ctx={ctx} />
    </FormScreen>
  );
}

function SoonNote({ text }: { text: string }) {
  const { type, font } = useType();
  return (
    <Text accessibilityRole="alert" style={{ ...type.callout, ...font.semibold, color: brand.ink, backgroundColor: brand.sand, padding: space.md, borderRadius: radius.button, overflow: 'hidden' }}>
      {text}
    </Text>
  );
}

function CardHeader({ glyph, title }: { glyph: GlyphName; title: string }) {
  const { type } = useType();
  return (
    <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
      <IconSquare glyph={glyph} />
      <Text accessibilityRole="header" style={{ ...type.cardTitle, flex: 1 }}>{title}</Text>
    </View>
  );
}

/** Where the owner fixes each blocker. Cards on this screen have no anchors, so those say what to do. */
function fixRoute(code: ReservationBlocker): Href | null {
  if (code === 'not_approved' || code === 'type_not_approved' || code === 'type_not_reservable') return '/my-business';
  if (code === 'licence_check_missing') return '/verification' as Href;
  return null;
}

function StatusCard({ ctx }: { ctx: Ctx }) {
  const { r, data } = ctx;
  const { type, font } = useType();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [refused, setRefused] = useState<ReservationBlocker[] | null>(null);
  const { takesReservations, openNow } = data.status;
  const blockers = refused ?? data.status.blockers;
  const line = data.soon ? r.statusOff : takesReservations ? (openNow ? r.statusOn : r.statusOnBlocked) : blockers.length === 0 ? r.statusReady : r.statusOff;
  const on = takesReservations && openNow;

  async function toggle(next: boolean) {
    setBusy(true);
    setMessage(null);
    const result = await setReservationsOn(ctx.providerId, next).catch((): SetupResult => ({ ok: false, error: 'failed' }));
    setBusy(false);
    if (result.ok) {
      setRefused(null);
      setMessage({ tone: 'ok', text: next ? r.switchedOn : r.switchedOff });
      ctx.reload();
    } else if (result.blockers) {
      setRefused(result.blockers);
      setMessage({ tone: 'error', text: r.switchRefused });
    } else setMessage({ tone: 'error', text: errorText(r, result) });
  }

  return (
    <Card style={on ? { backgroundColor: brand.mint } : undefined}>
      <CardHeader glyph={GLYPHS.power} title={fillText(r.statusTitle, { business: ctx.businessName })} />
      <Text style={{ ...type.body, color: on ? brand.forest : colors.label }}>{line}</Text>
      {!data.soon && blockers.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Text style={{ ...type.body, ...font.bold }}>{r.blockersTitle}</Text>
          {blockers.map((code) => {
            const route = fixRoute(code);
            return (
              <View key={code} style={{ gap: space.xxs, padding: space.md, borderRadius: radius.button, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
                <Text style={type.callout}>{r.blockers[code]}</Text>
                {route && r.fixes[code] ? (
                  <View style={{ alignItems: 'flex-start' }}>
                    <Button title={r.fixes[code]} variant="text" size="md" onPress={() => router.push(route)} />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
      {takesReservations ? (
        <Button title={r.switchOff} variant="outline" onPress={() => toggle(false)} loading={busy} disabled={data.soon} />
      ) : (
        // The screen's one filled button.
        <Button title={r.switchOn} onPress={() => toggle(true)} loading={busy} disabled={data.soon} accessibilityLabel={data.soon ? `${r.switchOn}. ${r.soon}` : undefined} />
      )}
      <FormMessage message={message} />
    </Card>
  );
}

function rateLine(r: ReservationText, rate: ReservationRate): string | null {
  if (rate.kind === 'per_guest' && rate.amount_tzs != null) {
    return rate.max_guests_counted != null
      ? fillText(r.rate.per_guest, { amount: formatTzs(rate.amount_tzs), max: rate.max_guests_counted })
      : fillText(r.rate.per_guest_no_cap, { amount: formatTzs(rate.amount_tzs) });
  }
  if (rate.kind === 'percent' && rate.percent != null) return fillText(r.rate.percent, { percent: rate.percent });
  if (rate.kind === 'per_person' && rate.amount_tzs != null) return fillText(r.rate.per_person, { amount: formatTzs(rate.amount_tzs) });
  return null;
}

function RateCard({ ctx }: { ctx: Ctx }) {
  const { r, data } = ctx;
  const { type, font } = useType();
  const lines = [data.rate, data.unpricedRate].filter((x): x is ReservationRate => !!x).map((x) => rateLine(r, x)).filter((x): x is string => !!x);
  return (
    <Card>
      <CardHeader glyph={GLYPHS.card} title={r.rateTitle} />
      {lines.length === 0 ? <Text style={type.callout}>{r.rate.none}</Text> : lines.map((l) => <Text key={l} style={{ ...type.body, ...font.bold }}>{l}</Text>)}
      <Muted>{r.rateNote}</Muted>
    </Card>
  );
}

function TermsCard({ ctx }: { ctx: Ctx }) {
  const { r, data } = ctx;
  const { type, font } = useType();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const current = data.status.termsVersion != null && data.status.termsVersion === data.status.termsCurrentVersion;
  const outdated = data.status.termsVersion != null && !current;

  async function accept() {
    if (!agree) return setMessage({ tone: 'error', text: r.termsAgreeFirst });
    setBusy(true);
    setMessage(null);
    const result = await acceptTerms(ctx.providerId).catch((): SetupResult => ({ ok: false, error: 'failed' }));
    setBusy(false);
    if (result.ok) {
      setMessage({ tone: 'ok', text: fillText(r.termsAccepted, { date: formatDay(new Date().toISOString(), ctx.locale) }) });
      ctx.reload();
    } else setMessage({ tone: 'error', text: result.error === 'terms_outdated' ? r.termsReload : errorText(r, result) });
  }

  return (
    <Card>
      <CardHeader glyph={GLYPHS.document} title={r.termsTitle} />
      <Muted>{r.termsIntro}</Muted>
      <View style={{ gap: space.sm }}>
        {r.termsPoints.map((p, i) => (
          <View key={p} style={{ flexDirection: 'row', gap: space.sm }}>
            <Text style={{ ...type.callout, ...font.bold }}>{i + 1}.</Text>
            <Text selectable style={{ ...type.callout, flex: 1 }}>{p}</Text>
          </View>
        ))}
      </View>
      {current && data.status.termsAcceptedAt ? (
        <Badge label={fillText(r.termsAccepted, { date: formatDay(data.status.termsAcceptedAt, ctx.locale) })} icon={GLYPHS.check} />
      ) : (
        <>
          {outdated && <SoonNote text={r.termsOutdated} />}
          <Toggle label={fillText(r.termsAgree, { business: ctx.businessName })} value={agree} onChange={setAgree} />
          <Button title={r.termsAccept} variant="outline" size="md" onPress={accept} loading={busy} disabled={data.soon} />
        </>
      )}
      <FormMessage message={message} />
    </Card>
  );
}

function HoursCard({ ctx }: { ctx: Ctx }) {
  const { r, data } = ctx;
  const { type, font } = useType();
  const [days, setDays] = useState<Record<number, OpeningPeriod[]>>(() => hoursByWeekday(data.hours));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [badDay, setBadDay] = useState<number | null>(null);
  const update = (day: number, periods: OpeningPeriod[]) => setDays((d) => ({ ...d, [day]: periods }));
  const copyToAll = (day: number) => setDays(Object.fromEntries(weekdaysMondayFirst.map((d) => [d, days[day].map((p) => ({ ...p }))])) as Record<number, OpeningPeriod[]>);

  async function save() {
    setBusy(true);
    setMessage(null);
    setBadDay(null);
    const result = await saveHours(ctx.providerId, days).catch((): SetupResult => ({ ok: false, error: 'failed' }));
    setBusy(false);
    if (result.ok) {
      setMessage({ tone: 'ok', text: r.hoursSaved });
      ctx.reload();
    } else if (result.error === 'invalid' && result.weekday != null) {
      setBadDay(result.weekday);
      setMessage({ tone: 'error', text: fillText(r.hoursInvalid, { day: r.weekdays[result.weekday] }) });
    } else setMessage({ tone: 'error', text: errorText(r, result) });
  }

  return (
    <Card>
      <CardHeader glyph={GLYPHS.calendar} title={r.hoursTitle} />
      <Muted>{r.hoursBody}</Muted>
      {weekdaysMondayFirst.map((day, index) => {
        const periods = days[day];
        const name = r.weekdays[day];
        return (
          <View
            key={day}
            style={{ gap: space.sm, paddingTop: index ? space.md : 0, borderTopWidth: index ? 1 : 0, borderTopColor: colors.border, backgroundColor: badDay === day ? brand.dangerSoft : undefined }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text accessibilityRole="header" style={{ ...type.body, ...font.bold }}>{name}</Text>
              {periods.length === 0 && <Text style={{ ...type.callout, color: colors.secondaryLabel }}>{r.closed}</Text>}
            </View>
            {periods.map((p, i) => (
              <View key={i} style={{ gap: space.xs }}>
                <View style={{ flexDirection: 'row', gap: space.md }}>
                  <View style={{ flex: 1 }}>
                    <Field label={r.opens} accessibilityLabel={`${name}, ${r.opens}`} value={p.opens} onChangeText={(v) => update(day, periods.map((x, j) => (j === i ? { ...x, opens: v } : x)))} keyboardType="numbers-and-punctuation" maxLength={5} placeholder="08:00" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label={r.closes} accessibilityLabel={`${name}, ${r.closes}`} value={p.closes} onChangeText={(v) => update(day, periods.map((x, j) => (j === i ? { ...x, closes: v } : x)))} keyboardType="numbers-and-punctuation" maxLength={5} placeholder="17:00" />
                  </View>
                </View>
                <View style={{ alignItems: 'flex-start' }}>
                  <Button title={r.removePeriod} variant="danger" size="md" accessibilityLabel={`${r.removePeriod}: ${name} ${p.opens}-${p.closes}`} onPress={() => update(day, periods.filter((_, j) => j !== i))} />
                </View>
              </View>
            ))}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: layout.inlineGap }}>
              {periods.length < reservationLimits.periodsPerDay && (
                <Button title={r.addPeriod} variant="text" size="md" icon={GLYPHS.plus} accessibilityLabel={`${r.addPeriod}: ${name}`} onPress={() => update(day, [...periods, periods.length ? { opens: '18:00', closes: '22:00' } : { opens: '08:00', closes: '17:00' }])} />
              )}
              {periods.length > 0 && <Button title={r.copyToAll} variant="text" size="md" accessibilityLabel={`${r.copyToAll}: ${name}`} onPress={() => copyToAll(day)} />}
            </View>
          </View>
        );
      })}
      <Text style={type.caption}>{r.timeHint}</Text>
      <Button title={r.hoursSave} variant="outline" size="md" onPress={save} loading={busy} disabled={data.soon} />
      <FormMessage message={message} />
    </Card>
  );
}

function ClosedCard({ ctx }: { ctx: Ctx }) {
  const { r, data } = ctx;
  const range = closedDateRange(data.today);
  const [day, setDay] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const say = (result: SetupResult, ok: string) => {
    if (result.ok) {
      setMessage({ tone: 'ok', text: ok });
      ctx.reload();
      return true;
    }
    const e = result.error;
    setMessage({ tone: 'error', text: e === 'range' || e === 'duplicate' || e === 'note' ? r.closedErrors[e] : errorText(r, result) });
    return false;
  };

  async function add() {
    setBusy(true);
    setMessage(null);
    const ok = say(await addClosedDate(ctx.providerId, day.trim(), note).catch((): SetupResult => ({ ok: false, error: 'failed' })), r.closedAdded);
    setBusy(false);
    if (ok) {
      setDay('');
      setNote('');
    }
  }

  return (
    <Card>
      <CardHeader glyph={GLYPHS.calendarClosed} title={r.closedTitle} />
      <Muted>{r.closedBody}</Muted>
      {data.closed.length === 0 ? <Muted>{r.closedEmpty}</Muted> : data.closed.map((c) => <ClosedRow key={c.day} ctx={ctx} row={c} onResult={say} />)}
      <Field label={r.closedDay} value={day} onChangeText={setDay} placeholder={range.min} hint={`YYYY-MM-DD, ${range.min} – ${range.max}`} keyboardType="numbers-and-punctuation" maxLength={10} />
      <Field label={r.closedNote} value={note} onChangeText={setNote} hint={r.closedNoteHint} maxLength={reservationLimits.closedDateNoteMax} />
      <Button title={r.closedAdd} variant="outline" size="md" onPress={add} loading={busy} disabled={data.soon} />
      <FormMessage message={message} />
    </Card>
  );
}

function ClosedRow({ ctx, row, onResult }: { ctx: Ctx; row: { day: string; note: string | null }; onResult: (result: SetupResult, ok: string) => boolean }) {
  const { r } = ctx;
  const { type, font } = useType();
  const [note, setNote] = useState(row.note ?? '');
  const [busy, setBusy] = useState(false);
  const date = formatDay(row.day, ctx.locale);
  const run = async (work: () => Promise<SetupResult>, ok: string) => {
    setBusy(true);
    onResult(await work().catch((): SetupResult => ({ ok: false, error: 'failed' })), ok);
    setBusy(false);
  };
  return (
    <View style={{ gap: space.sm, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border }}>
      <Text style={{ ...type.body, ...font.bold }}>{date}</Text>
      <Field label={r.closedNote} accessibilityLabel={`${r.closedNote}: ${date}`} value={note} onChangeText={setNote} maxLength={reservationLimits.closedDateNoteMax} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: layout.inlineGap }}>
        {note !== (row.note ?? '') && (
          <Button title={r.closedSaveNote} variant="text" size="md" disabled={busy || ctx.data.soon} onPress={() => run(() => updateClosedNote(ctx.providerId, row.day, note), r.closedNoteSaved)} />
        )}
        <Button title={r.closedRemove} variant="danger" size="md" accessibilityLabel={`${r.closedRemove}: ${date}`} disabled={busy || ctx.data.soon} onPress={() => run(() => removeClosedDate(ctx.providerId, row.day), r.closedRemoved)} />
      </View>
    </View>
  );
}

type ServiceForm = { name: string; duration: string; price: string; people: string };

function ServicesCard({ ctx }: { ctx: Ctx }) {
  const { r, data } = ctx;
  const [editing, setEditing] = useState<string | 'new' | null>(data.services.length === 0 ? 'new' : null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const { t } = useI18n();

  const run = async (work: () => Promise<SetupResult>, ok: string) => {
    setBusy(true);
    setMessage(null);
    const result = await work().catch((): SetupResult => ({ ok: false, error: 'failed' }));
    setBusy(false);
    if (result.ok) {
      setMessage({ tone: 'ok', text: ok });
      ctx.reload();
    } else setMessage({ tone: 'error', text: result.error === 'too_many' ? r.serviceErrors.too_many : errorText(r, result) });
  };
  const move = (index: number, by: -1 | 1) => {
    const ids = data.services.map((s) => s.id);
    const j = index + by;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    run(() => orderServices(ctx.providerId, ids), r.serviceSaved);
  };
  const nextSort = data.services.reduce((max, s) => Math.max(max, s.sort), -1) + 1;
  const done = (saved: boolean) => {
    if (saved) {
      setMessage({ tone: 'ok', text: r.serviceSaved });
      ctx.reload();
    }
    setEditing(null);
  };

  return (
    <Card>
      <CardHeader glyph={GLYPHS.list} title={r.servicesTitle} />
      <Muted>{ctx.care ? r.servicesBodyCare : r.servicesBodyRestaurant}</Muted>
      {data.services.length === 0 && <Muted>{r.servicesEmpty}</Muted>}
      {data.services.map((s, i) =>
        editing === s.id ? (
          <ServiceEditor key={s.id} ctx={ctx} service={s} nextSort={nextSort} onDone={done} />
        ) : (
          <ServiceRow
            key={s.id}
            ctx={ctx}
            service={s}
            busy={busy}
            first={i === 0}
            last={i === data.services.length - 1}
            onEdit={() => setEditing(s.id)}
            onActive={() => run(() => setServiceActive(ctx.providerId, s.id, !s.active), r.serviceSaved)}
            onMove={(by) => move(i, by)}
            onRemove={() => confirmThen(r.serviceRemove, fillText(r.serviceRemoveConfirm, { name: s.name }), t.ux.cancel, () => run(() => removeService(ctx.providerId, s.id), r.serviceRemoved))}
          />
        ),
      )}
      {editing === 'new' ? (
        <ServiceEditor ctx={ctx} service={null} nextSort={nextSort} onDone={done} cancellable={data.services.length > 0} />
      ) : (
        data.services.length < reservationLimits.servicesPerBusiness && <Button title={r.serviceNew} variant="outline" size="md" icon={GLYPHS.plus} onPress={() => setEditing('new')} />
      )}
      <FormMessage message={message} />
    </Card>
  );
}

function ServiceRow({
  ctx,
  service: s,
  busy,
  first,
  last,
  onEdit,
  onActive,
  onMove,
  onRemove,
}: {
  ctx: Ctx;
  service: SetupService;
  busy: boolean;
  first: boolean;
  last: boolean;
  onEdit: () => void;
  onActive: () => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { r } = ctx;
  const { type, font } = useType();
  const off = busy || ctx.data.soon;
  const action = (title: string, onPress: () => void, variant: 'text' | 'danger' = 'text'): ReactNode => (
    <Button title={title} variant={variant} size="md" accessibilityLabel={`${title}: ${s.name}`} disabled={off} onPress={onPress} />
  );
  return (
    <View style={{ gap: space.xs, padding: space.md, borderRadius: radius.button, borderWidth: 1, borderColor: colors.border, backgroundColor: s.active ? colors.card : colors.fill }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
        <Text style={{ ...type.body, ...font.bold, flexShrink: 1 }}>{s.name}</Text>
        {!s.active && <Badge label={r.serviceIsOff} tone="neutral" />}
      </View>
      <Text style={{ ...type.callout, color: colors.secondaryLabel }}>
        {[fillText(r.serviceMinutes, { n: s.duration_min }), fillText(r.servicePeople, { n: s.max_people }), s.price_tzs == null ? r.serviceNoPrice : formatTzs(s.price_tzs)].join(' · ')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: layout.inlineGap }}>
        {action(r.serviceEdit, onEdit)}
        {action(s.active ? r.serviceOff : r.serviceOn, onActive)}
        {!first && action(r.serviceMoveUp, () => onMove(-1))}
        {!last && action(r.serviceMoveDown, () => onMove(1))}
        {action(r.serviceRemove, onRemove, 'danger')}
      </View>
    </View>
  );
}

function ServiceEditor({ ctx, service, nextSort, onDone, cancellable = true }: { ctx: Ctx; service: SetupService | null; nextSort: number; onDone: (saved: boolean) => void; cancellable?: boolean }) {
  const { r } = ctx;
  const [f, setF] = useState<ServiceForm>(
    service
      ? { name: service.name, duration: String(service.duration_min), price: service.price_tzs == null ? '' : String(service.price_tzs), people: String(service.max_people) }
      : { name: '', duration: String(reservationLimits.durationDefault), price: '', people: ctx.care ? '1' : '2' },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof ServiceForm) => (value: string) => setF((x) => ({ ...x, [key]: value }));

  async function save() {
    setBusy(true);
    setError(null);
    const input = { name: f.name, duration_min: Number(f.duration), price_tzs: f.price.trim() === '' ? null : Number(f.price.replace(/[ ,]/g, '')), max_people: Number(f.people) };
    const result = await saveService(ctx.providerId, service?.id ?? null, input, nextSort).catch((): SetupResult => ({ ok: false, error: 'failed' }));
    setBusy(false);
    if (result.ok) return onDone(true);
    if (result.error === 'invalid' && result.field) return setError(r.serviceErrors[result.field]);
    setError(result.error === 'too_many' ? r.serviceErrors.too_many : errorText(r, result));
  }

  return (
    <View style={{ gap: space.md, padding: space.md, borderRadius: radius.button, borderWidth: 1, borderColor: brand.primary }}>
      <Field label={r.serviceName} value={f.name} onChangeText={set('name')} maxLength={reservationLimits.serviceNameMax} />
      <Field label={r.serviceDuration} value={f.duration} onChangeText={set('duration')} keyboardType="number-pad" maxLength={3} />
      <Field label={r.servicePrice} value={f.price} onChangeText={set('price')} keyboardType="number-pad" maxLength={10} hint={ctx.care ? r.servicePriceHintCare : undefined} />
      <Field label={r.serviceMaxPeople} value={f.people} onChangeText={set('people')} keyboardType="number-pad" maxLength={2} />
      <ErrorText>{error}</ErrorText>
      <Button title={service ? r.serviceSave : r.serviceAdd} variant="outline" size="md" onPress={save} loading={busy} disabled={ctx.data.soon} />
      {cancellable && <Button title={r.serviceCancel} variant="text" size="md" onPress={() => onDone(false)} />}
    </View>
  );
}

function RulesCard({ ctx }: { ctx: Ctx }) {
  const { r, data } = ctx;
  const [minNotice, setMinNotice] = useState(String(data.rules.minNotice));
  const [maxDays, setMaxDays] = useState(String(data.rules.maxDays));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    const result = await saveRules(ctx.providerId, Number(minNotice), Number(maxDays)).catch((): SetupResult => ({ ok: false, error: 'failed' }));
    setBusy(false);
    if (result.ok) {
      setMessage({ tone: 'ok', text: r.rulesSaved });
      ctx.reload();
    } else setMessage({ tone: 'error', text: result.error === 'invalid' ? r.rulesInvalid : errorText(r, result) });
  }

  return (
    <Card>
      <CardHeader glyph={GLYPHS.admin} title={r.rulesTitle} />
      <Field label={r.minNotice} value={minNotice} onChangeText={setMinNotice} hint={r.minNoticeHint} keyboardType="number-pad" maxLength={4} />
      <Field label={r.maxDays} value={maxDays} onChangeText={setMaxDays} hint={r.maxDaysHint} keyboardType="number-pad" maxLength={3} />
      <Button title={r.rulesSave} variant="outline" size="md" onPress={save} loading={busy} disabled={data.soon} />
      <FormMessage message={message} />
    </Card>
  );
}
