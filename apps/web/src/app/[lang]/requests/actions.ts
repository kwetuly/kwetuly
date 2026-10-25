'use server';

import { redirect } from 'next/navigation';
import { GUIDE_EXPERTISE, GUIDE_LANGUAGES, GUIDE_SPECIALTIES, REGIONS } from '@kwetuly/shared';
import { defaultLocale, hasLocale, type Locale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { isUuid, today } from '@/lib/requests';
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
const pick = (formData: FormData, key: string, allowed: readonly string[]) =>
  formData.getAll(key).map(String).filter((value) => allowed.includes(value));

// A traveller posts the trip they want. The database alerts matching guides.
export async function createRequest(formData: FormData) {
  const locale = localeOf(formData);
  const user = await requireUser(locale);
  const back = `/${locale}/requests/new`;

  const budget = int(formData, 'budget');
  const request = {
    traveler_id: user.id,
    traveler_name: (user.fullName ?? '').trim().slice(0, 120) || 'Traveller',
    title: field(formData, 'title', 140),
    details: field(formData, 'details', 4000),
    specialty: field(formData, 'specialty', 30),
    expertise: pick(formData, 'expertise', GUIDE_EXPERTISE.map((e) => e.id)),
    regions: pick(formData, 'regions', REGIONS),
    start_date: date(formData, 'start_date'),
    end_date: date(formData, 'end_date'),
    flexible_dates: formData.get('flexible') === 'on',
    adults: Math.min(Math.max(int(formData, 'adults') || 1, 1), 50),
    children: Math.min(Math.max(int(formData, 'children') || 0, 0), 50),
    budget_per_person_usd: Number.isFinite(budget) && budget > 0 ? Math.min(budget, 100000) : null,
    languages: pick(formData, 'languages', GUIDE_LANGUAGES.map((l) => l.code)),
    female_guide: formData.get('female_guide') === 'on',
  };
  const valid =
    request.title.length >= 5 &&
    request.details.length >= 20 &&
    GUIDE_SPECIALTIES.some((s) => s.id === request.specialty) &&
    (!request.start_date || request.start_date >= today()) &&
    (!request.start_date || !request.end_date || request.end_date >= request.start_date);
  if (!valid) redirect(`${back}?error=1`);

  const supabase = await createClient();
  const { data, error } = await supabase.from('trip_requests').insert(request).select('id').single();
  if (error || !data) redirect(`${back}?error=1`);
  redirect(`/${locale}/requests/${data.id}?posted=1`);
}

export async function setRequestOpen(formData: FormData) {
  const locale = localeOf(formData);
  await requireUser(locale);
  const id = field(formData, 'request_id', 40);
  if (!isUuid(id)) redirect(`/${locale}/requests`);
  const supabase = await createClient();
  await supabase
    .from('trip_requests')
    .update({ status: formData.get('open') === 'true' ? 'open' : 'closed' })
    .eq('id', id);
  redirect(`/${locale}/requests/${id}`);
}

// Guides offer as themselves; business accounts give a company name. Sending again updates the offer.
export async function sendOffer(formData: FormData) {
  const locale = localeOf(formData);
  const user = await requireUser(locale);
  const requestId = field(formData, 'request_id', 40);
  const back = `/${locale}/requests/${requestId}`;
  if (!isUuid(requestId)) redirect(`/${locale}/requests`);

  const asGuide = user.guide?.status === 'approved';
  const deposit = int(formData, 'deposit');
  const offer = {
    price_total_usd: int(formData, 'price'),
    deposit_percent: Number.isFinite(deposit) ? Math.min(Math.max(deposit, 0), 100) : 30,
    itinerary: field(formData, 'itinerary', 6000),
    includes: field(formData, 'includes', 1500) || null,
    excludes: field(formData, 'excludes', 1500) || null,
    valid_until: date(formData, 'valid_until'),
    company_name: asGuide ? null : field(formData, 'company_name', 120) || null,
  };
  const valid =
    offer.price_total_usd >= 1 &&
    offer.itinerary.length >= 20 &&
    (asGuide || offer.company_name) &&
    (!offer.valid_until || offer.valid_until >= today());
  if (!valid) redirect(`${back}?offerError=1#offer`);

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('trip_offers')
    .select('id')
    .eq('request_id', requestId)
    .eq('offered_by', user.id)
    .maybeSingle();
  const { error } = existing
    ? await supabase.from('trip_offers').update({ ...offer, status: 'sent' }).eq('id', existing.id)
    : await supabase
        .from('trip_offers')
        .insert({ ...offer, request_id: requestId, offered_by: user.id, guide_id: asGuide ? user.guide!.id : null });
  redirect(`${back}?${error ? 'offerError' : 'offerSent'}=1#offer`);
}

export async function withdrawOffer(formData: FormData) {
  const locale = localeOf(formData);
  const user = await requireUser(locale);
  const requestId = field(formData, 'request_id', 40);
  const supabase = await createClient();
  await supabase.from('trip_offers').update({ status: 'withdrawn' }).eq('request_id', requestId).eq('offered_by', user.id);
  redirect(`/${locale}/requests/${requestId}#offer`);
}

// The traveller accepts (books) or declines one offer. The database declines the others and opens a chat.
export async function answerOffer(formData: FormData) {
  const locale = localeOf(formData);
  await requireUser(locale);
  const requestId = field(formData, 'request_id', 40);
  const offerId = field(formData, 'offer_id', 40);
  const status = formData.get('decision') === 'accept' ? 'accepted' : 'declined';
  if (!isUuid(requestId) || !isUuid(offerId)) redirect(`/${locale}/requests`);

  const supabase = await createClient();
  const { error } = await supabase.from('trip_offers').update({ status }).eq('id', offerId).eq('request_id', requestId);
  redirect(`/${locale}/requests/${requestId}?${error ? 'error=1' : 'answered=1'}#offers`);
}
