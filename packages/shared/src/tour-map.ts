// Draws a tour route with Leaflet. Used by the website (TourMap) and the app (a DOM component),
// so both show the same map. Leaflet is passed in, so this package does not depend on it.

import type { TourStop } from './tours';

export type TourMapLabels = { day: string; kinds: Record<string, string> };

/** OpenStreetMap tiles by default; set NEXT_PUBLIC_MAP_TILE_URL / EXPO_PUBLIC_MAP_TILE_URL to use a paid tile provider. */
export const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Draws numbered stops joined by the route line (dashed for flights and boats) and fits the view.
 * Returns a cleanup function.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function drawTourMap(L: any, element: HTMLElement, stops: TourStop[], labels: TourMapLabels, tileUrl = DEFAULT_TILE_URL): () => void {
  const map = L.map(element, { scrollWheelZoom: false, zoomControl: false, attributionControl: true });
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer(tileUrl, { maxZoom: 17, attribution: TILE_ATTRIBUTION }).addTo(map);
  // Scroll-zoom only after the map is clicked, so the page still scrolls past it.
  map.once('focus', () => map.scrollWheelZoom.enable());

  const points = stops.map((s) => [Number(s.lat), Number(s.lng)] as [number, number]);
  for (let i = 1; i < stops.length; i++) {
    const mode = stops[i].transfer_mode;
    L.polyline([points[i - 1], points[i]], {
      color: '#1d951a',
      weight: 4,
      opacity: 0.85,
      dashArray: mode === 'flight' || mode === 'boat' ? '8 8' : undefined,
    }).addTo(map);
  }

  // Stops at the same place (e.g. start and end in Arusha) share one marker with both numbers.
  const groups = new Map<string, TourStop[]>();
  for (const stop of stops) {
    const key = `${Number(stop.lat).toFixed(3)},${Number(stop.lng).toFixed(3)}`;
    groups.set(key, [...(groups.get(key) ?? []), stop]);
  }
  for (const group of groups.values()) {
    const first = group[0];
    const numbers = group.map((s) => s.position).join('·');
    const peak = group.some((s) => s.kind === 'peak');
    const icon = L.divIcon({
      className: '',
      html: `<span style="display:flex;align-items:center;justify-content:center;min-width:28px;height:28px;padding:0 6px;border-radius:5px;background:${peak ? '#ffb627' : '#1d951a'};color:${peak ? '#2b3631' : '#fff'};font:800 13px/1 system-ui,sans-serif;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)">${numbers}</span>`,
      iconSize: [28 + (numbers.length - 1) * 7, 28],
      iconAnchor: [14 + (numbers.length - 1) * 3.5, 14],
    });
    const body = group
      .map((s) => `<strong>${s.position}. ${esc(s.name)}</strong><br>${s.day ? `${esc(labels.day)} ${s.day} · ` : ''}${esc(labels.kinds[s.kind] ?? s.kind)}${s.note ? `<br>${esc(s.note)}` : ''}`)
      .join('<hr style="margin:6px 0;border:0;border-top:1px solid #e7e5e0">');
    L.marker([Number(first.lat), Number(first.lng)], { icon, title: first.name, keyboard: true }).addTo(map).bindPopup(body);
  }

  if (points.length === 1) map.setView(points[0], 10);
  else if (points.length > 1) map.fitBounds(points, { padding: [36, 36], maxZoom: 12 });
  else map.setView([-6.3, 35], 5); // all of Tanzania

  return () => map.remove();
}
