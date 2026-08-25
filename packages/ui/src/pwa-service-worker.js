const cacheName = '__CACHE_NAME__';
const precacheUrls = /* __PRECACHE_URLS__ */ ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(Precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('rehab-trainer-') && key !== cacheName)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (
    request.method !== 'GET'
    || request.headers.has('range')
    || url.origin !== self.location.origin
    || url.pathname.startsWith('/api/')
  ) {
    return;
  }

  const isVersionedAsset = url.pathname.startsWith('/assets/')
    && /-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/.test(url.pathname);
  event.respondWith(isVersionedAsset ? CacheFirst(request) : NetworkFirst(request));
});

async function CacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  return FetchAndCache(request);
}

async function NetworkFirst(request) {
  try {
    return await FetchAndCache(request);
  } catch {
    return (await caches.match(request))
      || (request.mode === 'navigate' ? await caches.match(request, { ignoreSearch: true }) : undefined)
      || (request.mode === 'navigate' ? await caches.match('/') : undefined)
      || Response.error();
  }
}

async function FetchAndCache(request) {
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }
  return response;
}

async function Precache() {
  const cache = await caches.open(cacheName);
  const batchSize = 20;
  for (let index = 0; index < precacheUrls.length; index += batchSize) {
    await cache.addAll(precacheUrls.slice(index, index + batchSize));
  }
}
