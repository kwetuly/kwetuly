'use server';

import { HOST_FEATURES, isFeatureOn } from '@kwetuly/shared';
import { getCurrentUser } from '@/lib/auth';
import { getFeatures } from '@/lib/features';
import { createClient } from '@/lib/supabase/server';

export type HostContactState = 'sent' | 'missing' | 'error' | null;

// "Please contact me" on /hosts for a signed-in traveller or business account (hosts need a guide
// account). Name and contact come from the account itself, never from the form, and go into the same
// interest list as the coming-soon pages, which only admins read.
export async function askHostContact(_prev: HostContactState, formData: FormData): Promise<HostContactState> {
  const [user, features] = await Promise.all([getCurrentUser(), getFeatures()]);
  const open = isFeatureOn(features, HOST_FEATURES.concierge) || isFeatureOn(features, HOST_FEATURES.investment);
  if (!user || !open || user.role === 'guide' || user.role === 'admin') return 'error';
  // An empty phone falls back to the email.
  const contact = (user.phone?.trim() || user.email || '').slice(0, 160);
  const name = (user.fullName?.trim() || '').slice(0, 120);
  if (!contact || !name) return 'missing';

  const supabase = await createClient();
  const { error } = await supabase.from('interest_signups').insert({
    section: 'partners',
    item: 'become-host',
    kind: user.role === 'provider' ? 'business' : 'traveler',
    name,
    contact,
    message: `Host sign-up: wants to apply, signed in as ${user.role} (website)`,
    locale: formData.get('locale') === 'sw' ? 'sw' : 'en',
  });
  return error ? 'error' : 'sent';
}
