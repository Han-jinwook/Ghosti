const CACHE_NAME = 'ghosti-pwa-v20261120-v15';
const IMMUTABLE_HASHED_ASSET_RX = /^\/assets\/.+-[A-Za-z0-9_-]{6,}\.(?:js|css|wasm|png|jpg|jpeg|webp|svg|woff2?)$/i;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll({ type: 'window' }).then((windowClients) => {
          windowClients.forEach((client) => {
            try {
              client.navigate(client.url);
            } catch {
              // ignore navigation error
            }
          });
        })
      )
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (
    url.hostname === '127.0.0.1' ||
    url.hostname === 'localhost' ||
    url.pathname.startsWith('/__') ||
    url.hostname.includes('huggingface.co')
  ) {
    return;
  }
  // Always bypass browser HTTP cache for HTML navigation requests so deploys reflect 100% immediately
  if (
    event.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html')
  ) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request))
    );
    return;
  }
  // Content-hashed immutable Vite bundles (/assets/*-<hash>.js|css) -> Cache-First for <2ms --app startup
  if (url.origin === self.location.origin && IMMUTABLE_HASHED_ASSET_RX.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((hit) => {
          if (hit) return hit;
          return fetch(event.request).then((res) => {
            if (res && res.ok) {
              cache.put(event.request, res.clone());
            }
            return res;
          });
        })
      )
    );
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
