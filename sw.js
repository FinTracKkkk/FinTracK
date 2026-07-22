/* ============================================================
   FinTrack — Service Worker
   Cache-first app shell so the app opens and works with zero
   internet connection. Bump CACHE_VERSION whenever files change
   so returning users get the update.
   ============================================================ */

const CACHE_VERSION = 'fintrack-v1';

const APP_SHELL = [
  'index.html',
  'app.html',
  'salary.html',
  'debts.html',
  'analytics.html',
  'settings.html',
  'manifest.json',
  'css/styles.css',
  'css/auth.css',
  'css/dashboard.css',
  'css/quick-add.css',
  'css/salary.css',
  'css/debts.css',
  'css/analytics.css',
  'css/alerts.css',
  'css/settings.css',
  'js/auth.js',
  'js/wallet-store.js',
  'js/dashboard-data.js',
  'js/dashboard.js',
  'js/quick-add.js',
  'js/salary.js',
  'js/debts.js',
  'js/analytics-data.js',
  'js/analytics.js',
  'js/alerts.js',
  'js/settings.js',
  'js/offline.js',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // Cache successful same-origin responses for next time offline
          if (response.ok && event.request.url.startsWith(self.location.origin)) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline and not cached — fall back to the dashboard shell for navigations
          if (event.request.mode === 'navigate') {
            return caches.match('app.html');
          }
        });
    })
  );
});
