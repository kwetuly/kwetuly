'use dom';

import { useEffect, useRef } from 'react';
import type { DOMProps } from 'expo/dom';
import 'maplibre-gl/dist/maplibre-gl.css';
import { drawTourMap, type TourMapHandle, type TourMapLabels, type TourStop } from '@rafrika/shared';

// The website's MapLibre route map (OpenFreeMap, relief shading and a 3D view), run inside a web
// view (Expo DOM component) so the app shows exactly the same map.
export default function TourMap({ stops, labels, focus }: { stops: TourStop[]; labels: TourMapLabels; focus?: string; dom?: DOMProps }) {
  const ref = useRef<HTMLDivElement>(null);
  const handle = useRef<TourMapHandle | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    // MapLibre needs `window`, so it loads in the web view, never during server rendering.
    import('maplibre-gl')
      .then((ml) => {
        if (cancelled || !ref.current) return;
        handle.current = drawTourMap(ml, ref.current, stops, labels);
      })
      .catch((error) => console.error('Tour map failed to load', error));
    return () => {
      cancelled = true;
      handle.current?.destroy();
    };
  }, [stops, labels]);

  // The app can move the map to a stop (e.g. when a stop in the list is tapped): "<position>-<tap id>".
  useEffect(() => {
    if (focus) handle.current?.focus(Number(focus.split('-')[0]));
  }, [focus]);

  return <div ref={ref} style={{ position: 'absolute', inset: 0, background: '#eeece7' }} />;
}
