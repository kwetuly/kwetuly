'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_TILE_URL, drawTourMap, type TourMapLabels, type TourStop } from '@rafrika/shared';

// Interactive route map. Leaflet needs the browser, so it loads after the page renders.
export function TourMap({ stops, labels, title }: { stops: TourStop[]; labels: TourMapLabels; title: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    import('leaflet').then((L) => {
      if (cancelled || !ref.current) return;
      cleanup = drawTourMap(L.default ?? L, ref.current, stops, labels, process.env.NEXT_PUBLIC_MAP_TILE_URL || DEFAULT_TILE_URL);
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [stops, labels]);

  return <div ref={ref} role="region" aria-label={title} className="relative z-0 h-80 w-full overflow-hidden rounded-[5px] border border-line bg-surface sm:h-[26rem]" />;
}
