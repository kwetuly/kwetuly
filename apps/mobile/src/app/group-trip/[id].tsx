import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Link, Stack, router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EVENTS, specialtyPhoto, formatPhone, formatUsd, groupPriceOnRequest } from '@kwetuly/shared';
import { photoSource } from '@/lib/photos';
import { track } from '@/lib/analytics';
import { SpotsBar } from '@/components/cards';
import { TripRequests } from '@/components/trip-requests';
import { PayDeposit } from '@/components/pay-deposit';
import { GLYPHS } from '@/components/glyph';
import { Badge, BottomBar, Button, Card, DetailRow, EmptyState, ErrorText, Field, HeaderIconButton, Muted, ScreenState, SectionTitle, SuccessCheck, contentFadeIn } from '@/components/ui';
import { cancelGroupRequest, getGroupContact, getGroupTrip, getMyGroupRequest, requestToJoin } from '@/lib/api';
import { useProfile, useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useNeedsSetup, welcomeHref } from '@/lib/onboarding';
import { formatDateRange, languageName, specialtyName } from '@/lib/labels';
import { shareLink } from '@/lib/share';
import { supabase } from '@/lib/supabase';
import { brand, colors, control, layout, media, space } from '@/theme';
import { useType } from '@/lib/use-type';

export default function GroupTripScreen() {
  const { type, font } = useType();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const { session } = useSession();
  const profile = useProfile();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  const trip = useQuery({ queryKey: ['group-trip', id], queryFn: () => getGroupTrip(id) });
  const mine = useQuery({ queryKey: ['group-request', id, userId], queryFn: () => getMyGroupRequest(id, userId!), enabled: !!userId });
  const contact = useQuery({ queryKey: ['group-contact', id, userId], queryFn: () => getGroupContact(id), enabled: mine.data?.status === 'accepted' });
  const chat = useQuery({
    queryKey: ['trip-chat', id, userId],
    enabled: !!userId,
    queryFn: async () => (await supabase.from('group_chats').select('id').eq('group_trip_id', id).maybeSingle()).data,
  });

  const [seats, setSeats] = useState('1');
  const [message, setMessage] = useState('');
  const [contactInput, setContactInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Set after this person's own join request succeeds, so the check ticks the phone once (not on every visit).
  const [justJoined, setJustJoined] = useState(false);

  const needsSetup = useNeedsSetup();
  // Not found (deleted, or not public): say so plainly and offer the way back to all group trips.
  if (!trip.data)
    return (
      <ScreenState
        screen
        loading={trip.isLoading}
        error={trip.error}
        onRetry={() => trip.refetch()}
        empty
        emptyText={t.ux.notFoundTitle}
        emptyGlyph={GLYPHS.calendarClosed}
        emptyAction={{ label: t.groups.title, onPress: () => router.push('/trips') }}
      />
    );
  const g = trip.data;
  const g10n = t.groups;
  const left = Math.max(g.max_people - g.seats_taken - (g.already_going ?? 0), 0);
  const open = g.status === 'approved' && !g.cancelled && g.start_date >= new Date().toISOString().slice(0, 10) && left > 0;
  const isOrganizer = userId === g.organizer_id;

  async function join() {
    if (!userId) return router.push('/sign-in');
    if (needsSetup) return router.push(welcomeHref(`/group-trip/${id}`));
    setBusy(true);
    setError('');
    try {
      await requestToJoin(id, userId, {
        name: profile.data?.full_name ?? session?.user.email ?? 'Traveller',
        contact: contactInput.trim() || profile.data?.phone || session?.user.email || '',
        seats: Math.min(Math.max(parseInt(seats, 10) || 1, 1), Math.max(left, 1)),
        message: message.trim(),
      });
      track(EVENTS.groupTripJoined, { trip: id });
      setJustJoined(true);
      await queryClient.invalidateQueries({ queryKey: ['group-request', id] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!userId) return;
    await cancelGroupRequest(id, userId);
    queryClient.invalidateQueries({ queryKey: ['group-request', id] });
  }

  const state = isOrganizer ? 'organiser' : mine.data?.status === 'accepted' ? 'accepted' : mine.data?.status === 'requested' ? 'requested' : open ? 'open' : 'closed';
  // Only the open state has a bottom bar: Join is the screen's one filled button.
  const showBar = state === 'open';
  const priceOnRequest = groupPriceOnRequest(g);
  const photo = specialtyPhoto(g.specialty);
  const details = [
    g.meeting_point ? { label: g10n.meeting, value: g.meeting_point } : null,
    { label: g10n.minPeople, value: `${g.min_people} ${g10n.people}` },
    g.languages.length > 0 ? { label: t.guides.languages, value: g.languages.map(languageName).join(', ') } : null,
    g.includes ? { label: g10n.includes, value: g.includes } : null,
  ].filter((row): row is { label: string; value: string } => !!row);

  return (
    // iOS pads, Android shrinks the screen, so the bottom bar stays above the keyboard on both.
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.background }} contentContainerStyle={{ gap: space.lg, paddingBottom: space.xxxl }}>
      <Stack.Title>{g.title}</Stack.Title>
      {g.status === 'approved' && !g.cancelled && (
        <HeaderIconButton glyph={GLYPHS.share} accessibilityLabel={t.share.share} onPress={() => shareLink(`/${locale}/group-trips/${g.id}`, `${t.share.shareGroup}: ${g.title}`)} />
      )}
      <Image source={photoSource(photo)} style={{ backgroundColor: colors.fill, height: media.detailPhoto }} contentFit="cover" accessibilityLabel={photo.alt} />

      <Animated.View entering={contentFadeIn} style={{ paddingHorizontal: layout.screenX, gap: space.lg }}>
        {/* Shown first, so an organiser who has just submitted sees where the trip stands. A traveller's trip
            waits for Kwetuly's call to the account phone before it can be approved and go live. */}
        {/* A live traveller trip is hidden again if the organiser changes their phone, until Kwetuly calls. */}
        {isOrganizer && g.organizer_kind === 'traveller' && g.status === 'approved' && !g.cancelled && (
          <Card>
            <Muted>{t.extras.phoneChangeNote}</Muted>
          </Card>
        )}
        {isOrganizer && g.status === 'pending' && !g.cancelled && (
          <Card>
            <Muted>
              {g.organizer_kind === 'traveller' && !profile.data?.phone_called_at && profile.data?.phone
                ? t.extras.groupWaitingCall.replace('{phone}', formatPhone(profile.data.phone))
                : g10n.statusPending}
            </Muted>
          </Card>
        )}
        <Card>
          <Text style={{ ...type.label, color: brand.link }}>{specialtyName(g.specialty, locale)}</Text>
          {g.guides?.is_sample && <Badge label={t.extras.sampleTrip} tone="sand" />}
          <Text accessibilityRole="header" style={type.title2}>{g.title}</Text>
          <View style={{ gap: space.xxs }}>
            <Text style={type.meta}>{formatDateRange(g.start_date, g.end_date, locale)}</Text>
            <Text style={type.meta}>{g.region}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: space.sm }}>
            <Text style={{ ...type.title1, color: brand.primary, fontVariant: ['tabular-nums'] }}>{priceOnRequest ? t.extras.priceOnRequest : formatUsd(g.price_per_person_usd)}</Text>
            {!priceOnRequest && <Text style={type.meta}>{g10n.perPerson}</Text>}
          </View>
          <SpotsBar taken={g.seats_taken + (g.already_going ?? 0)} max={g.max_people} labels={g10n} />
          {g.guides ? (
            <Link href={`/guide/${g.guides.slug}`} asChild>
              <Pressable accessibilityRole="link" style={({ pressed }) => ({ minHeight: control.touch, justifyContent: 'center', alignSelf: 'flex-start', opacity: pressed ? 0.6 : 1 })}>
                <Text style={type.link}>
                  {g10n.organisedBy} {g.guides.display_name}
                </Text>
              </Pressable>
            </Link>
          ) : (
            g.organizer_kind === 'traveller' ? <Muted>{t.extras.byTraveller}</Muted> : g.company_name && <Muted>{g10n.organisedBy} {g.company_name}</Muted>
          )}
          {g.guides?.is_sample && <Muted>{t.extras.sampleTripNote}</Muted>}
        </Card>

        <Card>
          <Text selectable style={type.callout}>{g.description}</Text>
          {details.map((row) => (
            <View key={row.label} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md }}>
              <DetailRow label={row.label} value={row.value} selectable />
            </View>
          ))}
        </Card>

        <Card>
          {state === 'organiser' ? (
            <EmptyState glyph={GLYPHS.calendar} text={g10n.organising} />
          ) : state === 'accepted' ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <SuccessCheck />
                <Text style={{ ...type.cardTitle, flex: 1 }}>{g10n.accepted}</Text>
              </View>
              {contact.data && <Text selectable style={type.title3}>{contact.data}</Text>}
              <PayDeposit kind="group" id={mine.data!.id} totalUsd={(mine.data!.price_per_person_usd ?? g.price_per_person_usd) * mine.data!.seats} percent={g.deposit_percent} />
            </>
          ) : state === 'requested' ? (
            <>
              <View accessibilityRole={justJoined ? 'alert' : undefined} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <SuccessCheck haptic={justJoined} />
                <Text style={{ ...type.body, ...font.semibold, flex: 1 }}>{g10n.requested}</Text>
              </View>
              <Button title={g10n.cancel} variant="outline" size="md" onPress={cancel} />
            </>
          ) : state === 'open' ? (
            <>
              <SectionTitle>{mine.data?.status === 'cancelled' ? g10n.askAgain : g10n.joinTitle}</SectionTitle>
              {mine.data?.status === 'declined' && <Muted>{g10n.declined}</Muted>}
              <Muted>{g10n.joinBody}</Muted>
              <Field label={g10n.seats} value={seats} onChangeText={setSeats} keyboardType="number-pad" />
              <Field label={t.profile.contact} value={contactInput} onChangeText={setContactInput} placeholder={profile.data?.phone ?? undefined} />
              <Field label={g10n.message} value={message} onChangeText={setMessage} multiline />
            </>
          ) : (
            <EmptyState glyph={GLYPHS.calendarClosed} text={g.cancelled ? g10n.cancelledTrip : g10n.closed} />
          )}
          {chat.data && <Button title={t.chats.openChat} variant="outline" size="md" icon={GLYPHS.chat} onPress={() => router.push(`/chat/${chat.data!.id}`)} />}
          <Text style={type.caption}>{g10n.payNote}</Text>
        </Card>

        {isOrganizer && (
          <>
            <TripRequests tripId={g.id} cancelled={g.cancelled} />
          </>
        )}
      </Animated.View>
    </ScrollView>
    {showBar && (
      <BottomBar>
        <ErrorText>{error}</ErrorText>
        <Button title={userId ? g10n.joinCta : g10n.signInToJoin} onPress={join} loading={busy} />
      </BottomBar>
    )}
    </KeyboardAvoidingView>
  );
}
