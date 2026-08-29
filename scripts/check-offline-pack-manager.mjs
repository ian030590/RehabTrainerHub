#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const {
  CreateOfflinePackManager,
  GetOfflinePackTotalBytes,
  ParseOfflinePackManifest,
  offlinePackCacheName,
  ValidateOfflinePack,
} = await LoadManager();

const shared = Uint8Array.from([1, 2, 3, 4]);
const firstOnly = Uint8Array.from([5, 6, 7]);
const secondOnly = Uint8Array.from([8, 9]);
const resources = {
  '/runtimes/motor/assets/shared.js': shared,
  '/games/demo/first.js': firstOnly,
  '/games/demo/second.js': secondOnly,
};
const packOne = await CreatePack('official-game:demo-one', 'v1', [
  ['/runtimes/motor/assets/shared.js', shared],
  ['/games/demo/first.js', firstOnly],
]);
const packTwo = await CreatePack('official-game:demo-two', 'v1', [
  ['/runtimes/motor/assets/shared.js', shared],
  ['/games/demo/second.js', secondOnly],
]);

const parsedManifest = ParseOfflinePackManifest({
  schemaVersion: 1,
  kind: 'official-training-offline-pack',
  packId: packOne.id,
  moduleId: 'motor:demo-one',
  version: packOne.version,
  scope: packOne.scope,
  resources: packOne.resources,
  ignoredServerField: 'discarded at the boundary',
}, { packId: packOne.id, moduleId: 'motor:demo-one' });
assert.equal(parsedManifest.id, packOne.id);
assert.equal(GetOfflinePackTotalBytes(parsedManifest), shared.byteLength + firstOnly.byteLength);
assert.equal(Object.hasOwn(parsedManifest, 'ignoredServerField'), false);
assert.throws(
  () => ParseOfflinePackManifest({
    schemaVersion: 1,
    kind: 'official-training-offline-pack',
    packId: packOne.id,
    moduleId: 'motor:other-game',
    version: packOne.version,
    scope: packOne.scope,
    resources: packOne.resources,
  }, { packId: packOne.id, moduleId: 'motor:demo-one' }),
  /module does not match/,
);

class MemoryMetadataStore {
  packs = [];

  async read() {
    return this.packs.map((pack) => ({ ...pack, resources: pack.resources.map((resource) => ({ ...resource })) }));
  }

  async write(packs) {
    this.packs = packs.map((pack) => ({ ...pack, resources: pack.resources.map((resource) => ({ ...resource })) }));
  }
}

class FakeCacheStorage {
  caches = new Map();

  async open(name) {
    let cache = this.caches.get(name);
    if (!cache) {
      cache = new FakeCache();
      this.caches.set(name, cache);
    }
    return cache;
  }

  async keys() {
    return [...this.caches.keys()];
  }

  async delete(name) {
    return this.caches.delete(name);
  }
}

class FakeCache {
  entries = new Map();

  async put(request, response) {
    this.entries.set(new Request(request).url, response.clone());
  }

  async match(request) {
    return this.entries.get(new Request(request).url)?.clone();
  }

  async delete(request) {
    return this.entries.delete(new Request(request).url);
  }

  async keys() {
    return [...this.entries.keys()].map((url) => new Request(url));
  }

  async has(path) {
    return this.entries.has(new URL(path, 'https://trainerhub.invalid').toString());
  }
}

const cacheStorage = new FakeCacheStorage();
const metadata = new MemoryMetadataStore();
const progress = [];
const manager = CreateOfflinePackManager({
  cacheStorage,
  metadataStore: metadata,
  fetch: async (request) => {
    const path = new URL(request.url).pathname;
    const body = resources[path];
    return body ? new Response(body, { status: 200 }) : new Response('missing', { status: 404 });
  },
});

await manager.install(packOne, { onProgress: (value) => progress.push(value) });
assert.equal(progress.length, 2);
assert.deepEqual(await manager.verify(packOne), 'ready');
assert.equal((await manager.list()).find((pack) => pack.id === packOne.id)?.status, 'ready');

const conflictingPack = await CreatePack('official-game:conflicting', 'v1', [
  ['/runtimes/motor/assets/shared.js', Uint8Array.from([9, 9, 9, 9])],
]);
await assert.rejects(
  () => manager.install(conflictingPack),
  /conflicts with an installed immutable asset/,
);
assert.deepEqual(
  await manager.verify(packOne),
  'ready',
  'a conflicting pack must not replace an already installed immutable resource',
);

const concurrentCacheStorage = new FakeCacheStorage();
const concurrentMetadata = new MemoryMetadataStore();
let resolveFetchStarted;
let releaseFetch;
const firstFetch = new Promise((resolve) => { releaseFetch = resolve; });
const fetchStarted = new Promise((resolve) => { resolveFetchStarted = resolve; });
let delayedFetchCount = 0;
const concurrentManager = CreateOfflinePackManager({
  cacheStorage: concurrentCacheStorage,
  metadataStore: concurrentMetadata,
  fetch: async (request) => {
    if (delayedFetchCount++ === 0) {
      resolveFetchStarted();
      await firstFetch;
    }
    const body = resources[new URL(request.url).pathname];
    return body ? new Response(body, { status: 200 }) : new Response('missing', { status: 404 });
  },
});
const firstInstall = concurrentManager.install(packOne);
await fetchStarted;
await assert.rejects(
  () => concurrentManager.install(packOne),
  /already leased/,
  'a second install for the same pack must be rejected before it can race metadata writes',
);
releaseFetch();
await firstInstall;

await manager.install(packTwo);
assert.deepEqual(await manager.verify(packTwo), 'ready');
await manager.remove(packOne);
assert.deepEqual(await manager.verify(packTwo), 'ready', 'shared resource must survive first pack removal');
assert.deepEqual(await manager.verify(packOne), 'missing');
assert.equal(await cacheStorage.open(offlinePackCacheName).then((cache) => cache.has('/games/demo/first.js')), false);
await manager.remove(packTwo);
assert.equal(await cacheStorage.open(offlinePackCacheName).then((cache) => cache.has('/runtimes/motor/assets/shared.js')), false);

const corruptPack = await CreatePack('official-game:corrupt', 'v1', [
  ['/games/demo/corrupt.js', Uint8Array.from([1, 1, 1])],
]);
resources['/games/demo/corrupt.js'] = Uint8Array.from([2, 2, 2]);
await assert.rejects(() => manager.install(corruptPack), /hash mismatch/);
assert.equal((await manager.list()).some((pack) => pack.id === corruptPack.id), false);
assert.equal((await cacheStorage.keys()).some((name) => name.includes('staging')), false);

const abortController = new AbortController();
abortController.abort();
await assert.rejects(
  () => manager.install(packOne, { signal: abortController.signal }),
  (error) => error?.name === 'AbortError',
);

assert.throws(
  () => ValidateOfflinePack({
    id: 'unsafe',
    version: 'v1',
    scope: '/games/demo/',
    resources: [{ url: 'https://evil.invalid/a.js', byteSize: 1, sha256: 'a'.repeat(64) }],
  }),
  /same-origin|escapes/i,
);
assert.throws(
  () => ValidateOfflinePack({
    id: 'official-game:demo',
    version: 'v1',
    scope: '/games/demo/',
    resources: [{ url: '/games/other/a.js', byteSize: 1, sha256: 'a'.repeat(64) }],
  }),
  /escapes/i,
);

const orphanCache = await cacheStorage.open(offlinePackCacheName);
await orphanCache.put(new Request('https://trainerhub.invalid/games/demo/orphan.js'), new Response('orphan'));
await cacheStorage.open('rehab-trainer-offline-staging-v1:orphan');
await manager.reconcile();
assert.equal(await orphanCache.has('/games/demo/orphan.js'), false);
assert.equal((await cacheStorage.keys()).some((name) => name.includes('staging')), false);

console.log('Offline pack manager contract passed: staged installs, references, integrity, abort, scope, and reconciliation.');

async function CreatePack(id, version, entries) {
  return {
    id,
    version,
    scope: '/games/demo/',
    resources: await Promise.all(entries.map(async ([url, bytes]) => ({
      url,
      byteSize: bytes.byteLength,
      sha256: await Sha256(bytes),
      required: true,
    }))),
  };
}

async function Sha256(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function LoadManager() {
  const sourcePath = resolve(repoRoot, 'packages/ui/src/offlinePackManager.ts');
  const output = ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: sourcePath,
  }).outputText;
  return import(`${pathToFileURL(sourcePath).href}?check=${Date.now()}`).catch(async () => (
    import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
  ));
}
