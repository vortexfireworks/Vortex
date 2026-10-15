const CACHE_NAME = 'cuesheet-v5';
const ASSETS = [
  './',
  './index.html',
  './form.html',
  './checkin.html',
  './qr-codes.html',
  './payroll.html',
  './manage.html',
  './hp-tools.html',
  './new-hire.html',
  './update-info.html',
  './pyro-directory.html',
  './operators.html',
  './venues.html',
  './pick-lists.html',
  './manage-picklists.html',
  './manage-inventory.html',
  './plan-show.html',
  './aar-reports.html',
  './announcements.html',
  './backups.html',
  './auth.js',
  './enable-signin.html',
  './plan-a-show.html',
  './catalog.html',
  './import-products.html',
  './picklist-common.js',
  './release-notes.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './logo.jpg',
  './cuesheet-logo.jpg',
  './menu-bg.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(ASSETS.map(url =>
        fetch(url, {cache: 'reload'}).then(res => cache.put(url, res)).catch(() => {})
      ))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  // Only ever handle this app's own files. Anything cross-origin (the Apps Script
  // backend, Google fonts, CDN scripts, etc.) must go straight to the network,
  // untouched — caching or retrying a live API call here would risk silently
  // serving stale or empty data if the pass-through fetch below ever hiccups.
  if (new URL(event.request.url).origin !== self.location.origin) return;
  // {cache: 'no-store'} skips the browser's own disk cache for this fetch (iOS Safari in
  // particular can otherwise keep serving an old copy of a page even once this worker is
  // trying to fetch a fresh one), so what we cache and serve below is always what the
  // server has right now, with the cache here used only as an offline fallback.
  event.respondWith(
    fetch(event.request, { cache: 'no-store' }).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() =>
      caches.match(event.request)
    )
  );
});
