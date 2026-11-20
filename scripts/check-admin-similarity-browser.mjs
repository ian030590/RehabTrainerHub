import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { setTimeout as Delay } from 'node:timers/promises';

const root = resolve(import.meta.dirname, '..');
const output = resolve(process.env.HUB_OUTPUT_ROOT || resolve(root, 'apps/rehabtrainerhub/out'));
const browserPath = [process.env.BRAVE_BIN || 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', '/usr/bin/brave-browser', '/usr/bin/brave',
].find(path => existsSync(path));
assert.ok(browserPath, 'Install Brave or set BRAVE_BIN for the local similarity browser check.');
assert.ok(existsSync(join(output, 'admin', 'index.html')), 'Build the Hub first with npm run build:hub.');

const artifacts = await mkdtemp(join(tmpdir(), 'admin-similarity-'));
const gameFeatures = JSON.parse(await readFile(resolve(root, 'apps/rehabtrainerhub/recommendation/gameFeatures.json'), 'utf8')).games;
const gameIds = Object.keys(gameFeatures).sort();
const user = { id: 'similarity-browser-fixture', displayName: 'Local admin fixture', role: 'admin', profileCompleted: true };
const token = Buffer.from(JSON.stringify({ sub: user.id })).toString('base64url') + '.x';
const mimeTypes = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.txt': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(output, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
    assert.ok(file.startsWith(output + sep), 'Static path must stay in the Hub build.');
    const bytes = await readFile(file);
    response.writeHead(200, { 'Content-Type': mimeTypes[extname(file)] || 'application/octet-stream' }).end(bytes);
  } catch {
    response.writeHead(404).end();
  }
});

let origin, browser, ws, session, serial = 0;
let browserExit, requestError;
let browserStderr = '';
const pending = new Map();
const panelSelector = '#admin-panel-similarity';
const pickerSelector = '#admin-similarity-game';
const keyCodes = { Tab: 9, Enter: 13, ArrowLeft: 37, ArrowDown: 40 };
const responses = {
  '/api/auth/me': { user },
  '/api/auth/session': { user, token },
  '/api/admin/overview': { summary: { patientCount: 0, recordCount: 0, trainingDays: 0, latestActivityAt: null }, patients: [] },
  '/api/admin/records': { records: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 } },
  '/api/admin/game-releases': { releases: [] },
  '/api/admin/training-plans': { plan: null },
  '/api/training-plans/current': { plan: null },
  '/api/games': { games: [] },
};

function Send(method, params = {}, sessionId = session) {
  return new Promise((done, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout for ${method}`));
    }, 15000);
    pending.set(id, { done, reject, timer });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}

async function Evaluate(expression) {
  if (requestError) throw requestError;
  const result = await Send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}

async function WaitFor(expression) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await Evaluate(expression)) return;
    await Delay(100);
  }
  throw new Error(`Browser condition timed out: ${expression}`);
}

function Fulfill(requestId, responseCode, payload) {
  return Send('Fetch.fulfillRequest', {
    requestId, responseCode,
    responseHeaders: [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Access-Control-Allow-Origin', value: origin },
      { name: 'Access-Control-Allow-Credentials', value: 'true' },
      { name: 'Access-Control-Allow-Headers', value: 'authorization, content-type' },
      { name: 'Access-Control-Allow-Methods', value: 'GET, HEAD, OPTIONS' },
    ],
    body: payload === undefined ? '' : Buffer.from(JSON.stringify(payload)).toString('base64'),
  });
}

async function HandleRequest({ requestId, request }) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) {
    const { method, headers } = request;
    if (method === 'OPTIONS') {
      const preflight = Object.keys(headers).some(header => header.toLowerCase() === 'access-control-request-method');
      return url.pathname === '/api/admin/training-plans' && !preflight
        ? Fulfill(requestId, 200, { enabled: true })
        : Fulfill(requestId, 204);
    }
    if (method !== 'GET' && method !== 'HEAD') return Fulfill(requestId, 405, { error: 'Read-only local fixture' });
    if (Object.hasOwn(responses, url.pathname)) return Fulfill(requestId, 200, responses[url.pathname]);
    return Fulfill(requestId, 404, { error: 'No local fixture for this endpoint' });
  }
  if (url.origin !== origin) return Send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
  return Send('Fetch.continueRequest', { requestId });
}

function OnMessage(event) {
  const message = JSON.parse(event.data);
  const entry = pending.get(message.id);
  if (entry) {
    clearTimeout(entry.timer);
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
    else entry.done(message.result);
  }
  if (message.method === 'Fetch.requestPaused') {
    void HandleRequest(message.params).catch(error => { requestError = error; });
  }
}

async function WaitForDebugger(port) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (browserExit) break;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return (await response.json()).webSocketDebuggerUrl;
    } catch {
      // Brave is still starting.
    }
    await Delay(100);
  }
  throw new Error(['Brave debugger did not start.', browserExit, browserStderr.trim()].filter(Boolean).join('\n'));
}

async function Key(key) {
  for (const type of ['keyDown', 'keyUp']) {
    await Send('Input.dispatchKeyEvent', { type, key, code: key, windowsVirtualKeyCode: keyCodes[key] });
  }
}

async function TabTo(id, limit) {
  for (let step = 0; step < limit; step++) {
    await Key('Tab');
    if (await Evaluate('document.activeElement.id') === id) return;
  }
  assert.fail(`Tab did not reach ${id}.`);
}

async function CheckFocus(id) {
  const focus = await Evaluate(`(() => {
    const element = document.activeElement;
    const style = getComputedStyle(element);
    return { id: element.id, outline: style.outlineStyle, width: parseFloat(style.outlineWidth),
      offset: parseFloat(style.outlineOffset), color: style.outlineColor };
  })()`);
  assert.equal(focus.id, id);
  assert.ok(focus.outline === 'solid' && focus.width >= 3 && focus.offset >= 3
    && !['transparent', 'rgba(0, 0, 0, 0)'].includes(focus.color), `Visible focus outline for ${id}: ${JSON.stringify(focus)}`);
}

async function CheckLayout(width, height) {
  await Evaluate(`(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await Promise.allSettled(document.getAnimations().map(animation => animation.finished));
  })()`);
  const layout = await Evaluate(`(() => {
    const panel = document.querySelector('${panelSelector}');
    const controls = document.querySelectorAll('[role="tablist"] button, ${panelSelector} button, ${panelSelector} select');
    return { viewport: [innerWidth, innerHeight], pageWidth: document.documentElement.scrollWidth,
      wide: [panel, ...panel.querySelectorAll('*')].filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > innerWidth || (rect.width > 0 && (rect.left < -0.5 || rect.right > innerWidth + 0.5));
      }).map(element => element.tagName + ' ' + element.id),
      short: [...controls].filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.height < 44 || rect.width < 44;
      }).map(element => element.id || element.textContent.trim()),
      alert: panel.querySelector('[role="alert"], .admin-alert-error')?.textContent ?? null,
    };
  })()`);
  assert.deepEqual(layout.viewport, [width, height]);
  assert.ok(layout.pageWidth <= width, `Page scroll width ${layout.pageWidth} exceeds ${width}px.`);
  assert.deepEqual(layout.wide, [], 'Similarity panel items fit the viewport.');
  assert.deepEqual(layout.short, [], 'Tab and panel controls are at least 44 by 44px.');
  assert.equal(layout.alert, null);
}

async function ChooseNeighbor(mobile) {
  const { gameId, x, y } = await Evaluate(`(() => {
    const button = document.querySelector('${panelSelector} button[data-game-id]');
    if (!button) throw new Error('No neighbor button to activate.');
    button.scrollIntoView({ block: 'center', behavior: 'instant' });
    const rect = button.getBoundingClientRect();
    return { gameId: button.dataset.gameId, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  })()`);
  if (mobile) {
    await Send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await Send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    for (const type of ['mousePressed', 'mouseReleased']) {
      await Send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
    }
  }
  return gameId;
}

async function CheckViewport({ width, height, mobile }) {
  await Send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await Send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: 1 });
  const navigation = await Send('Page.navigate', { url: `${origin}/admin/?viewport=${width}` });
  assert.ok(!navigation.errorText, navigation.errorText);
  await WaitFor(`document.readyState === 'complete' && !!document.querySelector('#admin-panel-plans')`);
  await TabTo('admin-tab-overview', 30);
  await Key('ArrowLeft');
  await WaitFor(`document.activeElement.id === 'admin-tab-similarity'`);
  await Key('Enter');
  assert.equal(await Evaluate(`document.querySelector('#admin-tab-similarity').getAttribute('aria-selected')`), 'true');
  assert.equal(await Evaluate(`document.querySelector('${panelSelector}').hidden`), false);
  await CheckFocus('admin-tab-similarity');
  await CheckLayout(width, height);

  const picker = `document.querySelector('${pickerSelector}')`;
  const options = await Evaluate(`[...${picker}.options].map(option => option.value)`);
  assert.deepEqual(options.toSorted(), gameIds);
  assert.equal(await Evaluate(`${picker}.labels[0].querySelector('span').textContent`), '選擇活動');
  await TabTo('admin-similarity-game', 3);
  await CheckFocus('admin-similarity-game');
  const initial = await Evaluate(`${picker}.value`);
  assert.equal(initial, options[0]);
  await Key('ArrowDown');
  await WaitFor(`${picker}.value === ${JSON.stringify(options[1])}`);
  await CheckLayout(width, height);

  const neighbor = await ChooseNeighbor(mobile);
  assert.notEqual(neighbor, options[1]);
  assert.ok(gameIds.includes(neighbor));
  await WaitFor(`${picker}.value === ${JSON.stringify(neighbor)} && document.activeElement === ${picker}`);
  await CheckFocus('admin-similarity-game');
  const status = gameFeatures[neighbor].reviewStatus === 'confirmed' ? '已確認' : '草稿';
  assert.ok(await Evaluate(`[...document.querySelectorAll('${panelSelector} dt')].some(label =>
    label.textContent === '審閱狀態' && label.nextElementSibling.textContent === ${JSON.stringify(status)})`));
  await CheckLayout(width, height);
}

async function Screenshot(name) {
  const path = join(artifacts, `${name}.png`);
  const { data } = await Send('Page.captureScreenshot', { format: 'png' });
  await writeFile(path, Buffer.from(data, 'base64'));
  console.log(`Screenshot: ${path}`);
}

try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
  const debugProbe = createServer();
  debugProbe.listen(0, '127.0.0.1');
  await once(debugProbe, 'listening');
  const debugPort = debugProbe.address().port;
  await new Promise(done => debugProbe.close(done));
  browser = spawn(browserPath, ['--headless=new', '--no-first-run', '--disable-gpu',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${join(artifacts, 'profile')}`, 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  browser.stderr.on('data', chunk => { browserStderr = (browserStderr + chunk).slice(-4000); });
  browser.once('error', error => { browserExit = error.message; });
  browser.once('exit', (code, signal) => { browserExit = `Brave exited with ${code ?? signal}.`; });

  ws = new WebSocket(await WaitForDebugger(debugPort));
  await new Promise((done, reject) => {
    ws.addEventListener('open', done, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  ws.addEventListener('message', OnMessage);
  const target = await Send('Target.createTarget', { url: 'about:blank' }, null);
  session = (await Send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)).sessionId;
  await Send('Page.enable');
  await Send('Runtime.enable');
  await Send('Network.enable');
  await Send('Network.setBypassServiceWorker', { bypass: true });
  await Send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await Send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  await Send('Page.addScriptToEvaluateOnNewDocument', { source: `
    if (location.origin === ${JSON.stringify(origin)}) {
      localStorage.setItem('rehabtrainerhub.auth.token', ${JSON.stringify(token)});
      localStorage.setItem('rehab_hub_tour_seen', '1');
    }
  ` });

  for (const viewport of [{ width: 360, height: 740, mobile: true }, { width: 1280, height: 800, mobile: false }]) {
    const name = `${viewport.width}x${viewport.height}`;
    try {
      await CheckViewport(viewport);
      await Screenshot(name);
      console.log(`PASS ${name} with ${gameIds.length} catalog options.`);
    } catch (error) {
      process.exitCode = 1;
      console.error(`FAIL ${name}: ${error.message}`);
      await Screenshot(`${name}-failure`).catch(screenshotError => console.error(screenshotError.message));
    }
  }
} finally {
  if (ws?.readyState === WebSocket.OPEN) await Send('Browser.close', {}, null).catch(() => {});
  ws?.close();
  browser?.kill();
  server.closeAllConnections();
  await new Promise(done => server.close(done));
}
