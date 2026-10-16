// Data access for the app. Everything goes through Supabase with the signed-in user's session,
// so row-level security decides what each person can see and do (exactly as on the website).
import { randomUUID } from 'expo-crypto';
import { PLACE_COLUMNS, STOP_COLUMNS, TOUR_COLUMNS, guideSpecialtiesForTour, type Place, type Tour as SharedTour, type TourStop } from '@rafrika/shared';
import { supabase } from './supabase';

export type Guide = {
  id: string;
  owner_id: string;
  slug: string;
  display_name: string;
  photo_url: string | null;
  headline: string | null;
  bio: string | null;
  base_region: string;
  regions: string[];
  specialties: string[];
  expertise: string[];
  female_guide: boolean;
  open_to_partners: boolean;
  rating_avg: number | null;
  rating_count: number;
  languages: string[];
  max_group_size: number;
  years_experience: number | null;
  summits: number | null;
  certifications: string[];
  association: string | null;
  plan: 'msingi' | 'pro';
  verification_status: 'pending' | 'approved' | 'rejected';
  call_enabled: boolean;
  call_price_usd: number | null;
  call_minutes: number;
  call_topics: string[];
  identity_checked_at: string | null;
  licence_checked_at: string | null;
  first_aid_checked_at: string | null;
  first_aid_valid_until: string | null;
  is_sample: boolean;
};

const GUIDE_COLUMNS =
  'id, owner_id, slug, display_name, photo_url, headline, bio, base_region, regions, specialties, expertise, female_guide, open_to_partners, rating_avg, rating_count, languages, max_group_size, years_experience, summits, certifications, association, plan, verification_status, call_enabled, call_price_usd, call_minutes, call_topics, identity_checked_at, licence_checked_at, first_aid_checked_at, first_aid_valid_until, is_sample';

export type GuideFilters = { specialty?: string; language?: string; expertise?: string; female?: boolean; partners?: boolean };

function must<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export async function listGuides(filters: GuideFilters): Promise<Guide[]> {
  let query = supabase
    .from('guides')
    .select(GUIDE_COLUMNS)
    .eq('verification_status', 'approved')
    .eq('visibility', 'public')
    .order('plan', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(60);
  if (filters.specialty) query = query.contains('specialties', [filters.specialty]);
  if (filters.language) query = query.contains('languages', [filters.language]);
  if (filters.expertise) query = query.contains('expertise', [filters.expertise]);
  if (filters.female) query = query.eq('female_guide', true);
  if (filters.partners) query = query.eq('open_to_partners', true);
  return must(await query) as unknown as Guide[];
}

export async function getGuide(slug: string): Promise<Guide | null> {
  return must(await supabase.from('guides').select(GUIDE_COLUMNS).eq('slug', slug).eq('verification_status', 'approved').maybeSingle()) as Guide | null;
}

export type Review = { id: string; author_name: string; rating: number; body: string; created_at: string };

export async function listReviews(guideId: string): Promise<Review[]> {
  return must(
    await supabase.from('guide_reviews').select('id, author_name, rating, body, created_at').eq('guide_id', guideId).order('created_at', { ascending: false }).limit(50),
  ) as Review[];
}

// ---------------------------------------------------------------------------
// Tours (the trip catalogue) and group trips
// ---------------------------------------------------------------------------
export type Tour = SharedTour;
export type TourOperator = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  location: string | null;
  licence_number: string | null;
  licence_authority: string | null;
  licence_checked_at: string | null;
  tripadvisor_url: string | null;
  tripadvisor_rating: number | null;
  tripadvisor_reviews: number | null;
  tripadvisor_checked_at: string | null;
  verified_at: string | null;
};

/** Every published tour, Signature Trips first. Screens filter it in memory (the catalogue is small). */
export async function listTours(): Promise<Tour[]> {
  return must(
    await supabase
      .from('trips')
      .select(TOUR_COLUMNS)
      .eq('status', 'published')
      .order('is_signature', { ascending: false })
      .order('sort_order', { ascending: true })
      .limit(300),
  ) as unknown as Tour[];
}

export async function getTourStops(tripId: string): Promise<TourStop[]> {
  return must(await supabase.from('trip_stops').select(STOP_COLUMNS).eq('trip_id', tripId).order('position')) as TourStop[];
}

/** Guides assigned to the tour, or verified guides whose specialties fit it when none are assigned. */
export async function getTourGuides(tripId: string, categories: string[]): Promise<{ assigned: boolean; guides: Guide[] }> {
  const rows = must(await supabase.from('trip_guides').select(`position, guides(${GUIDE_COLUMNS})`).eq('trip_id', tripId).order('position')) as unknown as { guides: Guide | null }[];
  const chosen = rows.map((r) => r.guides).filter((g): g is Guide => g != null && g.verification_status === 'approved');
  if (chosen.length > 0) return { assigned: true, guides: chosen };
  const specialties = guideSpecialtiesForTour(categories);
  if (specialties.length === 0) return { assigned: false, guides: [] };
  const guides = must(
    await supabase
      .from('guides')
      .select(GUIDE_COLUMNS)
      .eq('verification_status', 'approved')
      .eq('visibility', 'public')
      .overlaps('specialties', specialties)
      .order('rating_count', { ascending: false })
      .limit(4),
  ) as unknown as Guide[];
  return { assigned: false, guides };
}

export async function listSavedTourIds(userId: string): Promise<string[]> {
  return (must(await supabase.from('saved_trips').select('trip_id').eq('user_id', userId)) as { trip_id: string }[]).map((r) => r.trip_id);
}

export async function setTourSaved(userId: string, tripId: string, saved: boolean) {
  const { error } = saved
    ? await supabase.from('saved_trips').upsert({ user_id: userId, trip_id: tripId })
    : await supabase.from('saved_trips').delete().eq('user_id', userId).eq('trip_id', tripId);
  if (error) throw new Error(error.message);
}

const OPERATOR_COLUMNS =
  'id, slug, name, logo_url, description, website, contact_email, contact_phone, location, licence_number, licence_authority, licence_checked_at, tripadvisor_url, tripadvisor_rating, tripadvisor_reviews, tripadvisor_checked_at, verified_at';

export async function listOperators(): Promise<TourOperator[]> {
  return must(await supabase.from('tour_operators').select(OPERATOR_COLUMNS).eq('status', 'published').order('name')) as TourOperator[];
}

export async function getOperator(slug: string): Promise<TourOperator | null> {
  return must(await supabase.from('tour_operators').select(OPERATOR_COLUMNS).eq('slug', slug).maybeSingle()) as TourOperator | null;
}

export type GroupTrip = {
  id: string;
  organizer_id: string;
  company_name: string | null;
  organizer_kind: 'guide' | 'business' | 'traveller';
  already_going: number;
  title: string;
  description: string;
  specialty: string;
  region: string;
  meeting_point: string | null;
  start_date: string;
  end_date: string;
  price_per_person_usd: number;
  deposit_percent: number;
  min_people: number;
  max_people: number;
  languages: string[];
  includes: string | null;
  seats_taken: number;
  status: 'pending' | 'approved' | 'rejected';
  cancelled: boolean;
  guides: { display_name: string; slug: string; photo_url: string | null } | null;
};

const GROUP_COLUMNS =
  'id, organizer_id, company_name, organizer_kind, already_going, title, description, specialty, region, meeting_point, start_date, end_date, price_per_person_usd, min_people, max_people, languages, includes, seats_taken, deposit_percent, status, cancelled, guides(display_name, slug, photo_url)';

export async function listGroupTrips(): Promise<GroupTrip[]> {
  const today = new Date().toISOString().slice(0, 10);
  return must(
    await supabase.from('group_trips').select(GROUP_COLUMNS).eq('status', 'approved').eq('cancelled', false).gte('start_date', today).order('start_date').limit(60),
  ) as unknown as GroupTrip[];
}

export async function getGroupTrip(id: string): Promise<GroupTrip | null> {
  return must(await supabase.from('group_trips').select(GROUP_COLUMNS).eq('id', id).maybeSingle()) as unknown as GroupTrip | null;
}

/** price_per_person_usd: the price saved when the request was accepted (charged for the deposit). */
export type MyGroupRequest = { id: string; status: 'requested' | 'accepted' | 'declined' | 'cancelled'; seats: number; price_per_person_usd?: number | null } | null;

export async function getMyGroupRequest(tripId: string, userId: string): Promise<MyGroupRequest> {
  // '*' so this keeps working before the price_per_person_usd column (20261016001400) exists.
  return must(await supabase.from('group_trip_members').select('*').eq('group_trip_id', tripId).eq('traveler_id', userId).maybeSingle()) as MyGroupRequest;
}

/** The organiser's contact; the database only returns it to accepted travellers. */
export async function getGroupContact(tripId: string): Promise<string | null> {
  const { data } = await supabase.from('group_trip_private').select('contact').eq('group_trip_id', tripId).maybeSingle();
  return data?.contact ?? null;
}

export async function requestToJoin(tripId: string, userId: string, request: { name: string; contact: string; seats: number; message: string }) {
  const values = { traveler_name: request.name, traveler_contact: request.contact, seats: request.seats, message: request.message || null };
  const existing = await getMyGroupRequest(tripId, userId);
  const result = existing
    ? await supabase.from('group_trip_members').update({ ...values, status: 'requested' }).eq('group_trip_id', tripId).eq('traveler_id', userId)
    : await supabase.from('group_trip_members').insert({ ...values, group_trip_id: tripId, traveler_id: userId });
  if (result.error) throw new Error(result.error.message);
}

export async function cancelGroupRequest(tripId: string, userId: string) {
  const { error } = await supabase.from('group_trip_members').update({ status: 'cancelled' }).eq('group_trip_id', tripId).eq('traveler_id', userId);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// One-to-one conversations with guides
// ---------------------------------------------------------------------------
export type Conversation = {
  id: string;
  traveler_id: string;
  traveler_name: string | null;
  contact_unlocked: boolean;
  last_message_at: string;
  last_message_preview: string | null;
  traveler_last_read_at: string | null;
  guide_last_read_at: string | null;
  guides: { display_name: string; slug: string; photo_url: string | null } | null;
};

export async function listConversations(): Promise<Conversation[]> {
  return must(
    await supabase
      .from('conversations')
      .select('id, traveler_id, traveler_name, contact_unlocked, last_message_at, last_message_preview, traveler_last_read_at, guide_last_read_at, guides(display_name, slug, photo_url)')
      .order('last_message_at', { ascending: false })
      .limit(100),
  ) as unknown as Conversation[];
}

export function conversationView(c: Conversation, userId: string) {
  const isTraveler = c.traveler_id === userId;
  const otherName = isTraveler ? (c.guides?.display_name ?? 'Guide') : (c.traveler_name ?? 'Traveller');
  const lastRead = isTraveler ? c.traveler_last_read_at : c.guide_last_read_at;
  return { isTraveler, otherName, unread: !lastRead || c.last_message_at > lastRead };
}

/** Opens the traveller's conversation with a guide, creating it the first time. */
export async function openConversation(guideId: string, userId: string): Promise<string> {
  const existing = must(await supabase.from('conversations').select('id').eq('traveler_id', userId).eq('guide_id', guideId).maybeSingle()) as { id: string } | null;
  if (existing) return existing.id;
  const created = must(await supabase.from('conversations').insert({ traveler_id: userId, guide_id: guideId }).select('id').single()) as { id: string };
  return created.id;
}

export type Message = { id: string; sender_id: string; body: string; created_at: string };

export async function listMessages(conversationId: string): Promise<Message[]> {
  return must(
    await supabase.from('messages').select('id, sender_id, body, created_at').eq('conversation_id', conversationId).order('created_at').limit(500),
  ) as Message[];
}

export async function sendMessage(conversationId: string, senderId: string, body: string) {
  const { error } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: senderId, body });
  if (error) throw new Error(error.message);
}

export async function markConversationRead(conversationId: string, isTraveler: boolean) {
  const now = new Date().toISOString();
  await supabase.from('conversations').update(isTraveler ? { traveler_last_read_at: now } : { guide_last_read_at: now }).eq('id', conversationId);
}

// ---------------------------------------------------------------------------
// Group chats with photos and videos
// ---------------------------------------------------------------------------
export type GroupChat = { id: string; name: string; group_trip_id: string | null; invite_code: string; last_message_at: string };

export async function listGroupChats(userId: string): Promise<(GroupChat & { unread: boolean })[]> {
  const rows = must(
    await supabase.from('group_chat_members').select('last_read_at, group_chats(id, name, group_trip_id, invite_code, last_message_at)').eq('user_id', userId),
  ) as unknown as { last_read_at: string; group_chats: GroupChat | null }[];
  return rows
    .filter((r) => r.group_chats)
    .map((r) => ({ ...r.group_chats!, unread: r.group_chats!.last_message_at > r.last_read_at }))
    .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
}

export async function getGroupChat(id: string) {
  const [chat, members] = await Promise.all([
    supabase.from('group_chats').select('id, name, group_trip_id, invite_code, last_message_at').eq('id', id).maybeSingle(),
    supabase.from('group_chat_members').select('user_id, display_name, role').eq('chat_id', id).order('joined_at'),
  ]);
  return { chat: must(chat) as GroupChat | null, members: (must(members) ?? []) as { user_id: string; display_name: string; role: string }[] };
}

export type ChatMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string | null;
  media_path: string | null;
  media_type: 'image' | 'video' | null;
  share_public: boolean;
  featured: boolean;
  created_at: string;
  media_url: string | null;
  objectors: string[];
};

export async function listChatMessages(chatId: string): Promise<ChatMessage[]> {
  const rows = must(
    await supabase
      .from('group_chat_messages')
      .select('id, sender_id, sender_name, body, media_path, media_type, share_public, featured, created_at')
      .eq('chat_id', chatId)
      .order('created_at')
      .limit(300),
  ) as Omit<ChatMessage, 'media_url' | 'objectors'>[];
  const paths = rows.map((r) => r.media_path).filter((p): p is string => !!p);
  const shared = rows.filter((r) => r.share_public).map((r) => r.id);
  const [signed, objections] = await Promise.all([
    paths.length ? supabase.storage.from('chat-media').createSignedUrls(paths, 60 * 60) : Promise.resolve({ data: [] }),
    shared.length ? supabase.from('group_chat_objections').select('message_id, user_id').in('message_id', shared) : Promise.resolve({ data: [] }),
  ]);
  const urls = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
  const byMessage = new Map<string, string[]>();
  for (const o of (objections.data ?? []) as { message_id: string; user_id: string }[]) {
    byMessage.set(o.message_id, [...(byMessage.get(o.message_id) ?? []), o.user_id]);
  }
  return rows.map((r) => ({ ...r, media_url: r.media_path ? urls.get(r.media_path) ?? null : null, objectors: byMessage.get(r.id) ?? [] }));
}

/** Uploads a photo/video from the phone into this chat's private folder, then posts the message. */
export async function sendChatMessage(chatId: string, userId: string, input: { body: string; media?: { uri: string; mimeType: string; kind: 'image' | 'video' }; sharePublic: boolean }) {
  let media_path: string | null = null;
  if (input.media) {
    const extension = input.media.mimeType.split('/')[1]?.replace('quicktime', 'mov').replace('jpeg', 'jpg') ?? 'bin';
    media_path = `${chatId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
    const bytes = await (await fetch(input.media.uri)).arrayBuffer();
    const upload = await supabase.storage.from('chat-media').upload(media_path, bytes, { contentType: input.media.mimeType, upsert: false });
    if (upload.error) throw new Error(upload.error.message);
  }
  const { error } = await supabase.from('group_chat_messages').insert({
    chat_id: chatId,
    sender_id: userId,
    sender_name: 'self', // the database sets the real name from the profile
    body: input.body.trim() || null,
    media_path,
    media_type: input.media?.kind ?? null,
    share_public: input.sharePublic,
  });
  if (error) throw new Error(error.message);
}

export async function setShareConsent(messageId: string, sharePublic: boolean) {
  const { error } = await supabase.from('group_chat_messages').update({ share_public: sharePublic }).eq('id', messageId);
  if (error) throw new Error(error.message);
}

export async function setObjection(messageId: string, userId: string, object: boolean) {
  const { error } = object
    ? await supabase.from('group_chat_objections').insert({ message_id: messageId, user_id: userId })
    : await supabase.from('group_chat_objections').delete().eq('message_id', messageId).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function deleteChatMessage(message: ChatMessage) {
  if (message.media_path) await supabase.storage.from('chat-media').remove([message.media_path]);
  const { error } = await supabase.from('group_chat_messages').delete().eq('id', message.id);
  if (error) throw new Error(error.message);
}

export async function createGroupChat(name: string, userId: string): Promise<string> {
  const id = randomUUID();
  const { error } = await supabase.from('group_chats').insert({ id, name, created_by: userId });
  if (error) throw new Error(error.message);
  return id;
}

export async function joinGroupChat(codeOrLink: string): Promise<string> {
  const code = codeOrLink.trim().split('/').filter(Boolean).pop() ?? '';
  const { data, error } = await supabase.rpc('join_group_chat', { p_code: code });
  if (error || !data) throw new Error(error?.message ?? 'Invite not found');
  return data as string;
}

export async function markChatRead(chatId: string, userId: string) {
  await supabase.from('group_chat_members').update({ last_read_at: new Date().toISOString() }).eq('chat_id', chatId).eq('user_id', userId);
}

/** Approved, public guides who offer 1-on-1 prep calls, optionally for one topic. */
export async function listCallGuides(topic?: string): Promise<Guide[]> {
  let query = supabase.from('guides').select(GUIDE_COLUMNS).eq('verification_status', 'approved').eq('visibility', 'public').eq('call_enabled', true).order('plan', { ascending: false }).limit(60);
  if (topic) query = query.contains('call_topics', [topic]);
  return must(await query) as unknown as Guide[];
}

// ---------------------------------------------------------------------------
// Places: guides to the parks and sites tours visit
// ---------------------------------------------------------------------------
export async function listPlaces(): Promise<Place[]> {
  return must(await supabase.from('places').select(PLACE_COLUMNS).eq('status', 'published').order('name')) as Place[];
}

export async function getPlace(slug: string): Promise<Place | null> {
  return must(await supabase.from('places').select(PLACE_COLUMNS).eq('slug', slug).maybeSingle()) as Place | null;
}

/** Ids of the published tours with a stop at this place. */
export async function tourIdsVisiting(placeId: string): Promise<string[]> {
  const rows = must(await supabase.from('trip_stops').select('trip_id').eq('place_id', placeId)) as { trip_id: string }[];
  return [...new Set(rows.map((r) => r.trip_id))];
}
