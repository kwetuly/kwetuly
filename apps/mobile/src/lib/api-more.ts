// More data access: reviews, calls, enquiries, Guide Hub, guide profile, organiser tools and business tools.
// Same tables and rules as the website; row-level security enforces who may do what.
import { isDisplayNameReservedError, isReservedDisplayName, normaliseWebsite, normalizePhone, type GuideCheckFields } from '@kwetuly/shared';
import { supabase } from './supabase';

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

const shortName = (full: string | null | undefined) => {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  return parts.length ? `${parts[0]}${parts[1] ? ` ${parts[1][0]}.` : ''}` : 'Traveller';
};

async function bytesOf(uri: string) {
  return (await fetch(uri)).arrayBuffer();
}

// ---------------------------------------------------------------------------
// Travellers: reviews, prep calls, contacting a guide, tour enquiries, reports
// ---------------------------------------------------------------------------
/** Travellers can review a guide after an accepted/completed call or a booking (contact unlocked). */
export async function reviewStatus(guideId: string, userId: string) {
  const [calls, conversations, own] = await Promise.all([
    supabase.from('call_requests').select('id', { count: 'exact', head: true }).eq('guide_id', guideId).eq('traveler_id', userId).in('status', ['accepted', 'completed']),
    supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('guide_id', guideId).eq('traveler_id', userId).eq('contact_unlocked', true),
    supabase.from('guide_reviews').select('rating, body').eq('guide_id', guideId).eq('author_id', userId).maybeSingle(),
  ]);
  return { eligible: (calls.count ?? 0) > 0 || (conversations.count ?? 0) > 0, own: own.data as { rating: number; body: string } | null };
}

export async function submitReview(guideId: string, userId: string, fullName: string | null, rating: number, body: string) {
  const { error } = await supabase
    .from('guide_reviews')
    .upsert({ guide_id: guideId, author_id: userId, author_name: shortName(fullName).slice(0, 80), rating, body: body.trim() }, { onConflict: 'guide_id,author_id' });
  check(error);
}

export async function requestCall(input: { guideId: string; userId: string; topic: string; times: string; message: string; contact: string }) {
  // The database sets the price from the guide's profile and keeps the status at "requested".
  const { error } = await supabase.from('call_requests').insert({
    guide_id: input.guideId,
    traveler_id: input.userId,
    topic: input.topic,
    preferred_times: input.times.trim() || null,
    message: input.message.trim() || null,
    traveler_contact: input.contact.trim() || null,
  });
  check(error);
}

export type MyCall = { id: string; topic: string; status: string; scheduled_at: string | null; meeting_link: string | null; guides: { display_name: string; slug: string } | null };

export async function listMyCalls(userId: string): Promise<MyCall[]> {
  const { data, error } = await supabase
    .from('call_requests')
    .select('id, topic, status, scheduled_at, meeting_link, guides(display_name, slug)')
    .eq('traveler_id', userId)
    .order('created_at', { ascending: false });
  check(error);
  return (data ?? []) as unknown as MyCall[];
}

export async function contactGuide(input: { guideId: string; userId?: string; name: string; contact: string; message: string; packageId?: string }) {
  const { error } = await supabase.from('leads').insert({
    guide_id: input.guideId,
    package_id: input.packageId ?? null,
    traveler_id: input.userId ?? null,
    source: 'contact_form',
    traveler_name: input.name.trim(),
    traveler_contact: input.contact.trim(),
    message: input.message.trim(),
  });
  check(error);
}

export async function enquireTour(input: { tripId: string; tripTitle: string; userId?: string; name: string; contact: string; dates: string; people: string; guide?: string; message: string }) {
  const details = [`Trip: ${input.tripTitle}`, `Dates: ${input.dates || '-'}`, `People: ${input.people || '-'}`, input.guide && `Preferred guide: ${input.guide}`, input.message].filter(Boolean).join('\n');
  const { error } = await supabase.from('leads').insert({
    trip_id: input.tripId,
    traveler_id: input.userId ?? null,
    source: 'contact_form',
    traveler_name: input.name.trim(),
    traveler_contact: input.contact.trim(),
    message: details,
  });
  check(error);
}

export async function reportMessage(messageId: string, userId: string) {
  const { error } = await supabase.from('message_reports').insert({ message_id: messageId, reporter_id: userId });
  check(error);
}

// ---------------------------------------------------------------------------
// Public: traveller moments gallery, interest sign-ups and partner applications
// ---------------------------------------------------------------------------
export type Moment = { id: string; sender_name: string; body: string | null; media_path: string | null; media_type: 'image' | 'video' | null; media_url: string | null };

export async function listMoments(): Promise<Moment[]> {
  const { data, error } = await supabase
    .from('group_chat_messages')
    .select('id, sender_name, body, media_path, media_type')
    .eq('share_public', true)
    .eq('featured', true)
    .order('created_at', { ascending: false })
    .limit(60);
  check(error);
  const rows = (data ?? []) as Omit<Moment, 'media_url'>[];
  const paths = rows.map((r) => r.media_path).filter((p): p is string => !!p);
  const signed = paths.length ? await supabase.storage.from('chat-media').createSignedUrls(paths, 15 * 60) : { data: [] };
  const urls = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({ ...r, sender_name: shortName(r.sender_name), media_url: r.media_path ? urls.get(r.media_path) ?? null : null }));
}

export async function registerInterest(input: { section: string; item: string; kind: 'traveler' | 'business'; name: string; contact: string; businessName?: string; message?: string; locale: string }) {
  const { error } = await supabase.from('interest_signups').insert({
    section: input.section,
    item: input.item,
    kind: input.kind,
    name: input.name.trim(),
    contact: input.contact.trim(),
    business_name: input.businessName?.trim() || null,
    message: input.message?.trim() || null,
    locale: input.locale,
  });
  check(error);
}

// ---------------------------------------------------------------------------
// Social sign-up: finish the account (type and phone)
// ---------------------------------------------------------------------------
// While Kwetuly is invite-only, the database refuses to finish an account without a valid invite
// code (error 'invite'). Accounts that already used a code at sign-up are not asked again.
export async function completeOnboarding(role: string, phone: string, fullName: string, inviteCode = '', phoneCountry?: string) {
  // The number as typed plus the country picked next to it, saved as one international number.
  const normalized = normalizePhone(phone, phoneCountry);
  if (!normalized) throw new Error('phone');
  if (isReservedDisplayName(fullName)) throw new Error('name');
  const code = inviteCode.trim().slice(0, 200);
  const { error } = await supabase.rpc('complete_onboarding', { p_role: role, p_phone: normalized, p_full_name: fullName, p_invite_code: code || null });
  if (error?.message.includes('invite_code_invalid')) throw new Error('invite');
  if (isDisplayNameReservedError(error)) throw new Error('name');
  check(error);
}

/** True while sign-up needs an invite code (site setting 'invite_only'). */
export async function getInviteOnly(): Promise<boolean> {
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'invite_only').maybeSingle<{ value: { enabled?: boolean } }>();
  return data?.value?.enabled === true;
}

// ---------------------------------------------------------------------------
// Guide Hub
// ---------------------------------------------------------------------------
export type MyGuide = {
  id: string;
  slug: string;
  display_name: string;
  photo_url: string | null;
  headline: string | null;
  bio: string | null;
  base_region: string;
  regions: string[];
  specialties: string[];
  languages: string[];
  expertise: string[];
  female_guide: boolean;
  open_to_partners: boolean;
  max_group_size: number;
  years_experience: number | null;
  summits: number | null;
  certifications: string[];
  association: string | null;
  has_vehicle: boolean;
  visibility: 'public' | 'link_only';
  verification_status: 'pending' | 'approved' | 'rejected';
  call_enabled: boolean;
  call_price_usd: number | null;
  call_minutes: number;
  call_topics: string[];
} & GuideCheckFields;

export type GuidePrivate = {
  phone: string | null;
  whatsapp_number: string | null;
  registration_number: string | null;
  kinapa_tanapa_id: string | null;
  id_document_path: string | null;
  license_document_path: string | null;
  first_aid_document_path: string | null;
};
type DocumentPath = 'id_document_path' | 'license_document_path' | 'first_aid_document_path';

export async function getMyGuide(userId: string): Promise<{ guide: MyGuide | null; details: GuidePrivate | null }> {
  const { data: guide, error } = await supabase
    .from('guides')
    .select('id, slug, display_name, photo_url, headline, bio, base_region, regions, specialties, languages, expertise, female_guide, open_to_partners, max_group_size, years_experience, summits, certifications, association, has_vehicle, visibility, verification_status, call_enabled, call_price_usd, call_minutes, call_topics, identity_checked_at, licence_checked_at, first_aid_checked_at, first_aid_valid_until')
    .eq('owner_id', userId)
    .maybeSingle();
  check(error);
  if (!guide) return { guide: null, details: null };
  const { data: details } = await supabase.from('guide_private').select('phone, whatsapp_number, registration_number, kinapa_tanapa_id, id_document_path, license_document_path, first_aid_document_path').eq('guide_id', guide.id).maybeSingle();
  return { guide: guide as MyGuide, details: (details as GuidePrivate | null) ?? null };
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

type Upload = { uri: string; mimeType: string };
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

/** Creates or updates the guide profile, with optional new photo and documents (same rules as the website). */
export async function saveGuideProfile(
  userId: string,
  profile: Omit<MyGuide, 'id' | 'verification_status' | 'photo_url' | keyof GuideCheckFields> & { photo_url?: string | null },
  details: Omit<GuidePrivate, DocumentPath>,
  uploads: { photo?: Upload; idDocument?: Upload; licenceDocument?: Upload; firstAidDocument?: Upload },
) {
  const guide = { ...profile, owner_id: userId, slug: slugify(profile.slug || profile.display_name) };
  if (uploads.photo) {
    const ext = EXTENSIONS[uploads.photo.mimeType] ?? 'jpg';
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, await bytesOf(uploads.photo.uri), { contentType: uploads.photo.mimeType });
    check(error);
    guide.photo_url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  }
  const { data: saved, error } = await supabase.from('guides').upsert(guide, { onConflict: 'owner_id' }).select('id').single();
  if (error?.code === '23505') throw new Error('slug');
  // 23514: a database check refused the row, which on guides means a profile link saved before the checks.
  if (error?.code === '23514') throw new Error('links');
  check(error);

  const privateData: Record<string, string | null> = { guide_id: saved!.id, ...details };
  // Private documents go to the verification bucket; a new one clears its public check until an admin looks again.
  const documents: { upload?: Upload; prefix: string; column: DocumentPath; check: keyof GuideCheckFields }[] = [
    { upload: uploads.idDocument, prefix: 'guide-id', column: 'id_document_path', check: 'identity_checked_at' },
    { upload: uploads.licenceDocument, prefix: 'guide-licence', column: 'license_document_path', check: 'licence_checked_at' },
    { upload: uploads.firstAidDocument, prefix: 'guide-first-aid', column: 'first_aid_document_path', check: 'first_aid_checked_at' },
  ];
  const cleared: Partial<Record<keyof GuideCheckFields, null>> = {};
  for (const doc of documents) {
    if (!doc.upload) continue;
    const ext = EXTENSIONS[doc.upload.mimeType] ?? 'jpg';
    const path = `${userId}/${doc.prefix}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('verification').upload(path, await bytesOf(doc.upload.uri), { contentType: doc.upload.mimeType });
    check(uploadError);
    privateData[doc.column] = path;
    cleared[doc.check] = null;
  }
  check((await supabase.from('guide_private').upsert(privateData)).error);
  if (Object.keys(cleared).length > 0) check((await supabase.from('guides').update(cleared).eq('id', saved!.id)).error);
}

export type HubCall = { id: string; topic: string; preferred_times: string | null; message: string | null; traveler_contact: string | null; status: string; scheduled_at: string | null; price_usd: number | null; created_at: string };
export type HubLead = { id: string; traveler_name: string; traveler_contact: string; message: string | null; created_at: string; guide_packages: { title: string } | null };

export async function listHubInbox(guideId: string) {
  const [calls, leads] = await Promise.all([
    supabase.from('call_requests').select('id, topic, preferred_times, message, traveler_contact, status, scheduled_at, price_usd, created_at').eq('guide_id', guideId).order('created_at', { ascending: false }).limit(50),
    supabase.from('leads').select('id, traveler_name, traveler_contact, message, created_at, guide_packages(title)').eq('guide_id', guideId).order('created_at', { ascending: false }).limit(50),
  ]);
  check(calls.error ?? leads.error);
  return { calls: (calls.data ?? []) as HubCall[], leads: (leads.data ?? []) as unknown as HubLead[] };
}

export async function respondToCall(callId: string, accept: boolean, scheduledAt?: string, meetingLink?: string) {
  const update: Record<string, string | null> = { status: accept ? 'accepted' : 'declined' };
  if (accept) {
    const when = scheduledAt ? new Date(scheduledAt) : null;
    update.scheduled_at = when && !Number.isNaN(when.getTime()) ? when.toISOString() : null;
    const link = normaliseWebsite(meetingLink);
    update.meeting_link = link.ok ? link.url : null;
  }
  check((await supabase.from('call_requests').update(update).eq('id', callId)).error);
}

export type HubPost = { id: string; title: string; body: string; region: string | null; source?: string | null; author_name: string | null; created_at: string; hub_replies?: { count: number }[] };
export type HubReply = { id: string; body: string; author_name: string | null; created_at: string };

export async function listHubPosts(kind: 'forum' | 'news'): Promise<HubPost[]> {
  const columns = kind === 'forum' ? 'id, title, body, region, author_name, created_at, hub_replies(count)' : 'id, title, body, region, source, author_name, created_at';
  const { data, error } = await supabase.from('hub_posts').select(columns).eq('kind', kind).order('created_at', { ascending: false }).limit(60);
  check(error);
  return (data ?? []) as unknown as HubPost[];
}

export async function getHubPost(id: string) {
  const { data, error } = await supabase.from('hub_posts').select('id, title, body, region, author_name, created_at, hub_replies(id, body, author_name, created_at)').eq('id', id).maybeSingle();
  check(error);
  return data as unknown as (Omit<HubPost, 'hub_replies'> & { hub_replies: HubReply[] }) | null;
}

export async function createHubPost(userId: string, title: string, body: string, region: string | null) {
  const { data, error } = await supabase.from('hub_posts').insert({ author_id: userId, kind: 'forum', title: title.trim(), body: body.trim(), region }).select('id').single();
  check(error);
  return data!.id as string;
}

export async function createHubReply(userId: string, postId: string, body: string) {
  check((await supabase.from('hub_replies').insert({ post_id: postId, author_id: userId, body: body.trim() })).error);
}

export type Job = {
  id: string;
  company_name: string;
  role_needed: string;
  title: string;
  description: string | null;
  location: string;
  start_date: string | null;
  end_date: string | null;
  pay: string | null;
  how_to_apply: string;
  kind: 'crew' | 'handover';
  group_size: number | null;
  languages: string[];
  specialty: string | null;
};

export async function listJobs(): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('id, company_name, role_needed, title, description, location, start_date, end_date, pay, how_to_apply, kind, group_size, languages, specialty')
    .eq('status', 'approved')
    .order('kind', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(60);
  check(error);
  return (data ?? []) as Job[];
}

export async function postJob(userId: string, job: Omit<Job, 'id'>) {
  check((await supabase.from('jobs').insert({ ...job, posted_by: userId })).error);
}

// ---------------------------------------------------------------------------
// Group trip organisers
// ---------------------------------------------------------------------------
export type OrganisedTrip = { id: string; title: string; start_date: string; end_date: string; seats_taken: number; already_going: number; max_people: number; status: string; cancelled: boolean };
export type TripRequest = { id: string; traveler_name: string; traveler_contact: string; seats: number; message: string | null; status: string };

export async function listMyOrganisedTrips(userId: string): Promise<OrganisedTrip[]> {
  const { data, error } = await supabase.from('group_trips').select('id, title, start_date, end_date, seats_taken, already_going, max_people, status, cancelled').eq('organizer_id', userId).order('start_date', { ascending: false });
  check(error);
  return (data ?? []) as OrganisedTrip[];
}

export async function listMyJoinedTrips(userId: string) {
  const { data, error } = await supabase
    .from('group_trip_members')
    .select('status, group_trips(id, title, start_date, end_date, seats_taken, already_going, max_people, status, cancelled)')
    .eq('traveler_id', userId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });
  check(error);
  return ((data ?? []) as unknown as { status: string; group_trips: OrganisedTrip | null }[]).filter((r) => r.group_trips);
}

export async function listTripRequests(tripId: string): Promise<TripRequest[]> {
  const { data, error } = await supabase.from('group_trip_members').select('id, traveler_name, traveler_contact, seats, message, status').eq('group_trip_id', tripId).neq('status', 'cancelled').order('created_at');
  check(error);
  return (data ?? []) as TripRequest[];
}

/** Accept or decline; the database refuses to overbook the trip. */
export async function respondToTripRequest(memberId: string, accept: boolean) {
  check((await supabase.from('group_trip_members').update({ status: accept ? 'accepted' : 'declined' }).eq('id', memberId)).error);
}

export async function cancelGroupTrip(tripId: string) {
  check((await supabase.from('group_trips').update({ cancelled: true }).eq('id', tripId)).error);
}

export async function createGroupTrip(
  userId: string,
  guideId: string | null,
  trip: { company_name: string | null; title: string; description: string; specialty: string; region: string; meeting_point: string | null; start_date: string; end_date: string; price_per_person_usd: number; min_people: number; max_people: number; languages: string[]; includes: string | null; deposit_percent: number; already_going: number },
  contact: string,
) {
  const { data, error } = await supabase.from('group_trips').insert({ ...trip, organizer_id: userId, guide_id: guideId }).select('id').single();
  check(error);
  check((await supabase.from('group_trip_private').insert({ group_trip_id: data!.id, contact })).error);
  return data!.id as string;
}
