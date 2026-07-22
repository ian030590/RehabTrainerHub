#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = ParseArgs(process.argv.slice(2));
const appDir = resolve(process.cwd(), args.app ?? '.');
const route = args.route ?? '/';
const externalUrl = args.url;
const testTarget = externalUrl ?? route;
const expectedSelectors = [
  ...ParseSelectorList(args.selector),
  ...ParseSelectorList(args.allSelectors),
];
const clickSelectors = ParseSelectorList(args.clickSelectors);
const viewportSelectors = ParseSelectorList(args.viewportSelectors);
const canvasViewportSelectors = ParseSelectorList(args.canvasViewportSelectors);
const fullscreenSelector = args.fullscreenSelector;
const requireFullscreenBeforeAudio = args.fullscreenBeforeAudio === 'true';
const storageEntries = ParseStorageEntries(args.storage);
const mockAuthUser = args.mockAuthUser === 'true';
const expectedText = args.text;
const timeoutMs = Number(args.timeoutMs ?? 12000);

if (expectedSelectors.length === 0) {
  throw new Error('Usage: node scripts/check-browser-route-smoke.mjs (--app <appDir> --route <route> | --url <absoluteUrl>) --selector <cssSelector> [--allSelectors <cssSelector,...>] [--clickSelectors <cssSelector,...>] [--fullscreenSelector <cssSelector>] [--fullscreenBeforeAudio true] [--viewportSelectors <cssSelector,...>] [--canvasViewportSelectors <cssSelector,...>] [--storage <key=value,...>] [--mockAuthUser true] [--text <text>]');
}

const browserPath = FindBrowserPath();

if (!browserPath) {
  throw new Error('No Chrome or Edge executable was found for browser route smoke testing.');
}

const previewPort = externalUrl ? null : await GetAvailablePort();
const debugPort = await GetAvailablePort();
const userDataDir = resolve(repoRoot, '.tmp', `route-smoke-${process.pid}`);
mkdirSync(userDataDir, { recursive: true });

let previewProcess;
let previewLogs = '';
if (!externalUrl) {
  const viteBin = resolve(repoRoot, 'node_modules/vite/bin/vite.js');
  previewProcess = spawn(process.execPath, [viteBin, 'preview', '--host', '127.0.0.1', '--port', String(previewPort)], {
    cwd: appDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  previewProcess.stdout.on('data', (chunk) => {
    previewLogs += chunk;
  });
  previewProcess.stderr.on('data', (chunk) => {
    previewLogs += chunk;
  });
}

let browserProcess;
let browserLogs = '';
let ws;

try {
  if (!externalUrl) {
    await WaitForHttp(`http://127.0.0.1:${previewPort}/`, 'Vite preview');
  }
  browserProcess = spawn(browserPath, [
    '--headless=new',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-gpu-compositing',
    '--disable-features=VizDisplayCompositor,UseSkiaRenderer,Vulkan,CanvasOopRasterization',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--no-first-run',
    `--user-data-dir=${userDataDir}`,
    `--remote-debugging-port=${debugPort}`,
    'about:blank',
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  browserProcess.stdout.on('data', (chunk) => {
    browserLogs += chunk;
  });
  browserProcess.stderr.on('data', (chunk) => {
    browserLogs += chunk;
  });

  const versionResponse = await WaitForHttp(`http://127.0.0.1:${debugPort}/json/version`, 'browser debugger');
  const webSocketDebuggerUrl = JSON.parse(versionResponse.body).webSocketDebuggerUrl;
  const cdp = await ConnectCdp(webSocketDebuggerUrl);
  ws = cdp.ws;
  const target = await cdp.Send('Target.createTarget', { url: 'about:blank' });
  const attached = await cdp.Send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const sessionId = attached.sessionId;

  await cdp.Send('Runtime.enable', undefined, sessionId);
  await cdp.Send('Page.enable', undefined, sessionId);
  await cdp.Send('Network.enable', undefined, sessionId);
  await cdp.Send('Log.enable', undefined, sessionId);
  const bootstrapStatements = [];
  if (mockAuthUser) {
    const tokenPayload = Buffer.from(JSON.stringify({
      sub: 'route-smoke-user',
      name: 'Route Smoke',
      email: 'route-smoke@example.test',
    })).toString('base64url');
    const token = `${tokenPayload}.route-smoke-signature`;
    const user = {
      id: 'route-smoke-user',
      displayName: 'Route Smoke',
      email: 'route-smoke@example.test',
      profileCompleted: true,
      privacyAcceptedAt: '2026-01-01T00:00:00.000Z',
    };
    storageEntries.push(['rehabtrainerhub.auth.token', token]);
    bootstrapStatements.push(`
      const routeSmokeAuthToken = ${JSON.stringify(token)};
      const routeSmokeAuthUser = ${JSON.stringify(user)};
      const routeSmokeFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const rawUrl = typeof input === 'string' ? input : input?.url;
        const url = new URL(rawUrl || '', location.href);
        if (url.origin === 'https://trainerhub.cc' && url.pathname === '/api/auth/me') {
          return Promise.resolve(new Response(JSON.stringify({ user: routeSmokeAuthUser }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }));
        }
        if (url.origin === 'https://trainerhub.cc' && url.pathname === '/api/auth/session') {
          return Promise.resolve(new Response(JSON.stringify({ token: routeSmokeAuthToken, user: routeSmokeAuthUser }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }));
        }
        if (url.origin === 'https://trainerhub.cc' && url.pathname === '/api/records') {
          return Promise.resolve(new Response(JSON.stringify(init?.method === 'POST' ? { ok: true } : { records: [] }), {
            status: init?.method === 'POST' ? 201 : 200,
            headers: { 'Content-Type': 'application/json' },
          }));
        }
        return routeSmokeFetch(input, init);
      };
    `);
  }
  if (storageEntries.length > 0) {
    bootstrapStatements.push(`for (const [key, value] of ${JSON.stringify(storageEntries)}) localStorage.setItem(key, value);`);
  }
  if (requireFullscreenBeforeAudio) {
    bootstrapStatements.push(`
      window.__trainerSmokeCallOrder = [];
      const originalRequestFullscreen = HTMLElement.prototype.requestFullscreen;
      if (originalRequestFullscreen) {
        HTMLElement.prototype.requestFullscreen = function (...args) {
          window.__trainerSmokeCallOrder.push('fullscreen');
          return originalRequestFullscreen.apply(this, args);
        };
      }
      const audioContextPrototype = window.AudioContext?.prototype;
      const originalAudioResume = audioContextPrototype?.resume;
      if (originalAudioResume) {
        audioContextPrototype.resume = function (...args) {
          window.__trainerSmokeCallOrder.push('audio');
          return originalAudioResume.apply(this, args);
        };
      }
    `);
  }
  if (bootstrapStatements.length > 0) {
    await cdp.Send('Page.addScriptToEvaluateOnNewDocument', {
      source: bootstrapStatements.join('\n'),
    }, sessionId);
  }
  const navigationUrl = externalUrl ?? `http://127.0.0.1:${previewPort}${route}`;
  await cdp.Send('Page.navigate', { url: navigationUrl }, sessionId);
  await Wait(timeoutMs);
  await ClickSelectors(cdp, sessionId, clickSelectors, timeoutMs);
  if (clickSelectors.length > 0) await Wait(800);

  const stateResult = await cdp.Send('Runtime.evaluate', {
    expression: `JSON.stringify({
      href: location.href,
      rootHtml: document.querySelector('#root')?.outerHTML || '',
      bodyText: document.body.innerText || '',
      selectorMatches: ${JSON.stringify(expectedSelectors)}.map((selector) => ({
        selector,
        matched: Boolean(document.querySelector(selector)),
      })),
      fullscreenMatched: ${fullscreenSelector ? `Boolean(document.fullscreenElement?.matches(${JSON.stringify(fullscreenSelector)}))` : 'true'},
      viewportMatches: ${JSON.stringify(viewportSelectors)}.map((selector) => {
        const element = document.querySelector(selector);
        const rect = element?.getBoundingClientRect();
        const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
        return {
          selector,
          matched: Boolean(rect && Math.abs(rect.left) <= 1 && Math.abs(rect.top) <= 1 && Math.abs(rect.width - viewportWidth) <= 1 && Math.abs(rect.height - viewportHeight) <= 1),
          rect: rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null,
          viewport: { width: viewportWidth, height: viewportHeight },
        };
      }),
      canvasViewportMatches: ${JSON.stringify(canvasViewportSelectors)}.map((selector) => {
        const canvas = document.querySelector(selector);
        const rect = canvas?.getBoundingClientRect();
        const resolution = Math.min(window.devicePixelRatio || 1, 2);
        const expectedWidth = Math.round((rect?.width ?? 0) * resolution);
        const expectedHeight = Math.round((rect?.height ?? 0) * resolution);
        return {
          selector,
          matched: canvas instanceof HTMLCanvasElement && Boolean(rect) && Math.abs(canvas.width - expectedWidth) <= 2 && Math.abs(canvas.height - expectedHeight) <= 2,
          buffer: canvas instanceof HTMLCanvasElement ? { width: canvas.width, height: canvas.height } : null,
          expected: { width: expectedWidth, height: expectedHeight },
        };
      }),
      fullscreenBeforeAudio: ${requireFullscreenBeforeAudio ? `(() => {
        const callOrder = window.__trainerSmokeCallOrder ?? [];
        const fullscreenIndex = callOrder.indexOf('fullscreen');
        const audioIndex = callOrder.indexOf('audio');
        return fullscreenIndex >= 0 && (audioIndex < 0 || fullscreenIndex < audioIndex);
      })()` : 'true'},
      callOrder: ${requireFullscreenBeforeAudio ? 'window.__trainerSmokeCallOrder ?? []' : '[]'},
      textMatched: ${expectedText ? `document.body.innerText.includes(${JSON.stringify(expectedText)})` : 'true'}
    })`,
    returnByValue: true,
  }, sessionId);
  const state = JSON.parse(stateResult.result.value);
  const exceptions = cdp.events
    .filter((event) => event.sessionId === sessionId && event.method === 'Runtime.exceptionThrown')
    .map((event) => event.params.exceptionDetails.exception?.description ?? event.params.exceptionDetails.text);
  const criticalRequests = new Map(
    cdp.events
      .filter((event) => event.sessionId === sessionId && event.method === 'Network.requestWillBeSent')
      .map((event) => [event.params.requestId, {
        type: event.params.type,
        url: event.params.request.url,
      }]),
  );
  const failedResources = cdp.events
    .filter((event) => event.sessionId === sessionId && event.method === 'Network.loadingFailed')
    .map((event) => ({ ...event.params, request: criticalRequests.get(event.params.requestId) }))
    .filter((event) => ['Document', 'Script', 'Stylesheet'].includes(event.request?.type))
    .filter((event) => IsSameOrigin(event.request?.url, navigationUrl))
    .map((event) => `${event.request.url}: ${event.errorText}`);
  const errorResponses = cdp.events
    .filter((event) => event.sessionId === sessionId && event.method === 'Network.responseReceived')
    .filter((event) => ['Document', 'Script', 'Stylesheet'].includes(event.params.type))
    .filter((event) => event.params.response.status >= 400)
    .filter((event) => IsSameOrigin(event.params.response.url, navigationUrl))
    .map((event) => `${event.params.response.url}: HTTP ${event.params.response.status}`);

  const failures = [];
  if (!state.rootHtml || state.rootHtml === '<div id="root"></div>') {
    failures.push('React root is empty.');
  }
  for (const selectorMatch of state.selectorMatches) {
    if (!selectorMatch.matched) {
      failures.push(`Missing expected selector: ${selectorMatch.selector}`);
    }
  }
  if (!state.textMatched) {
    failures.push(`Missing expected text: ${expectedText}`);
  }
  if (!state.fullscreenMatched) {
    failures.push(`Fullscreen element did not match: ${fullscreenSelector}`);
  }
  for (const viewportMatch of state.viewportMatches) {
    if (!viewportMatch.matched) {
      failures.push(`Element did not cover the viewport: ${viewportMatch.selector} (${JSON.stringify(viewportMatch.rect)} vs ${JSON.stringify(viewportMatch.viewport)})`);
    }
  }
  for (const canvasViewportMatch of state.canvasViewportMatches) {
    if (!canvasViewportMatch.matched) {
      failures.push(`Canvas buffer did not match its viewport: ${canvasViewportMatch.selector} (${JSON.stringify(canvasViewportMatch.buffer)} vs ${JSON.stringify(canvasViewportMatch.expected)})`);
    }
  }
  if (!state.fullscreenBeforeAudio) {
    failures.push(`Fullscreen request must precede audio activation. Call order: ${state.callOrder.join(', ')}`);
  }
  if (exceptions.length > 0) {
    failures.push(`Runtime exceptions:\n${exceptions.map((exception) => `  - ${exception}`).join('\n')}`);
  }
  if (failedResources.length > 0) {
    failures.push(`Failed critical resources:\n${failedResources.map((resource) => `  - ${resource}`).join('\n')}`);
  }
  if (errorResponses.length > 0) {
    failures.push(`Critical HTTP errors:\n${errorResponses.map((resource) => `  - ${resource}`).join('\n')}`);
  }

  if (failures.length > 0) {
    throw new Error(`Browser route smoke failed for ${testTarget}\n${failures.join('\n')}\n\nPage text:\n${state.bodyText.slice(0, 2000)}`);
  }

  console.log(`Browser route smoke passed for ${testTarget}.`);
} catch (error) {
  console.error(error.stack || error);
  console.error('\nPreview logs:\n' + previewLogs.slice(-4000));
  console.error('\nBrowser logs:\n' + browserLogs.slice(-4000));
  process.exitCode = 1;
} finally {
  ws?.close();
  await StopProcess(browserProcess);
  await StopProcess(previewProcess);
  rmSync(userDataDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
}

function ParseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = 'true';
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function ParseSelectorList(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((selector) => selector.trim())
    .filter(Boolean);
}

function ParseStorageEntries(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => {
      const separatorIndex = entry.indexOf('=');
      if (separatorIndex <= 0) {
        throw new Error(`Storage entry must use key=value syntax: ${entry}`);
      }
      return [entry.slice(0, separatorIndex), entry.slice(separatorIndex + 1)];
    });
}

async function ClickSelectors(cdp, sessionId, selectors, timeoutMs) {
  for (const selector of selectors) {
    const bounds = await WaitForClickableBounds(cdp, sessionId, selector, timeoutMs);
    await cdp.Send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: bounds.x,
      y: bounds.y,
      button: 'left',
      clickCount: 1,
    }, sessionId);
    await cdp.Send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: bounds.x,
      y: bounds.y,
      button: 'left',
      clickCount: 1,
    }, sessionId);
    await Wait(150);
  }
}

async function WaitForClickableBounds(cdp, sessionId, selector, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await cdp.Send('Runtime.evaluate', {
      expression: `(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!(element instanceof HTMLElement) || element.matches(':disabled')) return null;
        const rect = element.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return null;
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      })()`,
      returnByValue: true,
    }, sessionId);
    if (result.result.value) return result.result.value;
    await Wait(100);
  }
  throw new Error(`Timed out waiting for clickable selector: ${selector}`);
}

function FindBrowserPath() {
  const envCandidates = [
    process.env.BROWSER_EXECUTABLE_PATH,
    process.env.EDGE_BIN,
    process.env.CHROME_BIN,
  ].filter(Boolean);
  const pathCandidates = [
    ...envCandidates,
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    ...FindWindowsVersionedBrowsers('C:/Program Files (x86)/Microsoft/EdgeCore'),
    ...FindWindowsVersionedBrowsers('C:/Program Files (x86)/Microsoft/EdgeWebView/Application'),
  ];

  for (const candidate of pathCandidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  for (const command of ['msedge', 'microsoft-edge', 'google-chrome', 'chrome', 'chromium']) {
    const result = spawnSync(command, ['--version'], { encoding: 'utf8' });
    if (!result.error && result.status === 0) {
      return command;
    }
  }

  return null;
}

function FindWindowsVersionedBrowsers(parentDir) {
  if (!existsSync(parentDir)) return [];
  return readdirSync(parentDir)
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
    .map((entry) => join(parentDir, entry, 'msedge.exe'))
    .filter((candidate) => existsSync(candidate));
}

function GetAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === 'object' && address?.port) resolve(address.port);
        else reject(new Error('Unable to allocate a local port.'));
      });
    });
    server.on('error', reject);
  });
}

function GetHttp(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        resolve({ status: response.statusCode, body });
      });
    });
    request.on('error', reject);
    request.setTimeout(1500, () => {
      request.destroy(new Error(`Timed out requesting ${url}`));
    });
  });
}

async function WaitForHttp(url, label) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20000) {
    try {
      const response = await GetHttp(url);
      if (response.status) return response;
    } catch {}
    await Wait(200);
  }
  throw new Error(`${label} did not become ready at ${url}`);
}

function Wait(durationMs) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function IsSameOrigin(candidate, target) {
  if (!candidate) return false;
  try {
    return new URL(candidate).origin === new URL(target).origin;
  } catch {
    return false;
  }
}

function StopProcess(childProcess) {
  if (!childProcess || childProcess.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    childProcess.once('exit', resolve);
    childProcess.kill();
    setTimeout(resolve, 2500);
  });
}

async function ConnectCdp(webSocketDebuggerUrl) {
  const ws = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
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

  const Send = (method, params, sessionId) => {
    nextId += 1;
    ws.send(JSON.stringify(sessionId ? { id: nextId, sessionId, method, params } : { id: nextId, method, params }));
    return new Promise((resolve, reject) => {
      pending.set(nextId, { resolve, reject, method });
    });
  };

  return { Send, events, ws };
}
