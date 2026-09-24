const CACHE_NAME = 'at-trail-shell-v9';

// Exact URLs for the app shell (cache-first: always served from cache once installed).
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './route.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png'
];

// Third-party library/style files needed to render the map at all. Precached
// at install so a single visit is enough to make the app fully offline-capable,
// rather than relying on them being opportunistically cached later.
const LIBRARY_URLS = [
  'https://cdn.jsdelivr.net/npm/maplibre-gl@4/dist/maplibre-gl.js',
  'https://cdn.jsdelivr.net/npm/maplibre-gl@4/dist/maplibre-gl.css',
  'https://cdn.jsdelivr.net/npm/maplibre-contour@0.1.1/dist/index.min.js',
  'https://tiles.openfreemap.org/styles/liberty'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await cache.addAll(SHELL_FILES);
      // Fetch each library file individually (not cache.addAll) so one failed
      // fetch (e.g. flaky connection during install) doesn't abort the rest.
      await Promise.all(LIBRARY_URLS.map(url =>
        fetch(url, { mode: 'cors' })
          .then(res => { if (res.ok) return cache.put(url, res); })
          .catch(() => {})
      ));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Resolve SHELL_FILES to absolute URLs once, for exact matching below
// (a previous version matched by string suffix, which had a bug: './'
// stripped down to an empty string that matched every request).
const SHELL_URLS = new Set(SHELL_FILES.map(f => new URL(f, self.registration.scope).href));

// App shell: cache-first (fast, always available offline).
// Everything else (map library, style, tiles, fonts): network-first so
// content stays fresh, falling back to cache so it still works offline
// for anything fetched on a previous visit (including the precached
// library/style files above).
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  if (SHELL_URLS.has(event.request.url)) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
