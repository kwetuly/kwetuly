'use server';

import { redirect } from 'next/navigation';
import { CALL_TOPICS } from '@rafrika/shared';
import { defaultLocale, hasLocale } from '@/i18n/config';
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

  const { error } = await supabase.from('leads').insert({
    guide_id: guideId,
    traveler_id: user?.id ?? null,
    source: 'contact_form',
    traveler_name: name,
    traveler_contact: contact,
    message,
  });

  redirect(`${back}?${error ? 'error' : 'sent'}=1#contact`);
}
