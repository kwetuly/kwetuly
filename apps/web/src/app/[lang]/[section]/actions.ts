'use server';

import { redirect } from 'next/navigation';
import { findMenuItem } from '@rafrika/shared';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { createClient } from '@/lib/supabase/server';

export async function registerInterest(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const section = String(formData.get('section') ?? '');
  const item = String(formData.get('item') ?? '');
  if (!findMenuItem(section, item)) redirect(`/${locale}`);

  const field = (key: string, max: number) => String(formData.get(key) ?? '').trim().slice(0, max);
  const kind = formData.get('kind') === 'business' ? 'business' : 'traveler';
  const name = field('name', 120);
  const contact = field('contact', 160);
  const back = `/${locale}/${section}/${item}`;
  if (!name || !contact) redirect(`${back}?error=${kind}#${kind}`);

  const supabase = await createClient();
  const { error } = await supabase.from('interest_signups').insert({
    section,
    item,
    kind,
    name,
    contact,
    business_name: field('business_name', 120) || null,
    message: field('message', 2000) || null,
    locale,
  });

  redirect(`${back}?${error ? 'error' : 'sent'}=${kind}#${kind}`);
}
