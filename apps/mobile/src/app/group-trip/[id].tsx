import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { Link, Stack, router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { photoUrl, specialtyPhoto } from '@rafrika/shared';
import { SpotsBar } from '@/components/cards';
import { TripRequests } from '@/components/trip-requests';
import { Button, Card, Muted, ScreenState, SectionTitle } from '@/components/ui';
import { cancelGroupRequest, getGroupContact, getGroupTrip, getMyGroupRequest, requestToJoin } from '@/lib/api';
import { useProfile, useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { formatDateRange, languageName, specialtyName } from '@/lib/labels';
import { shareLink } from '@/lib/share';
import { supabase } from '@/lib/supabase';
import { brand, colors, radius } from '@/theme/colors';

const input = { backgroundColor: colors.background, borderRadius: radius.button, borderCurve: 'continuous' as const, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.label };

export default function GroupTripScreen() {
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

  if (!trip.data) return <ScreenState loading={trip.isLoading} error={trip.error} empty emptyText={t.groups.closed} />;
  const g = trip.data;
  const g10n = t.groups;
  const left = Math.max(g.max_people - g.seats_taken, 0);
  const open = g.status === 'approved' && !g.cancelled && g.start_date >= new Date().toISOString().slice(0, 10) && left > 0;
  const isOrganizer = userId === g.organizer_id;

  async function join() {
    if (!userId) return router.push('/sign-in');
    setBusy(true);
    setError('');
    try {
      await requestToJoin(id, userId, {
        name: profile.data?.full_name ?? session?.user.email ?? 'Traveller',
        contact: contactInput.trim() || profile.data?.phone || session?.user.email || '',
        seats: Math.min(Math.max(parseInt(seats, 10) || 1, 1), Math.max(left, 1)),
        message: message.trim(),
      });
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

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.background }} contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
      <Stack.Title>{g.title}</Stack.Title>
      <Image source={{ uri: photoUrl(specialtyPhoto(g.specialty), 1200) }} style={{ height: 220 }} contentFit="cover" />

      <View style={{ paddingHorizontal: 16, gap: 16 }}>
        <Card>
          <Text style={{ color: brand.sunsetDark, fontWeight: '700' }}>{specialtyName(g.specialty, locale)}</Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.label }}>{g.title}</Text>
          <Muted>
            {formatDateRange(g.start_date, g.end_date, locale)} · {g.region}
          </Muted>
          <Text style={{ fontSize: 26, fontWeight: '800', color: brand.forest }}>
            ${g.price_per_person_usd} <Text style={{ fontSize: 14, color: colors.secondaryLabel }}>{g10n.perPerson}</Text>
          </Text>
          <SpotsBar taken={g.seats_taken} max={g.max_people} labels={g10n} />
          {g.guides ? (
            <Link href={`/guide/${g.guides.slug}`} style={{ color: brand.forest, fontWeight: '700' }}>
              {g10n.organisedBy} {g.guides.display_name} ›
            </Link>
          ) : (
            g.company_name && <Muted>{g10n.organisedBy} {g.company_name}</Muted>
          )}
        </Card>

        <Card>
          <Text selectable style={{ color: colors.label, fontSize: 15, lineHeight: 22 }}>{g.description}</Text>
          {g.meeting_point && <Muted>{g10n.meeting}: {g.meeting_point}</Muted>}
          <Muted>{g10n.minPeople} {g.min_people} {g10n.people}</Muted>
          {g.languages.length > 0 && <Muted>{g.languages.map(languageName).join(' · ')}</Muted>}
          {g.includes && <Muted>{g10n.includes}: {g.includes}</Muted>}
        </Card>

        <Card>
          {isOrganizer ? (
            <Muted>{g10n.organising}</Muted>
          ) : mine.data?.status === 'accepted' ? (
            <>
              <Text style={{ fontWeight: '700', color: brand.forest }}>✓ {g10n.accepted}</Text>
              {contact.data && <Text selectable style={{ fontSize: 20, fontWeight: '800', color: colors.label }}>{contact.data}</Text>}
            </>
          ) : mine.data?.status === 'requested' ? (
            <>
              <Text style={{ fontWeight: '700', color: colors.label }}>✓ {g10n.requested}</Text>
              <Button title={g10n.cancel} variant="outline" onPress={cancel} />
            </>
          ) : open ? (
            <>
              <SectionTitle>{mine.data?.status === 'cancelled' ? g10n.askAgain : g10n.joinTitle}</SectionTitle>
              {mine.data?.status === 'declined' && <Muted>{g10n.declined}</Muted>}
              <Muted>{g10n.joinBody}</Muted>
              <TextInput value={seats} onChangeText={setSeats} keyboardType="number-pad" placeholder={g10n.seats} placeholderTextColor={colors.secondaryLabel} style={input} accessibilityLabel={g10n.seats} />
              <TextInput value={contactInput} onChangeText={setContactInput} placeholder={profile.data?.phone ?? t.profile.contact} placeholderTextColor={colors.secondaryLabel} style={input} accessibilityLabel={t.profile.contact} />
              <TextInput value={message} onChangeText={setMessage} placeholder={g10n.message} placeholderTextColor={colors.secondaryLabel} multiline style={[input, { minHeight: 80 }]} />
              {error ? <Text selectable style={{ color: '#b42318' }}>{error}</Text> : null}
              <Button title={userId ? g10n.joinCta : g10n.signInToJoin} onPress={join} loading={busy} />
            </>
          ) : (
            <Muted>{g.cancelled ? g10n.cancelledTrip : g10n.closed}</Muted>
          )}
          {chat.data && <Button title={t.chats.openChat} variant="dark" onPress={() => router.push(`/chat/${chat.data!.id}`)} />}
          <Muted>{g10n.payNote}</Muted>
        </Card>

        {isOrganizer && (
          <>
            {g.status === 'pending' && <Muted>{g10n.statusPending}</Muted>}
            <TripRequests tripId={g.id} cancelled={g.cancelled} />
          </>
        )}

        {g.status === 'approved' && !g.cancelled && (
          <Button title={t.share.share} variant="outline" onPress={() => shareLink(`/${locale}/group-trips/${g.id}`, `${t.share.shareGroup}: ${g.title}`)} />
        )}
      </View>
    </ScrollView>
  );
}
