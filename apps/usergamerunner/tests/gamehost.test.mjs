import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { MessageChannel } from 'node:worker_threads';

import { HandleRequest } from '../functions/[[path]].js';
import {
  ContentTypeForPath,
  PackageKey,
  ParseGameRoute,
  ReleaseKey,
  ReleaseValidationError,
  ValidateRelease,
  maxPackageBytes,
  maxPackageFileBytes,
  maxReleaseFiles,
} from '../functions/_lib/release.js';
import {
  platformRuntimeContract,
  platformRuntimePrecacheUrls,
} from '../functions/_lib/runtime.js';

const textEncoder = new TextEncoder();
const sha256 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

class MockBucket {
  constructor(objects) {
    this.objects = new Map(
      Object.entries(objects).map(([key, value]) => [key, ToBytes(value)]),
    );
    this.requestedKeys = [];
  }

  async get(key) {
    this.requestedKeys.push(key);
    const bytes = this.objects.get(key);
    if (!bytes) return null;
    return {
      body: bytes.slice(),
      customMetadata: { sha256 },
      size: bytes.byteLength,
      etag: 'test-etag',
      httpEtag: '"test-etag"',
      text: async () => new TextDecoder().decode(bytes),
    };
  }

  async head(key) {
    this.requestedKeys.push(key);
    const bytes = this.objects.get(key);
    return bytes ? { customMetadata: { sha256 }, size: bytes.byteLength } : null;
  }
}

test('route parser isolates one game/version and rejects traversal', () => {
  assert.deepEqual(ParseGameRoute('/games/reaction-time/1.2.0/'), {
    kind: 'launcher',
    basePath: '/games/reaction-time/1.2.0/',
    gameId: 'reaction-time',
    version: '1.2.0',
  });
  assert.equal(
    ParseGameRoute('/games/reaction-time/1.2.0/package/assets/sound.mp3').path,
    'assets/sound.mp3',
  );
  assert.equal(ParseGameRoute('/games/reaction-time/1.2.0/package/%2e%2e/secret').kind, 'invalid');
  assert.equal(ParseGameRoute('/games/reaction-time/1.2.0/package/assets%2Fsecret').kind, 'invalid');
  assert.equal(ParseGameRoute('/games/Reaction-Time/1.2.0/').kind, 'invalid');
});

test('release validator requires approval, jsPsych 8, hashes, and an allowlisted entry', () => {
  const release = BuildRelease();
  const validated = ValidateRelease(release, release.gameId, release.version);
  assert.equal(validated.runtime.name, 'jspsych');
  assert.equal(validated.files.length, 2);
  assert.deepEqual(validated.capabilities, ['audio']);
  const licensed = ValidateRelease({ ...release, license: { id: 'MIT', label: 'MIT License', url: 'https://opensource.org/license/mit/' } }, release.gameId, release.version);
  assert.equal(licensed.license.id, 'MIT');
  assert.throws(
    () => ValidateRelease({ ...release, license: { id: 'not-declared', label: 'License not declared', url: null } }, release.gameId, release.version),
    ReleaseValidationError,
  );

  assert.throws(
    () => ValidateRelease({ ...release, status: 'pending' }, release.gameId, release.version),
    ReleaseValidationError,
  );
  assert.throws(
    () => ValidateRelease({ ...release, runtime: { name: 'custom', major: 1 } }, release.gameId, release.version),
    ReleaseValidationError,
  );
  assert.throws(
    () => ValidateRelease({ ...release, entry: '../index.html' }, release.gameId, release.version),
    ReleaseValidationError,
  );
  assert.equal(maxReleaseFiles, 192);
  assert.equal(maxPackageBytes, 24 * 1024 * 1024);
  assert.equal(maxPackageFileBytes, 8 * 1024 * 1024);
  assert.throws(
    () => ValidateRelease({
      ...release,
      files: [{ ...release.files[0], size: maxPackageFileBytes + 1 }, release.files[1]],
    }, release.gameId, release.version),
    ReleaseValidationError,
  );
  assert.throws(
    () => ValidateRelease({
      ...release,
      files: Array.from({ length: maxReleaseFiles + 1 }, (_, index) => ({
        ...release.files[0],
        path: index === 0 ? 'index.html' : `asset-${index}.html`,
      })),
    }, release.gameId, release.version),
    ReleaseValidationError,
  );
});

test('launcher is a noindex PWA shell with an opaque-origin iframe and strict relay', async () => {
  const context = CreateContext('/games/reaction-time/1.0.0/');
  const response = await HandleRequest(context);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/html/);
  assert.match(
    response.headers.get('content-security-policy'),
    /connect-src https:\/\/trainerhub-user-games\.pages\.dev/,
  );
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'self' https:\/\/trainerhub\.cc/);
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  assert.match(html, /sandbox="allow-scripts"/);
  assert.match(html, /credentialless/);
  assert.match(html, /referrerpolicy="no-referrer"/);
  assert.doesNotMatch(html, /allow-same-origin|allow-top-navigation/);
  assert.match(html, /const channel = new MessageChannel\(\)/);
  assert.match(html, /\[channel\.port2\]/);
  assert.match(html, /gamePort\.addEventListener\('message'/);
  assert.match(html, /if \(gameFrameInitialized\)/);
  assert.match(html, /gameFrame\.remove\(\)/);
  assert.doesNotMatch(html, /event\.source === gameFrame\.contentWindow/);
  assert.match(html, /event\.source === window\.parent/);
  assert.match(html, /event\.origin === config\.trustedPlatformOrigin/);
  assert.match(html, /message\.sessionNonce !== sessionNonce/);
  assert.match(html, /message\.sequence <= lastAcceptedSequence/);
  assert.match(html, /trainerhub\.game-platform\/v1/);
  assert.match(html, /trainerhub\.game:lifecycle/);
  assert.match(html, /trainerhub\.game:result/);
  assert.match(html, /const maximumResultDurationMs = 86400000/);
  assert.match(html, /const maximumResultPayloadBytes = 16000/);
  assert.match(html, /const maximumResultTrialCount = 100000/);
  assert.match(html, /method: 'HEAD'/);
  assert.match(html, /cache: 'no-store'/);
  assert.match(html, /window\.setInterval\(checkReleaseHealth, 60000\)/);
  assert.match(html, /key\.startsWith\(config\.cachePrefix\)/);
  assert.match(html, /https:\/\/trainerhub\.cc/);
  assert.doesNotMatch(html, /apiToken|accessToken|authToken/);
});

test('Hub embed mode uses only a valid caller-provided session nonce', async () => {
  const sessionNonce = 'Abcdefghijklmnopqrstuvwxyz_1234567890';
  const response = await HandleRequest(CreateContext(
    `/games/reaction-time/1.0.0/?embed=hub&session=${sessionNonce}`,
  ));
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, new RegExp(`"embedSessionNonce":"${sessionNonce}"`));
  assert.match(html, /window\.parent\.postMessage\(message, config\.trustedPlatformOrigin\)/);

  const shortSession = await HandleRequest(CreateContext(
    '/games/reaction-time/1.0.0/?embed=hub&session=short',
  ));
  assert.equal(shortSession.status, 400);
  const unexpectedParameter = await HandleRequest(CreateContext(
    `/games/reaction-time/1.0.0/?embed=hub&session=${sessionNonce}&token=never`,
  ));
  assert.equal(unexpectedParameter.status, 400);
});

test('sandboxed launchers announce ready without requiring service worker access', async () => {
  const sessionNonce = 'Abcdefghijklmnopqrstuvwxyz_1234567890';
  const embedResponse = await HandleRequest(CreateContext(
    `/games/reaction-time/1.0.0/?embed=hub&session=${sessionNonce}`,
  ));
  let embedServiceWorkerReads = 0;
  const embedNavigator = {};
  Object.defineProperty(embedNavigator, 'serviceWorker', {
    get() {
      embedServiceWorkerReads += 1;
      throw new Error('sandboxed service worker access');
    },
  });
  const embedRun = RunLauncherDomContent(await embedResponse.text(), embedNavigator);
  assert.equal(embedServiceWorkerReads, 0);
  assert.equal(embedRun.announcements.at(-1)?.message.type, 'trainerhub.runner:ready');
  assert.equal(embedRun.announcements.at(-1)?.message.sessionNonce, sessionNonce);

  const standaloneResponse = await HandleRequest(CreateContext('/games/reaction-time/1.0.0/'));
  const inaccessibleNavigator = {};
  Object.defineProperty(inaccessibleNavigator, 'serviceWorker', {
    get() {
      throw new Error('service worker unavailable');
    },
  });
  const standaloneRun = RunLauncherDomContent(
    await standaloneResponse.text(),
    inaccessibleNavigator,
  );
  assert.equal(standaloneRun.announcements.at(-1)?.message.type, 'trainerhub.runner:ready');
});

test('launcher health check retires an online revoked release', async () => {
  const response = await HandleRequest(CreateContext('/games/reaction-time/1.0.0/'));
  const deletedCaches = [];
  let healthRequest = null;
  let unregistered = false;
  const registration = {
    scope: 'https://trainerhub-user-games.pages.dev/games/reaction-time/1.0.0/',
    async unregister() {
      unregistered = true;
    },
  };
  const run = RunLauncherDomContent(await response.text(), {
    serviceWorker: {
      async getRegistration() {
        return registration;
      },
      async register() {
        return registration;
      },
    },
  }, {
    caches: {
      async delete(key) {
        deletedCaches.push(key);
        return true;
      },
      async keys() {
        return [
          'trainerhub-game:reaction-time:1.0.0:current',
          'trainerhub-game:reaction-time:1.0.0:old',
          'trainerhub-game:another-game:1.0.0:keep',
        ];
      },
    },
    async fetch(url, options) {
      healthRequest = { options, url };
      return { status: 404 };
    },
  });

  assert.equal(run.intervalCallbacks.length, 1);
  await run.intervalCallbacks[0]();
  assert.equal(healthRequest.url, 'https://trainerhub-user-games.pages.dev/games/reaction-time/1.0.0/');
  assert.equal(healthRequest.options.method, 'HEAD');
  assert.equal(healthRequest.options.cache, 'no-store');
  assert.equal(healthRequest.options.credentials, 'omit');
  assert.equal(run.elements['game-frame'].removed, true);
  assert.deepEqual(deletedCaches, [
    'trainerhub-game:reaction-time:1.0.0:current',
    'trainerhub-game:reaction-time:1.0.0:old',
  ]);
  assert.equal(unregistered, true);
});

test('launcher transfers one private port and fails closed after a frame navigation', async () => {
  const response = await HandleRequest(CreateContext('/games/reaction-time/1.0.0/'));
  const html = await response.text();
  const script = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);

  const documentListeners = new Map();
  const frameListeners = new Map();
  const windowListeners = new Map();
  const transferredMessages = [];
  const installButton = {
    dataset: {},
    addEventListener() {},
  };
  const status = { textContent: '' };
  const gameFrame = {
    contentWindow: {
      postMessage(message, targetOrigin, ports) {
        transferredMessages.push({ message, ports, targetOrigin });
      },
    },
    removed: false,
    src: '',
    addEventListener(type, listener) {
      frameListeners.set(type, listener);
    },
    remove() {
      this.removed = true;
    },
  };
  const document = {
    addEventListener(type, listener) {
      documentListeners.set(type, listener);
    },
    getElementById(id) {
      return { 'game-frame': gameFrame, 'install-button': installButton, 'runner-status': status }[id];
    },
  };
  const window = {
    addEventListener(type, listener) {
      windowListeners.set(type, listener);
    },
    matchMedia() {
      return { matches: false };
    },
    setInterval() {
      return 1;
    },
  };
  window.parent = window;

  vm.runInNewContext(script, {
    MessageChannel,
    Object,
    Reflect,
    Set,
    TextEncoder,
    crypto: webcrypto,
    document,
    navigator: {},
    window,
  });
  documentListeners.get('DOMContentLoaded')();
  assert.equal(gameFrame.src, '/games/reaction-time/1.0.0/package/index.html');

  frameListeners.get('load')();
  assert.equal(transferredMessages.length, 1);
  assert.equal(transferredMessages[0].message.type, 'trainerhub.host:init');
  assert.equal(transferredMessages[0].targetOrigin, '*');
  assert.equal(transferredMessages[0].ports.length, 1);

  frameListeners.get('load')();
  assert.equal(transferredMessages.length, 1);
  assert.equal(gameFrame.removed, true);
  assert.match(status.textContent, /停止/);
  transferredMessages[0].ports[0].close();
});

test('result relay enforces the game-runs API numeric and byte limits', async () => {
  const sessionNonce = 'Abcdefghijklmnopqrstuvwxyz_1234567890';
  const response = await HandleRequest(CreateContext(
    `/games/reaction-time/1.0.0/?embed=hub&session=${sessionNonce}`,
  ));
  const relay = RunLauncherMessageRelay(await response.text());
  const resultAnnouncements = () => relay.announcements.filter(
    ({ message }) => message.type === 'trainerhub.game:result',
  );
  const postResult = async (sequence, payload) => {
    relay.gamePort.postMessage({
      schema: 'trainerhub.game-platform/v1',
      type: 'trainerhub.game:result',
      sessionNonce,
      sequence,
      payload,
    });
    await new Promise((resolve) => setImmediate(resolve));
  };

  await postResult(0, { status: 'completed', durationMs: 86_400_001 });
  await postResult(0, { status: 'completed', durationMs: 1.5 });
  await postResult(0, { status: 'completed', trialCount: 100_001 });
  assert.equal(resultAnnouncements().length, 0);

  await postResult(0, {
    status: 'completed',
    durationMs: 86_400_000,
    trialCount: 100_000,
  });
  assert.equal(resultAnnouncements().length, 1);

  const maximumPayload = CreateBoundaryResultPayload(22);
  assert.equal(textEncoder.encode(JSON.stringify(maximumPayload)).byteLength, 16_000);
  await postResult(1, maximumPayload);
  assert.equal(resultAnnouncements().length, 2);

  const oversizedPayload = CreateBoundaryResultPayload(23);
  assert.equal(textEncoder.encode(JSON.stringify(oversizedPayload)).byteLength, 16_001);
  await postResult(2, oversizedPayload);
  assert.equal(resultAnnouncements().length, 2);
  relay.gamePort.close();
});

test('manifest and service worker are unique and scoped to one release', async () => {
  const manifestResponse = await HandleRequest(
    CreateContext('/games/reaction-time/1.0.0/manifest.webmanifest'),
  );
  const manifest = await manifestResponse.json();
  assert.equal(manifest.id, '/games/reaction-time/1.0.0/');
  assert.equal(manifest.scope, '/games/reaction-time/1.0.0/');
  assert.equal(manifest.start_url, '/games/reaction-time/1.0.0/');
  assert.ok(manifest.icons.some((icon) => (
    icon.src === platformRuntimeContract.icon192Url
      && icon.sizes === '192x192'
      && icon.type === 'image/png'
  )));
  assert.ok(manifest.icons.some((icon) => (
    icon.src === platformRuntimeContract.icon512Url
      && icon.sizes === '512x512'
      && icon.type === 'image/png'
  )));

  const workerResponse = await HandleRequest(CreateContext('/games/reaction-time/1.0.0/sw.js'));
  const worker = await workerResponse.text();
  assert.equal(workerResponse.headers.get('service-worker-allowed'), '/games/reaction-time/1.0.0/');
  assert.match(worker, /trainerhub-game:reaction-time:1\.0\.0:/);
  assert.match(worker, /\/games\/reaction-time\/1\.0\.0\/package\/index\.html/);
  assert.match(worker, /\/games\/reaction-time\/1\.0\.0\/package\/assets\/tone\.mp3/);
  for (const runtimeUrl of platformRuntimePrecacheUrls) {
    assert.ok(worker.includes(runtimeUrl), `service worker must precache ${runtimeUrl}`);
  }
  assert.match(worker, /DeleteReleaseCaches\(cacheName\)/);
  assert.match(worker, /requestUrl\.search/);
  assert.match(worker, /new Request\(event\.request, \{ cache: 'no-store' \}\)/);
  assert.match(worker, /await fetch\(networkRequest\)/);
  assert.match(worker, /await DeleteReleaseCaches\(\)/);
  assert.match(worker, /self\.registration\.unregister\(\)/);
  assert.doesNotMatch(worker, /keys\.map\(\(key\) => caches\.delete/);
});

test('service worker deletes only its release caches after an online revocation', async () => {
  const workerResponse = await HandleRequest(CreateContext('/games/reaction-time/1.0.0/sw.js'));
  const worker = await workerResponse.text();
  const listeners = new Map();
  const deletedCaches = [];
  let fetchedRequest = null;
  let responsePromise = null;
  let unregistered = false;
  const cache = {
    async match() {
      return new Response('offline copy');
    },
    async put() {},
  };
  const cacheStorage = {
    async delete(key) {
      deletedCaches.push(key);
      return true;
    },
    async keys() {
      return [
        'trainerhub-game:reaction-time:1.0.0:current',
        'trainerhub-game:reaction-time:1.0.0:old',
        'trainerhub-game:reaction-time:2.0.0:keep',
        'trainerhub-game:another-game:1.0.0:keep',
      ];
    },
    async open() {
      return cache;
    },
  };
  const serviceWorkerGlobal = {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    clients: { async claim() {} },
    location: { origin: 'https://trainerhub-user-games.pages.dev' },
    registration: {
      async unregister() {
        unregistered = true;
      },
    },
    async skipWaiting() {},
  };
  vm.runInNewContext(worker, {
    Object,
    Promise,
    Request,
    Response,
    Set,
    URL,
    caches: cacheStorage,
    async fetch(request) {
      fetchedRequest = request;
      return new Response('revoked', { status: 404 });
    },
    self: serviceWorkerGlobal,
  });
  listeners.get('fetch')({
    request: new Request(
      'https://trainerhub-user-games.pages.dev/games/reaction-time/1.0.0/package/index.html',
    ),
    respondWith(value) {
      responsePromise = value;
    },
  });

  const revokedResponse = await responsePromise;
  assert.equal(revokedResponse.status, 404);
  assert.equal(fetchedRequest.cache, 'no-store');
  assert.deepEqual(deletedCaches, [
    'trainerhub-game:reaction-time:1.0.0:current',
    'trainerhub-game:reaction-time:1.0.0:old',
  ]);
  assert.equal(unregistered, true);
});

test('package route only serves manifest files with restrictive immutable headers', async () => {
  const context = CreateContext('/games/reaction-time/1.0.0/package/index.html');
  const response = await HandleRequest(context);

  assert.equal(response.status, 200);
  assert.equal(await response.text(), '<!doctype html><title>Game</title>');
  assert.match(response.headers.get('content-type'), /^text\/html/);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.match(response.headers.get('permissions-policy'), /camera=\(\)/);
  assert.match(response.headers.get('content-security-policy'), /connect-src 'none'/);
  assert.match(response.headers.get('content-security-policy'), /worker-src 'none'/);
  assert.match(response.headers.get('content-security-policy'), /object-src 'none'/);
  assert.match(response.headers.get('content-security-policy'), /form-action 'none'/);
  assert.match(response.headers.get('content-security-policy'), /sandbox allow-scripts/);
  assert.match(response.headers.get('content-security-policy'), /webrtc 'block'/);
  assert.doesNotMatch(response.headers.get('content-security-policy'), /navigate-to/);
  assert.equal(response.headers.get('x-dns-prefetch-control'), 'off');

  const unlisted = await HandleRequest(CreateContext('/games/reaction-time/1.0.0/package/secret.js'));
  assert.equal(unlisted.status, 404);
  assert.equal(
    context.env.GAME_RELEASE_BUCKET.requestedKeys.at(-1),
    PackageKey('reaction-time', '1.0.0', 'index.html'),
  );
});

test('platform runtime is static, CORS-readable from an opaque sandbox, and non-indexable', async () => {
  const headersSource = await readFile(new URL('../public/_headers', import.meta.url), 'utf8');
  const routes = JSON.parse(await readFile(new URL('../public/_routes.json', import.meta.url), 'utf8'));
  assert.deepEqual(routes.exclude, ['/runtime/*']);

  for (const [pattern, contentType] of [
    ['/runtime/*.js', 'text/javascript; charset=utf-8'],
    ['/runtime/*.css', 'text/css; charset=utf-8'],
    ['/runtime/*.txt', 'text/plain; charset=utf-8'],
    ['/runtime/icons/*.png', 'image/png'],
  ]) {
    const block = HeaderBlock(headersSource, pattern);
    assert.match(block, /Access-Control-Allow-Origin: \*/);
    assert.match(block, /Cross-Origin-Resource-Policy: cross-origin/);
    assert.match(block, /Cache-Control: public, max-age=31536000, immutable/);
    assert.match(block, new RegExp(`Content-Type: ${EscapeRegExp(contentType)}`));
    assert.match(block, /X-Content-Type-Options: nosniff/);
    assert.match(block, /X-Robots-Tag: noindex, nofollow, noarchive/);
  }

  const staticContext = CreateContext(platformRuntimeContract.gameSdkUrl);
  assert.equal(await (await HandleRequest(staticContext)).text(), 'static');
  assert.equal(staticContext.env.GAME_RELEASE_BUCKET.requestedKeys.length, 0);
});

test('the pinned jsPsych browser artifact exposes the documented classic API', async () => {
  const packageJson = JSON.parse(await readFile(
    new URL('../../../node_modules/jspsych/package.json', import.meta.url),
    'utf8',
  ));
  assert.equal(packageJson.version, platformRuntimeContract.jsPsychVersion);
  const source = await readFile(
    new URL('../../../node_modules/jspsych/dist/index.browser.js', import.meta.url),
    'utf8',
  );
  const browserGlobal = { console };
  browserGlobal.window = browserGlobal;
  vm.createContext(browserGlobal);
  vm.runInContext(source, browserGlobal);
  assert.equal(typeof browserGlobal.jsPsychModule?.initJsPsych, 'function');
});

test('the checked-in third-party notice retains the jsPsych MIT attribution', async () => {
  const notice = await readFile(new URL('../THIRD_PARTY_NOTICES.txt', import.meta.url), 'utf8');
  assert.match(notice, /jsPsych 8\.2\.3/);
  assert.match(notice, /Copyright \(c\) 2014-2022 Joshua R\. de Leeuw/);
  assert.match(notice, /MIT License/);
});

test('draft releases and R2 file-size mismatches fail closed', async () => {
  const pending = BuildRelease({ status: 'pending' });
  const pendingContext = CreateContext('/games/reaction-time/1.0.0/', pending);
  assert.equal((await HandleRequest(pendingContext)).status, 404);

  const release = BuildRelease();
  release.files[0].size += 1;
  const mismatchedContext = CreateContext('/games/reaction-time/1.0.0/package/index.html', release);
  assert.equal((await HandleRequest(mismatchedContext)).status, 404);

  const metadataContext = CreateContext('/games/reaction-time/1.0.0/package/index.html');
  const getObject = metadataContext.env.GAME_RELEASE_BUCKET.get.bind(
    metadataContext.env.GAME_RELEASE_BUCKET,
  );
  metadataContext.env.GAME_RELEASE_BUCKET.get = async (key) => {
    const object = await getObject(key);
    if (key.endsWith('/files/index.html')) {
      object.customMetadata.sha256 = 'f'.repeat(64);
    }
    return object;
  };
  assert.equal((await HandleRequest(metadataContext)).status, 404);
});

test('MIME types are determined by the reviewed path rather than upload metadata', () => {
  assert.equal(ContentTypeForPath('index.html'), 'text/html; charset=utf-8');
  assert.equal(ContentTypeForPath('scripts/game.js'), 'text/javascript; charset=utf-8');
  assert.equal(ContentTypeForPath('assets/data.unknown'), 'application/octet-stream');
});

function BuildRelease(overrides = {}) {
  const html = '<!doctype html><title>Game</title>';
  const audio = new Uint8Array([1, 2, 3, 4]);
  return {
    schemaVersion: 1,
    status: 'approved',
    gameId: 'reaction-time',
    version: '1.0.0',
    name: 'Reaction time',
    shortName: 'Reaction',
    description: 'A practice game',
    runtime: { name: 'jspsych', major: 8 },
    capabilities: ['audio'],
    license: { id: 'MIT', label: 'MIT License', url: 'https://opensource.org/license/mit/' },
    contentSha256: sha256,
    approvedAt: '2026-08-17T00:00:00.000Z',
    entry: 'index.html',
    files: [
      { path: 'index.html', size: textEncoder.encode(html).byteLength, sha256, contentType: 'text/html' },
      { path: 'assets/tone.mp3', size: audio.byteLength, sha256, contentType: 'audio/mpeg' },
    ],
    ...overrides,
  };
}

function CreateContext(path, release = BuildRelease()) {
  const html = '<!doctype html><title>Game</title>';
  const objects = {
    [ReleaseKey(release.gameId, release.version)]: JSON.stringify(release),
    [PackageKey(release.gameId, release.version, 'index.html')]: html,
    [PackageKey(release.gameId, release.version, 'assets/tone.mp3')]: new Uint8Array([1, 2, 3, 4]),
  };
  return {
    request: new Request(`https://trainerhub-user-games.pages.dev${path}`),
    env: { GAME_RELEASE_BUCKET: new MockBucket(objects) },
    next: () => new Response('static'),
  };
}

function RunLauncherDomContent(html, navigatorObject, options = {}) {
  const script = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  const documentListeners = new Map();
  const announcements = [];
  const intervalCallbacks = [];
  const elements = {
    'game-frame': {
      addEventListener() {},
      contentWindow: { postMessage() {} },
      removed: false,
      remove() {
        this.removed = true;
      },
      src: '',
    },
    'install-button': {
      addEventListener() {},
      dataset: {},
    },
    'runner-status': { textContent: '' },
  };
  const parentWindow = {
    postMessage(message, targetOrigin) {
      announcements.push({ message, targetOrigin });
    },
  };
  const windowObject = {
    parent: parentWindow,
    addEventListener() {},
    matchMedia() {
      return { matches: false };
    },
    setInterval(callback) {
      intervalCallbacks.push(callback);
      return intervalCallbacks.length;
    },
  };
  const document = {
    addEventListener(type, listener) {
      documentListeners.set(type, listener);
    },
    getElementById(id) {
      return elements[id];
    },
  };

  vm.runInNewContext(script, {
    MessageChannel,
    Object,
    Reflect,
    Set,
    TextEncoder,
    crypto: webcrypto,
    caches: options.caches,
    document,
    fetch: options.fetch,
    navigator: navigatorObject,
    window: windowObject,
  });
  documentListeners.get('DOMContentLoaded')();
  return { announcements, elements, intervalCallbacks };
}

function RunLauncherMessageRelay(html) {
  const script = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  const documentListeners = new Map();
  const frameListeners = new Map();
  const announcements = [];
  let gamePort;
  const elements = {
    'game-frame': {
      addEventListener(type, listener) {
        frameListeners.set(type, listener);
      },
      contentWindow: {
        postMessage(message, targetOrigin, ports) {
          assert.equal(message.type, 'trainerhub.host:init');
          assert.equal(targetOrigin, '*');
          [gamePort] = ports;
        },
      },
      src: '',
    },
    'install-button': {
      addEventListener() {},
      dataset: {},
    },
    'runner-status': { textContent: '' },
  };
  const parentWindow = {
    postMessage(message, targetOrigin) {
      announcements.push({ message, targetOrigin });
    },
  };
  const windowObject = {
    parent: parentWindow,
    addEventListener() {},
    matchMedia() {
      return { matches: false };
    },
    setInterval() {
      return 1;
    },
  };
  const document = {
    addEventListener(type, listener) {
      documentListeners.set(type, listener);
    },
    getElementById(id) {
      return elements[id];
    },
  };

  vm.runInNewContext(script, {
    MessageChannel,
    Object,
    Reflect,
    Set,
    TextEncoder,
    crypto: webcrypto,
    document,
    navigator: {},
    window: windowObject,
  });
  documentListeners.get('DOMContentLoaded')();
  frameListeners.get('load')();
  assert.ok(gamePort);
  return { announcements, gamePort };
}

function CreateBoundaryResultPayload(finalMetricKeyLength) {
  const metrics = Object.fromEntries(Array.from({ length: 231 }, (_, index) => [
    `m${index.toString(36).padStart(3, '0')}${'x'.repeat(60)}`,
    0,
  ]));
  metrics[`z${'q'.repeat(finalMetricKeyLength - 1)}`] = 0;
  return { status: 'completed', metrics };
}

function HeaderBlock(source, pathPattern) {
  const normalizedSource = source.replace(/\r\n/g, '\n');
  const start = normalizedSource.indexOf(`${pathPattern}\n`);
  assert.notEqual(start, -1, `missing header block ${pathPattern}`);
  const remainder = normalizedSource.slice(start + pathPattern.length + 1);
  const end = remainder.search(/\n(?=\/)/);
  return end === -1 ? remainder : remainder.slice(0, end);
}

function EscapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ToBytes(value) {
  if (value instanceof Uint8Array) return value;
  return textEncoder.encode(String(value));
}
