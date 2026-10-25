// Draws a tour route with MapLibre GL. Used by the website (TourMap) and the app (a DOM
// component), so both show the same map. MapLibre is passed in, so this package does not bundle it.
//
// Map data: OpenFreeMap vector tiles (free, no key, no usage limits, commercial use allowed;
// © OpenMapTiles © OpenStreetMap contributors). Relief and 3D: the open Terrain Tiles dataset
// (Mapzen / AWS Open Data, from USGS SRTM and GMTED2010 and NOAA ETOPO1).

import type * as MapLibre from 'maplibre-gl';
import type { TourStop } from './tours';

export type TourMapLabels = { day: string; kinds: Record<string, string>; altitude: string; view3d: string; view2d: string };
export type TourMapHandle = { destroy: () => void; focus: (position: number) => void };

export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
export const TERRAIN_TILE_URL = 'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png';
// Must match the installed maplibre-gl version exactly (see apps/*/package.json).
export const MAPLIBRE_WORKER_URL = 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl-worker.mjs';
const TERRAIN_ATTRIBUTION =
  '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Terrain: Mapzen, USGS SRTM &amp; GMTED2010, NOAA ETOPO1</a>';

const LEAF = '#1d951a';
const GOLD = '#ffb627';
const INK = '#2b3631';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function markerElement(text: string, peak: boolean): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.textContent = text;
  el.style.cssText = `display:flex;align-items:center;justify-content:center;min-width:28px;height:28px;padding:0 6px;border-radius:5px;background:${peak ? GOLD : LEAF};color:${peak ? INK : '#fff'};font:800 13px/1 system-ui,sans-serif;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);cursor:pointer`;
  return el;
}

/** A small "3D / 2D" button that tilts the map and raises the terrain. */
class TerrainToggle implements MapLibre.IControl {
  private container?: HTMLElement;
  constructor(private labels: TourMapLabels, private onToggle: (on: boolean) => void, private on = false) {}
  onAdd() {
    const container = document.createElement('div');
    container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    const button = document.createElement('button');
    button.type = 'button';
    button.style.cssText = 'width:auto;padding:0 8px;font:700 12px system-ui,sans-serif';
    const render = () => {
      button.textContent = this.on ? this.labels.view2d : this.labels.view3d;
      button.setAttribute('aria-pressed', String(this.on));
    };
    button.onclick = () => {
      this.on = !this.on;
      render();
      this.onToggle(this.on);
    };
    render();
    container.appendChild(button);
    this.container = container;
    return container;
  }
  onRemove() {
    this.container?.remove();
  }
}

export function drawTourMap(
  ml: typeof MapLibre,
  element: HTMLElement,
  stops: TourStop[],
  labels: TourMapLabels,
  options: { cooperativeGestures?: boolean; styleUrl?: string } = {},
): TourMapHandle {
  if (ml.getWorkerUrl() !== MAPLIBRE_WORKER_URL) ml.setWorkerUrl(MAPLIBRE_WORKER_URL);

  const points = stops.map((s) => [Number(s.lng), Number(s.lat)] as [number, number]);
  const bounds = points.reduce((b, p) => b.extend(p), new ml.LngLatBounds(points[0] ?? [35, -6.3], points[0] ?? [35, -6.3]));
  const map = new ml.Map({
    container: element,
    style: options.styleUrl ?? MAP_STYLE_URL,
    bounds: points.length > 1 ? bounds : undefined,
    center: points.length === 1 ? points[0] : points.length === 0 ? [35, -6.3] : undefined,
    zoom: points.length === 1 ? 10 : points.length === 0 ? 4.5 : undefined,
    fitBoundsOptions: { padding: 48, maxZoom: 12 },
    cooperativeGestures: options.cooperativeGestures ?? false,
    attributionControl: { compact: true },
    maxPitch: 70,
  });
  map.addControl(new ml.NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new ml.FullscreenControl(), 'top-right');
  map.addControl(
    new TerrainToggle(labels, (on) => {
      if (on) {
        map.setTerrain({ source: 'kwetuly-terrain', exaggeration: 1.4 });
        map.easeTo({ pitch: 60, duration: 900 });
      } else {
        map.setTerrain(null);
        map.easeTo({ pitch: 0, bearing: 0, duration: 700 });
      }
    }),
    'top-right',
  );
  map.addControl(new ml.ScaleControl({ unit: 'metric' }), 'bottom-left');

  map.on('load', () => {
    // Relief shading under the labels, and a separate source for 3D terrain (MapLibre advises not sharing one).
    const dem = { type: 'raster-dem' as const, tiles: [TERRAIN_TILE_URL], encoding: 'terrarium' as const, tileSize: 256, maxzoom: 13 };
    map.addSource('kwetuly-hillshade', { ...dem, attribution: TERRAIN_ATTRIBUTION });
    map.addSource('kwetuly-terrain', dem);
    const firstSymbol = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
    map.addLayer(
      { id: 'kwetuly-hillshade', type: 'hillshade', source: 'kwetuly-hillshade', paint: { 'hillshade-exaggeration': 0.4, 'hillshade-shadow-color': '#3a3a3a' } },
      firstSymbol,
    );

    // Route: one line per leg, dashed for flights and boat transfers.
    const legs = stops.slice(1).map((stop, i) => ({
      type: 'Feature' as const,
      properties: { mode: stop.transfer_mode ?? 'drive' },
      geometry: { type: 'LineString' as const, coordinates: [points[i], points[i + 1]] },
    }));
    map.addSource('kwetuly-route', { type: 'geojson', data: { type: 'FeatureCollection', features: legs } });
    const dashed: MapLibre.FilterSpecification = ['in', ['get', 'mode'], ['literal', ['flight', 'boat']]];
    map.addLayer({ id: 'kwetuly-route-casing', type: 'line', source: 'kwetuly-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.9 } });
    map.addLayer({ id: 'kwetuly-route', type: 'line', source: 'kwetuly-route', filter: ['!', dashed], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': LEAF, 'line-width': 4 } });
    map.addLayer({ id: 'kwetuly-route-dashed', type: 'line', source: 'kwetuly-route', filter: dashed, paint: { 'line-color': LEAF, 'line-width': 3, 'line-dasharray': [2, 2] } });
  });

  // Stops at the same place (e.g. start and end in Arusha) share one marker with both numbers.
  const groups = new Map<string, TourStop[]>();
  for (const stop of stops) {
    const key = `${Number(stop.lat).toFixed(3)},${Number(stop.lng).toFixed(3)}`;
    groups.set(key, [...(groups.get(key) ?? []), stop]);
  }
  const markers = new Map<number, MapLibre.Marker>();
  for (const group of groups.values()) {
    const first = group[0];
    const body = group
      .map(
        (s) =>
          `<strong>${s.position}. ${esc(s.name)}</strong><br>${s.day ? `${esc(labels.day)} ${s.day} · ` : ''}${esc(labels.kinds[s.kind] ?? s.kind)}` +
          `${s.elevation_m != null ? `<br>${esc(labels.altitude)} ≈ ${s.elevation_m.toLocaleString('en-US')} m` : ''}${s.note ? `<br>${esc(s.note)}` : ''}`,
      )
      .join('<hr style="margin:6px 0;border:0;border-top:1px solid #e7e5e0">');
    const element = markerElement(group.map((s) => s.position).join('·'), group.some((s) => s.kind === 'peak'));
    element.setAttribute('aria-label', group.map((s) => `${s.position}. ${s.name}`).join(', '));
    const marker = new ml.Marker({ element })
      .setLngLat([Number(first.lng), Number(first.lat)])
      .setPopup(new ml.Popup({ offset: 18, maxWidth: '260px' }).setHTML(`<div style="font:14px/1.4 system-ui,sans-serif;color:${INK}">${body}</div>`))
      .addTo(map);
    for (const s of group) markers.set(s.position, marker);
  }

  return {
    destroy: () => map.remove(),
    focus: (position) => {
      const marker = markers.get(position);
      if (!marker) return;
      map.flyTo({ center: marker.getLngLat(), zoom: Math.max(map.getZoom(), 11), essential: true });
      if (!marker.getPopup()?.isOpen()) marker.togglePopup();
    },
  };
}
