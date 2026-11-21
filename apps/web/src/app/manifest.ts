import type { MetadataRoute } from 'next';

// Lets people add Kwetuly to their phone's home screen. Served at /manifest.webmanifest.
// No service worker: nothing is cached for offline use. start_url "/" sends each person to
// their own language, the same way the site's address does.
// Icons come from docs/design/kwetuly: the 192 and 512 are the rounded tile; the maskable one is
// the full-bleed square icon, whose "k" and sun sit inside the safe circle so phones can crop it.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Kwetuly',
    short_name: 'Kwetuly',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: '#1D951A',
    background_color: '#ffffff',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
