import { useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  addDaysIso,
  fillText,
  formatTzs,
  isReservableType,
  reservationGroupDiscountApplies,
  reservationPricePerPerson,
  joinSentences,
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
import { checkGuideCode, loadReserveData, placeReservation, reserveError, type ActionResult } from '@/lib/reservations';
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
  const data = useQuery({ queryKey: ['reserve-data', id], queryFn: () => loadReserveData(id, b!.business_type), enabled: !!b && !!session && !b.is_sample && isReservableType(b.business_type) });
  const title = <Stack.Screen options={{ title: r.reserve }} />;

  if (!session) {
    return (
      <FormScreen>
        {title}
        <SignInPrompt />
      </FormScreen>
    );
  }
  if (!b || (isReservableType(b.business_type) && !b.is_sample && !data.data)) {
    return (
      <>
        {title}
        <ScreenState screen loading={business.isLoading || data.isLoading} error={business.error ?? data.error} onRetry={() => (business.error ? business.refetch() : data.refetch())} retryLabel={r.retry} empty={!business.isLoading && !b} emptyText={r.loadError} />
      </>
    );
  }
  // Samples and other business types cannot be reserved (QA 6, 14).
  if (b.is_sample || !isReservableType(b.business_type) || !data.data) {
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
  const [allDays, setAllDays] = useState(false);

  const service = data.services.find((s) => s.id === serviceId) ?? null;
  const maxParty = service ? service.max_people : reservationRules.restaurantMaxParty;
  // No manual useMemo: the React Compiler memoizes these (expo lint, preserve-manual-memoization).
  // The first 3 weeks, then "Show later dates" for the whole range the business allows (QA 7).
  const openDays = Array.from({ length: data.maxDays + 1 }, (_, i) => addDaysIso(data.today, i)).filter((d) => !data.closedDays.includes(d) && (data.hours[weekdayOfDay(d)] ?? []).length > 0);
  const days = allDays ? openDays : openDays.slice(0, 21);
  const slots = day
    ? reservationSlots({ day, periods: data.hours[weekdayOfDay(day)] ?? [], durationMin: service?.duration_min ?? reservationRules.defaultDurationMin, minNoticeMin: data.minNoticeMin, maxDays: data.maxDays, today: data.today, closedDays: data.closedDays })
    : [];
  const rate = care && service && service.price_tzs == null ? data.unpricedRate : data.rate;
  // The service's group discount (spa and salon): shown on the service, and the price per person after
  // it once the party reaches the minimum. The disclosure line stays the same.
  const discount =
    service && service.price_tzs != null && service.group_discount_min_people != null && service.group_discount_percent != null
      ? { group_discount_min_people: service.group_discount_min_people, group_discount_percent: service.group_discount_percent }
      : null;
  const partyNumber = Number(party);
  const discountPrice =
    discount && service && Number.isInteger(partyNumber) && reservationGroupDiscountApplies(discount, partyNumber)
      ? reservationPricePerPerson({ commission_kind: 'percent', commission_rate_tzs: null, commission_percent: null, max_guests_counted: null, price_basis_tzs: service.price_tzs, ...discount }, partyNumber)
      : null;
  // No rate for this choice outside "opens soon": no disclosure, so no Send (security review L-A).
  const rateMissing = !data.soon && data.open && !rate;
  const disabled = data.soon || !data.open || rateMissing;

  async function send() {
    setError(null);
    if (needsSetup) return router.push(welcomeHref(`/reserve/${providerId}`));
    if (care && !service) return setError(r.refusals.service_required);
    if (!day || !time || !slots.includes(time)) return setError(r.refusals.time_not_allowed);
    const people = Number(party);
    if (!Number.isInteger(people) || people < 1 || people > maxParty) return setError(r.refusals.party_size);
    if (diet.trim() && !consent) return setError(r.refusals.diet_consent_needed);
    setBusy(true);
    // A guide code is checked first; the database takes only a code checked in the last hour.
    if (guideCode.trim()) {
      const check = await checkGuideCode(guideCode).catch(() => 'failed' as const);
      if (check !== 'ok') {
        setBusy(false);
        return setError(check === 'unknown' ? r.refusals.guide_code_unknown : check === 'too_many' ? r.guideCodeTooMany : check === 'soon' ? r.soon : r.saveError);
      }
    }
    const result = await placeReservation({ providerId, serviceId: service?.id ?? null, startsAt: tanzaniaStartsAt(day, time), partySize: people, note, dietLine: diet, dietConsent: consent, guideCode }).catch((): ActionResult => ({ ok: false, error: 'failed' }));
    setBusy(false);
    // Only the reservation id travels; My reservations reads the business name from the database (L-C).
    if (result.ok) router.replace({ pathname: '/my-reservations', params: { sent: result.id ?? '1' } } as unknown as Href);
    else setError(reserveError(r, result));
  }

  const chips = (children: React.ReactNode) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: layout.inlineGap }}>{children}</View>;

  return (
    <FormScreen
      bar={
        <>
          {/* The disclosure sits right above Send (security review L-B; commission doc section 8). */}
          {rate && <Text style={{ ...type.callout, color: brand.forest }}>{joinSentences(locale, fillText(r.disclosure[rate.kind], business), guideCode.trim() ? r.disclosureGuide : null)}</Text>}
          {rateMissing && <ErrorText>{r.loadError}</ErrorText>}
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
      {!data.soon && !data.open && (
        <>
          <Note text={fillText(r.notOpen, business)} />
          <Button title={fillText(r.askInstead, business)} variant="outline" size="md" onPress={() => router.replace({ pathname: '/business/[id]', params: { id: providerId } })} />
        </>
      )}

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
          {!allDays && openDays.length > days.length && <Button title={r.laterDates} variant="text" size="md" onPress={() => setAllDays(true)} />}
        </View>
        <View style={{ gap: space.sm }}>
          <Text style={type.label}>{r.time}</Text>
          {!day ? <Muted>{r.pickDay}</Muted> : slots.length === 0 ? <Muted>{r.noTimes}</Muted> : chips(slots.map((s) => <Chip key={s} label={s} active={time === s} onPress={() => setTime(s)} />))}
        </View>
        {service && service.price_tzs != null ? (
          <View style={{ gap: space.xxs }} accessibilityLiveRegion="polite">
            <Muted>{fillText(r.pricePerPerson, { price: formatTzs(service.price_tzs) })}</Muted>
            {discount ? <Muted>{fillText(r.groupDiscount, { percent: discount.group_discount_percent, n: discount.group_discount_min_people })}</Muted> : null}
            {discountPrice != null ? <Text style={{ ...type.callout, ...font.bold, color: brand.forest }}>{fillText(r.priceWithDiscount, { price: formatTzs(discountPrice) })}</Text> : null}
          </View>
        ) : null}
        <Field label={r.party} value={party} onChangeText={setParty} keyboardType="number-pad" maxLength={2} hint={fillText(r.partyHint, { max: maxParty })} />
        <Field label={fillText(r.note, business)} value={note} onChangeText={setNote} multiline maxLength={reservationRules.noteMax} hint={joinSentences(locale, r.noteHint, r.noteHealth)} autoComplete="off" autoCorrect={false} importantForAutofill="no" />
        <Field label={r.diet} value={diet} onChangeText={setDiet} maxLength={reservationRules.dietLineMax} hint={fillText(r.dietHint, business)} autoComplete="off" autoCorrect={false} importantForAutofill="no" />
        {diet.trim() ? <Toggle label={fillText(r.dietConsent, business)} value={consent} onChange={setConsent} /> : null}
        <Field label={r.guideCode} value={guideCode} onChangeText={setGuideCode} autoCapitalize="characters" maxLength={20} hint={r.guideCodeHint} />
      </Card>

      <Card style={{ backgroundColor: brand.mint }}>
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
