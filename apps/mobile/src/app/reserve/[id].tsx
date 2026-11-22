import { useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  addDaysIso,
  fillText,
  isReservableType,
  reservationRules,
  reservationSlots,
  reserveText,
  tanzaniaStartsAt,
  weekdayOfDay,
  type ReserveText,
} from '@kwetuly/shared';
import { GLYPHS } from '@/components/glyph';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { Button, Card, Chip, EmptyState, ErrorText, Field, FormScreen, Muted, ScreenState, Toggle } from '@/components/ui';
import { useSession } from '@/lib/auth';
import { getBusiness } from '@/lib/businesses';
import { useI18n } from '@/lib/i18n';
import { useNeedsSetup, welcomeHref } from '@/lib/onboarding';
import { loadReserveData, placeReservation, reserveError, type ActionResult } from '@/lib/reservations';
import { useType } from '@/lib/use-type';
import { brand, layout, radius, space } from '@/theme';

const dayLabel = (day: string, locale: string) => {
  try {
    return new Date(`${day}T00:00:00Z`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  } catch {
    return day;
  }
};

// The Reserve form of a restaurant, spa or salon, the same as /businesses/[id]/reserve on the website:
// service or table, day, a free time, people, note, optional diet line with consent, optional guide
// code, and the commission disclosure before Send. "Opens soon" while the database part is missing.
export default function ReserveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { locale } = useI18n();
  const r = reserveText(locale);
  const { session } = useSession();
  const needsSetup = useNeedsSetup();
  const business = useQuery({ queryKey: ['business', id], queryFn: () => getBusiness(id) });
  const b = business.data;
  const data = useQuery({ queryKey: ['reserve-data', id], queryFn: () => loadReserveData(id, b!.business_type), enabled: !!b && !!session && isReservableType(b.business_type) });
  const title = <Stack.Screen options={{ title: r.reserve }} />;

  if (!session) {
    return (
      <FormScreen>
        {title}
        <SignInPrompt />
      </FormScreen>
    );
  }
  if (!b || (isReservableType(b.business_type) && !data.data)) {
    return (
      <>
        {title}
        <ScreenState screen loading={business.isLoading || data.isLoading} error={business.error ?? data.error} onRetry={() => (business.error ? business.refetch() : data.refetch())} retryLabel={r.retry} empty={!business.isLoading && !b} emptyText={r.loadError} />
      </>
    );
  }
  if (!isReservableType(b.business_type) || !data.data) {
    return (
      <FormScreen>
        {title}
        <EmptyState glyph={GLYPHS.calendarClosed} text={fillText(r.notOpen, { business: b.business_name })} />
      </FormScreen>
    );
  }
  return <Form r={r} locale={locale} providerId={b.id} businessName={b.business_name} care={b.business_type !== 'restaurant'} data={data.data} needsSetup={needsSetup} />;
}

function Form({
  r,
  locale,
  providerId,
  businessName,
  care,
  data,
  needsSetup,
}: {
  r: ReserveText;
  locale: string;
  providerId: string;
  businessName: string;
  care: boolean;
  data: NonNullable<Awaited<ReturnType<typeof loadReserveData>>>;
  needsSetup: boolean;
}) {
  const { type, font } = useType();
  const business = { business: businessName };
  const [serviceId, setServiceId] = useState<string>(care ? (data.services[0]?.id ?? '') : '');
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [party, setParty] = useState(care ? '1' : '2');
  const [note, setNote] = useState('');
  const [diet, setDiet] = useState('');
  const [consent, setConsent] = useState(false);
  const [guideCode, setGuideCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const service = data.services.find((s) => s.id === serviceId) ?? null;
  const maxParty = service ? service.max_people : reservationRules.restaurantMaxParty;
  // No manual useMemo: the React Compiler memoizes these (expo lint, preserve-manual-memoization).
  const days = Array.from({ length: Math.min(data.maxDays, 20) + 1 }, (_, i) => addDaysIso(data.today, i)).filter((d) => !data.closedDays.includes(d) && (data.hours[weekdayOfDay(d)] ?? []).length > 0);
  const slots = day
    ? reservationSlots({ day, periods: data.hours[weekdayOfDay(day)] ?? [], durationMin: service?.duration_min ?? reservationRules.defaultDurationMin, minNoticeMin: data.minNoticeMin, maxDays: data.maxDays, today: data.today, closedDays: data.closedDays })
    : [];
  const rate = care && service && service.price_tzs == null ? data.unpricedRate : data.rate;
  const disabled = data.soon || !data.open;

  async function send() {
    setError(null);
    if (needsSetup) return router.push(welcomeHref(`/reserve/${providerId}`));
    if (care && !service) return setError(r.refusals.service_required);
    if (!day || !time || !slots.includes(time)) return setError(r.refusals.time_not_allowed);
    const people = Number(party);
    if (!Number.isInteger(people) || people < 1 || people > maxParty) return setError(r.refusals.party_size);
    if (diet.trim() && !consent) return setError(r.refusals.diet_consent_needed);
    setBusy(true);
    const result = await placeReservation({ providerId, serviceId: service?.id ?? null, startsAt: tanzaniaStartsAt(day, time), partySize: people, note, dietLine: diet, dietConsent: consent, guideCode }).catch((): ActionResult => ({ ok: false, error: 'failed' }));
    setBusy(false);
    if (result.ok) router.replace({ pathname: '/my-reservations', params: { sent: businessName } } as unknown as Href);
    else setError(reserveError(r, result));
  }

  const chips = (children: React.ReactNode) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: layout.inlineGap }}>{children}</View>;

  return (
    <FormScreen
      bar={
        <>
          <ErrorText>{error}</ErrorText>
          {/* The screen's one filled button. */}
          <Button title={r.send} onPress={send} loading={busy} disabled={disabled} accessibilityLabel={data.soon ? `${r.send}. ${r.soon}` : undefined} />
        </>
      }
    >
      <Stack.Screen options={{ title: r.reserve }} />
      <Text accessibilityRole="header" style={type.title2}>{fillText(r.title, business)}</Text>
      <Muted>{fillText(r.intro, business)}</Muted>
      {data.soon && <Note text={r.soon} />}
      {!data.soon && !data.open && <Note text={fillText(r.notOpen, business)} />}

      <Card>
        {(care || data.services.length > 0) && (
          <View style={{ gap: space.sm }}>
            <Text style={type.label}>{r.service}</Text>
            {chips(
              <>
                {!care && <Chip label={r.table} active={serviceId === ''} onPress={() => { setServiceId(''); setTime(''); }} />}
                {data.services.map((s) => (
                  <Chip key={s.id} label={s.name} active={serviceId === s.id} onPress={() => { setServiceId(s.id); setTime(''); }} />
                ))}
              </>,
            )}
          </View>
        )}
        <View style={{ gap: space.sm }}>
          <Text style={type.label}>{r.date}</Text>
          {days.length === 0 ? <Muted>{r.noTimes}</Muted> : chips(days.map((d) => <Chip key={d} label={dayLabel(d, locale)} active={day === d} onPress={() => { setDay(d); setTime(''); }} />))}
        </View>
        <View style={{ gap: space.sm }}>
          <Text style={type.label}>{r.time}</Text>
          {!day ? <Muted>{r.pickDay}</Muted> : slots.length === 0 ? <Muted>{r.noTimes}</Muted> : chips(slots.map((s) => <Chip key={s} label={s} active={time === s} onPress={() => setTime(s)} />))}
        </View>
        <Field label={r.party} value={party} onChangeText={setParty} keyboardType="number-pad" maxLength={2} hint={fillText(r.partyHint, { max: maxParty })} />
        <Field label={fillText(r.note, business)} value={note} onChangeText={setNote} multiline maxLength={reservationRules.noteMax} hint={`${r.noteHint} ${r.noteHealth}`} />
        <Field label={r.diet} value={diet} onChangeText={setDiet} maxLength={reservationRules.dietLineMax} hint={fillText(r.dietHint, business)} />
        {diet.trim() ? <Toggle label={fillText(r.dietConsent, business)} value={consent} onChange={setConsent} /> : null}
        <Field label={r.guideCode} value={guideCode} onChangeText={setGuideCode} autoCapitalize="characters" maxLength={20} hint={r.guideCodeHint} />
      </Card>

      {/* The disclosure, before Send (docs/team/business-reservation-commission-2026-11-22.md section 8). */}
      <Card style={{ backgroundColor: brand.mint }}>
        {rate && <Text style={{ ...type.callout, color: brand.forest }}>{fillText(r.disclosure[rate.kind], business)}{guideCode.trim() ? ` ${r.disclosureGuide}` : ''}</Text>}
        <Text style={{ ...type.callout, ...font.bold, color: brand.forest }}>{r.noCharge}</Text>
      </Card>
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
