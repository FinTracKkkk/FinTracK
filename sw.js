/* ============================================================
   FinTrack — Service Worker
   Network-first: always tries to fetch the latest version first,
   and only falls back to the cached copy when there's no internet.
   This means deployed updates show up immediately when online,
   while the app still works fully offline as a fallback.
   Bump CACHE_VERSION whenever you want to force old caches to clear.
   ============================================================ */

const CACHE_VERSION = 'fintrack-v3';

const APP_SHELL = [
  'index.html',
  'app.html',
  'salary.html',
  'debts.html',
  'splits.html',
  'budgets.html',
  'goals.html',
  'transactions.html',
  'analytics.html',
  'settings.html',
  'manifest.json',
  'css/styles.css',
  'css/auth.css',
  'css/dashboard.css',
  'css/quick-add.css',
  'css/salary.css',
  'css/debts.css',
  'css/splits.css',
  'css/analytics.css',
  'css/alerts.css',
  'css/settings.css',
  'js/auth.js',
  'js/wallet-store.js',
  'js/transaction-store.js',
  'js/goals-store.js',
  'js/budget-store.js',
  'js/split-store.js',
  'js/dashboard-data.js',
  'js/dashboard.js',
  'js/quick-add.js',
  'js/salary.js',
  'js/debts.js',
  'js/splits.js',
  'js/budgets.js',
  'js/goals.js',
  'js/transactions-list.js',
  'js/analytics-data.js',
  'js/analytics.js',
  'js/export-pdf.js',
  'js/export-debt-pdf.js',
  'js/export-split-pdf.js',
  'js/alerts.js',
  'js/settings.js',
  'js/offline.js',
  'js/supabase-config.js',
  'js/sync.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/logo-full.png'
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
    fetch(event.request)
      .then((response) => {
        // Got a fresh response — cache it for offline use later, and serve it now
        if (response.ok && event.request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // No network — fall back to whatever we have cached
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') return caches.match('app.html');
        });
      })
  );
});
