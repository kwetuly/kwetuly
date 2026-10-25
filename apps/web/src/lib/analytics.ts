'use client';

import type { PostHog } from 'posthog-js';
import { POSTHOG_DEFAULT_HOST, safeProps, type AnalyticsEvent, type AnalyticsProps } from '@kwetuly/shared';

// Product analytics with PostHog in cookieless mode: no cookies or browser storage, so no consent
// banner is needed. Turned off until NEXT_PUBLIC_POSTHOG_KEY is set. The library loads after the
// page is idle so it never slows the first paint, and events sent before then are queued.

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? POSTHOG_DEFAULT_HOST;

let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;
const queue: [string, AnalyticsProps][] = [];

export const analyticsEnabled = Boolean(KEY);

export function loadAnalytics(): Promise<PostHog | null> {
  if (!KEY || typeof window === 'undefined') return Promise.resolve(null);
  loading ??= import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(KEY, {
        api_host: HOST,
        cookieless_mode: 'always',
        person_profiles: 'never',
        autocapture: false,
        capture_pageview: 'history_change',
        capture_pageleave: true,
        disable_session_recording: true,
        disable_surveys: true,
        capture_performance: { web_vitals: true },
      });
      client = posthog;
      queue.splice(0).forEach(([event, props]) => posthog.capture(event, props));
      return posthog;
    })
    .catch(() => null);
  return loading;
}

export function track(event: AnalyticsEvent, props?: AnalyticsProps) {
  if (!KEY) return;
  const clean = { ...safeProps(props), platform: 'web' };
  if (client) client.capture(event, clean);
  else queue.push([event, clean]);
}
