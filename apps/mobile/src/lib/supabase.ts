// Gives supabase-js a persistent localStorage on iOS/Android (backed by SQLite), so people stay signed in.
import 'expo-sqlite/localStorage/install';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set in apps/mobile/.env.local');

// Same project and the same row-level security as the website: the app can only see what the user may see.
export const supabase = createClient(url, key, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** The public website, used for share links and for tools that live on the web (guide editor, admin). */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? 'https://rafrika.com').replace(/\/$/, '');
