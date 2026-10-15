'use client';

import { useEffect } from 'react';
import { EVENTS, type AnalyticsEvent, type AnalyticsProps } from '@rafrika/shared';
import { analyticsEnabled, loadAnalytics, track } from '@/lib/analytics';

/**
 * Starts analytics once the page is idle and records clicks on anything marked
 * `data-track="<label>"` as `cta_clicked`, so buttons can be measured without extra code.
 */
export function Analytics({ locale }: { locale: string }) {
  useEffect(() => {
    if (!analyticsEnabled) return;
    const start = () => void loadAnalytics();
    const canIdle = typeof window.requestIdleCallback === 'function';
    const idle = canIdle ? window.requestIdleCallback(start, { timeout: 4000 }) : setTimeout(start, 2000);

    const onClick = (event: MouseEvent) => {
      const el = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-track]');
      if (!el) return;
      track(EVENTS.ctaClicked, { cta: el.dataset.track, page: window.location.pathname, locale });
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => {
      if (canIdle) window.cancelIdleCallback(idle as number);
      else clearTimeout(idle);
      document.removeEventListener('click', onClick, { capture: true });
    };
  }, [locale]);
  return null;
}

/** Records one event when a page is shown, e.g. a guide or tour view. */
export function LogEvent({ event, props }: { event: AnalyticsEvent; props?: AnalyticsProps }) {
  const key = JSON.stringify(props ?? {});
  useEffect(() => {
    track(event, JSON.parse(key));
  }, [event, key]);
  return null;
}
