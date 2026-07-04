// CACHE_NAME is stamped by swVersionPlugin at build time (e.g. 'mortimer-cache-1234567890')
const CACHE_NAME = 'mortimer-cache-v1';

// Core shell assets. Hashed JS/CSS chunks are injected by swVersionPlugin at
// build time so every chunk is pre-cached on install.
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './icons.svg',
];

// Placeholder replaced at build time with the full hashed-asset list.
// In dev (sw.js served from public/ without a build step) this stays empty.
const VITE_ASSETS = /*VITE_ASSETS_PLACEHOLDER*/[];

const ASSETS_TO_CACHE = [...new Set([...SHELL_ASSETS, ...VITE_ASSETS])];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  // Do NOT call skipWaiting() here — we want the waiting SW to hold until the
  // page explicitly triggers an update via the SKIP_WAITING message.
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Message ──────────────────────────────────────────────────────────────────
// The app sends SKIP_WAITING when the user clicks "Reload" in the update banner.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  }
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  // Only intercept same-origin GETs
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Stale-while-revalidate: serve from cache immediately, refresh in background
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse?.status === 200) {
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(event.request, networkResponse));
            }
          })
          .catch(() => {}); // offline — ignore
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, responseToCache));
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback: return cached index.html for page navigations
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
