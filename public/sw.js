const CACHE_NAME = 'ghosti-pwa-v20261127-v22';
const IMMUTABLE_HASHED_ASSET_RX = /^\/assets\/.+-[A-Za-z0-9_-]{6,}\.(?:js|css|wasm|png|jpg|jpeg|webp|svg|woff2?)$/i;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // [시크릿 창·신규 방문자 10초 2중 로딩 근본 해결]:
  // 최초 SW 활성화 시 client.navigate(client.url)로 멀쩡히 로드된 페이지를 강제 리로드하던 동작을 제거합니다.
  // HTML navigate 요청은 아래 fetch 핸들러에서 cache:'no-store'로 항상 최신 배포본을 받으므로 강제 리로드가 불필요합니다.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
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
  // (배포 교체 직후 구 해시 청크가 SPA fallback(text/html)으로 내려올 때는 절대 캐시 오염시키지 않고 404 반환해 자동 리로드 복구가 작동하게 보장)
  if (url.origin === self.location.origin && IMMUTABLE_HASHED_ASSET_RX.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((hit) => {
          if (hit) {
            const hitType = (hit.headers.get('content-type') || '').toLowerCase();
            if (!hitType.includes('text/html')) return hit;
            void cache.delete(event.request);
          }
          return fetch(event.request).then((res) => {
            if (!res) return res;
            const ct = (res.headers.get('content-type') || '').toLowerCase();
            if (ct.includes('text/html')) {
              return new Response('', { status: 404, statusText: 'Stale Chunk' });
            }
            if (res.ok) {
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
