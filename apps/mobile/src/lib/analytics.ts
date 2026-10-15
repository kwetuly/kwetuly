import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import PostHog from 'posthog-react-native';
import { POSTHOG_DEFAULT_HOST, safeProps, type AnalyticsEvent, type AnalyticsProps } from '@rafrika/shared';

// Product analytics with PostHog, matching the website: same event names, no personal details,
// and nothing kept on the phone between launches (memory only). Off until
// EXPO_PUBLIC_POSTHOG_KEY is set.

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;

const client = KEY
  ? new PostHog(KEY, {
      host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? POSTHOG_DEFAULT_HOST,
      persistence: 'memory',
      personProfiles: 'never',
      captureAppLifecycleEvents: true,
    })
  : null;

export function track(event: AnalyticsEvent, props?: AnalyticsProps) {
  client?.capture(event, { ...safeProps(props), platform: 'app' });
}

/** Records a screen view whenever the route changes. Mount once in the root layout. */
export function useScreenTracking() {
  const pathname = usePathname();
  useEffect(() => {
    client?.screen(pathname);
  }, [pathname]);
}
