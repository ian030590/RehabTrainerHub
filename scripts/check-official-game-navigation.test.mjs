import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { BuildGameServiceWorker } from './official-game-service-worker.mjs';

const root = resolve(import.meta.dirname, '..');
const basePath = '/games/plus-minus/';
const cacheName = 'trainerhub-official-game:plus-minus:regression';

test('all ExpFactory runtime assets are precached without nested iframe documents', async (t) => {
  const source = await readFile(resolve(root, 'packages/ui/src/components/ExpFactoryGame.tsx'), 'utf8');
  assert.match(source, /new URL\('\.\/runtime\/', window\.location\.href\)/);
  assert.doesNotMatch(source, /<iframe|postMessage/);
  const gameRoot = resolve(root, 'apps/rehabtrainerhub/games');
  const games = await readdir(gameRoot, { withFileTypes: true });
  for (const game of games.filter((entry) => entry.isDirectory())) {
    const files = await readdir(resolve(gameRoot, game.name));
    const components = await Promise.all(files.filter((file) => file.endsWith('.tsx'))
      .map((file) => readFile(resolve(gameRoot, game.name, file), 'utf8')));
    if (!components.some((component) => component.includes('ExpFactoryGame'))) continue;
    await t.test(game.name, async () => {
      const manifest = JSON.parse(await readFile(resolve(gameRoot, game.name, 'public/runtime/manifest.json'), 'utf8'));
      assert.ok(manifest.scripts.includes('experiment.js'));
      const scope = `/games/${game.name}/`;
      const runtimeUrls = [scope + 'runtime/manifest.json', scope + 'runtime/experiment.js'];
      const worker = await CreateWorker(t, scope, runtimeUrls);
      await worker.dispatch('install');
      assert.ok(!worker.requests.some((path) => path.endsWith('/index.html')), 'Precache must use canonical directory URLs');
      worker.offline = true;
      const cacheNames = await worker.caches.keys();
      const cache = await worker.caches.open(cacheNames[0]);
      for (const path of runtimeUrls) assert.ok(await cache.match(worker.origin + path), `${path} must be cached.`);
    });
  }
});

test('redirected precache responses remain usable for offline iframe navigation', async (t) => {
  const worker = await CreateWorker(t);
  // This extra HTML URL intentionally follows a real HTTP 308 during install.
  await worker.dispatch('install');
  const cache = await worker.caches.open(cacheName);
  const cached = await cache.match(worker.origin + basePath + 'instructions.html');
  assert.equal(cached.redirected, true, 'Fixture must reproduce the original redirected Response');
  worker.offline = true;
  const response = await worker.navigate(basePath + 'instructions.html');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(response.headers.get('content-security-policy'), "frame-ancestors 'self'");
  assert.equal(await response.text(), '<!doctype html><p>Legacy game</p>');
});

test('launcher falls back to its cached response offline and activation removes only obsolete game caches', async (t) => {
  const worker = await CreateWorker(t);
  await worker.dispatch('install');
  const oldCache = 'trainerhub-official-game:plus-minus:old';
  const otherCache = 'trainerhub-official-game:stroop:old';
  await worker.caches.open(oldCache);
  await worker.caches.open(otherCache);
  await worker.dispatch('activate');
  assert.deepEqual((await worker.caches.keys()).sort(), [cacheName, otherCache].sort());
  assert.equal(worker.claimed, true);
  worker.offline = true;
  const response = await worker.navigate(basePath);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '<!doctype html><p>Legacy game</p>');
});

test('both CI workflows retain the navigation regression through the pwa gate', async () => {
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  assert.match(pkg.scripts['test:pwa'], /npm run test:pwa-navigation/);
  assert.equal(pkg.scripts['test:pwa-navigation'], 'node --test scripts/check-official-game-navigation.test.mjs');
  for (const file of ['ci.yml', 'deploy-cloudflare-pages.yml']) {
    const workflow = await readFile(resolve(root, '.github/workflows', file), 'utf8');
    assert.match(workflow, /- name: pwa\s+command: npm run test:pwa/);
    assert.ok(workflow.includes('".github/workflows/**"'));
  }
});

async function CreateWorker(t, scope = basePath, shellUrls = [scope + 'runtime/manifest.json', scope + 'instructions.html']) {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push(request.url);
    if (request.url.endsWith('/index.html') || request.url.endsWith('/instructions.html')) {
      response.writeHead(308, { location: request.url.replace(/(?:index|instructions)\.html$/, '') });
      response.end();
      return;
    }
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': "frame-ancestors 'self'",
    });
    response.end('<!doctype html><p>Legacy game</p>');
  });
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', accept);
  });
  t.after(() => new Promise((accept) => {
    server.close(accept);
    server.closeAllConnections();
  }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const worker = { origin, requests, offline: false, claimed: false };
  const workerFetch = (request, options) => {
    if (worker.offline) return Promise.reject(new TypeError('offline'));
    return fetch(typeof request === 'string' ? new URL(request, origin) : request.url, {
      redirect: request.redirect ?? 'follow', ...options,
    });
  };
  const stores = new Map();
  const key = (request) => new URL(typeof request === 'string' ? request : request.url, origin).href;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async put(request, response) { entries.set(key(request), response.clone()); },
        async match(request) { return entries.get(key(request))?.clone(); },
        async addAll(urls) {
          for (const url of urls) {
            const response = await workerFetch(url);
            assert.equal(response.ok, true);
            await this.put(url, response);
          }
        },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  const listeners = new Map();
  const code = BuildGameServiceWorker({
    basePath: scope, gameId: scope.split('/')[2], revision: 'regression',
    shellUrls,
  });
  runInNewContext(code, {
    URL, Response, caches, fetch: workerFetch,
    self: {
      location: { origin },
      addEventListener: (type, listener) => listeners.set(type, listener),
      skipWaiting: async () => {},
      clients: { claim: async () => { worker.claimed = true; } },
      registration: { unregister: async () => true },
    },
  });
  return Object.assign(worker, {
    caches,
    async dispatch(type) {
      let pending;
      listeners.get(type)({ waitUntil: (promise) => { pending = promise; } });
      await pending;
    },
    async navigate(path) {
      let pending;
      listeners.get('fetch')({
        request: { url: origin + path, method: 'GET', mode: 'navigate', redirect: 'manual', headers: new Headers() },
        respondWith: (promise) => { pending = promise; },
      });
      assert.ok(pending, 'Offline navigation must be handled by the worker');
      const response = await pending;
      // The browser rejects redirected responses for a navigation with redirect: manual.
      assert.equal(response.redirected, false, 'Would cause net::ERR_FAILED in an iframe');
      return response;
    },
  });
}
