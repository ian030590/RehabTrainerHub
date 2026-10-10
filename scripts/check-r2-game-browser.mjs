import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { BuildOfficialGameRelease } from './publish-official-game.mjs';
import { HandleRequest } from '../apps/usergamerunner/functions/[[path]].js';
import { ContentTypeForPath } from '../apps/usergamerunner/functions/_lib/release.js';
import { onRequestPost as createSession } from '../apps/rehabtrainerhub/functions/api/official-game-sessions.js';
import { onRequestPost as saveRecord } from '../apps/rehabtrainerhub/functions/api/records.js';
import { onRequestGet as listGames } from '../apps/rehabtrainerhub/functions/api/games.js';
import { onRequestGet as readAccount } from '../apps/rehabtrainerhub/functions/api/auth/me.js';
import { CreateSessionForUser } from '../apps/rehabtrainerhub/functions/_lib/auth.js';

import { CheckAsteroidShield } from './asteroid-shield-browser.mjs';
import { CheckGestureBattler } from './gesture-battler-browser.mjs';
import { CheckMotorCortex } from './motor-cortex-browser.mjs';
import { LoadGestureCameraFixtures } from './gesture-camera-fixtures.mjs';
import { CheckResultsPresentation } from './r2-game-results-browser.mjs';
import { CheckSettingsPresentation, CheckConfirmationPresentation } from './r2-game-ui-browser.mjs';
const gameIndex = process.argv.indexOf('--game');
const gameId = gameIndex < 0 ? 'drawing-defense' : process.argv[gameIndex + 1];
assert.ok(['drawing-defense', 'asteroid-shield', 'gesture-battler', 'motor-cortex-rehab'].includes(gameId), 'Unknown browser game fixture');
const handGame = ['gesture-battler', 'motor-cortex-rehab'].includes(gameId);
const phasePrefix = gameId;
const root = resolve(import.meta.dirname, '..');
const productionHub = process.argv.includes('--production-hub');
const remote = process.argv.includes('--remote') || productionHub;
const standalone = process.argv.includes('--standalone');
const lobby = process.argv.includes('--lobby');
const sessionFailure = process.argv.includes('--session-failure');
const signedIn = process.argv.includes('--signed-in');
const english = process.argv.includes('--english');
const viewportMode = process.argv.includes('--mobile') ? 'mobile' : process.argv.includes('--tablet') ? 'tablet' : 'desktop';
const rendererFailure = process.argv.includes('--renderer-failure');
const output = resolve(process.env.HUB_OUTPUT_ROOT || resolve(root, 'apps/rehabtrainerhub/out'));
const runnerOutput = resolve(process.env.RUNNER_OUTPUT_ROOT || resolve(root, 'apps/usergamerunner/dist'));
if (handGame && !remote) assert.ok(existsSync(resolve(runnerOutput, 'input/hand-tracking-1.0.0/index.js')),
  'Build the runner hand input first; use RUNNER_OUTPUT_ROOT for a fixed browser snapshot.');
const browserPath = process.env.BRAVE_BIN || 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
assert.ok(existsSync(browserPath), 'Brave is required.');
const { manifest, files } = await BuildOfficialGameRelease(gameId);
const handFixtures = handGame ? await LoadGestureCameraFixtures(root) : new Map();
const unavailableTexture = rendererFailure ? manifest.files.find(file => file.path.startsWith('assets/ship-'))?.path : null;
assert.ok(!rendererFailure || unavailableTexture, 'Renderer failure fixture requires the asteroid ship texture.');
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
  const bytes = key === `official-games/${gameId}/current.json` ? Buffer.from(JSON.stringify(catalog))
    : key.endsWith('/release.json') ? Buffer.from(JSON.stringify({ ...manifest, status: revoked ? 'revoked' : 'approved' })) : files.get(key.split('/files/')[1]);
  if (!bytes || (unavailableTexture && key.endsWith('/files/' + unavailableTexture))) return null;
  return { size: bytes.length, body: bytes, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    text: async () => bytes.toString('utf8'), json: async () => JSON.parse(bytes.toString('utf8')) };
} };
const environment = { REHAB_DB: database, GAME_RELEASE_BUCKET: bucket, ANONYMOUS_RECORDS_ENABLED: '1', AUTH_SESSION_SECRET: 'r2-browser-local-secret-abcdefghijklmnopqrstuvwxyz' };
const accountId = signedIn ? crypto.randomUUID() : null;
const guestSubjectId = '550e8400-e29b-41d4-a716-446655440000';
if (signedIn) sqlite.prepare('INSERT INTO app_users (id,display_name,created_at,updated_at) VALUES (?,?,?,?)')
  .run(accountId, 'Local browser account', new Date().toISOString(), new Date().toISOString());
const accountToken = signedIn ? await CreateSessionForUser(environment, { id: accountId }) : null;
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
    void HandleRequest({ request: new Request(runnerOrigin + request.url, { method: request.method }), env: { GAME_RELEASE_BUCKET: bucket }, next: async () => {
      if (handFixtures.has(request.url)) return new Response(handFixtures.get(request.url), { headers: { 'Content-Type': 'image/jpeg' } });
      const path = resolve(runnerOutput, '.' + new URL(request.url, runnerOrigin).pathname);
      assert.ok(path.startsWith(runnerOutput + sep));
      const bytes = await readFile(path).catch(() => null);
      return bytes ? new Response(bytes, { headers: { 'Content-Type': path.endsWith('.wasm') ? 'application/wasm' : ContentTypeForPath(path), 'Access-Control-Allow-Origin': '*' } }) : new Response('Missing', { status: 404 });
    } })
      .then(result => Respond(response, result)).catch(error => { errors.push(String(error)); response.writeHead(500).end(); });
  });
  runnerOrigin = remote ? 'https://trainerhub-user-games.pages.dev' : await listen(runner);
  environment.GAME_RUNNER_ORIGIN = runnerOrigin;
  hub = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, hubOrigin);
      if (handFixtures.has(url.pathname)) { response.writeHead(200, { 'Content-Type': 'image/jpeg' }); response.end(handFixtures.get(url.pathname)); return; }
      if (url.pathname === '/api/auth/me' && signedIn) {
        await Respond(response, await readAccount({ request: new Request('https://trainerhub.cc/api/auth/me', { headers: request.headers }), env: environment }));
        return;
      }
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
        const oldGame = { id: gameId === 'motor-cortex-rehab' ? 'official-motor-cortex-rehab' : 'old-drawing-defense', slug: gameId, title: 'Obsolete settings shell',
          summary: 'Legacy publication', trainer: 'motor', category: gameId === 'motor-cortex-rehab' ? 'general' : 'upper-limb', developerName: 'Sample author', updatedAt: '2026-10-08',
          release: { id: 'old-release', version: '1.0.0', contentSha256: 'a'.repeat(64), capabilities: ['pointer'],
            approvedAt: '2026-10-08', launchUrl: `${runnerOrigin}/games/${gameId}/1.0.0/`,
            installUrl: `${runnerOrigin}/games/${gameId}/1.0.0/`,
            settingsUrl: `${runnerOrigin}/games/${gameId}/1.0.0/package/settings.json` } };
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
  const profile = resolve(root, '.tmp', `r2-browser-${process.pid}-${crypto.randomUUID()}`);
  await mkdir(profile, { recursive: true });
  browser = spawn(browserPath, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-allow-origins=*',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    ...(handGame ? ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] : []),
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
        const fixture = handFixtures.get(path.pathname);
        if (fixture) {
          await send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 200,
            responseHeaders: [{ name: 'Content-Type', value: 'image/jpeg' }], body: fixture.toString('base64') }, message.sessionId);
          return;
        }
        const response = await fetch(hubOrigin + path.pathname + path.search, { method: request.method,
          headers: request.headers, ...(request.postData ? { body: request.postData } : {}) });
        await send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: response.status,
          responseHeaders: Array.from(response.headers, ([name, value]) => ({ name, value })),
          body: Buffer.from(await response.arrayBuffer()).toString('base64') }, message.sessionId);
      })().catch(error => errors.push(String(error)));
    }
    if (message.method === 'Target.attachedToTarget') {
      void (async () => {
        const childSession = message.params.sessionId;
        await Promise.all([send('Runtime.enable', {}, childSession), send('Network.enable', {}, childSession)]);
        if (gameId === 'asteroid-shield' && message.params.targetInfo.type === 'iframe') {
          await send('Page.enable', {}, childSession);
          await send('Page.addScriptToEvaluateOnNewDocument', {
            source: 'window.__PIXI_APP_INIT__ = app => { window.asteroidPixiApp = app; };', runImmediately: true,
          }, childSession);
        }
        if (message.params.waitingForDebugger) await send('Runtime.runIfWaitingForDebugger', {}, childSession);
      })().catch(error => { if (!/Inspected target navigated or closed/.test(error.message)) errors.push(String(error)); });
    }
  });
  const target = await send('Target.createTarget', { url: 'about:blank' });
  const attached = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const session = attached.sessionId;
  await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: gameId === 'asteroid-shield', flatten: true,
    ...(gameId === 'asteroid-shield' ? { filter: [{ type: 'iframe' }, { exclude: true }] } : {}),
  }, session);
  await send('Runtime.enable', {}, session);
  await send('Network.enable', {}, session);
  await send('Page.enable', {}, session);
  if (handGame) await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    if (window === window.top) {
      const fixtureImages = ${JSON.stringify(Object.fromEntries([...handFixtures].map(([path, bytes]) => [path.split('/').at(-1).replace('.jpg', ''), 'data:image/jpeg;base64,' + bytes.toString('base64')])))};
      const nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async () => {
        const nativeStream = await nativeGetUserMedia({video:true,audio:false});
        nativeStream.getTracks().forEach(track=>track.stop());
        window.nativeCameraPermissionVerified=true;
        let image = new Image(); image.src = fixtureImages.pointing_up; image.fixtureName='pointing_up'; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width=720;canvas.height=720;
        const context=canvas.getContext('2d');
        window.handFixtureOffset={x:0,y:0};
        const draw = () => {const sx=image.fixtureName==='right_hands'?360:0;const width=image.width-sx;const scale=Math.min(canvas.width/width,canvas.height/image.height);context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.save();const mirror=${process.argv.includes('--left')};if(mirror){context.translate(canvas.width,0);context.scale(-1,1);}context.drawImage(image,sx,0,width,image.height,(canvas.width-width*scale)/2+(mirror?-1:1)*window.handFixtureOffset.x*canvas.width,(canvas.height-image.height*scale)/2+window.handFixtureOffset.y*canvas.height,width*scale,image.height*scale);context.restore();};draw();
        window.setHandFixture = async name => {const next=new Image();next.src=fixtureImages[name];next.fixtureName=name;await next.decode();image=next;};
        const stream=canvas.captureStream(15);window.handFixtureStream=stream;
        const timer=setInterval(()=>{if(stream.getTracks().every(track=>track.readyState==='ended'))clearInterval(timer);else draw();},66);
        return stream;
      };
    }
  ` }, session);
  if (gameId === 'asteroid-shield') await send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'window.__PIXI_APP_INIT__ = app => { window.asteroidPixiApp = app; };',
  }, session);
  if (remote || handGame) await send('Fetch.enable', { patterns: [
    ...(remote ? [{ urlPattern: productionHub ? 'https://trainerhub.cc/api/*' : 'https://trainerhub.cc/*', requestStage: 'Request' }] : []),
    ...(handGame ? [{ urlPattern: '*/__hand-test/*', requestStage: 'Request' }] : []),
  ] }, session);
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
  if (process.argv.includes('--wide')) await send('Emulation.setDeviceMetricsOverride', { width: 1320, height: 713, deviceScaleFactor: 1, mobile: false }, session);
  if (process.argv.includes('--mobile')) await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, session);
  if (process.argv.includes('--tablet')) await send('Emulation.setDeviceMetricsOverride', { width: 820, height: 1180, deviceScaleFactor: 1, mobile: false }, session);
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `try {
    localStorage.setItem('rehab_hub_tour_seen','1');
    localStorage.setItem('rehab-trainer-hub-language', ${JSON.stringify(english ? 'en' : 'zh')});
    localStorage.setItem('rehabtrainerhub.subject-id.v1', ${JSON.stringify(guestSubjectId)});
    ${signedIn ? `localStorage.setItem('rehabtrainerhub.auth.token', ${JSON.stringify(accountToken)});` : ''}
  } catch {}` }, session);
  await send('Page.navigate', { url: standalone ? `${runnerOrigin}/games/${gameId}/${manifest.version}/${english ? '?lang=en' : ''}` : (remote ? 'https://trainerhub.cc' : hubOrigin) + (lobby ? '/' : `/train/?module=motor%3A${gameId}`) }, session);
  await send('Target.activateTarget', { targetId: target.targetId });
  const evaluate = async (expression, context) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true, ...(context ? { contextId: context.id } : {}) }, context?.session || session);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const until = async (action, label, timeout = 20000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      try { if (await action()) return; } catch (error) {
        if (!/Inspected target navigated or closed|Cannot find context/.test(error.message)) throw error;
      }
      await wait(100);
    }
    const bodies = [];
    for (const context of contexts.filter(context => context.auxData?.isDefault)) {
      try { bodies.push(await evaluate('document.body.innerText.slice(0,6000)', context)); } catch {}
    }
    throw new Error(`Timed out: ${label}\n${errors.join('\n')}\n${bodies.join('\n')}`);
  };
  let lobbyScrollState;
  if (lobby && !standalone) {
    await until(() => evaluate('Boolean(document.querySelector(".module-card[data-runtime-id=reviewed-browser-game]"))'), 'reviewed catalog loaded');
    assert.equal(await evaluate(`document.querySelectorAll(".module-card[data-runtime-id=${gameId}]").length`), 1);
    assert.match(await evaluate(`document.querySelector(".module-card[data-runtime-id=${gameId}] .module-subcategory-tag").textContent`), english ? /upper/i : /上肢動作/);
    await evaluate(`document.querySelector(".module-card[data-runtime-id=${gameId}]").scrollIntoView()`);
    await until(() => evaluate(`(() => { const image = document.querySelector(".module-card[data-runtime-id=${gameId}] img"); return image?.complete && image.naturalWidth > 0; })()`), 'game-owned preview loaded');
    assert.equal(new URL(await evaluate(`document.querySelector(".module-card[data-runtime-id=${gameId}] img").src`)).pathname,
      `/games/${gameId}/${manifest.version}/package/preview.webp`);
    lobbyScrollState = await evaluate('({top:scrollY,overflow:getComputedStyle(document.documentElement).overflowY})');
    await evaluate(`document.querySelector(".module-card[data-runtime-id=${gameId}] button").click()`);
    await until(() => sessionAttempts > 0, 'lobby selects an approved R2 session before loading settings');
  }
  if (sessionFailure && !standalone) {
    await until(() => evaluate('Boolean(document.querySelector("dialog [role=alert]"))'), 'session failure feedback');
    assert.equal(await evaluate('document.querySelectorAll("dialog iframe").length'), 0, 'Unavailable sessions must not mount an unbound game.');
    await evaluate('document.querySelector("dialog [role=alert] button").click()');
  }
  await until(() => evaluate('Boolean(document.querySelector("iframe"))'), 'Hub game iframe');
  console.log('Hub iframe ready.');
  if (!standalone) {
    const layout = await evaluate(`(() => {
      const frame = document.querySelector('dialog iframe').getBoundingClientRect();
      const documentWidth = document.documentElement.clientWidth;
      return { width: innerWidth, documentWidth, overflow: getComputedStyle(document.documentElement).overflowY,
        frameLeft: frame.left, frameRight: frame.right, scrollbarWidth: innerWidth - documentWidth };
    })()`);
    assert.equal(layout.scrollbarWidth, 0, `A game overlay must not retain the lobby scrollbar: ${JSON.stringify(layout)}`);
    assert.ok(['hidden', 'clip'].includes(layout.overflow), 'The lobby must stop scrolling while the game overlay is open.');
    assert.ok(Math.abs(layout.frameLeft - (layout.documentWidth - layout.frameRight)) <= 1,
      `The game frame must be horizontally centered in the visible viewport: ${JSON.stringify(layout)}`);
    console.log(`Hub overlay viewport passed: ${JSON.stringify(layout)}`);
  }
  assert.equal(await evaluate('document.querySelector("iframe").getAttribute("sandbox")'), 'allow-scripts');
  if (!standalone) assert.equal(new URL(await evaluate('document.querySelector("iframe").src')).pathname,
    `/games/${gameId}/${manifest.version}/package/index.html`, 'Load the session-selected game directly without the legacy launcher.');
  let gameContext;
  await until(async () => {
    for (const context of contexts.filter(context => context.auxData?.isDefault)) {
      try { if (await evaluate(`Boolean(document.querySelector(".${phasePrefix}-phase-menu"))`, context)) { gameContext = context; return true; } } catch {}
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
  assert.equal(await game('document.fullscreenElement'), null, 'Settings must remain outside fullscreen for every R2 game.');
  await CheckSettingsPresentation(game);
  const settingsScreenshot = await send('Page.captureScreenshot', { format: 'png' }, session);
  await writeFile(resolve(profile, 'settings.png'), Buffer.from(settingsScreenshot.data, 'base64'));
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
  } else if (gameId === 'motor-cortex-rehab') {
    const screenshots = resolve(root, '.tmp/motor-validation', `${standalone ? 'standalone' : 'lobby'}-${viewportMode}-${signedIn ? 'account' : 'guest'}${english ? '-en' : ''}`);
    await mkdir(screenshots, { recursive: true });
    const capture = async name => { const screenshot = await send('Page.captureScreenshot', { format: 'png' }, session); await writeFile(resolve(screenshots, `${name}.png`), Buffer.from(screenshot.data, 'base64')); };
    await CheckMotorCortex({ game, evaluate, until, standalone, english, capture, checkSpotlight, sqlite,
      getSaveAttempts: () => saveAttempts, getSessionAttempts: () => sessionAttempts, sessionFailure, requests, errors, version: manifest.version, accountId, guestSubjectId,
      revokeRelease: () => { revoked = true; } });
  } else if (gameId === 'gesture-battler') {
    const screenshots = resolve(root, '.tmp/gesture-validation', `${standalone ? 'standalone' : 'lobby'}-${viewportMode}-${signedIn ? 'account' : 'guest'}${english ? '-en' : ''}`);
    await mkdir(screenshots, { recursive: true });
    const capture = async name => { const screenshot = await send('Page.captureScreenshot', { format: 'png' }, session); await writeFile(resolve(screenshots, `${name}.png`), Buffer.from(screenshot.data, 'base64')); };
    await CheckGestureBattler({ game, evaluate, send, until, gameContext, session, standalone, english,
      mobile: process.argv.includes('--mobile'), capture, sqlite, getSaveAttempts: () => saveAttempts,
      getSessionAttempts: () => sessionAttempts, sessionFailure, requests, errors, version: manifest.version, accountId, guestSubjectId });
  } else if (gameId === 'asteroid-shield') {
    const screenshots = resolve(root, '.tmp/asteroid-validation', `${standalone ? 'standalone' : 'lobby'}-${viewportMode}-${signedIn ? 'account' : 'guest'}${english ? '-en' : ''}`);
    await mkdir(screenshots, { recursive: true });
    const capture = async name => {
      const screenshot = await send('Page.captureScreenshot', { format: 'png' }, session);
      await writeFile(resolve(screenshots, `${name}.png`), Buffer.from(screenshot.data, 'base64'));
    };
    await CheckAsteroidShield({game, evaluate, send, until, gameContext, session, version: manifest.version, standalone,
      sqlite, requests, errors, saveAttempts: () => saveAttempts, sessionAttempts: () => sessionAttempts, sessionFailure, capture, accountId, guestSubjectId});
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
  await CheckConfirmationPresentation(game);
  assert.equal(await game('document.fullscreenElement'), null, 'Drawing tutorial and confirmation remain windowed.');
  const confirmationScreenshot = await send('Page.captureScreenshot', { format: 'png' }, session);
  await writeFile(resolve(profile, 'confirmation.png'), Buffer.from(confirmationScreenshot.data, 'base64'));
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
  const resultScreenshots = resolve(root, '.tmp/drawing-validation', `${standalone ? 'standalone' : 'lobby'}-${viewportMode}`);
  await mkdir(resultScreenshots, { recursive: true });
  const captureResults = async name => {
    const screenshot = await send('Page.captureScreenshot', { format: 'png' }, session);
    await writeFile(resolve(resultScreenshots, `${name}.png`), Buffer.from(screenshot.data, 'base64'));
  };
  await CheckResultsPresentation(game, { defaultMetric: 'reactionSeconds', alternateMetric: 'defeated', capture: captureResults });
  if (standalone) {
    assert.ok(await game('document.body.textContent.includes("從 Hub 開啟才能保存紀錄")'));
    await game('document.querySelector(".experiment-results > button:last-child").click()');
    await until(() => game('Boolean(document.querySelector(".drawing-defense-phase-menu"))'), 'standalone return to settings');
    assert.equal(await evaluate('document.fullscreenElement'), null, 'Returning to settings exits fullscreen.');
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
  assert.equal(await evaluate('document.fullscreenElement'), null, 'Returning to Hub exits fullscreen.');
  console.log(`Brave R2 game passed: settings → tutorial → Pixi (${viewport[0]}×${viewport[1]}) → results → failed save → retry → one SQL row → lobby.`);
  }
  }
  if (lobbyScrollState && !await evaluate('Boolean(document.querySelector("dialog.training-overlay"))')) {
    await until(() => evaluate('scrollY').then(top => Math.abs(top - lobbyScrollState.top) <= 1), 'lobby scroll position restored after fullscreen exit');
    const restored = await evaluate('({top:scrollY,overflow:getComputedStyle(document.documentElement).overflowY})');
    assert.equal(restored.overflow, lobbyScrollState.overflow, 'Returning to the lobby restores its scrollbar.');
    assert.ok(Math.abs(restored.top - lobbyScrollState.top) <= 1, 'Returning preserves the original lobby scroll position.');
    console.log(`Lobby scrolling restored: ${JSON.stringify(restored)}`);
  }
} finally {
  ws?.close();
  browser?.kill();
  hub?.closeAllConnections(); runner?.closeAllConnections();
  await Promise.all([hub, runner].filter(server => server?.listening).map(server => new Promise(resolve => server.close(resolve))));
  sqlite.close();
}
