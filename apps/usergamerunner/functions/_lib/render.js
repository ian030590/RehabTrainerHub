import { EncodePackagePath } from './release.js';
import {
  platformRuntimeContract,
  platformRuntimePrecacheUrls,
} from './runtime.js';

export const trustedPlatformOrigin = 'https://trainerhub.cc';
const maximumResultDurationMs = 24 * 60 * 60 * 1000;
const maximumResultPayloadBytes = 16_000;
const maximumResultTrialCount = 100_000;
const releaseHealthCheckIntervalMs = 60 * 1000;
const runnerCacheRevision = '2026-08-17-platform-runtime-v3';

export function RenderLauncher(release, basePath, runnerOrigin, embedOptions = {}) {
  const cspNonce = RandomToken(18);
  const entryUrl = `${basePath}package/${EncodePackagePath(release.entry)}`;
  const manifestUrl = `${basePath}manifest.webmanifest`;
  const serviceWorkerUrl = `${basePath}sw.js`;
  const clientConfiguration = SerializeForScript({
    basePath,
    cachePrefix: CreateReleaseCachePrefix(release),
    entryUrl,
    embedMode: embedOptions.embedMode === true,
    embedSessionNonce: embedOptions.embedSessionNonce ?? null,
    gameId: release.gameId,
    gameVersion: release.version,
    healthUrl: new URL(basePath, runnerOrigin).href,
    serviceWorkerUrl,
    trustedPlatformOrigin,
  });

  const body = `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="robots" content="noindex,nofollow,noarchive" />
    <meta name="theme-color" content="#172033" />
    <link rel="manifest" href="${EscapeHtml(manifestUrl)}" />
    <link rel="apple-touch-icon" href="${EscapeHtml(platformRuntimeContract.icon192Url)}" />
    <title>${EscapeHtml(release.name)}｜居家訓練網遊戲</title>
    <style nonce="${cspNonce}">
      :root {
        color-scheme: dark;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        --runner-page: #0b1020;
        --runner-panel: #172033;
        --runner-border: #334155;
        --runner-text: #f8fafc;
        --runner-muted: #cbd5e1;
        --runner-control: #e2e8f0;
        --runner-control-border: #64748b;
        --runner-control-text: #0f172a;
        --runner-frame: #ffffff;
      }
      * { box-sizing: border-box; }
      html, body { width: 100%; min-height: 100%; margin: 0; background: var(--runner-page); color: var(--runner-text); }
      body { min-height: 100vh; min-height: 100dvh; overflow: hidden; }
      main { display: grid; grid-template-rows: auto 1fr; width: 100%; height: 100vh; height: 100dvh; }
      header { display: flex; align-items: center; gap: .75rem; min-width: 0; padding: .65rem max(.75rem, env(safe-area-inset-right)) .65rem max(.75rem, env(safe-area-inset-left)); background: var(--runner-panel); border-bottom: 1px solid var(--runner-border); }
      h1 { flex: 1; min-width: 0; margin: 0; overflow: hidden; font-size: 1rem; text-overflow: ellipsis; white-space: nowrap; }
      #runner-status { color: var(--runner-muted); font-size: .8rem; white-space: nowrap; }
      button { display: none; border: 1px solid var(--runner-control-border); border-radius: .5rem; padding: .45rem .7rem; background: var(--runner-control); color: var(--runner-control-text); font: inherit; font-weight: 700; cursor: pointer; }
      button[data-visible="true"] { display: inline-block; }
      iframe { display: block; width: 100%; height: 100%; border: 0; background: var(--runner-frame); }
    </style>
    <script nonce="${cspNonce}">
      (() => {
        'use strict';
        const config = Object.freeze(${clientConfiguration});
        const messageSchema = 'trainerhub.game-platform/v1';
        const lifecycleMessageType = 'trainerhub.game:lifecycle';
        const resultMessageType = 'trainerhub.game:result';
        const sessionId = createRandomId();
        const sessionNonce = config.embedSessionNonce ?? createRandomId();
        const lifecyclePhases = new Set(['ready', 'started', 'paused', 'resumed', 'completed', 'aborted']);
        const maximumResultDurationMs = ${maximumResultDurationMs};
        const maximumResultPayloadBytes = ${maximumResultPayloadBytes};
        const maximumResultTrialCount = ${maximumResultTrialCount};
        const resultStatuses = new Set(['completed', 'aborted']);
        const sensitiveMetricKey = /(auth|authorization|birthday|cookie|credential|dob|email|jwt|name|participant|password|phone|secret|session|token|user)/i;
        let lastAcceptedSequence = -1;
        let gamePort = null;
        let gameFrameInitialized = false;
        let gameFrameFailed = false;

        window.addEventListener('message', (event) => {
          if (window.parent !== window
            && event.source === window.parent
            && event.origin === config.trustedPlatformOrigin) {
            receivePlatformMessage(event.data);
          }
        });

        document.addEventListener('DOMContentLoaded', () => {
          const installButton = document.getElementById('install-button');
          const status = document.getElementById('runner-status');
          const gameFrame = document.getElementById('game-frame');
          let installPrompt = null;

          gameFrame.addEventListener('load', () => handleGameFrameLoad(gameFrame, status));
          gameFrame.src = config.entryUrl;

          window.addEventListener('beforeinstallprompt', (event) => {
            event.preventDefault();
            installPrompt = event;
            installButton.dataset.visible = 'true';
          });
          installButton.addEventListener('click', async () => {
            if (!installPrompt) return;
            installButton.dataset.visible = 'false';
            await installPrompt.prompt();
            installPrompt = null;
          });
          window.addEventListener('appinstalled', () => {
            status.textContent = '已安裝';
            installButton.dataset.visible = 'false';
          });

          if (window.matchMedia('(display-mode: standalone)').matches) {
            status.textContent = '已安裝';
          }

          announceToPlatform({
            schema: messageSchema,
            type: 'trainerhub.runner:ready',
            gameId: config.gameId,
            gameVersion: config.gameVersion,
            sessionId,
            sessionNonce,
          });

          if (!config.embedMode) {
            try {
              const serviceWorker = navigator.serviceWorker;
              if (serviceWorker) {
                serviceWorker.register(config.serviceWorkerUrl, {
                  scope: config.basePath,
                  updateViaCache: 'none',
                }).catch(() => {
                  status.textContent = '離線安裝暫時無法使用';
                });
              }
            } catch {
              status.textContent = '離線安裝暫時無法使用';
            }
          }

          const checkReleaseHealth = () => verifyReleaseHealth(gameFrame, status);
          window.setInterval(checkReleaseHealth, ${releaseHealthCheckIntervalMs});
          window.addEventListener('online', checkReleaseHealth);
        });

        let releaseHealthCheckActive = false;

        async function verifyReleaseHealth(gameFrame, status) {
          if (releaseHealthCheckActive || gameFrameFailed) return;
          releaseHealthCheckActive = true;
          try {
            const response = await fetch(config.healthUrl, {
              method: 'HEAD',
              cache: 'no-store',
              credentials: 'omit',
              redirect: 'error',
            });
            if (response.status === 404 || response.status === 410) {
              failGameFrameClosed(gameFrame, status);
              await retireReleaseStorage();
            }
          } catch {
            // Offline play is supported. Only an authoritative 404/410 revokes a release.
          } finally {
            releaseHealthCheckActive = false;
          }
        }

        async function retireReleaseStorage() {
          if (config.embedMode) return;
          try {
            const keys = await caches.keys();
            await Promise.all(keys
              .filter((key) => key.startsWith(config.cachePrefix))
              .map((key) => caches.delete(key)));
          } catch {
            // Cache Storage may be unavailable in a restricted browser context.
          }
          try {
            const serviceWorker = navigator.serviceWorker;
            const registration = await serviceWorker?.getRegistration(config.basePath);
            if (registration?.scope === config.healthUrl) await registration.unregister();
          } catch {
            // The sandboxed Hub launcher intentionally cannot access Service Workers.
          }
        }

        function receiveGameMessage(message) {
          if (!isExactPlainObject(message, ['schema', 'type', 'sessionNonce', 'sequence', 'payload'])
            || message.schema !== messageSchema
            || message.sessionNonce !== sessionNonce
            || !Number.isSafeInteger(message.sequence)
            || message.sequence < 0
            || message.sequence <= lastAcceptedSequence) return;

          const sanitized = message.type === lifecycleMessageType
            ? sanitizeLifecycleMessage(message)
            : message.type === resultMessageType
              ? sanitizeResultMessage(message)
              : null;
          if (!sanitized || !isPayloadSizeAllowed(sanitized.payload)) return;
          lastAcceptedSequence = message.sequence;
          announceToPlatform(sanitized);
        }

        function receivePlatformMessage(message) {
          if (!isExactPlainObject(
            message,
            ['schema', 'type', 'sessionId', 'sessionNonce', 'command'],
          )
            || message.schema !== messageSchema
            || message.type !== 'trainerhub.runner:command'
            || message.sessionId !== sessionId
            || message.sessionNonce !== sessionNonce
              || !['pause', 'resume', 'exit'].includes(message.command)) {
            return;
          }
          if (!gamePort || gameFrameFailed) return;
          gamePort.postMessage({
            schema: messageSchema,
            type: 'trainerhub.host:command',
            sessionId,
            sessionNonce,
            command: message.command,
          });
        }

        function handleGameFrameLoad(gameFrame, status) {
          if (gameFrameInitialized) {
            failGameFrameClosed(gameFrame, status);
            return;
          }
          gameFrameInitialized = true;
          const channel = new MessageChannel();
          gamePort = channel.port1;
          gamePort.addEventListener('message', (event) => {
            if (!gameFrameFailed) receiveGameMessage(event.data);
          });
          gamePort.addEventListener('messageerror', () => failGameFrameClosed(gameFrame, status), { once: true });
          gamePort.start();
          gameFrame.contentWindow.postMessage({
            schema: messageSchema,
            type: 'trainerhub.host:init',
            gameId: config.gameId,
            gameVersion: config.gameVersion,
            sessionId,
            sessionNonce,
          }, '*', [channel.port2]);
        }

        function failGameFrameClosed(gameFrame, status) {
          if (gameFrameFailed) return;
          gameFrameFailed = true;
          gamePort?.close();
          gamePort = null;
          gameFrame.remove();
          status.textContent = '遊戲已因非預期導向而停止';
        }

        function announceToPlatform(message) {
          if (window.parent !== window) {
            window.parent.postMessage(message, config.trustedPlatformOrigin);
          }
        }

        function createRandomId() {
          const bytes = crypto.getRandomValues(new Uint8Array(24));
          return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
        }

        function sanitizeLifecycleMessage(message) {
          if (!isExactPlainObject(message.payload, ['phase'], ['progress'])
            || !lifecyclePhases.has(message.payload.phase)
            || ('progress' in message.payload
              && (!Number.isFinite(message.payload.progress)
                || message.payload.progress < 0
                || message.payload.progress > 1))) return null;
          return {
            schema: messageSchema,
            type: lifecycleMessageType,
            sessionNonce,
            sequence: message.sequence,
            payload: {
              phase: message.payload.phase,
              ...('progress' in message.payload ? { progress: message.payload.progress } : {}),
            },
          };
        }

        function sanitizeResultMessage(message) {
          if (!isExactPlainObject(
            message.payload,
            ['status'],
            ['score', 'durationMs', 'trialCount', 'metrics'],
          ) || !resultStatuses.has(message.payload.status)) return null;

          const payload = { status: message.payload.status };
          if ('score' in message.payload) {
            if (!Number.isFinite(message.payload.score)) return null;
            payload.score = message.payload.score;
          }
          if ('durationMs' in message.payload) {
            if (!Number.isSafeInteger(message.payload.durationMs)
              || message.payload.durationMs < 0
              || message.payload.durationMs > maximumResultDurationMs) return null;
            payload.durationMs = message.payload.durationMs;
          }
          if ('trialCount' in message.payload) {
            if (!Number.isSafeInteger(message.payload.trialCount)
              || message.payload.trialCount < 0
              || message.payload.trialCount > maximumResultTrialCount) return null;
            payload.trialCount = message.payload.trialCount;
          }
          if ('metrics' in message.payload) {
            if (!isSafeMetrics(message.payload.metrics)) return null;
            payload.metrics = Object.fromEntries(Object.entries(message.payload.metrics));
          }
          return {
            schema: messageSchema,
            type: resultMessageType,
            sessionNonce,
            sequence: message.sequence,
            payload,
          };
        }

        function isSafeMetrics(value) {
          if (!isPlainRecord(value)) return false;
          const keys = Reflect.ownKeys(value);
          return keys.length <= 512 && keys.every((key) => {
            if (typeof key !== 'string'
              || !Object.prototype.propertyIsEnumerable.call(value, key)
              || !/^[a-z][A-Za-z0-9_.-]{0,63}$/.test(key)
              || sensitiveMetricKey.test(key)) return false;
            const metric = value[key];
            return metric === null || typeof metric === 'boolean' || Number.isFinite(metric);
          });
        }

        function isPayloadSizeAllowed(value) {
          return new TextEncoder().encode(JSON.stringify(value)).byteLength <= maximumResultPayloadBytes;
        }

        function isExactPlainObject(value, requiredKeys, optionalKeys = []) {
          if (!isPlainRecord(value)) return false;
          const keys = Reflect.ownKeys(value);
          const allowedKeys = new Set([...requiredKeys, ...optionalKeys]);
          return keys.every((key) => typeof key === 'string'
            && Object.prototype.propertyIsEnumerable.call(value, key)
            && allowedKeys.has(key))
            && requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
        }

        function isPlainRecord(value) {
          if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
          const prototype = Object.getPrototypeOf(value);
          return prototype === Object.prototype || prototype === null;
        }
      })();
    </script>
  </head>
  <body>
    <main>
      <header>
        <h1>${EscapeHtml(release.name)}</h1>
        <span id="runner-status" role="status">隔離執行</span>
        <button id="install-button" type="button">安裝遊戲</button>
      </header>
      <iframe credentialless id="game-frame" title="${EscapeHtml(release.name)}" referrerpolicy="no-referrer" sandbox="allow-scripts"></iframe>
    </main>
  </body>
</html>`;

  return { body, cspNonce };
}

export function RenderManifest(release, basePath) {
  return JSON.stringify({
    id: basePath,
    name: `${release.name}｜居家訓練網`,
    short_name: release.shortName,
    description: release.description,
    lang: 'zh-Hant',
    dir: 'ltr',
    start_url: basePath,
    scope: basePath,
    display: 'standalone',
    orientation: 'any',
    background_color: '#0b1020',
    theme_color: '#172033',
    icons: [
      {
        src: platformRuntimeContract.icon192Url,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: platformRuntimeContract.icon512Url,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${basePath}icon.svg`,
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any maskable',
      },
    ],
  });
}

export async function RenderServiceWorker(release, basePath) {
  const cacheFingerprint = await CreateReleaseFingerprint(release);
  const cachePrefix = CreateReleaseCachePrefix(release);
  const cacheName = `${cachePrefix}${cacheFingerprint}`;
  const releaseUrls = release.files.map(
    (file) => `${basePath}package/${EncodePackagePath(file.path)}`,
  );
  const precacheUrls = [
    basePath,
    `${basePath}manifest.webmanifest`,
    `${basePath}icon.svg`,
    ...platformRuntimePrecacheUrls,
    ...releaseUrls,
  ];

  return `'use strict';
const cachePrefix = ${JSON.stringify(cachePrefix)};
const cacheName = ${JSON.stringify(cacheName)};
const precacheUrls = Object.freeze(${JSON.stringify(precacheUrls)});
const precachePaths = new Set(precacheUrls.map((value) => new URL(value, self.location.origin).pathname));

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(precacheUrls)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(DeleteReleaseCaches(cacheName).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin || requestUrl.search) return;
  if (!precachePaths.has(requestUrl.pathname)) return;
  const canonicalUrl = new URL(requestUrl.pathname, self.location.origin).href;
  event.respondWith(caches.open(cacheName).then(async (cache) => {
    const cached = await cache.match(canonicalUrl);
    try {
      const networkRequest = new Request(event.request, { cache: 'no-store' });
      const response = await fetch(networkRequest);
      if (response.ok) {
        await cache.put(canonicalUrl, response.clone());
        return response;
      }
      if (response.status === 404 || response.status === 410) {
        await DeleteReleaseCaches();
        await self.registration.unregister();
        return response;
      }
      return cached ?? response;
    } catch {
      return cached ?? Response.error();
    }
  }));
});

async function DeleteReleaseCaches(keepCacheName = null) {
  const keys = await caches.keys();
  await Promise.all(keys
    .filter((key) => key.startsWith(cachePrefix) && key !== keepCacheName)
    .map((key) => caches.delete(key)));
}
`;
}

export function RenderIcon(release) {
  const initials = Array.from(release.shortName.trim()).slice(0, 2).join('').toUpperCase() || 'TH';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="${EscapeHtml(release.name)}">
  <rect width="512" height="512" rx="108" fill="#172033"/>
  <circle cx="256" cy="256" r="174" fill="#2563eb"/>
  <text x="256" y="292" fill="#ffffff" font-family="system-ui,sans-serif" font-size="132" font-weight="700" text-anchor="middle">${EscapeHtml(initials)}</text>
</svg>`;
}

export function EscapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function CreateReleaseFingerprint(release) {
  const fingerprintSource = JSON.stringify({
    runnerCacheRevision,
    entry: release.entry,
    files: release.files.map(({ path, sha256, size }) => ({ path, sha256, size })),
    platformRuntimePrecacheUrls,
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprintSource));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

function CreateReleaseCachePrefix(release) {
  return `trainerhub-game:${release.gameId}:${release.version}:`;
}

function RandomToken(byteLength) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function SerializeForScript(value) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}
