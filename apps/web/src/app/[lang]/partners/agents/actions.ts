'use server';

import { redirect } from 'next/navigation';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { createClient } from '@/lib/supabase/server';

// Partner applications go into the same inbox as other business sign-ups, so admins get the usual alert.
export async function applyAsAgency(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const back = `/${locale}/partners/agents`;

  const field = (key: string, max: number) => String(formData.get(key) ?? '').trim().slice(0, max);
  const name = field('name', 120);
  const contact = field('contact', 160);
  const agency = field('agency', 120);
  if (!name || !contact || !agency) redirect(`${back}?error=1#apply`);

  const details = [
    ['Country', field('country', 80)],
    ['Website', field('website', 200)],
    ['Clients and trips', field('markets', 400)],
    ['Travellers per year', field('volume', 40)],
    ['Message', field('message', 1000)],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n');

  const supabase = await createClient();
  const { error } = await supabase.from('interest_signups').insert({
    section: 'partners',
    item: 'travel-agents',
    kind: 'business',
    name,
    contact,
    business_name: agency,
    message: details || null,
    locale,
  });

  redirect(`${back}?${error ? 'error' : 'sent'}=1#apply`);
}
