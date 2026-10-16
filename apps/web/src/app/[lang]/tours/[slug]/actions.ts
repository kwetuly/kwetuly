'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { requireOnboarded } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function enquireTrip(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const field = (key: string, max: number) => String(formData.get(key) ?? '').trim().slice(0, max);
  const slug = field('slug', 80);
  const back = `/${locale}/tours/${encodeURIComponent(slug)}`;

  const name = field('name', 120);
  const contact = field('contact', 160);
  if (!name || !contact) redirect(`${back}?error=1#enquire`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // An enquiry linked to an account needs a finished account (the database checks the same).
  if (user) await requireOnboarded(user.id, locale, `${back}#enquire`);
  const details = [
    `Trip: ${field('trip_title', 160)}`,
    `Dates: ${field('dates', 120) || '-'}`,
    `People: ${field('group_size', 10) || '-'}`,
    field('guide', 120) && `Preferred guide: ${field('guide', 120)}`,
    field('message', 1500),
  ]
    .filter(Boolean)
    .join('\n');

  const { error } = await supabase.from('leads').insert({
    trip_id: field('trip_id', 40),
    traveler_id: user?.id ?? null,
    source: 'contact_form',
    traveler_name: name,
    traveler_contact: contact,
    message: details,
  });

  redirect(`${back}?${error ? 'error' : 'sent'}=1#enquire`);
}

// Save or un-save a tour. Signed-out visitors go to sign in and come back to the tour.
export async function toggleSavedTour(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const slug = String(formData.get('slug') ?? '').slice(0, 80);
  const tripId = String(formData.get('trip_id') ?? '').slice(0, 40);
  const back = `/${locale}/tours/${encodeURIComponent(slug)}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(back)}`);

  if (formData.get('saved') === '1') {
    await supabase.from('saved_trips').delete().eq('user_id', user.id).eq('trip_id', tripId);
  } else {
    await supabase.from('saved_trips').upsert({ user_id: user.id, trip_id: tripId });
  }
  revalidatePath(back);
  redirect(back);
}
