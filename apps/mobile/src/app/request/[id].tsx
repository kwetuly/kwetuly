import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Redirect, Link, Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { approxTzs, formatUsd, hasRecordedCheck, isDisplayNameReservedError, type Dictionary, type Locale } from '@kwetuly/shared';
import { BookingTicket } from '@/components/booking-ticket';
import { PayDeposit } from '@/components/pay-deposit';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { GLYPHS } from '@/components/glyph';
import { Badge, Button, Card, EmptyState, ErrorText, Field, FormMessage, MetaItems, Muted, ScreenState, SectionTitle, Stars, SuccessCheck } from '@/components/ui';
import { useCanOffer } from '@/hooks/use-can-offer';
import {
  answerOffer,
  depositState,
  getMyOffer,
  getRequest,
  listOffers,
  offerContacts,
  offerName,
  paymentsConfig,
  sendOffer,
  setRequestOpen,
  today,
  withdrawOffer,
  type TripOffer,
  type TripRequest,
} from '@/lib/api-requests';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useNeedsSetup, welcomeHref } from '@/lib/onboarding';
import { expertiseOf, formatDateRange, languageName, specialtyName } from '@/lib/labels';
import { useType } from '@/lib/use-type';
import { brand, colors, control, layout, radius, space } from '@/theme';

export default function RequestScreen() {
  const { id, posted } = useLocalSearchParams<{ id: string; posted?: string }>();
  const { t } = useI18n();
  const { type, font } = useType();
  const { session } = useSession();
  const userId = session?.user.id;
  const request = useQuery({ queryKey: ['request', id], queryFn: () => getRequest(id), enabled: !!userId });
  const offers = useQuery({ queryKey: ['offers', id], queryFn: () => listOffers(id), enabled: !!userId });

  const needsSetup = useNeedsSetup();
  if (needsSetup) return <Redirect href={welcomeHref(`/request/${id}`)} />;
  if (!userId) return <SignInPrompt screen />;
  if (!request.data) return <ScreenState screen loading={request.isLoading} error={request.error} onRetry={() => request.refetch()} empty emptyText={t.requests.error} />;
  const req = request.data;
  const isOwner = req.traveler_id === userId;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: layout.screenX, gap: space.lg, paddingBottom: space.xxxl }}
      refreshControl={<RefreshControl refreshing={request.isRefetching} onRefresh={() => { request.refetch(); offers.refetch(); }} tintColor={brand.leaf} />}
    >
      <Stack.Title>{req.title}</Stack.Title>
      {posted && (
        <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <SuccessCheck />
          <Text style={{ ...type.body, ...font.bold, color: brand.forest, flex: 1 }}>{t.requests.posted}</Text>
        </View>
      )}
      <Summary req={req} isOwner={isOwner} />
      {isOwner ? <TravellerOffers req={req} offers={offers.data ?? []} /> : <MyOffer req={req} />}
    </ScrollView>
  );
}

function Summary({ req, isOwner }: { req: TripRequest; isOwner: boolean }) {
  const { t, locale } = useI18n();
  const r = t.requests;
  const { type } = useType();
  const queryClient = useQueryClient();
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.sm }}>
        <Text style={{ ...type.label, color: brand.link, flexShrink: 1 }}>{specialtyName(req.specialty, locale)}</Text>
        <Badge label={r.status[req.status]} tone={req.status === 'open' ? 'mint' : 'sand'} />
      </View>
      <Text accessibilityRole="header" style={type.title2}>{req.title}</Text>
      {!isOwner && <Muted>{t.offers.from} {req.traveler_name}</Muted>}
      <Muted>
        {req.start_date ? formatDateRange(req.start_date, req.end_date ?? req.start_date, locale) : r.datesFlexible}
        {req.start_date && req.flexible_dates ? ` (${r.datesFlexible})` : ''}
      </Muted>
      <MetaItems items={[`${req.adults} ${r.adults}`, req.children ? `${req.children} ${r.children}` : null, req.regions.length ? req.regions.join(', ') : null]} />
      {req.budget_per_person_usd ? <Muted>{r.budgetLabel}: ${req.budget_per_person_usd.toLocaleString(locale)} {r.perPerson}</Muted> : null}
      {req.languages.length > 0 && <Muted>{req.languages.map(languageName).join(', ')}</Muted>}
      <Text selectable style={type.callout}>{req.details}</Text>
      {(req.female_guide || req.expertise.length > 0) && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {req.female_guide && <Badge label={r.femaleGuide} tone="sand" />}
          {expertiseOf(req.expertise).map((e) => <Badge key={e.id} label={e.label[locale]} tone="sand" />)}
        </View>
      )}
      {isOwner && req.status !== 'booked' && (
        <Button
          title={req.status === 'open' ? r.close : r.reopen}
          variant="outline"
          size="md"
          onPress={async () => {
            await setRequestOpen(req.id, req.status !== 'open');
            queryClient.invalidateQueries({ queryKey: ['request', req.id] });
            queryClient.invalidateQueries({ queryKey: ['my-requests'] });
          }}
        />
      )}
    </Card>
  );
}

function useRate() {
  return useQuery({ queryKey: ['payments-config'], queryFn: paymentsConfig, staleTime: 10 * 60_000 }).data?.rate ?? null;
}

function datesOf(req: TripRequest, t: Dictionary, locale: Locale) {
  return req.start_date ? formatDateRange(req.start_date, req.end_date ?? req.start_date, locale) : t.requests.datesFlexible;
}

// One offer as a comparison row: who, verified, rating, price and what's included up front; the itinerary folds open.
function OfferRow({ offer }: { offer: TripOffer }) {
  const { t } = useI18n();
  const r = t.requests;
  const { type, font } = useType();
  const rate = useRate();
  const [open, setOpen] = useState(false);
  const expired = !!offer.valid_until && offer.valid_until < today();
  const tzs = approxTzs(offer.price_total_usd, rate);
  const depositMeta = offer.deposit_percent > 0 ? `${r.deposit} ${offer.deposit_percent}%` : null;
  const validMeta = offer.valid_until ? (expired ? r.expired : `${r.validUntil} ${offer.valid_until}`) : null;

  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
        <View style={{ flex: 1, gap: space.xs }}>
          {offer.guides ? (
            <Link href={`/guide/${offer.guides.slug}`} style={{ ...type.cardTitle, color: brand.link, textDecorationLine: 'underline' }}>{offer.guides.display_name}</Link>
          ) : (
            <Text style={type.cardTitle}>{offer.company_name}</Text>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
            {offer.guides && hasRecordedCheck(offer.guides) && <Badge label={t.guides.verified} icon={GLYPHS.check} />}
            {offer.guides?.rating_count ? <Stars value={offer.guides.rating_avg ?? 0} /> : null}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ ...type.price, color: colors.label }}>{formatUsd(offer.price_total_usd)}</Text>
          {tzs && <Text style={{ ...type.caption, fontVariant: ['tabular-nums'] }}>{tzs}</Text>}
        </View>
      </View>
      {offer.includes && (
        <Text style={type.callout}>
          <Text style={font.bold}>{r.includes}: </Text>
          {offer.includes}
        </Text>
      )}
      {depositMeta || validMeta ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md }}>
          {depositMeta ? <Text style={type.meta}>{depositMeta}</Text> : null}
          {validMeta ? <Text style={{ ...type.meta, color: expired ? brand.danger : colors.secondaryLabel }}>{validMeta}</Text> : null}
        </View>
      ) : null}
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ backgroundColor: colors.background, borderRadius: radius.chip, borderCurve: 'continuous', padding: space.md, gap: space.sm, minHeight: control.touch }}>
        <Text style={{ ...type.callout, ...font.bold, color: brand.link }}>{r.showItinerary}</Text>
        {open && (
          <>
            <Text selectable style={type.callout}>{offer.itinerary}</Text>
            {offer.excludes && <Muted>{r.excludes}: {offer.excludes}</Muted>}
          </>
        )}
      </Pressable>
    </>
  );
}

function Contacts({ offer, traveller }: { offer: TripOffer; traveller: string }) {
  const { t } = useI18n();
  const { type, font } = useType();
  const contacts = useQuery({ queryKey: ['offer-contacts', offer.id], queryFn: () => offerContacts(offer.id) });
  const c = contacts.data;
  return (
    <View style={{ gap: space.sm }}>
      <Text style={type.cardTitle}>{t.requests.contactTitle}</Text>
      {c && (
        <>
          <View style={{ gap: space.xxs }}>
            <Text style={{ ...type.callout, ...font.bold }}>{offerName(offer)}</Text>
            <MetaItems selectable items={[c.offerer_phone, c.offerer_email]} />
          </View>
          <View style={{ gap: space.xxs }}>
            <Text style={{ ...type.callout, ...font.bold }}>{traveller}</Text>
            <MetaItems selectable items={[c.traveler_phone, c.traveler_email]} />
          </View>
        </>
      )}
      {offer.chat_id && <Button title={t.requests.openChat} variant="outline" size="md" icon={GLYPHS.chat} onPress={() => router.push(`/chat/${offer.chat_id}`)} />}
    </View>
  );
}

/** The accepted offer as a ticket, for both the traveller and the guide. */
function AcceptedTicket({ req, offer, children, forGuide }: { req: TripRequest; offer: TripOffer; children?: React.ReactNode; forGuide?: boolean }) {
  const { t, locale } = useI18n();
  const rate = useRate();
  const deposit = useQuery({ queryKey: ['deposit-state', offer.id], queryFn: () => depositState('trip_offer_id', offer.id) });
  return (
    <BookingTicket
      title={req.title}
      guide={offerName(offer)}
      dates={datesOf(req, t, locale)}
      people={req.adults + req.children}
      totalUsd={offer.price_total_usd}
      depositPercent={offer.deposit_percent}
      deposit={deposit.data}
      rate={rate}
      forGuide={forGuide}
    >
      <Contacts offer={offer} traveller={req.traveler_name} />
      {children}
    </BookingTicket>
  );
}

function TravellerOffers({ req, offers }: { req: TripRequest; offers: TripOffer[] }) {
  const { t } = useI18n();
  const r = t.requests;
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const accepted = offers.find((o) => o.status === 'accepted');
  // Cheapest first, so offers compare at a glance; declined ones go last.
  const others = offers
    .filter((o) => o !== accepted)
    .sort((a, b) => Number(a.status === 'declined') - Number(b.status === 'declined') || a.price_total_usd - b.price_total_usd);

  async function answer(offer: TripOffer, accept: boolean) {
    setBusy(offer.id + accept);
    setError('');
    try {
      await answerOffer(offer.id, accept);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['offers', req.id] }),
        queryClient.invalidateQueries({ queryKey: ['request', req.id] }),
        queryClient.invalidateQueries({ queryKey: ['my-requests'] }),
      ]);
    } catch {
      setError(r.error);
    } finally {
      setBusy('');
    }
  }

  return (
    <View style={{ gap: space.md }}>
      {accepted && (
        <AcceptedTicket req={req} offer={accepted}>
          <PayDeposit kind="offer" id={accepted.id} totalUsd={accepted.price_total_usd} percent={accepted.deposit_percent} />
        </AcceptedTicket>
      )}
      <SectionTitle>{r.offersTitle} ({offers.length})</SectionTitle>
      {offers.length === 0 && <EmptyState glyph={GLYPHS.list} text={r.noOffers} />}
      <ErrorText>{error}</ErrorText>
      {(accepted ? [...others, accepted] : others).map((offer) => (
        // Declined offers sit on the page colour instead of fading, so their text stays readable.
        <Card key={offer.id} style={offer.status === 'declined' ? { backgroundColor: colors.background } : undefined}>
          <OfferRow offer={offer} />
          {offer.status !== 'sent' && <Muted>{r.offerStatus[offer.status]}</Muted>}
          {offer.status === 'sent' && req.status === 'open' && (!offer.valid_until || offer.valid_until >= today()) && (
            <>
              {/* Several offers can be open at once, so these are not filled buttons. */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                <Button title={r.accept} variant="outline" size="md" style={{ flexGrow: 1 }} onPress={() => answer(offer, true)} loading={busy === offer.id + 'true'} />
                <Button title={r.decline} variant="text" size="md" style={{ flexGrow: 1 }} onPress={() => answer(offer, false)} loading={busy === offer.id + 'false'} />
              </View>
              <Muted>{r.acceptNote}</Muted>
            </>
          )}
        </Card>
      ))}
    </View>
  );
}

function MyOffer({ req }: { req: TripRequest }) {
  const { t } = useI18n();
  const o = t.offers;
  const { type, font } = useType();
  const { session } = useSession();
  const userId = session!.user.id;
  const queryClient = useQueryClient();
  const { canOffer, businessWaiting, guideId, loading } = useCanOffer();
  const mine = useQuery({ queryKey: ['my-offer', req.id, userId], queryFn: () => getMyOffer(req.id, userId) });
  const offer = mine.data ?? null;

  const [f, setF] = useState({ company: '', price: '', deposit: '30', itinerary: '', includes: '', excludes: '', validUntil: '' });
  const set = <K extends keyof typeof f>(key: K) => (value: string) => setF((current) => ({ ...current, [key]: value }));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  // Fill the form with the offer already sent, so it can be edited (adjusting state while rendering
  // when the loaded offer changes, instead of in an effect).
  const [seenOffer, setSeenOffer] = useState<typeof offer>(null);
  if (offer && offer !== seenOffer) {
    setSeenOffer(offer);
    setF({
      company: offer.company_name ?? '',
      price: String(offer.price_total_usd),
      deposit: String(offer.deposit_percent),
      itinerary: offer.itinerary,
      includes: offer.includes ?? '',
      excludes: offer.excludes ?? '',
      validUntil: offer.valid_until ?? '',
    });
  }

  if (loading || mine.isLoading) return <ScreenState loading />;
  if (!canOffer && !offer) return <Muted>{businessWaiting ? t.business.waitApproval : o.whoCan}</Muted>;

  const editable = canOffer && req.status === 'open' && (!offer || offer.status === 'sent' || offer.status === 'withdrawn');
  const banner = offer ? { accepted: o.accepted, declined: o.declined, withdrawn: o.withdrawn, sent: '' }[offer.status] : '';

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['my-offer', req.id] }),
      queryClient.invalidateQueries({ queryKey: ['request', req.id] }),
      queryClient.invalidateQueries({ queryKey: ['my-offers'] }),
    ]);

  async function submit() {
    const price = parseInt(f.price, 10);
    const deposit = parseInt(f.deposit, 10);
    const validUntil = f.validUntil.trim() || null;
    const valid =
      price >= 1 &&
      f.itinerary.trim().length >= 20 &&
      (guideId || f.company.trim()) &&
      (!validUntil || (/^\d{4}-\d{2}-\d{2}$/.test(validUntil) && validUntil >= today()));
    if (!valid) return setMessage({ tone: 'error', text: t.requests.error });
    setBusy(true);
    setMessage(null);
    try {
      await sendOffer(
        req.id,
        userId,
        guideId,
        {
          price_total_usd: price,
          deposit_percent: Number.isFinite(deposit) ? Math.min(Math.max(deposit, 0), 100) : 30,
          itinerary: f.itinerary.trim(),
          includes: f.includes.trim() || null,
          excludes: f.excludes.trim() || null,
          valid_until: validUntil,
          company_name: guideId ? null : f.company.trim(),
        },
        offer?.id,
      );
      await refresh();
      setMessage({ tone: 'ok', text: o.sent });
    } catch (e) {
      setMessage({ tone: 'error', text: isDisplayNameReservedError(e as Error) ? t.auth.nameReserved : t.requests.error });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: space.md }}>
      <SectionTitle>{offer ? o.yourOffer : o.makeOffer}</SectionTitle>
      <Muted>{o.competing}: {req.offers_count}</Muted>
      {banner ? <Text style={{ ...type.body, ...font.bold }}>{banner}</Text> : null}

      {offer?.status === 'accepted' && <AcceptedTicket req={req} offer={offer} forGuide />}
      {offer?.status === 'declined' && (
        <Card>
          <OfferRow offer={offer} />
        </Card>
      )}

      {editable && (
        <Card>
          {!guideId && <Field label={o.companyName} value={f.company} onChangeText={set('company')} />}
          <Field label={o.price} value={f.price} onChangeText={set('price')} keyboardType="number-pad" />
          <Field label={o.deposit} value={f.deposit} onChangeText={set('deposit')} keyboardType="number-pad" hint={o.depositHint} />
          <Field label={o.itinerary} value={f.itinerary} onChangeText={set('itinerary')} placeholder={o.itineraryPlaceholder} multiline />
          <Field label={o.includes} value={f.includes} onChangeText={set('includes')} multiline />
          <Field label={o.excludes} value={f.excludes} onChangeText={set('excludes')} multiline />
          <Field label={o.validUntil} value={f.validUntil} onChangeText={set('validUntil')} placeholder="2027-01-31" />
          <FormMessage message={message} />
          <Button title={offer && offer.status === 'sent' ? o.update : o.send} onPress={submit} loading={busy} />
          {offer?.status === 'sent' && (
            <Button
              title={o.withdraw}
              variant="outline"
              size="md"
              onPress={async () => {
                await withdrawOffer(offer.id);
                await refresh();
              }}
            />
          )}
        </Card>
      )}
    </View>
  );
}
