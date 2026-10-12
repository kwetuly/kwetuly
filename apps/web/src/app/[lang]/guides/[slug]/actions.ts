'use server';

import { redirect } from 'next/navigation';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { createClient } from '@/lib/supabase/server';

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
