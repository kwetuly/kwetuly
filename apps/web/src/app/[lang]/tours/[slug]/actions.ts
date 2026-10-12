'use server';

import { redirect } from 'next/navigation';
import { defaultLocale, hasLocale } from '@/i18n/config';
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

  const details = [
    `Trip: ${field('trip_title', 160)}`,
    `Dates: ${field('dates', 120) || '-'}`,
    `People: ${field('group_size', 10) || '-'}`,
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
