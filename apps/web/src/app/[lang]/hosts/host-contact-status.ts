import 'server-only';

import { createClient } from '@/lib/supabase/server';

// "Please contact me" on /hosts is stored as this interest row (the app uses the same values).
export const HOST_CONTACT_SECTION = 'partners';
export const HOST_CONTACT_ITEM = 'become-host';

/**
 * True when the signed-in account already sent "Please contact me", from the website or the app
 * (public.my_interest_exists, supabase/migrations/20261126000060_interest_signups_owner.sql).
 * Signed out, or the function not there yet: false, so the button shows and the database decides.
 */
export async function hostContactAlreadySent(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('my_interest_exists', { p_section: HOST_CONTACT_SECTION, p_item: HOST_CONTACT_ITEM });
  return !error && data === true;
}
