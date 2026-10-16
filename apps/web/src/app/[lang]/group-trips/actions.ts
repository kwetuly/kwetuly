'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { GUIDE_LANGUAGES, GUIDE_SPECIALTIES, REGIONS } from '@rafrika/shared';
import { defaultLocale, hasLocale, type Locale } from '@/i18n/config';
import { businessApproval, getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const localeOf = (formData: FormData): Locale => {
  const value = String(formData.get('locale') ?? '');
  return hasLocale(value) ? value : defaultLocale;
};
const field = (formData: FormData, key: string, max: number) => String(formData.get(key) ?? '').trim().slice(0, max);
const int = (formData: FormData, key: string) => Number.parseInt(field(formData, key, 9), 10);
const date = (formData: FormData, key: string) => {
  const value = field(formData, key, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
};

// Verified guides post as themselves; business accounts post under their company name.
// The database re-checks who may organise and keeps every new trip pending until approved.
export async function createGroupTrip(formData: FormData) {
  const locale = localeOf(formData);
  const back = `/${locale}/group-trips/new${formData.get('complete') === '1' ? '?complete=1&' : '?'}`;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const asGuide = user.guide?.status === 'approved';
  const business = await businessApproval(user);
  // Business accounts organise only once Rafrika has approved their listing.
  if (!asGuide && business === 'waiting') redirect(`${back}error=1`);
  const asBusiness = business === 'approved' || user.role === 'admin';
  // Travellers organise as themselves: no guide and no company. Completing a group means some
  // people are already going; they count against the spots.
  const alreadyGoing = formData.get('complete') === '1' ? int(formData, 'already_going') : 0;
  const specialty = field(formData, 'specialty', 30);
  const region = field(formData, 'region', 80);
  const trip = {
    organizer_id: user.id,
    guide_id: asGuide ? user.guide!.id : null,
    company_name: !asGuide && asBusiness ? field(formData, 'company_name', 120) || null : null,
    already_going: Number.isFinite(alreadyGoing) ? Math.min(Math.max(alreadyGoing, 0), 99) : 0,
    title: field(formData, 'title', 140),
    description: field(formData, 'description', 4000),
    specialty,
    region,
    meeting_point: field(formData, 'meeting_point', 200) || null,
    start_date: date(formData, 'start_date'),
    end_date: date(formData, 'end_date'),
    price_per_person_usd: int(formData, 'price'),
    min_people: int(formData, 'min_people') || 1,
    max_people: int(formData, 'max_people'),
    languages: formData.getAll('languages').map(String).filter((code) => GUIDE_LANGUAGES.some((l) => l.code === code)),
    includes: field(formData, 'includes', 1000) || null,
    deposit_percent: !asGuide && !asBusiness ? 0 : Math.min(Math.max(Number.isFinite(int(formData, 'deposit')) ? int(formData, 'deposit') : 30, 0), 100),
  };
  const contact = field(formData, 'contact', 160);
  const valid =
    trip.title.length >= 5 &&
    trip.description.length >= 20 &&
    GUIDE_SPECIALTIES.some((s) => s.id === specialty) &&
    (REGIONS as readonly string[]).includes(region) &&
    trip.start_date &&
    trip.end_date &&
    trip.end_date >= trip.start_date &&
    trip.start_date >= new Date().toISOString().slice(0, 10) &&
    trip.price_per_person_usd >= 0 &&
    trip.max_people >= 2 &&
    trip.min_people <= trip.max_people &&
    contact.length >= 3 &&
    trip.already_going < trip.max_people &&
    (trip.guide_id || trip.company_name || (!asBusiness && user.phone));
  if (!valid) redirect(`${back}error=1`);

  const supabase = await createClient();
  const { data, error } = await supabase.from('group_trips').insert(trip).select('id').single();
  if (error || !data) redirect(`${back}error=1`);
  await supabase.from('group_trip_private').insert({ group_trip_id: data.id, contact });

  redirect(`/${locale}/group-trips/${data.id}?created=1`);
}

// A traveller asks to join, or asks again after cancelling. The organiser then accepts or declines.
export async function requestToJoin(formData: FormData) {
  const locale = localeOf(formData);
  const tripId = field(formData, 'group_trip_id', 40);
  const back = `/${locale}/group-trips/${tripId}`;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const request = {
    traveler_name: field(formData, 'name', 120),
    traveler_contact: field(formData, 'contact', 160),
    seats: Math.min(Math.max(int(formData, 'seats') || 1, 1), 20),
    message: field(formData, 'message', 1000) || null,
  };
  if (!request.traveler_name || request.traveler_contact.length < 3) redirect(`${back}?error=1#join`);

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('group_trip_members')
    .select('id')
    .eq('group_trip_id', tripId)
    .eq('traveler_id', user.id)
    .maybeSingle();
  const { error } = existing
    ? await supabase.from('group_trip_members').update({ ...request, status: 'requested' }).eq('id', existing.id)
    : await supabase.from('group_trip_members').insert({ ...request, group_trip_id: tripId, traveler_id: user.id });

  redirect(`${back}?${error ? 'error' : 'sent'}=1#join`);
}

export async function cancelMyRequest(formData: FormData) {
  const locale = localeOf(formData);
  const tripId = field(formData, 'group_trip_id', 40);
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const supabase = await createClient();
  await supabase
    .from('group_trip_members')
    .update({ status: 'cancelled' })
    .eq('group_trip_id', tripId)
    .eq('traveler_id', user.id);
  revalidateTag('groups', 'max');
  redirect(`/${locale}/group-trips/${tripId}#join`);
}

// Organiser accepts or declines a request. The database refuses to overbook the trip.
export async function respondToRequest(formData: FormData) {
  const locale = localeOf(formData);
  const tripId = field(formData, 'group_trip_id', 40);
  const back = `/${locale}/group-trips/${tripId}`;
  const decision = formData.get('decision') === 'accept' ? 'accepted' : 'declined';

  const supabase = await createClient();
  const { error } = await supabase
    .from('group_trip_members')
    .update({ status: decision })
    .eq('id', field(formData, 'member_id', 40))
    .eq('group_trip_id', tripId);
  revalidateTag('groups', 'max');
  redirect(`${back}?${error ? 'full' : 'updated'}=1#requests`);
}

export async function cancelGroupTrip(formData: FormData) {
  const locale = localeOf(formData);
  const tripId = field(formData, 'group_trip_id', 40);
  const supabase = await createClient();
  await supabase.from('group_trips').update({ cancelled: true }).eq('id', tripId);
  revalidateTag('groups', 'max');
  redirect(`/${locale}/group-trips/${tripId}`);
}
