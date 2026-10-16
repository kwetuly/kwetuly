'use server';

import { redirect } from 'next/navigation';
import { orderMessage } from '@rafrika/shared';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { createClient } from '@/lib/supabase/server';

// A traveller's question to a listed business. It lands in the business's dashboard.
export async function askBusiness(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const providerId = String(formData.get('provider_id') ?? '');
  const name = String(formData.get('name') ?? '').trim().slice(0, 120);
  const contact = String(formData.get('contact') ?? '').trim().slice(0, 160);
  const text = String(formData.get('message') ?? '').trim().slice(0, 2000);
  // Shops (curio, gems, gear) also take orders: delivered to the traveller's hotel, or held for collection.
  const mode = formData.get('order_mode');
  const where = String(formData.get('order_where') ?? '').trim().slice(0, 300);
  const message = text && (mode === 'deliver' || mode === 'collect') ? orderMessage(mode, where, text) : text;
  const back = `/${locale}/businesses/${encodeURIComponent(providerId)}`;
  if (!/^[0-9a-f-]{36}$/.test(providerId) || !name || !contact || !message) redirect(`${back}?error=1#ask`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from('leads').insert({
    provider_id: providerId,
    traveler_id: user?.id ?? null,
    source: 'contact_form',
    traveler_name: name,
    traveler_contact: contact,
    message,
  });
  redirect(`${back}?${error ? 'error' : 'sent'}=1#ask`);
}
