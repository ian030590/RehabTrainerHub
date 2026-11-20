import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { setTimeout as Delay } from 'node:timers/promises';
import { guestLobbyHistoryKey } from '../apps/rehabtrainerhub/app/lobbyActivityHistory.js';

const output = resolve(process.env.HUB_OUTPUT_ROOT || join(import.meta.dirname, '../apps/rehabtrainerhub/out'));
const browserPath = [process.env.BRAVE_BIN, 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', '/usr/bin/brave-browser', '/usr/bin/brave',
].find(path => path && existsSync(path));
assert.ok(browserPath, 'Install Brave or set BRAVE_BIN for the local lobby browser check.');
assert.ok(existsSync(join(output, 'index.html')), 'Build the Hub first with npm run build:hub.');

const artifacts = await mkdtemp(join(tmpdir(), 'lobby-recommendations-'));
const user = { id: 'lobby-browser-fixture', displayName: 'Local player fixture', role: 'patient', profileCompleted: true };
const token = Buffer.from(JSON.stringify({ sub: user.id })).toString('base64url') + '.fixture';
const activity = { gameId: 'hart-chart', playedAt: '2026-10-01T10:00:00.000Z' };
const guestOnlyActivity = { ...activity, gameId: 'tongue-catch' };
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

const heading = '#lobby-recommendations-title';
const links = '.lobby-recommendations li > button';
const search = '#module-search-input';
const iframe = '.hub-game-overlay-host dialog[open] iframe';
const keyCodes = { Tab: 9, Enter: 13, Escape: 27 };
const pending = new Map();
const launched = [];
let origin, browser, ws, session, serial = 0;
let browserExit, requestError;
let browserStderr = '';
let signedIn = false;
let progressRequests = 0;

function Send(method, params = {}, sessionId = session) {
  return new Promise((done, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error([`CDP timeout for ${method}.`, browserExit, browserStderr.trim()].filter(Boolean).join('\n')));
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

async function WaitFor(expression, description = expression) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await Evaluate(expression)) return;
    await Delay(100);
  }
  throw new Error(`Browser condition timed out: ${description}`);
}

function Fulfill(requestId, responseCode, payload, type = 'application/json') {
  const body = payload === undefined ? '' : type === 'application/json' ? JSON.stringify(payload) : payload;
  return Send('Fetch.fulfillRequest', {
    requestId, responseCode,
    responseHeaders: [
      { name: 'Content-Type', value: type },
      { name: 'Access-Control-Allow-Origin', value: origin },
      { name: 'Access-Control-Allow-Credentials', value: 'true' },
      { name: 'Access-Control-Allow-Headers', value: 'authorization, content-type' },
      { name: 'Access-Control-Allow-Methods', value: 'GET, HEAD, POST, OPTIONS' },
    ],
    body: Buffer.from(body).toString('base64'),
  });
}

async function HandleRequest({ requestId, request, networkId }) {
  const url = new URL(request.url);
  const { pathname } = url;
  if (pathname.startsWith('/api/')) {
    if (request.method === 'OPTIONS') return Fulfill(requestId, 204);
    if (pathname === '/api/official-game-sessions' && request.method === 'POST') {
      const postData = request.postData ?? (await Send('Network.getRequestPostData', { requestId: networkId })).postData;
      const { gameId, subjectId } = JSON.parse(postData);
      launched.push(gameId);
      return Fulfill(requestId, 200, { subjectId, version: '1.0.0', token: 'local-session-fixture',
        recordId: '00000000-0000-4000-8000-000000000000', contentSha256: '0'.repeat(64) });
    }
    if (request.method !== 'GET') return Fulfill(requestId, 405);
    if (pathname === '/api/games') return Fulfill(requestId, 200, { games: [] });
    if (pathname === '/api/auth/me') return Fulfill(requestId, signedIn ? 200 : 401, { user });
    if (pathname === '/api/auth/session') return Fulfill(requestId, signedIn ? 200 : 401, { user, token });
    if (pathname === '/api/training-plans/current') return Fulfill(requestId, 200, { plan: null });
    if (pathname === '/api/progress') {
      const auth = Object.entries(request.headers).find(([name]) => name.toLowerCase() === 'authorization')?.[1];
      assert.ok(signedIn, 'Guest recommendations use device storage.');
      assert.equal(auth, `Bearer ${token}`);
      progressRequests++;
      return Fulfill(requestId, 200, { recentModules: [activity] });
    }
    return Fulfill(requestId, 404);
  }
  if (/^\/games\/[a-z0-9-]+\/1\.0\.0\/package\/index\.html$/.test(pathname)) {
    return Fulfill(requestId, 200, '<!doctype html><title>Local activity fixture</title>', 'text/html');
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
  for (let attempt = 0; attempt < 100 && !browserExit; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return (await response.json()).webSocketDebuggerUrl;
    } catch {
      // The debugger socket becomes available after Brave starts.
    }
    await Delay(100);
  }
  throw new Error(['Brave debugger did not start.', browserExit, browserStderr.trim()].filter(Boolean).join('\n'));
}

async function Key(key) {
  const input = { key, code: key, windowsVirtualKeyCode: keyCodes[key] };
  const down = key === 'Enter' ? { type: 'keyDown', text: '\r', unmodifiedText: '\r' } : { type: 'rawKeyDown' };
  await Send('Input.dispatchKeyEvent', { ...input, ...down });
  await Send('Input.dispatchKeyEvent', { ...input, type: 'keyUp' });
}

async function Click(selector, touch) {
  const point = await Evaluate(`(() => {
    const button = document.querySelector(${JSON.stringify(selector)});
    button.scrollIntoView({ block: 'center', behavior: 'instant' });
    const rect = button.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  if (touch) {
    await Send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await Send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    for (const type of ['mousePressed', 'mouseReleased']) {
      await Send('Input.dispatchMouseEvent', { type, ...point, button: 'left', clickCount: 1 });
    }
  }
}

async function CheckViewport({ width, height, mobile, columns, account }) {
  signedIn = account;
  progressRequests = 0;
  launched.length = 0;
  await Send('Emulation.setDeviceMetricsOverride', { width, height, mobile, deviceScaleFactor: 1 });
  await Send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: 1 });
  const { identifier } = await Send('Page.addScriptToEvaluateOnNewDocument', { source: `
    if (location.origin === ${JSON.stringify(origin)}) {
      localStorage.setItem(${JSON.stringify(guestLobbyHistoryKey)}, ${JSON.stringify(JSON.stringify([account ? guestOnlyActivity : activity]))});
      if (${account}) localStorage.setItem('rehabtrainerhub.auth.token', ${JSON.stringify(token)});
      else localStorage.removeItem('rehabtrainerhub.auth.token');
      localStorage.setItem('rehab_hub_tour_seen', '1');
      localStorage.setItem('rehab-trainer-hub-language', ${JSON.stringify(account ? 'en' : 'zh')});
    }
  ` });
  try {
    await Send('Page.navigate', { url: `${origin}/?fixture=${width}-${Number(account)}` });
    const expectedHeading = account ? 'Similar activities' : '相近活動';
    await WaitFor(`document.querySelector('${heading}')?.textContent === ${JSON.stringify(expectedHeading)}`);
    await Evaluate(`(async () => {
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await Promise.allSettled(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime))
        .map(animation => animation.finished));
    })()`);
    const layout = await Evaluate(`(() => {
      const list = document.querySelector('.lobby-recommendations ul');
      const searchRow = document.querySelector('.lobby-search-row').getBoundingClientRect();
      const recommendationHeading = document.querySelector('${heading}').getBoundingClientRect();
      const recommendationGrid = list.getBoundingClientRect();
      const gameGrid = document.querySelector('.module-grid').getBoundingClientRect();
      const filterPanel = document.querySelector('.filter-panel').getBoundingClientRect();
      return { width: innerWidth, height: innerHeight, pageWidth: document.documentElement.scrollWidth,
        leftEdges: [searchRow.left, recommendationHeading.left, recommendationGrid.left,
          matchMedia('(min-width: 1024px)').matches ? filterPanel.left : gameGrid.left],
        rightEdges: [searchRow.right, recommendationGrid.right, gameGrid.right],
        columns: getComputedStyle(list).gridTemplateColumns.split(' ').length,
        items: [...list.querySelectorAll('li > button')].map(button => {
          const { width, height, left, right } = button.getBoundingClientRect();
          return { id: button.dataset.recommendationId, width, height, left, right,
            category: button.querySelector('.module-category-tag').textContent,
            title: button.querySelector('strong').textContent, reason: button.lastElementChild.textContent };
        }) };
    })()`);
    assert.deepEqual([layout.width, layout.height], [width, height]);
    assert.ok(layout.pageWidth <= width, `Page scroll width ${layout.pageWidth} exceeds ${width}px.`);
    for (const edges of [layout.leftEdges, layout.rightEdges]) {
      assert.ok(Math.max(...edges) - Math.min(...edges) < 1, `Lobby content edges should align: ${edges.join(', ')}`);
    }
    assert.equal(layout.columns, columns);
    assert.ok(layout.items.length >= 1 && layout.items.length <= 4);
    for (const item of layout.items) {
      assert.ok(item.width >= 44 && item.height >= 44 && item.left >= 0 && item.right <= width);
      assert.ok(item.category && item.title);
      assert.match(item.reason, account ? /^Similar to / : /^與「.+」內容相近$/);
    }
    assert.equal(progressRequests, account ? 1 : 0);
    assert.ok(layout.items.some(item => item.id === 'exploratory-saccade'), 'Recommendations use the Hart Chart history fixture.');

    await Evaluate(`document.querySelector('${search}').focus()`);
    for (const item of layout.items) {
      await Key('Tab');
      const focus = await Evaluate(`(() => {
        const button = document.activeElement;
        const style = getComputedStyle(button);
        return { id: button.dataset.recommendationId, visible: button.matches(':focus-visible'),
          outline: style.outlineStyle, size: parseFloat(style.outlineWidth), color: style.outlineColor };
      })()`);
      assert.equal(focus.id, item.id, 'Tab order follows the recommendation order.');
      assert.ok(focus.visible && focus.outline === 'solid' && focus.size >= 3
        && !['transparent', 'rgba(0, 0, 0, 0)'].includes(focus.color));
    }

    const selected = layout.items.at(-1);
    if (mobile) await Click(`${links}[data-recommendation-id="${selected.id}"]`, true);
    else await Key('Enter');
    await WaitFor(`!!document.querySelector('${iframe}')`, `${selected.id} overlay from the recommendation via ${mobile ? 'touch' : 'Enter'}`);
    const source = await Evaluate(`document.querySelector('${iframe}').src`);
    assert.match(new URL(source).pathname, new RegExp(`^/games/${selected.id}/`));
    await Key('Escape');
    await WaitFor(`!document.querySelector('.hub-game-overlay-host')`);

    await Evaluate(`document.querySelector('${search}').focus()`);
    await Send('Input.insertText', { text: selected.title });
    const cardButton = `.module-grid [data-runtime-id="${selected.id}"] .official-game-actions button`;
    await WaitFor(`!document.querySelector('${heading}') && !!document.querySelector(${JSON.stringify(cardButton)})`);
    await Click(cardButton, mobile);
    await WaitFor(`!!document.querySelector('${iframe}')`, `${selected.id} overlay from the matching catalog card`);
    assert.equal(await Evaluate(`document.querySelector('${iframe}').src`), source);
    assert.deepEqual(launched, [selected.id, selected.id]);
    await Key('Escape');
    await WaitFor(`!document.querySelector('.hub-game-overlay-host')`);
  } finally {
    await Send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
  }
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
  await once(ws, 'open');
  ws.addEventListener('message', OnMessage);
  const target = await Send('Target.createTarget', { url: 'about:blank' }, null);
  session = (await Send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)).sessionId;
  await Send('Page.enable');
  await Send('Runtime.enable');
  await Send('Network.enable');
  await Send('Network.setBypassServiceWorker', { bypass: true });
  await Send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await Send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });

  for (const viewport of [
    { width: 360, height: 740, mobile: true, columns: 1, account: false },
    { width: 800, height: 900, mobile: true, columns: 2, account: false },
    { width: 1280, height: 800, mobile: false, columns: 4, account: false },
    { width: 1280, height: 800, mobile: false, columns: 4, account: true },
  ]) {
    const name = `${viewport.account ? 'signed-in' : 'guest'}-${viewport.width}x${viewport.height}`;
    try {
      await CheckViewport(viewport);
      console.log(`PASS ${name}`);
    } catch (error) {
      process.exitCode = 1;
      console.error(`FAIL ${name}: ${error.message}`);
      const path = join(artifacts, `${name}-failure.png`);
      const screenshot = await Send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
      if (screenshot) {
        await writeFile(path, Buffer.from(screenshot.data, 'base64'));
        console.error(`Screenshot: ${path}`);
      }
    }
  }
} finally {
  if (ws?.readyState === WebSocket.OPEN) await Send('Browser.close', {}, null).catch(() => {});
  ws?.close();
  browser?.kill();
  server.closeAllConnections();
  await new Promise(done => server.close(done));
}
