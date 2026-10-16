'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { CALL_TOPICS } from '@rafrika/shared';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { requireOnboarded } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function requestCall(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const slug = String(formData.get('slug') ?? '');
  const back = `/${locale}/guides/${encodeURIComponent(slug)}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);
  await requireOnboarded(user.id, locale, `${back}#call`);

  const field = (key: string, max: number) => String(formData.get(key) ?? '').trim().slice(0, max);
  const topic = field('topic', 60);
  if (!CALL_TOPICS.some((c) => c.id === topic)) redirect(`${back}?callError=1#call`);

  // The database checks the guide offers calls and sets the price from their profile.
  const { error } = await supabase.from('call_requests').insert({
    guide_id: field('guide_id', 40),
    traveler_id: user.id,
    topic,
    preferred_times: field('preferred_times', 500) || null,
    message: field('message', 2000) || null,
    traveler_contact: field('contact', 160) || null,
  });

  redirect(`${back}?${error ? 'callError' : 'callSent'}=1#call`);
}

export async function requestGuide(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const slug = String(formData.get('slug') ?? '');
  const guideId = String(formData.get('guide_id') ?? '');
  const name = String(formData.get('name') ?? '').trim().slice(0, 120);
  const contact = String(formData.get('contact') ?? '').trim().slice(0, 160);
  const message = String(formData.get('message') ?? '').trim().slice(0, 2000);

  const back = `/${locale}/guides/${encodeURIComponent(slug)}`;
  if (!guideId || !name || !contact || !message) redirect(`${back}?error=1#contact`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // An enquiry linked to an account needs a finished account (the database checks the same).
  if (user) await requireOnboarded(user.id, locale, `${back}#contact`);

  // The package the traveller asked about, when they came from "Ask about this package".
  const packageId = String(formData.get('package_id') ?? '');
  const { error } = await supabase.from('leads').insert({
    guide_id: guideId,
    package_id: /^[0-9a-f-]{36}$/.test(packageId) ? packageId : null,
    traveler_id: user?.id ?? null,
    source: 'contact_form',
    traveler_name: name,
    traveler_contact: contact,
    message,
  });

  redirect(`${back}?${error ? 'error' : 'sent'}=1#contact`);
}

// Post or update the signed-in traveller's review. The database only accepts it from travellers
// with a confirmed call or booking with this guide, and keeps one review per traveller per guide.
export async function submitReview(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const slug = String(formData.get('slug') ?? '');
  const back = `/${locale}/guides/${encodeURIComponent(slug)}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);
  await requireOnboarded(user.id, locale, `${back}#reviews`);

  const rating = Number.parseInt(String(formData.get('rating') ?? ''), 10);
  const body = String(formData.get('body') ?? '').trim().slice(0, 2000);
  const guideId = String(formData.get('guide_id') ?? '').slice(0, 40);
  if (!(rating >= 1 && rating <= 5) || body.length < 10) redirect(`${back}?reviewError=1#reviews`);

  // Show first name and initial only, e.g. "Anna K.", to protect travellers' privacy.
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
  const parts = (profile?.full_name ?? '').trim().split(/\s+/).filter(Boolean);
  const authorName = parts.length ? `${parts[0]}${parts[1] ? ` ${parts[1][0]}.` : ''}` : 'Traveller';

  const { error } = await supabase
    .from('guide_reviews')
    .upsert(
      { guide_id: guideId, author_id: user.id, author_name: authorName.slice(0, 80), rating, body },
      { onConflict: 'guide_id,author_id' },
    );
  if (!error) revalidateTag('guides', 'max');
  redirect(`${back}?${error ? 'reviewError' : 'reviewSent'}=1#reviews`);
}
