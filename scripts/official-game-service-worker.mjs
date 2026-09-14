export function BuildGameServiceWorker({ basePath, gameId, revision, shellUrls }) {
  const cachePrefix = `trainerhub-official-game:${gameId}:`;
  const cacheName = `${cachePrefix}${revision}`;
  const precacheUrls = [...new Set([
    basePath,
    `${basePath}manifest.webmanifest`,
    `${basePath}settings.json`,
    // Cloudflare Pages redirects directory index files to their trailing-slash URL.
    ...shellUrls.map((url) => url.replace(/\/index\.html$/, '/')),
  ])].sort();
  return `'use strict';
const cachePrefix = ${JSON.stringify(cachePrefix)};
const cacheName = ${JSON.stringify(cacheName)};
const scopePath = ${JSON.stringify(basePath)};
const launcherUrl = new URL(scopePath, self.location.origin).href;
const precacheUrls = Object.freeze(${JSON.stringify(precacheUrls)});
const precachePaths = new Set(precacheUrls.map((value) => new URL(value, self.location.origin).pathname));
const runtimeDestinations = new Set(['audio', 'font', 'image', 'script', 'style', 'track', 'video', 'worker']);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(precacheUrls)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith(cachePrefix) && key !== cacheName).map((key) => caches.delete(key)),
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || request.headers.has('range') || request.headers.has('authorization')) return;
  if (request.mode === 'navigate' && url.origin === self.location.origin && url.pathname === scopePath) {
    event.respondWith(NetworkFirstLauncher(request));
    return;
  }
  if (url.origin === self.location.origin && precachePaths.has(url.pathname) && !url.search) {
    event.respondWith(CacheFirst(request));
    return;
  }
  if (request.mode !== 'navigate' && runtimeDestinations.has(request.destination)) {
    event.respondWith(CacheFirst(request));
  }
});

async function NetworkFirstLauncher(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.status === 404 || response.status === 410) {
      await DisableGamePwa();
      return response;
    }
    if (response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(launcherUrl, response.clone());
    }
    return NavigationResponse(response);
  } catch {
    return NavigationResponse(await (await caches.open(cacheName)).match(launcherUrl) || Response.error());
  }
}

async function CacheFirst(request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return request.mode === 'navigate' ? NavigationResponse(cached) : cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') await cache.put(request, response.clone());
  return request.mode === 'navigate' ? NavigationResponse(response) : response;
}

function NavigationResponse(response) {
  // Precache fetches follow redirects, but navigation requests use redirect: manual.
  // A redirected cached Response cannot be returned to such a navigation.
  if (!response.redirected) return response;
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

async function DisableGamePwa() {
  await Promise.all([
    caches.delete(cacheName),
    self.registration.unregister(),
  ]);
}
`;
}
