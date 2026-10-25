// Persistent localStorage (SQLite on phones), so people stay signed in.
import './local-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set in apps/mobile/.env.local');

// Same project and the same row-level security as the website: the app can only see what the user may see.
export const supabase = createClient(url, key, {
  auth: {
    // (No localStorage while the web preview is rendered on the server.)
    storage: globalThis.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE is required for Google / Facebook / Apple sign-in in a native app.
    flowType: 'pkce',
  },
});

/** The public website, used for share links and for tools that live on the web (guide editor, admin). */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? 'https://kwetuly.com').replace(/\/$/, '');
