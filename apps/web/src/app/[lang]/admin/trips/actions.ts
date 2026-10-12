'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const STATUSES = ['draft', 'published', 'archived'];
const OPERATORS = ['partner', 'rafrika', 'guide'];

export async function updateTrip(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await getCurrentUser();
  if (user?.role !== 'admin') redirect(`/${locale}`);

  const field = (key: string, max: number) => String(formData.get(key) ?? '').trim().slice(0, max);
  const tripId = field('trip_id', 40);
  const status = field('status', 20);
  const operated = field('operated_by', 20);
  const price = Number.parseFloat(field('price_from_usd', 12));

  const supabase = await createClient();
  await supabase
    .from('trips')
    .update({
      status: STATUSES.includes(status) ? status : 'draft',
      operated_by: OPERATORS.includes(operated) ? operated : 'partner',
      price_from_usd: Number.isFinite(price) && price >= 0 ? price : null,
      is_signature: formData.get('is_signature') === 'on',
    })
    .eq('id', tripId);

  // Partner details are admin-only and never shown to travellers.
  const company = field('company_name', 120);
  if (company) {
    await supabase.from('trip_partners').upsert({
      trip_id: tripId,
      company_name: company,
      tala_licence: field('tala_licence', 60) || null,
      contact: field('contact', 160) || null,
      commission_note: field('commission_note', 200) || null,
    });
  }

  revalidateTag('trips', 'max');
  redirect(`/${locale}/admin/trips#${tripId}`);
}
