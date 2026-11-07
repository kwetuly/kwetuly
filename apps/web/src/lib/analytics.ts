'use client';

import type { PostHog } from 'posthog-js';
import { POSTHOG_DEFAULT_HOST, isPaymentPath, redactUrlProps, safeProps, type AnalyticsEvent, type AnalyticsProps } from '@kwetuly/shared';

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
        // No heatmaps, dead-click or rage-click capture (they record what was clicked and where).
        enable_heatmaps: false,
        capture_dead_clicks: false,
        rageclick: false,
        // PostHog's own masking of personal-data URL parameters, plus our order id parameter.
        mask_personal_data_properties: true,
        custom_personal_data_properties: ['order'],
        // Nothing at all is sent from payment pages (/{lang}/payments/...): they carry the order id.
        // From every other page, page views, page leaves and web vitals carry $current_url and
        // $referrer (Selcom's pages can carry payment tokens): the query string and hash after any
        // payment or Selcom address are cut, in nested properties and keys too, before sending.
        before_send: (event) => {
          if (!event) return event;
          const props = event.properties ?? {};
          if (
            (typeof window !== 'undefined' && isPaymentPath(window.location.pathname)) ||
            isPaymentPath(typeof props.$current_url === 'string' ? props.$current_url : null) ||
            isPaymentPath(typeof props.$pathname === 'string' ? props.$pathname : null)
          ) {
            return null;
          }
          event.properties = redactUrlProps(event.properties) ?? event.properties;
          event.$set = redactUrlProps(event.$set);
          event.$set_once = redactUrlProps(event.$set_once);
          return event;
        },
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
