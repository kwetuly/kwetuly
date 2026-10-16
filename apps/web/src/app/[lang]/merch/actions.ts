'use server';

import { redirect } from 'next/navigation';
import { orderMessage } from '@rafrika/shared';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { getMerchShopId } from '@/lib/merch';
import { createClient } from '@/lib/supabase/server';

// A merchandise order: delivered to the traveller's hotel, or held for collection. Rafrika confirms
// the price and payment (mobile money or cash on delivery) before sending anything.
export async function orderMerch(formData: FormData) {
  const value = String(formData.get('locale') ?? '');
  const locale = hasLocale(value) ? value : defaultLocale;
  const text = (key: string, max: number) => String(formData.get(key) ?? '').trim().slice(0, max);
  const back = `/${locale}/merch`;
  const product = text('product', 120);
  const size = text('size', 20);
  const qty = Math.min(Math.max(Number.parseInt(text('qty', 3), 10) || 1, 1), 50);
  const name = text('name', 120);
  const contact = text('contact', 160);
  const mode = formData.get('order_mode') === 'collect' ? 'collect' : 'deliver';
  const where = text('order_where', 300);
  const note = text('message', 1000);
  const shopId = await getMerchShopId();
  if (!shopId || !product || !name || contact.length < 3) redirect(`${back}?error=1#order`);

  const what = [`${qty} × ${product}${size ? ` (size ${size})` : ''}`, note].filter(Boolean).join('\n');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from('leads').insert({
    provider_id: shopId,
    traveler_id: user?.id ?? null,
    source: 'contact_form',
    traveler_name: name,
    traveler_contact: contact,
    message: orderMessage(mode, where, what),
  });
  redirect(`${back}?${error ? 'error' : 'sent'}=1#order`);
}
