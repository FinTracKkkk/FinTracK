/* ============================================================
   FinTrack — Offline Mode
   Registers the service worker (app shell caching) and shows a
   persistent online/offline indicator next to the page title.
   ============================================================ */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Registration fails silently on file:// or unsupported hosts —
      // the app still works, just without offline caching until deployed.
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  injectConnectionDot();
  updateConnectionDot();
  window.addEventListener('online', updateConnectionDot);
  window.addEventListener('offline', updateConnectionDot);
});

function injectConnectionDot() {
  const brand = document.querySelector('.topbar .brand');
  if (!brand || document.getElementById('connDot')) return;

  const dot = document.createElement('span');
  dot.id = 'connDot';
  dot.style.cssText = 'display:inline-block;width:7px;height:7px;border-radius:50%;margin-left:7px;vertical-align:middle;transition:background .2s;';
  brand.appendChild(dot);
}

function updateConnectionDot() {
  const dot = document.getElementById('connDot');
  if (!dot) return;
  if (navigator.onLine) {
    dot.style.background = '#2E7D6B';
    dot.title = 'Online';
  } else {
    dot.style.background = '#9AA3B2';
    dot.title = 'Offline — changes are saved on this device and nothing is lost.';
  }
}
