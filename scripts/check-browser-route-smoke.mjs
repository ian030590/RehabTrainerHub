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
const expectedSelector = args.selector;
const expectedText = args.text;
const timeoutMs = Number(args.timeoutMs ?? 12000);

if (!expectedSelector) {
  throw new Error('Usage: node scripts/check-browser-route-smoke.mjs --app <appDir> --route <route> --selector <cssSelector> [--text <text>]');
}

const browserPath = FindBrowserPath();

if (!browserPath) {
  throw new Error('No Chrome or Edge executable was found for browser route smoke testing.');
}

const previewPort = await GetAvailablePort();
const debugPort = await GetAvailablePort();
const userDataDir = resolve(repoRoot, '.tmp', `route-smoke-${process.pid}`);
mkdirSync(userDataDir, { recursive: true });

const viteBin = resolve(repoRoot, 'node_modules/vite/bin/vite.js');
const previewProcess = spawn(process.execPath, [viteBin, 'preview', '--host', '127.0.0.1', '--port', String(previewPort)], {
  cwd: appDir,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let previewLogs = '';
previewProcess.stdout.on('data', (chunk) => {
  previewLogs += chunk;
});
previewProcess.stderr.on('data', (chunk) => {
  previewLogs += chunk;
});

let browserProcess;
let browserLogs = '';
let ws;

try {
  await WaitForHttp(`http://127.0.0.1:${previewPort}/`, 'Vite preview');
  browserProcess = spawn(browserPath, [
    '--headless=old',
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
  await cdp.Send('Page.navigate', { url: `http://127.0.0.1:${previewPort}${route}` }, sessionId);
  await Wait(timeoutMs);

  const stateResult = await cdp.Send('Runtime.evaluate', {
    expression: `JSON.stringify({
      href: location.href,
      rootHtml: document.querySelector('#root')?.outerHTML || '',
      bodyText: document.body.innerText || '',
      selectorMatched: Boolean(document.querySelector(${JSON.stringify(expectedSelector)})),
      textMatched: ${expectedText ? `document.body.innerText.includes(${JSON.stringify(expectedText)})` : 'true'}
    })`,
    returnByValue: true,
  }, sessionId);
  const state = JSON.parse(stateResult.result.value);
  const exceptions = cdp.events
    .filter((event) => event.sessionId === sessionId && event.method === 'Runtime.exceptionThrown')
    .map((event) => event.params.exceptionDetails.exception?.description ?? event.params.exceptionDetails.text);

  const failures = [];
  if (!state.rootHtml || state.rootHtml === '<div id="root"></div>') {
    failures.push('React root is empty.');
  }
  if (!state.selectorMatched) {
    failures.push(`Missing expected selector: ${expectedSelector}`);
  }
  if (!state.textMatched) {
    failures.push(`Missing expected text: ${expectedText}`);
  }
  if (exceptions.length > 0) {
    failures.push(`Runtime exceptions:\n${exceptions.map((exception) => `  - ${exception}`).join('\n')}`);
  }

  if (failures.length > 0) {
    throw new Error(`Browser route smoke failed for ${route}\n${failures.join('\n')}\n\nPage text:\n${state.bodyText.slice(0, 2000)}`);
  }

  console.log(`Browser route smoke passed for ${route}.`);
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
