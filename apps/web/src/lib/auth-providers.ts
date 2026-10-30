import 'server-only';
import { cacheLife } from 'next/cache';

// Social sign-in options, in the order they are shown. Apple is required by the App Store
// whenever an iPhone app offers other social sign-ins.
export const SOCIAL_PROVIDERS = ['google', 'facebook', 'apple'] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

/**
 * "Connected sign-ins" may connect and remove sign-ins only once Walter has switched on manual linking
 * in Supabase and set NEXT_PUBLIC_LINKING_ON=1 (Vercel). Until then the buttons stay hidden.
 */
export const LINKING_ON = process.env.NEXT_PUBLIC_LINKING_ON === '1';

// Asks Supabase which providers are switched on, so buttons only appear once they work.
export async function enabledSocialProviders(): Promise<SocialProvider[]> {
  'use cache';
  cacheLife('hours');
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
    });
    if (!res.ok) return [];
    const settings = (await res.json()) as { external?: Record<string, boolean> };
    return SOCIAL_PROVIDERS.filter((p) => settings.external?.[p]);
  } catch {
    return [];
  }
}
