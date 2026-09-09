const CACHE_NAME = 'aar-form-v2';
const ASSETS = [
  './',
  './index.html',
  './form.html',
  './checkin.html',
  './qr-codes.html',
  './payroll.html',
  './manage.html',
  './hp-tools.html',
  './operators.html',
  './venues.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './logo.jpg',
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
