const CACHE_NAME = 'saysee-pwa-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve()))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/__') || url.hostname.includes('huggingface.co')) {
    return;
  }
  // Network-first so dev & tunnel updates are always reflected immediately
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
