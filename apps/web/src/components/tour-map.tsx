'use client';

import { useEffect, useRef } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { drawTourMap, type TourMapHandle, type TourMapLabels, type TourStop } from '@kwetuly/shared';

// Interactive route map (MapLibre + OpenFreeMap, with terrain and a 3D view). It loads after the
// page renders because it needs the browser. Any element with data-map-stop="<position>" on the
// page (the stop list, the itinerary) moves the map to that stop when clicked.
export function TourMap({ stops, labels, title }: { stops: TourStop[]; labels: TourMapLabels; title: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let handle: TourMapHandle | undefined;
    let cancelled = false;
    import('maplibre-gl').then((ml) => {
      if (cancelled || !ref.current) return;
      handle = drawTourMap(ml, ref.current, stops, labels, { cooperativeGestures: true });
    }).catch((error) => console.error('Tour map failed to load', error));
    const onClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-map-stop]');
      if (!target || !handle) return;
      event.preventDefault();
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      handle.focus(Number(target.dataset.mapStop));
    };
    document.addEventListener('click', onClick);
    return () => {
      cancelled = true;
      document.removeEventListener('click', onClick);
      handle?.destroy();
    };
  }, [stops, labels]);

  return <div ref={ref} role="region" aria-label={title} className="relative z-0 h-96 w-full overflow-hidden rounded-[5px] border border-line bg-surface sm:h-[30rem]" />;
}
