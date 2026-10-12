'use client';

import { createBrowserClient } from '@supabase/ssr';

// Browser Supabase client (uses the signed-in user's session cookie). Used for live chat updates.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
