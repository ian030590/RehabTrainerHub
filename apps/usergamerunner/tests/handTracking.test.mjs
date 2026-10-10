import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { resolve } from 'node:path';
import test from 'node:test';
import { AcceptGameMessage } from '../../../packages/ui/src/selfContainedGame.js';
import { createHash } from 'node:crypto';
import { HandleRequest } from '../functions/[[path]].js';
import { CreateHandTrackingBroker } from '../../../packages/ui/src/handTrackingBroker.js';

test('trusted consent is cancellable and late input loading cannot restart a closed game', async () => {
  let resolveConsent;
  let resolveController;
  let requests = 0;
  let starts = 0;
  let stops = 0;
  const messages = [];
  const controller = { Start: async () => { starts++; return true; }, Stop: () => stops++ };
  const broker = CreateHandTrackingBroker({
    requestConsent: () => { requests++; return new Promise(resolve => { resolveConsent = resolve; }); },
    cancelConsent: () => resolveConsent?.(false),
    createController: () => new Promise(resolve => { resolveController = resolve; }),
    send: message => messages.push(message),
  });
  const cancelled = broker.Start();
  await broker.Start();
  assert.equal(requests, 1, 'Repeated input requests must not reopen permission prompts.');
  broker.Stop();
  await cancelled;
  assert.equal(starts, 0);
  assert.deepEqual(messages, []);
  const delayed = broker.Start();
  resolveConsent(true);
  await new Promise(resolve => setImmediate(resolve));
  broker.Stop();
  resolveController(controller);
  await delayed;
  assert.equal(starts, 0);
  assert.equal(stops, 1, 'Discard the controller loaded after exit.');
  const declined = broker.Start();
  resolveConsent(false);
  await declined;
  assert.deepEqual(messages, [{ schema: 'trainerhub.input/v1', sequence: 0, type: 'error', payload: { reason: 'permission' } }]);
});

test('only reviewed hand tracking sessions accept private input requests; rejects replay and results-phase starts', () => {
  const state = { gameId: 'gesture-battler', version: '2.0.0', sessionNonce: 'a'.repeat(64),
    sequence: -1, complete: false, capabilities: ['hand-tracking'] };
  const request = { schema: 'trainerhub.game/v1', gameId: state.gameId, version: state.version,
    sessionNonce: state.sessionNonce, sequence: 0, type: 'input-start', payload: {} };
  assert.equal(AcceptGameMessage(request, { ...state, capabilities: [] }), false);
  assert.equal(AcceptGameMessage({ ...request, payload: { model: 'https://evil.example/model' } }, { ...state }), false);
  assert.equal(AcceptGameMessage({ ...request, sessionNonce: 'b'.repeat(64) }, { ...state }), false);
  assert.equal(AcceptGameMessage(request, state), true);
  assert.equal(AcceptGameMessage(request, state), false);
  assert.equal(AcceptGameMessage({ ...request, sequence: 1 }, { ...state, complete: true }), false);
  assert.equal(AcceptGameMessage({ ...request, sequence: 1, type: 'input-stop' }, state), true);
});

test('input proxy sends only xyz landmarks and stops camera, detector and timers', async () => {
  const { CreateHandTrackingController } = await import('../runtime/handTrackingController.js');
  const fixture = CreateFixture();
  const frames = [];
  const errors = [];
  const proxy = CreateHandTrackingController(fixture.environment);
  await proxy.Start(frame => frames.push(frame), error => errors.push(error));
  fixture.Tick(100);
  assert.deepEqual(frames, [{ timestamp: 100, landmarks: Array.from({ length: 21 }, () => ({ x: 0.1, y: 0.2, z: -0.3 })) }]);
  fixture.video.currentTime++;
  fixture.detection.landmarks = [];
  fixture.Tick(200);
  assert.deepEqual(frames.at(-1), { timestamp: 200, landmarks: [] });
  proxy.Stop();
  assert.equal(fixture.stops, 1);
  assert.equal(fixture.closes, 1);
  assert.equal(fixture.callbacks.size, 0);
  assert.equal(fixture.video.srcObject, null);
  assert.deepEqual(errors, []);
});

test('late camera and model initialization are disposed after exit', async () => {
  const { CreateHandTrackingController } = await import('../runtime/handTrackingController.js');
  for (const stage of ['camera', 'model']) {
    const fixture = CreateFixture();
    let finish;
    const pending = new Promise(resolve => { finish = resolve; });
    if (stage === 'camera') fixture.environment.getUserMedia = () => pending;
    else fixture.environment.createLandmarker = () => pending;
    const proxy = CreateHandTrackingController(fixture.environment);
    const start = proxy.Start(() => assert.fail('No frame after exit'), () => assert.fail('No stale error'));
    await new Promise(resolve => setImmediate(resolve));
    proxy.Stop();
    finish(stage === 'camera' ? fixture.stream : fixture.landmarker);
    await start;
    assert.equal(fixture.stops, 1, stage);
    assert.equal(fixture.closes, stage === 'model' ? 1 : 0, stage);
    assert.equal(fixture.callbacks.size, 0);
  }
});

test('denial, disconnect and inference failure stop tracking and provide retryable errors', async () => {
  const { CreateHandTrackingController } = await import('../runtime/handTrackingController.js');
  for (const reason of ['permission', 'disconnected', 'initialization']) {
    const fixture = CreateFixture();
    const errors = [];
    if (reason === 'permission') fixture.environment.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); };
    const proxy = CreateHandTrackingController(fixture.environment);
    await proxy.Start(() => {}, error => errors.push(error));
    if (reason === 'disconnected') fixture.events.get('ended')();
    if (reason === 'initialization') {
      fixture.landmarker.detectForVideo = () => { throw new Error('Inference failed'); };
      fixture.Tick(100);
    }
    assert.deepEqual(errors, [reason]);
    assert.equal(fixture.callbacks.size, 0);
    if (reason !== 'permission') assert.equal(fixture.stops, 1);
  }
});

function CreateFixture() {
  const callbacks = new Map();
  const events = new Map();
  const fixture = { callbacks, events, stops: 0, closes: 0 };
  const track = { stop: () => fixture.stops++, addEventListener: (type, listener) => events.set(type, listener) };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  const video = { readyState: 2, currentTime: 1, srcObject: null, play: async () => {}, pause() {} };
  const detection = { landmarks: [Array.from({ length: 21 }, () => ({ x: 0.1, y: 0.2, z: -0.3, visibility: 1, image: 'private' }))] };
  const landmarker = { detectForVideo: () => detection, close: () => fixture.closes++ };
  let nextId = 0;
  Object.assign(fixture, { stream, video, detection, landmarker,
    environment: { getUserMedia: async () => stream, createVideo: () => video,
      createLandmarker: async () => landmarker,
      requestFrame: callback => { callbacks.set(++nextId, callback); return nextId; },
      cancelFrame: id => callbacks.delete(id),
    }, Tick: timestamp => {
      const [id, callback] = [...callbacks][0]; callbacks.delete(id); callback(timestamp);
    },
  });
  return fixture;
}

test('trusted proxy selects the requested hand locally and emits only the existing xyz frame contract', async () => {
  const { CreateHandTrackingController } = await import('../runtime/handTrackingController.js');
  for (const hand of ['left', 'right']) {
    const fixture = CreateFixture();
    const left = Array.from({ length: 21 }, () => ({ x: .2, y: .3, z: 0 }));
    const right = Array.from({ length: 21 }, () => ({ x: .7, y: .4, z: 0 }));
    fixture.detection.landmarks = [left, right];
    fixture.detection.handedness = [[{ categoryName: 'Left' }], [{ categoryName: 'Right' }]];
    const frames = [];
    const proxy = CreateHandTrackingController(fixture.environment);
    await proxy.Start(frame => frames.push(frame), assert.fail, hand);
    fixture.Tick(100);
    assert.deepEqual(frames[0], { timestamp: 100, landmarks: hand === 'left' ? left : right });
    fixture.video.currentTime++;
    fixture.detection.handedness = [[{ categoryName: hand === 'left' ? 'Right' : 'Left' }]];
    fixture.detection.landmarks = [left];
    fixture.Tick(200);
    assert.deepEqual(frames[1], { timestamp: 200, landmarks: [] });
    proxy.Stop();
  }
});

test('private hand selection rejects arbitrary input options and survives consent forwarding', async () => {
  const state = { gameId: 'motor-cortex-rehab', version: '2.0.0', sessionNonce: 'a'.repeat(64),
    sequence: -1, complete: false, capabilities: ['hand-tracking'] };
  const message = { schema: 'trainerhub.game/v1', gameId: state.gameId, version: state.version,
    sessionNonce: state.sessionNonce, sequence: 0, type: 'input-start', payload: { hand: 'left' } };
  assert.equal(AcceptGameMessage(message, { ...state }), true);
  for (const payload of [{ hand: 'other' }, { hand: 'left', model: 'remote' }, { camera: true }]) {
    assert.equal(AcceptGameMessage({ ...message, payload }, { ...state }), false);
  }
  assert.equal(AcceptGameMessage({ ...message, type: 'input-stop' }, { ...state }), false);
  let selected;
  const broker = CreateHandTrackingBroker({ requestConsent: async () => true, cancelConsent() {}, send() {},
    createController: async () => ({ Start: async (_frame, _error, hand) => { selected = hand; return true; }, Stop() {} }) });
  await broker.Start('left');
  assert.equal(selected, 'left');
  broker.Stop();
});

test('only trusted official hand launchers receive camera permission; game packages stay opaque and offline', async () => {
  const bytes = Buffer.from('<!doctype html><title>Gesture</title>');
  const files = [{ path: 'index.html', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }];
  const release = { schemaVersion: 1, status: 'approved', gameId: 'gesture-battler', version: '2.0.0',
    name: 'Gesture battle', entry: 'index.html', runtime: { name: 'native', major: 1 }, presentation: 'game',
    capabilities: ['hand-tracking'], files, contentSha256: createHash('sha256').update(JSON.stringify(files)).digest('hex') };
  let official = true;
  const catalog = { schemaVersion: 1, gameId: release.gameId, currentVersion: release.version,
    releases: { [release.version]: { contentSha256: release.contentSha256 } } };
  const bucket = { get: async key => {
    const source = key.startsWith('official-games/') ? (official ? JSON.stringify(catalog) : null)
      : key.endsWith('/release.json') ? JSON.stringify(release) : null;
    if (source) return { size: Buffer.byteLength(source), text: async () => source };
    if (key.endsWith('/files/index.html')) return { size: bytes.length, body: bytes,
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    return null;
  } };
  const Read = path => HandleRequest({ request: new Request('https://runner.example/games/gesture-battler/2.0.0/' + path),
    env: { GAME_RELEASE_BUCKET: bucket } });
  const launcher = await Read('');
  assert.equal(launcher.status, 200);
  assert.match(launcher.headers.get('permissions-policy'), /camera=\(self\)/);
  assert.match(launcher.headers.get('content-security-policy'), /wasm-unsafe-eval/);
  assert.doesNotMatch(launcher.headers.get('content-security-policy'), /'unsafe-eval'/);
  const html = await launcher.text();
  assert.match(html, /sandbox="allow-scripts"/);
  assert.doesNotMatch(html, /allow-same-origin|allow="camera/);
  assert.equal((await Read('?lang=en')).status, 200, 'Official standalone input supports a selected language.');
  assert.equal((await Read('?lang=fr')).status, 400);
  assert.equal((await Read('?lang=en&lang=zh')).status, 400);
  const workerEvents = new Map();
  const workerSource = await (await Read('sw.js')).text();
  new Function('self', 'caches', 'fetch', workerSource)(
    { location: { origin: 'https://runner.example' }, addEventListener: (type, listener) => workerEvents.set(type, listener) },
    { open: async () => ({ match: async () => new Response('cached launcher') }) },
    async () => { throw new Error('Offline'); },
  );
  let offline;
  workerEvents.get('fetch')({ request: new Request('https://runner.example/games/gesture-battler/2.0.0/?lang=en'), respondWith: promise => { offline = promise; } });
  assert.ok(offline, 'The language-specific standalone entry must work offline.');
  assert.equal(await (await offline).text(), 'cached launcher');
  const game = await Read('package/index.html');
  assert.equal(game.status, 200);
  assert.match(game.headers.get('permissions-policy'), /camera=\(\)/);
  assert.match(game.headers.get('content-security-policy'), /connect-src 'none'/);
  assert.doesNotMatch(game.headers.get('content-security-policy'), /wasm-unsafe-eval/);
  official = false;
  assert.equal((await Read('')).status, 404);
});

test('production-bundled hand launcher starts its opaque game without acquiring camera input', async () => {
  const output = await build({ entryPoints: [resolve(import.meta.dirname, '../functions/_lib/handTrackingLauncher.js')],
    bundle: true, keepNames: true, format: 'esm', platform: 'neutral', write: false });
  const { RenderHandTrackingLauncher } = await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'));
  const html = RenderHandTrackingLauncher({ gameId: 'gesture-battler', version: '2.0.0', capabilities: ['hand-tracking'] }, '/games/gesture-battler/2.0.0/', 'test-nonce');
  const inline = html.match(/<script nonce="test-nonce">([\s\S]*?)<\/script>/)[1];
  const events = new Map();
  const frame = { addEventListener: (type, listener) => events.set(type, listener) };
  const elements = new Map([['game-frame', frame], ['camera-consent', {}], ['camera-enable', {}], ['camera-cancel', {}], ['install-button', {}]]);
  let ready;
  let brokerCount = 0;
  let cameraCount = 0;
  runInNewContext(inline, {
    document: { addEventListener: (type, listener) => { assert.equal(type, 'DOMContentLoaded'); ready = listener; }, getElementById: id => elements.get(id) },
    TrainerHubHandTracking: { CreateBroker: () => { brokerCount++; return { Start() {}, Stop() {} }; }, CreateController: () => { cameraCount++; } },
    crypto, Uint8Array, URLSearchParams, location: { search: '?lang=en' },
    navigator: {}, window: { addEventListener() {} }, setInterval: () => 0,
  });
  ready();
  assert.equal(brokerCount, 1, 'The published browser runtime supplies the broker');
  assert.equal(cameraCount, 0, 'Loading settings does not start the camera');
  assert.equal(frame.src, '/games/gesture-battler/2.0.0/package/index.html');
  assert.ok(events.has('load'), 'The strict game receives its private channel on load');
});

test('hand launcher names the selected official game and escapes its title', async () => {
  const { RenderHandTrackingLauncher } = await import('../functions/_lib/handTrackingLauncher.js');
  const html = RenderHandTrackingLauncher({ gameId: 'motor-cortex-rehab', version: '2.0.0', name: 'Hand <target>', capabilities: ['hand-tracking'] }, '/games/motor-cortex-rehab/2.0.0/', 'test-nonce');
  assert.match(html, /<title>Hand &lt;target&gt;｜居家訓練網<\/title>/);
  assert.match(html, /title="Hand &lt;target&gt;"/);
  assert.doesNotMatch(html, /<title>手勢指令對戰/);
});
