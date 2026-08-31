#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import {
  dirname,
  extname,
  join,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = resolve(repoRoot, 'apps/rehabtrainerhub/out');
const outputIndex = resolve(outputDir, 'index.html');
const setupRegistryPath = resolve(
  repoRoot,
  'apps/rehabtrainerhub/training-modules/registry/setupLoaders.ts',
);
const browserPath = FindBrowserPath();
const timeoutMs = ReadPositiveInteger(
  process.env.OFFICIAL_TRAINING_RUNTIME_TIMEOUT_MS,
  45_000,
);

if (!existsSync(outputIndex)) {
  throw new Error(`Built Hub output is missing: ${outputIndex}\nRun pnpm run build:hub first.`);
}
if (!browserPath) {
  throw new Error('No Chromium-based browser executable was found for official training runtime acceptance.');
}

const registeredModuleIds = ReadSetupModuleIds(setupRegistryPath);
const requestedModuleIds = ParseRequestedModuleIds(
  process.env.OFFICIAL_TRAINING_RUNTIME_MODULE_IDS,
  registeredModuleIds,
);
const runModuleIds = [...requestedModuleIds, requestedModuleIds[0]];
const localRuntimeAssetSources = await ReadLocalRuntimeAssetSources();
const server = http.createServer((request, response) => ServeOutput(
  request,
  response,
  outputDir,
  localRuntimeAssetSources,
));
await new Promise((resolvePromise, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolvePromise);
});
const serverAddress = server.address();
assert.ok(serverAddress && typeof serverAddress === 'object');
const baseUrl = `http://127.0.0.1:${serverAddress.port}`;

const debugPort = await GetAvailablePort();
const browserProfileDir = mkdtempSync(join(tmpdir(), 'official-training-runtime-'));
let browserProcess;
let browserLogs = '';
let cdp;
let sessionId;

try {
  browserProcess = spawn(browserPath, [
    '--headless=new',
    '--no-sandbox',
    '--no-first-run',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-dev-shm-usage',
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--enable-webgl',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--use-angle=swiftshader',
    '--window-size=1440,1000',
    `--user-data-dir=${browserProfileDir}`,
    `--remote-debugging-port=${debugPort}`,
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  browserProcess.stdout.on('data', (chunk) => { browserLogs += chunk; });
  browserProcess.stderr.on('data', (chunk) => { browserLogs += chunk; });

  const version = await WaitForHttp(
    `http://127.0.0.1:${debugPort}/json/version`,
    'Chromium debugger',
  );
  cdp = await ConnectCdp(JSON.parse(version.body).webSocketDebuggerUrl);
  const target = await cdp.Send('Target.createTarget', { url: 'about:blank' });
  const attached = await cdp.Send('Target.attachToTarget', {
    targetId: target.targetId,
    flatten: true,
  });
  sessionId = attached.sessionId;

  await cdp.Send('Page.enable', undefined, sessionId);
  await cdp.Send('Runtime.enable', undefined, sessionId);
  await cdp.Send('Network.enable', undefined, sessionId);
  await cdp.Send('Log.enable', undefined, sessionId);
  await cdp.Send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: 1440,
    screenHeight: 1000,
  }, sessionId);

  for (let index = 0; index < runModuleIds.length; index += 1) {
    const moduleId = runModuleIds[index];
    const repeated = index === runModuleIds.length - 1;
    const eventStart = cdp.events.length;
    try {
      await Navigate(cdp, sessionId, `${baseUrl}/?runtime-smoke=${index}`);
      await OpenNativeSetup(cdp, sessionId, moduleId, timeoutMs);

      await ClickFrameAction(cdp, sessionId, moduleId, 'rules', timeoutMs);
      await WaitForSurface(
        cdp,
        sessionId,
        moduleId,
        `(surface, frameDocument) => {
          const start = frameDocument.querySelector('[data-training-action="start"]');
          return surface.dataset.phase === 'rules'
            && start?.tagName === 'BUTTON'
            && !start.disabled;
        }`,
        timeoutMs,
        'rules-ready with an enabled start action',
      );

      await ClickFrameAction(cdp, sessionId, moduleId, 'start', timeoutMs);
      await WaitForSurface(
        cdp,
        sessionId,
        moduleId,
        `(surface, frameDocument) => {
          const mount = frameDocument.querySelector('.native-training-mount');
          const runtimeRoot = mount?.firstElementChild;
          const rect = runtimeRoot?.getBoundingClientRect();
          return surface.dataset.phase === 'running'
            && mount?.childElementCount > 0
            && Boolean(rect && rect.width > 0 && rect.height > 0);
        }`,
        timeoutMs,
        'running with a visible mounted training surface',
      );
      await Wait(500);
      AssertNoCriticalBrowserFailures(cdp.events.slice(eventStart), sessionId, baseUrl, moduleId);
      console.log(
        `Official training runtime startability passed for ${moduleId}${repeated ? ' (fresh second run)' : ''}.`,
      );
    } catch (error) {
      const snapshot = await ReadSurfaceSnapshot(cdp, sessionId).catch(() => null);
      throw new Error(
        `Official training runtime startability failed for ${moduleId}${repeated ? ' (fresh second run)' : ''}.\n`
          + `Surface snapshot: ${JSON.stringify(snapshot)}\n${error.stack || error}`,
      );
    }
  }
} catch (error) {
  console.error(error.stack || error);
  console.error(`\nBrowser logs:\n${browserLogs.slice(-5000)}`);
  process.exitCode = 1;
} finally {
  cdp?.ws.close();
  await StopProcess(browserProcess);
  await CloseServer(server);
  rmSync(browserProfileDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
}

function ReadSetupModuleIds(path) {
  const source = readFileSync(path, 'utf8');
  const ids = [...source.matchAll(/^\s*'([^']+)':\s*\(\)\s*=>/gm)].map((match) => match[1]);
  if (ids.length === 0 || new Set(ids).size !== ids.length) {
    throw new Error('The native setup registry is empty or contains duplicate module IDs.');
  }
  return ids;
}

function ParseRequestedModuleIds(value, registeredIds) {
  if (!value) return registeredIds;
  const requested = [...new Set(String(value).split(',').map((item) => item.trim()).filter(Boolean))];
  const unknown = requested.filter((id) => !registeredIds.includes(id));
  if (requested.length === 0 || unknown.length > 0) {
    throw new Error(`OFFICIAL_TRAINING_RUNTIME_MODULE_IDS contains unknown IDs: ${unknown.join(', ')}`);
  }
  return requested;
}

async function Navigate(client, attachedSessionId, url) {
  await client.Send('Page.navigate', { url }, attachedSessionId);
  await WaitForValue(
    client,
    attachedSessionId,
    `document.readyState === 'complete' || document.readyState === 'interactive'`,
    timeoutMs,
    `navigation to ${url}`,
  );
}

async function OpenNativeSetup(client, attachedSessionId, moduleId, durationMs) {
  const selector = `[data-training-module-id="${moduleId}"] [data-training-action="launch"]`;
  const startedAt = Date.now();
  await WaitForValue(
    client,
    attachedSessionId,
    `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
    durationMs,
    `Hub launch action for ${moduleId}`,
  );

  // A fresh navigation can expose the static launch button before React has
  // installed its click handler. Retry a real pointer click until the native
  // surface opens; this still fails within the same budget for a broken
  // launch flow instead of accepting a pre-hydration no-op as success.
  while (Date.now() - startedAt < durationMs) {
    const remainingMs = Math.max(1_000, durationMs - (Date.now() - startedAt));
    await ClickTopSelector(client, attachedSessionId, selector, Math.min(remainingMs, 2_000));
    try {
      await WaitForSurface(
        client,
        attachedSessionId,
        moduleId,
        `(surface) => surface.dataset.phase === 'config'`,
        Math.min(remainingMs, 2_000),
        'config',
      );
      return;
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith('Timed out waiting for')) throw error;
    }
  }
  throw new Error(`Timed out opening the native setup for ${moduleId}.`);
}

async function WaitForSurface(client, attachedSessionId, moduleId, predicate, durationMs, label) {
  const expression = `(() => {
    const frame = document.querySelector('dialog[open] iframe');
    if (!(frame instanceof HTMLIFrameElement) || !frame.contentWindow) return false;
    const frameDocument = frame.contentDocument;
    const surface = frameDocument?.querySelector('.native-training-surface');
    if (!(surface instanceof frame.contentWindow.HTMLElement)
      || surface.dataset.moduleId !== ${JSON.stringify(moduleId)}) return false;
    return (${predicate})(surface, frameDocument);
  })()`;
  await WaitForValue(client, attachedSessionId, expression, durationMs, `${moduleId} ${label}`);
}

async function ClickTopSelector(client, attachedSessionId, selector, durationMs) {
  const bounds = await WaitForBounds(
    client,
    attachedSessionId,
    `(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!(element instanceof HTMLElement) || element.matches(':disabled')) return null;
      element.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : null;
    })()`,
    durationMs,
    selector,
  );
  await DispatchClick(client, attachedSessionId, bounds);
}

async function ClickFrameAction(client, attachedSessionId, moduleId, action, durationMs) {
  const bounds = await WaitForBounds(
    client,
    attachedSessionId,
    `(() => {
      const frame = document.querySelector('dialog[open] iframe');
      const innerDocument = frame?.contentDocument;
      const surface = innerDocument?.querySelector('.native-training-surface');
      const element = innerDocument?.querySelector(${JSON.stringify(`[data-training-action="${action}"]`)});
      if (!(frame instanceof HTMLIFrameElement)
        || !frame.contentWindow
        || !(surface instanceof frame.contentWindow.HTMLElement)
        || surface.dataset.moduleId !== ${JSON.stringify(moduleId)}
        || !(element instanceof frame.contentWindow.HTMLElement)
        || element.matches(':disabled')) return null;
      element.scrollIntoView({ block: 'center', inline: 'center' });
      const frameRect = frame.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      return elementRect.width > 0 && elementRect.height > 0
        ? {
            x: frameRect.left + elementRect.left + elementRect.width / 2,
            y: frameRect.top + elementRect.top + elementRect.height / 2,
          }
        : null;
    })()`,
    durationMs,
    `${moduleId} ${action}`,
  );
  await DispatchClick(client, attachedSessionId, bounds);
}

async function WaitForBounds(client, attachedSessionId, expression, durationMs, label) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < durationMs) {
    const value = await Evaluate(client, attachedSessionId, expression);
    if (value) return value;
    await Wait(100);
  }
  throw new Error(`Timed out waiting for clickable ${label}.`);
}

async function DispatchClick(client, attachedSessionId, bounds) {
  await client.Send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: bounds.x,
    y: bounds.y,
    button: 'left',
    clickCount: 1,
  }, attachedSessionId);
  await client.Send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: bounds.x,
    y: bounds.y,
    button: 'left',
    clickCount: 1,
  }, attachedSessionId);
}

async function WaitForValue(client, attachedSessionId, expression, durationMs, label) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < durationMs) {
    if (await Evaluate(client, attachedSessionId, expression)) return;
    await Wait(100);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function Evaluate(client, attachedSessionId, expression) {
  const response = await client.Send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }, attachedSessionId);
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
  }
  return response.result.value;
}

async function ReadSurfaceSnapshot(client, attachedSessionId) {
  return Evaluate(client, attachedSessionId, `(() => {
    const frame = document.querySelector('dialog[open] iframe');
    if (!(frame instanceof HTMLIFrameElement) || !frame.contentWindow) {
      return { dialog: false, moduleId: null, phase: null, startDisabled: null, mountChildren: null, text: null };
    }
    const frameDocument = frame.contentDocument;
    const surface = frameDocument?.querySelector('.native-training-surface');
    const start = frameDocument?.querySelector('[data-training-action="start"]');
    const mount = frameDocument?.querySelector('.native-training-mount');
    const runtimeRoot = mount?.firstElementChild;
    const runtimeRect = runtimeRoot?.getBoundingClientRect();
    return {
      dialog: Boolean(frameDocument),
      moduleId: surface?.dataset.moduleId ?? null,
      phase: surface?.dataset.phase ?? null,
      startDisabled: start instanceof frame.contentWindow.HTMLButtonElement ? start.disabled : null,
      mountChildren: mount?.childElementCount ?? null,
      mountHtml: mount?.innerHTML.slice(0, 1200) ?? null,
      runtimeSize: runtimeRect
        ? { width: Math.round(runtimeRect.width), height: Math.round(runtimeRect.height) }
        : null,
      text: frameDocument?.body?.innerText?.slice(0, 1200) ?? null,
    };
  })()`);
}

function AssertNoCriticalBrowserFailures(events, attachedSessionId, origin, moduleId) {
  const exceptions = events
    .filter((event) => event.sessionId === attachedSessionId && event.method === 'Runtime.exceptionThrown')
    .map((event) => event.params.exceptionDetails.exception?.description ?? event.params.exceptionDetails.text);
  const requests = new Map(events
    .filter((event) => event.sessionId === attachedSessionId && event.method === 'Network.requestWillBeSent')
    .map((event) => [event.params.requestId, event.params.request]));
  const failedResources = events
    .filter((event) => event.sessionId === attachedSessionId && event.method === 'Network.loadingFailed')
    .filter((event) => event.params.errorText !== 'net::ERR_ABORTED')
    .map((event) => ({
      errorText: event.params.errorText,
      request: requests.get(event.params.requestId),
      type: event.params.type,
    }))
    .filter(({ request, type }) => (
      request && IsCriticalSameOriginResource(request.url, type, origin)
    ))
    .map(({ errorText, request }) => `${request.url}: ${errorText}`);
  const errorResponses = events
    .filter((event) => event.sessionId === attachedSessionId && event.method === 'Network.responseReceived')
    .filter((event) => event.params.response.status >= 400)
    .filter((event) => IsCriticalSameOriginResource(
      event.params.response.url,
      event.params.type,
      origin,
    ))
    .filter((event) => IsSameOrigin(event.params.response.url, origin))
    .map((event) => `${event.params.response.url}: HTTP ${event.params.response.status}`);

  assert.deepEqual(exceptions, [], `${moduleId} raised browser runtime exceptions.`);
  assert.deepEqual(failedResources, [], `${moduleId} failed to load a critical same-origin resource.`);
  assert.deepEqual(errorResponses, [], `${moduleId} received critical HTTP errors.`);
}

function IsCriticalSameOriginResource(url, type, origin) {
  if (!IsSameOrigin(url, origin)) return false;
  return IsCriticalResourceType(type)
    || /(?:\.html?|\.m?js|\.css)(?:$|[?#])/i.test(url)
    || new URL(url).pathname.startsWith('/runtime-assets/');
}

function IsCriticalResourceType(type) {
  return ['Document', 'Script', 'Stylesheet', 'Image'].includes(type);
}

function IsSameOrigin(candidate, expected) {
  try {
    return new URL(candidate).origin === new URL(expected).origin;
  } catch {
    return false;
  }
}

function ServeOutput(request, response, root, runtimeAssetSources) {
  try {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
    if (requestUrl.pathname === '/api/games') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end('{"games":[]}');
      return;
    }
    const runtimeAssetKey = ParseRuntimeAssetKey(requestUrl.pathname);
    if (runtimeAssetKey) {
      const runtimeAsset = runtimeAssetSources.get(runtimeAssetKey);
      if (!runtimeAsset) {
        response.writeHead(404).end('Not found');
        return;
      }
      const body = runtimeAsset.body ?? readFileSync(runtimeAsset.path);
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Length': body.byteLength,
        'Content-Type': runtimeAsset.contentType,
      });
      if (request.method === 'HEAD') response.end();
      else response.end(body);
      return;
    }
    const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '');
    let filePath = resolve(root, relativePath || 'index.html');
    if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    if (existsSync(filePath) && statSync(filePath).isDirectory()) filePath = join(filePath, 'index.html');
    if (!existsSync(filePath) && !extname(filePath)) filePath = join(filePath, 'index.html');
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    const body = readFileSync(filePath);
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Length': body.byteLength,
      'Content-Type': ContentType(filePath),
    });
    if (request.method === 'HEAD') response.end();
    else response.end(body);
  } catch (error) {
    response.writeHead(500).end(error instanceof Error ? error.message : 'Server error');
  }
}

async function ReadLocalRuntimeAssetSources() {
  const manifestPath = resolve(repoRoot, 'scripts/r2-ai-assets.manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.assets)) {
    throw new Error('Runtime asset manifest is invalid for the browser startability gate.');
  }
  const sources = new Map();
  for (const asset of manifest.assets) {
    if (!IsSafeRuntimeAssetKey(asset?.key)) continue;
    if (typeof asset.source === 'string') {
      const sourcePath = resolve(repoRoot, asset.source);
      if (!sourcePath.startsWith(`${repoRoot}${sep}`)
        || !existsSync(sourcePath)
        || !statSync(sourcePath).isFile()) {
        throw new Error(`Local runtime asset source is unavailable: ${asset.source}`);
      }
      sources.set(asset.key, Object.freeze({
        path: sourcePath,
        contentType: typeof asset.contentType === 'string'
          ? asset.contentType
          : ContentType(sourcePath),
      }));
      continue;
    }
    if (typeof asset.sourceUrl === 'string') {
      const sourceUrl = new URL(asset.sourceUrl);
      if (sourceUrl.protocol !== 'https:') {
        throw new Error(`Runtime asset source must use HTTPS: ${asset.sourceUrl}`);
      }
      const response = await fetch(sourceUrl, {
        redirect: 'follow',
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) {
        throw new Error(`Unable to fetch runtime asset source ${sourceUrl.href}: HTTP ${response.status}`);
      }
      const body = Buffer.from(await response.arrayBuffer());
      const digest = createHash('sha256').update(body).digest('hex');
      if (body.byteLength !== asset.size || digest !== asset.sha256) {
        throw new Error(`Immutable runtime asset source does not match its manifest: ${asset.key}`);
      }
      sources.set(asset.key, Object.freeze({
        body,
        contentType: typeof asset.contentType === 'string'
          ? asset.contentType
          : 'application/octet-stream',
      }));
    }
  }
  return sources;
}

function ParseRuntimeAssetKey(pathname) {
  const prefix = '/runtime-assets/';
  if (!pathname.startsWith(prefix)) return null;
  try {
    const key = pathname.slice(prefix.length)
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .join('/');
    return IsSafeRuntimeAssetKey(key) ? key : null;
  } catch {
    return null;
  }
}

function IsSafeRuntimeAssetKey(value) {
  return typeof value === 'string'
    && value.length > 0
    && !value.startsWith('/')
    && !value.includes('\\')
    && !value.split('/').some((segment) => !segment || segment === '.' || segment === '..')
    && /^[A-Za-z0-9._/-]+$/.test(value);
}

function ContentType(path) {
  return ({
    '.css': 'text/css; charset=utf-8',
    '.glb': 'model/gltf-binary',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.task': 'application/octet-stream',
    '.wasm': 'application/wasm',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.webp': 'image/webp',
  })[extname(path).toLowerCase()] ?? 'application/octet-stream';
}

function FindBrowserPath() {
  const candidates = [
    process.env.BROWSER_EXECUTABLE_PATH,
    process.env.CHROME_BIN,
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  for (const command of ['google-chrome', 'google-chrome-stable', 'chromium', 'microsoft-edge']) {
    const result = spawnSync(command, ['--version'], { encoding: 'utf8' });
    if (!result.error && result.status === 0) return command;
  }
  return null;
}

function GetAvailablePort() {
  return new Promise((resolvePromise, reject) => {
    const probe = http.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() => {
        if (address && typeof address === 'object') resolvePromise(address.port);
        else reject(new Error('Unable to allocate a local port.'));
      });
    });
    probe.once('error', reject);
  });
}

function WaitForHttp(url, label) {
  return new Promise((resolvePromise, reject) => {
    const startedAt = Date.now();
    const poll = () => {
      const request = http.get(url, (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => resolvePromise({ status: response.statusCode, body }));
      });
      request.on('error', () => {
        if (Date.now() - startedAt >= 20_000) reject(new Error(`${label} did not become ready at ${url}`));
        else setTimeout(poll, 200);
      });
      request.setTimeout(1_500, () => request.destroy());
    };
    poll();
  });
}

async function ConnectCdp(webSocketDebuggerUrl) {
  const ws = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolvePromise, reject) => {
    ws.addEventListener('open', resolvePromise, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  const events = [];
  ws.addEventListener('message', (message) => {
    const data = JSON.parse(message.data);
    if (data.id && pending.has(data.id)) {
      const item = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) item.reject(new Error(`${item.method}: ${JSON.stringify(data.error)}`));
      else item.resolve(data.result);
      return;
    }
    events.push(data);
  });
  const Send = (method, params, attachedSessionId) => {
    nextId += 1;
    ws.send(JSON.stringify(attachedSessionId
      ? { id: nextId, sessionId: attachedSessionId, method, params }
      : { id: nextId, method, params }));
    return new Promise((resolvePromise, reject) => {
      pending.set(nextId, { resolve: resolvePromise, reject, method });
    });
  };
  return { Send, events, ws };
}

async function StopProcess(childProcess) {
  if (!childProcess || HasProcessExited(childProcess)) return;
  childProcess.kill('SIGTERM');
  await WaitForProcessExit(childProcess, 2_500);
  if (HasProcessExited(childProcess)) return;
  childProcess.kill('SIGKILL');
  await WaitForProcessExit(childProcess, 2_500);
}

function HasProcessExited(childProcess) {
  return childProcess.exitCode !== null || childProcess.signalCode !== null;
}

function WaitForProcessExit(childProcess, durationMs) {
  if (HasProcessExited(childProcess)) return Promise.resolve();
  return new Promise((resolvePromise) => {
    const finish = () => {
      clearTimeout(timeoutId);
      childProcess.off('exit', finish);
      resolvePromise();
    };
    const timeoutId = setTimeout(finish, durationMs);
    childProcess.once('exit', finish);
  });
}

function CloseServer(httpServer) {
  return new Promise((resolvePromise) => {
    const finish = () => {
      clearTimeout(timeoutId);
      resolvePromise();
    };
    const timeoutId = setTimeout(finish, 2_500);
    httpServer.close(finish);
    httpServer.closeAllConnections?.();
  });
}

function ReadPositiveInteger(value, fallback) {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed < 1_000 || parsed > 180_000) {
    throw new Error('OFFICIAL_TRAINING_RUNTIME_TIMEOUT_MS must be an integer between 1000 and 180000.');
  }
  return parsed;
}

function Wait(durationMs) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, durationMs));
}
