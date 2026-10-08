import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { BuildOfficialGameRelease } from './publish-official-game.mjs';
import { HandleRequest } from '../apps/usergamerunner/functions/[[path]].js';
import { ContentTypeForPath } from '../apps/usergamerunner/functions/_lib/release.js';
import { onRequestPost as createSession } from '../apps/rehabtrainerhub/functions/api/official-game-sessions.js';
import { onRequestPost as saveRecord } from '../apps/rehabtrainerhub/functions/api/records.js';
import { onRequestGet as listGames } from '../apps/rehabtrainerhub/functions/api/games.js';

const root = resolve(import.meta.dirname, '..');
const productionHub = process.argv.includes('--production-hub');
const remote = process.argv.includes('--remote') || productionHub;
const standalone = process.argv.includes('--standalone');
const lobby = process.argv.includes('--lobby');
const sessionFailure = process.argv.includes('--session-failure');
const output = resolve(process.env.HUB_OUTPUT_ROOT || resolve(root, 'apps/rehabtrainerhub/out'));
const browserPath = process.env.BRAVE_BIN || 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
assert.ok(existsSync(browserPath), 'Brave is required.');
const { manifest, files } = await BuildOfficialGameRelease('drawing-defense');
const sqlite = new DatabaseSync(':memory:');
const migrations = resolve(root, 'apps/rehabtrainerhub/migrations');
for (const file of (await readdir(migrations)).filter(file => file.endsWith('.sql')).sort()) sqlite.exec(await readFile(resolve(migrations, file), 'utf8'));
const database = { prepare: sql => {
  const statement = sqlite.prepare(sql);
  let values = [];
  const result = { bind: (...bindings) => { values = bindings; return result; },
    first: async () => statement.get(...values) ?? null, all: async () => ({ results: statement.all(...values) }),
    run: async () => ({ meta: { changes: Number(statement.run(...values).changes) } }) };
  return result;
} };
let revoked = false;
const catalog = { schemaVersion: 1, gameId: manifest.gameId, currentVersion: manifest.version,
  releases: { [manifest.version]: { contentSha256: manifest.contentSha256 } } };
const bucket = { get: async key => {
  const bytes = key === 'official-games/drawing-defense/current.json' ? Buffer.from(JSON.stringify(catalog))
    : key.endsWith('/release.json') ? Buffer.from(JSON.stringify({ ...manifest, status: revoked ? 'revoked' : 'approved' })) : files.get(key.split('/files/')[1]);
  if (!bytes) return null;
  return { size: bytes.length, body: bytes, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    text: async () => bytes.toString('utf8'), json: async () => JSON.parse(bytes.toString('utf8')) };
} };
const environment = { REHAB_DB: database, GAME_RELEASE_BUCKET: bucket, ANONYMOUS_RECORDS_ENABLED: '1', AUTH_SESSION_SECRET: 'r2-browser-local-secret-abcdefghijklmnopqrstuvwxyz' };
const errors = [];
const requests = [];
let failFirstSave = true;
let saveAttempts = 0;
let sessionAttempts = 0;
let runnerOrigin;
let hubOrigin;
let browser;
let ws;
let hub;
let runner;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
async function Respond(response, result) {
  response.writeHead(result.status, Object.fromEntries(result.headers));
  response.end(result.body ? Buffer.from(await result.arrayBuffer()) : undefined);
}

try {
  runner = createServer((request, response) => {
    void HandleRequest({ request: new Request(runnerOrigin + request.url, { method: request.method }), env: { GAME_RELEASE_BUCKET: bucket }, next: () => new Response('Missing', { status: 404 }) })
      .then(result => Respond(response, result)).catch(error => { errors.push(String(error)); response.writeHead(500).end(); });
  });
  runnerOrigin = remote ? 'https://trainerhub-user-games.pages.dev' : await listen(runner);
  environment.GAME_RUNNER_ORIGIN = runnerOrigin;
  hub = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, hubOrigin);
      if (url.pathname === '/api/official-game-sessions' || (url.pathname === '/api/records' && request.method === 'POST')) {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const body = Buffer.concat(chunks);
        if (url.pathname.endsWith('sessions')) {
          sessionAttempts++;
          if (sessionFailure && sessionAttempts === 1) { response.writeHead(503).end('Retry'); return; }
        }
        if (url.pathname === '/api/records') {
          saveAttempts++;
          if (failFirstSave) { failFirstSave = false; response.writeHead(503).end('Retry'); return; }
        }
        const headers = { ...request.headers, origin: 'https://trainerhub.cc', 'cf-connecting-ip': '127.0.0.88' };
        const apiRequest = new Request('https://trainerhub.cc' + url.pathname, { method: 'POST', headers, body });
        await Respond(response, await (url.pathname.endsWith('sessions') ? createSession : saveRecord)({ request: apiRequest, env: environment }));
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        const oldGame = { id: 'old-drawing-defense', slug: 'drawing-defense', title: 'Obsolete settings shell',
          summary: 'Legacy publication', trainer: 'motor', category: 'upper-limb', developerName: 'Sample author', updatedAt: '2026-10-08',
          release: { id: 'old-release', version: '1.0.0', contentSha256: 'a'.repeat(64), capabilities: ['pointer'],
            approvedAt: '2026-10-08', launchUrl: `${runnerOrigin}/games/drawing-defense/1.0.0/`,
            installUrl: `${runnerOrigin}/games/drawing-defense/1.0.0/`,
            settingsUrl: `${runnerOrigin}/games/drawing-defense/1.0.0/package/settings.json` } };
        const currentGames = url.pathname === '/api/games' && lobby
          ? (await (await listGames({ request: new Request('https://trainerhub.cc/api/games'), env: environment })).json()).games : [];
        const body = url.pathname === '/api/games' ? { games: lobby ? [oldGame,
          { ...oldGame, id: 'reviewed-browser-game', slug: 'reviewed-browser-game', title: 'Reviewed game' },
          ...currentGames,
        ] : [] } : { records: [], error: 'Unauthorized' };
        response.writeHead(url.pathname === '/api/games' ? 200 : 401, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
        return;
      }
      const path = resolve(output, '.' + decodeURIComponent(url.pathname));
      assert.ok(path.startsWith(output));
      let source;
      let actual = path;
      try { source = await readFile(path); } catch {
        actual = url.pathname.endsWith('/') ? resolve(path, 'index.html') : path + '.html';
        source = await readFile(actual);
      }
      if (/\.(js|html)$/.test(actual)) source = Buffer.from(source.toString('utf8').replaceAll('https://trainerhub-user-games.pages.dev', runnerOrigin));
      response.writeHead(200, { 'Content-Type': ContentTypeForPath(actual) }).end(source);
    } catch (error) { response.writeHead(404).end(String(error)); }
  });
  hubOrigin = await listen(hub);
  const debugProbe = createServer();
  const debugUrl = await listen(debugProbe);
  const debugPort = new URL(debugUrl).port;
  await new Promise(resolve => debugProbe.close(resolve));
  const profile = resolve(root, '.tmp', `r2-browser-${process.pid}`);
  await mkdir(profile, { recursive: true });
  browser = spawn(browserPath, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-allow-origins=*',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let connection;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { connection = await (await fetch(debugUrl + '/json/version')).json(); break; } catch { await wait(100); }
  }
  assert.ok(connection, 'Browser debugger did not start.');
  ws = new WebSocket(connection.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  const contexts = [];
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const commandId = ++id;
    pending.set(commandId, { resolve, reject });
    ws.send(JSON.stringify({ id: commandId, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const promise = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) promise?.reject(new Error(JSON.stringify(message.error))); else promise?.resolve(message.result);
    }
    if (message.method === 'Runtime.executionContextCreated') contexts.push({ ...message.params.context, session: message.sessionId });
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
    if (message.method === 'Fetch.requestPaused') {
      void (async () => {
        const request = message.params.request;
        const path = new URL(request.url);
        const response = await fetch(hubOrigin + path.pathname + path.search, { method: request.method,
          headers: request.headers, ...(request.postData ? { body: request.postData } : {}) });
        await send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: response.status,
          responseHeaders: Array.from(response.headers, ([name, value]) => ({ name, value })),
          body: Buffer.from(await response.arrayBuffer()).toString('base64') }, message.sessionId);
      })().catch(error => errors.push(String(error)));
    }
    if (message.method === 'Target.attachedToTarget') {
      void Promise.all([
        send('Runtime.enable', {}, message.params.sessionId),
        send('Network.enable', {}, message.params.sessionId),
      ]).catch(error => { if (!/Inspected target navigated or closed/.test(error.message)) errors.push(String(error)); });
    }
  });
  const target = await send('Target.createTarget', { url: 'about:blank' });
  const attached = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const session = attached.sessionId;
  await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, session);
  await send('Runtime.enable', {}, session);
  await send('Network.enable', {}, session);
  await send('Page.enable', {}, session);
  if (remote) await send('Fetch.enable', { patterns: [{ urlPattern: productionHub ? 'https://trainerhub.cc/api/*' : 'https://trainerhub.cc/*', requestStage: 'Request' }] }, session);
  // Production keeps Turnstile enabled; this fixture only submits to intercepted local APIs.
  if (productionHub) await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    if (window === window.top) {
      const widgets = new Map(); let nextWidget = 0;
      window.turnstile = {
        render: (_container, options) => { const id = String(++nextWidget); widgets.set(id, options); return id; },
        execute: id => queueMicrotask(() => widgets.get(id)?.callback('local-record-test-token')),
        remove: id => widgets.delete(id), reset: () => {},
      };
    }
  ` }, session);
  if (process.argv.includes('--mobile')) await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, session);
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "try { localStorage.setItem('rehab_hub_tour_seen','1'); } catch {}" }, session);
  await send('Page.navigate', { url: standalone ? `${runnerOrigin}/games/drawing-defense/${manifest.version}/` : (remote ? 'https://trainerhub.cc' : hubOrigin) + (lobby ? '/' : '/train/?module=motor%3Adrawing-defense') }, session);
  await send('Target.activateTarget', { targetId: target.targetId });
  const evaluate = async (expression, context) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true, ...(context ? { contextId: context.id } : {}) }, context?.session || session);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const until = async (action, label) => {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      try { if (await action()) return; } catch (error) {
        if (!/Inspected target navigated or closed|Cannot find context/.test(error.message)) throw error;
      }
      await wait(100);
    }
    const bodies = [];
    for (const context of contexts.filter(context => context.auxData?.isDefault)) {
      try { bodies.push(await evaluate('document.body.textContent.slice(0,2000)', context)); } catch {}
    }
    throw new Error(`Timed out: ${label}\n${errors.join('\n')}\n${bodies.join('\n')}`);
  };
  if (lobby && !standalone) {
    await until(() => evaluate('Boolean(document.querySelector(".module-card[data-runtime-id=reviewed-browser-game]"))'), 'reviewed catalog loaded');
    assert.equal(await evaluate('document.querySelectorAll(".module-card[data-runtime-id=drawing-defense]").length'), 1);
    assert.equal(await evaluate('document.querySelector(".module-card[data-runtime-id=drawing-defense] .module-subcategory-tag").textContent'), '上肢動作');
    await evaluate('document.querySelector(".module-card[data-runtime-id=drawing-defense]").scrollIntoView()');
    await until(() => evaluate('(() => { const image = document.querySelector(".module-card[data-runtime-id=drawing-defense] img"); return image?.complete && image.naturalWidth > 0; })()'), 'game-owned preview loaded');
    assert.equal(new URL(await evaluate('document.querySelector(".module-card[data-runtime-id=drawing-defense] img").src')).pathname,
      `/games/drawing-defense/${manifest.version}/package/preview.webp`);
    await evaluate('document.querySelector(".module-card[data-runtime-id=drawing-defense] button").click()');
    await until(() => sessionAttempts > 0, 'lobby selects an approved R2 session before loading settings');
  }
  if (sessionFailure && !standalone) {
    await until(() => evaluate('Boolean(document.querySelector("dialog [role=alert]"))'), 'session failure feedback');
    assert.equal(await evaluate('document.querySelectorAll("dialog iframe").length'), 0, 'Unavailable sessions must not mount an unbound game.');
    await evaluate('document.querySelector("dialog [role=alert] button").click()');
  }
  await until(() => evaluate('Boolean(document.querySelector("iframe"))'), 'Hub game iframe');
  console.log('Hub iframe ready.');
  assert.equal(await evaluate('document.querySelector("iframe").getAttribute("sandbox")'), 'allow-scripts');
  if (!standalone) assert.equal(new URL(await evaluate('document.querySelector("iframe").src')).pathname,
    `/games/drawing-defense/${manifest.version}/package/index.html`, 'Load the session-selected game directly without the legacy launcher.');
  let gameContext;
  await until(async () => {
    for (const context of contexts.filter(context => context.auxData?.isDefault)) {
      try { if (await evaluate('Boolean(document.querySelector(".drawing-defense-phase-menu"))', context)) { gameContext = context; return true; } } catch {}
    }
    return false;
  }, 'game-owned settings');
  console.log('Game settings ready.');
  if (!standalone) {
    assert.equal(sessionAttempts, sessionFailure ? 2 : 1, 'Select and bind the approved version before presenting settings.');
    catalog.releases['9.0.0'] = { contentSha256: manifest.contentSha256 };
    catalog.currentVersion = '9.0.0';
  }
  const game = expression => evaluate(expression, gameContext);
  const checkSpotlight = async selector => {
    const state = await game(`(() => {
      const spotlight = document.querySelector('.game-tour-spotlight');
      if (!spotlight) return null;
      const rect = element => { const { left, top, right, bottom } = element.getBoundingClientRect(); return { left, top, right, bottom }; };
      const style = getComputedStyle(spotlight);
      return { target: rect(document.querySelector(${JSON.stringify(selector)})), spotlight: rect(spotlight),
        panel: rect(document.querySelector('.game-tour')), width: innerWidth, height: innerHeight,
        shadow: style.boxShadow, outline: style.outlineStyle, pointerEvents: style.pointerEvents };
    })()`);
    assert.ok(state, 'Tutorial must leave a spotlight over the current target.');
    for (const edge of ['left', 'top']) assert.ok(state.spotlight[edge] <= state.target[edge] + 1, `${selector}: spotlight ${edge}`);
    for (const edge of ['right', 'bottom']) assert.ok(state.spotlight[edge] >= state.target[edge] - 1, `${selector}: spotlight ${edge}`);
    assert.notEqual(state.shadow, 'none', 'The area outside the target must be dimmed.');
    assert.equal(state.outline, 'solid', 'The current target must have a visible ring.');
    assert.equal(state.pointerEvents, 'none', 'The spotlight must preserve tutorial navigation.');
    assert.ok(state.panel.left >= 0 && state.panel.top >= 0 && state.panel.right <= state.width + 1 && state.panel.bottom <= state.height + 1, 'Tutorial controls must stay within the viewport.');
    return state;
  };
  if (process.argv.includes('--revoke')) {
    revoked = true;
    await evaluate("window.dispatchEvent(new Event('online'))");
    await until(() => evaluate('!document.querySelector("dialog iframe") && Boolean(document.querySelector("dialog [role=alert]"))'), 'revoked game removed');
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM training_records').get().count, 0);
    console.log('Revoked R2 release removed; no result saved.');
  } else {
  assert.equal(await game('document.querySelectorAll("form input[type=range]").length'), 3);
  assert.ok(await game('document.documentElement.scrollWidth <= innerWidth'), 'Settings must not overflow horizontally.');
  await game(`document.querySelector('input[type=number]').focus()`);
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 }, session);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 }, session);
  await send('Input.insertText', { text: '5' }, session);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab' }, session);
  await wait(150);
  assert.equal(await game('document.querySelector("input[type=number]").value'), '5');
  assert.equal(await game('document.querySelectorAll("form select")[1].value'), '5', 'Duration selection must display the custom duration actually used.');
  await game('document.querySelector("form .btn-primary").click()');
  await until(() => game('Boolean(document.querySelector(".game-tour"))'), 'tutorial');
  const firstStep = await checkSpotlight('.mock-enemy');
  assert.ok(firstStep.spotlight.right - firstStep.spotlight.left < firstStep.width / 2, 'Enemy spotlight must not illuminate the entire screen.');
  if (firstStep.spotlight.bottom + 12 + firstStep.panel.bottom - firstStep.panel.top <= firstStep.height - 8) {
    assert.ok(firstStep.panel.top >= firstStep.spotlight.bottom, 'Enemy explanation must appear below its spotlight when space permits.');
  }
  const screenshot = await send('Page.captureScreenshot', { format: 'png' }, session);
  await writeFile(resolve(profile, 'tutorial-spotlight.png'), Buffer.from(screenshot.data, 'base64'));
  const originalViewport = await evaluate('[innerWidth, innerHeight]');
  await send('Emulation.setDeviceMetricsOverride', { width: originalViewport[0] - 40, height: originalViewport[1] - 40, deviceScaleFactor: 1, mobile: process.argv.includes('--mobile') }, session);
  await until(() => game(`innerWidth !== ${firstStep.width}`), 'resized tutorial viewport');
  await game('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  await checkSpotlight('.mock-enemy');
  await send('Emulation.setDeviceMetricsOverride', { width: originalViewport[0], height: originalViewport[1], deviceScaleFactor: 1, mobile: process.argv.includes('--mobile') }, session);
  await until(() => game(`innerWidth === ${firstStep.width}`), 'restored tutorial viewport');
  await game('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  await checkSpotlight('.mock-enemy');
  await game('document.querySelector(".drawing-defense-tutorial .ui-button").click()');
  await until(() => game('Boolean(document.querySelector(".drawing-defense-phase-menu"))'), 'back to settings');
  assert.equal(await game('Boolean(document.querySelector(".game-tour"))'), false, 'Tutorial must be removed when returning to settings.');
  assert.equal(await game('Boolean(document.querySelector(".game-tour-spotlight"))'), false, 'Spotlight must be removed when returning to settings.');
  await game('document.querySelector("form .btn-primary").click()');
  await until(() => game('Boolean(document.querySelector(".game-tour"))'), 'reopened tutorial');
  await checkSpotlight('.mock-enemy');
  await game('document.querySelector(".game-tour button").click()');
  await checkSpotlight('.mock-canvas-area');
  await game('document.querySelector(".game-tour button").click()');
  const defenseStep = await checkSpotlight('.mock-defense-line');
  if (defenseStep.spotlight.top - 12 - (defenseStep.panel.bottom - defenseStep.panel.top) >= 8) {
    assert.ok(defenseStep.panel.bottom <= defenseStep.spotlight.top, 'Defense explanation must appear above its spotlight when space permits.');
  }
  await game('document.querySelector(".game-tour button").click()');
  assert.equal(await game('Boolean(document.querySelector(".game-tour-spotlight"))'), false, 'Finishing the tutorial must remove its spotlight.');
  await game('document.querySelector(".drawing-defense-tutorial .ui-button").click()');
  await until(() => game('Boolean(document.querySelector(".drawing-defense-phase-menu"))'), 'settings after completing tutorial');
  await game('document.querySelector("form .btn-primary").click()');
  await until(() => game('Boolean(document.querySelector(".game-tour"))'), 'tutorial before skipping');
  await game('document.querySelector(".game-tour button:last-child").click()');
  assert.equal(await game('Boolean(document.querySelector(".game-tour-spotlight"))'), false, 'Skipping the tutorial must remove its spotlight.');
  await until(() => game('Boolean(document.querySelector(".drawing-defense-tutorial .ui-button-primary"))'), 'start button');
  assert.ok(await game('document.querySelector(".drawing-defense-tutorial").textContent.includes("5s")'));
  await game('document.querySelector(".drawing-defense-tutorial .ui-button-primary").click()');
  await until(() => game('Boolean(document.querySelector(".drawing-defense-phase-playing canvas"))'), 'Pixi gameplay');
  console.log('Playing.');
  assert.equal(await game('document.fullscreenElement === document.querySelector(".drawing-defense")'), true, 'Native fullscreen must belong to the game root.');
  const viewport = await game('(() => { const canvas=document.querySelector("canvas").getBoundingClientRect(); return [Math.round(canvas.width),Math.round(canvas.height),innerWidth,innerHeight]; })()');
  assert.equal(viewport[0], viewport[2]);
  assert.equal(viewport[1], viewport[3]);
  const pointerSession = gameContext.session || session;
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 150, y: 200, button: 'left', clickCount: 1 }, pointerSession);
  for (let point = 1; point <= 8; point++) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 150 + point * 10, y: 200 + point * 10, button: 'left', buttons: 1 }, pointerSession);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 230, y: 280, button: 'left', clickCount: 1 }, pointerSession);
  if (process.argv.includes('--mobile')) {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 160, y: 230 }] }, pointerSession);
    for (let point = 1; point <= 8; point++) await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 160 + point * 10, y: 230 }] }, pointerSession);
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, pointerSession);
  }
  await until(() => game('Boolean(document.querySelector(".drawing-defense-phase-results"))'), 'game-owned results');
  if (standalone) {
    assert.ok(await game('document.body.textContent.includes("從 Hub 開啟才能保存紀錄")'));
    await game('document.querySelector(".experiment-results > button:last-child").click()');
    await until(() => game('Boolean(document.querySelector(".drawing-defense-phase-menu"))'), 'standalone return to settings');
    assert.equal(saveAttempts, 0);
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('Standalone R2 PWA passed: settings, tutorial, game, results, return to settings; no account data writes.');
  } else {
  await until(() => game('Boolean(Array.from(document.querySelectorAll("button")).find(button=>button.textContent.includes("重試保存")))'), 'failed save feedback');
  await game('Array.from(document.querySelectorAll("button")).find(button=>button.textContent.includes("重試保存")).click()');
  await until(() => game('document.body.textContent.includes("紀錄已保存")'), 'Hub D1 save acknowledgement');
  const rows = sqlite.prepare('SELECT payload_json FROM training_records').all();
  assert.equal(rows.length, 1);
  const record = JSON.parse(rows[0].payload_json);
  assert.equal(record.config.durationSec, 5);
  assert.ok(record.score.rounds.length >= 1);
  assert.ok(saveAttempts >= 2);
  assert.equal(sessionAttempts, sessionFailure ? 2 : 1, 'Saving and retry must keep the session selected before current changed.');
  assert.equal(requests.some(url => /drawing-defense.*(?:settings|score)\.json/.test(url)), false);
  assert.equal(errors.length, 0, errors.join('\n'));
  await game('document.querySelector(".experiment-results > button:last-child").click()');
  await until(() => evaluate('!document.querySelector("dialog.training-overlay")'), 'return to lobby');
  console.log(`Brave R2 game passed: settings → tutorial → Pixi (${viewport[0]}×${viewport[1]}) → results → failed save → retry → one SQL row → lobby.`);
  }
  }
} finally {
  ws?.close();
  browser?.kill();
  hub?.closeAllConnections(); runner?.closeAllConnections();
  await Promise.all([hub, runner].filter(server => server?.listening).map(server => new Promise(resolve => server.close(resolve))));
  sqlite.close();
}
