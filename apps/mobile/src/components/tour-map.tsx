'use dom';

import { useEffect, useRef } from 'react';
import type { DOMProps } from 'expo/dom';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_TILE_URL, drawTourMap, type TourMapLabels, type TourStop } from '@rafrika/shared';

// The website's Leaflet route map, run inside a web view (Expo DOM component), so the app shows
// exactly the same map: numbered stops, the route line and tap-for-details popups.
export default function TourMap({ stops, labels }: { stops: TourStop[]; labels: TourMapLabels; dom?: DOMProps }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    // Leaflet needs `window`, so it loads in the web view, never during server rendering.
    import('leaflet').then((L) => {
      if (cancelled || !ref.current) return;
      cleanup = drawTourMap(L.default ?? L, ref.current, stops, labels, process.env.EXPO_PUBLIC_MAP_TILE_URL || DEFAULT_TILE_URL);
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [stops, labels]);

  return <div ref={ref} style={{ position: 'absolute', inset: 0, background: '#eeece7' }} />;
}
