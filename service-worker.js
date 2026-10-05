const CACHE_NAME = 'cuesheet-v4';
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
  './manage-fireworks.html',
  './plan-show.html',
  './aar-reports.html',
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
  event.respondWith(
    fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() =>
      caches.match(event.request)
    )
  );
});
