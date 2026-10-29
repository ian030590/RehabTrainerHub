import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as gameMessages from '../packages/ui/src/selfContainedGame.js';
import { CreateSensorInputHost } from '../packages/ui/src/sensorInputHost.js';
import { CreateRawCoordinateRecorder, rawCoordinateColumns } from '../packages/ui/src/rawCoordinateRecorder.js';

const subjectId = '12345678-1234-4234-8234-123456789abc';
const jsxRuntime = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'fragment' };

function Nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(Nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...Nodes(tree.props?.children)];
}

function Text(tree) {
  if (Array.isArray(tree)) return tree.map(Text).join('');
  if (tree && typeof tree === 'object') return Text(tree.props?.children);
  return tree === null || tree === undefined || typeof tree === 'boolean' ? '' : String(tree);
}

function CreateRenderer(attach = () => {}) {
  const slots = [];
  let cursor = 0, dirty = false, pendingEffects = [], component, props, tree;
  const hooks = {
    useRef(initial) {
      const index = cursor++;
      return (slots[index] ??= { value: { current: initial } }).value;
    },
    useState(initial) {
      const index = cursor++;
      const slot = slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slot.value, next => {
        const value = typeof next === 'function' ? next(slot.value) : next;
        if (!Object.is(value, slot.value)) { slot.value = value; dirty = true; }
      }];
    },
    useCallback: callback => callback,
    useEffect(effect, dependencies) {
      const index = cursor++;
      const slot = slots[index] ??= {};
      if (!slot.dependencies || dependencies.some((value, item) => !Object.is(value, slot.dependencies[item]))) {
        slot.dependencies = dependencies;
        pendingEffects.push(() => { slot.cleanup?.(); slot.cleanup = effect(); });
      }
    },
  };
  const Render = () => {
    cursor = 0; dirty = false;
    tree = component(props);
    Nodes(tree).forEach(attach);
    const effects = pendingEffects; pendingEffects = [];
    effects.forEach(effect => effect());
  };
  return {
    hooks,
    Mount(nextComponent, nextProps) { component = nextComponent; props = nextProps; Render(); },
    async Flush() {
      for (let count = 0; count < 12; count++) {
        await new Promise(resolve => setImmediate(resolve));
        if (dirty) Render();
      }
    },
    Find(predicate) { return Nodes(tree).find(predicate); },
    All(predicate) { return Nodes(tree).filter(predicate); },
    Text: () => Text(tree),
    Unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

function LoadModule(path, dependencies, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const exports = {};
  runInNewContext(compiled, { exports, require: name => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected test import: ${name}`);
    return dependencies[name];
  }, AbortController, Uint8Array, crypto: globalThis.crypto, console, ...globals });
  return exports;
}

async function CreateOverlay(options = {}) {
  const actions = [], outbound = [], channels = [], initialized = [], recorders = [], sensorBrokers = new Map();
  const control = { failRawKind: null, failRecord: false, uploadGate: null };
  let handSend, sessions = 0, closed = 0, sequence = 0;
  const capabilities = options.capabilities ?? ['hand-tracking', 'pose-tracking', 'microphone-level', 'head-tracking'];
  const gameId = options.gameId ?? 'every-ball-response';
  const auth = {
    GetAuthToken: () => 'account-token', GetAuthUserIdFromToken: () => 'owner',
    CreateRemoteTrainingRecordVerificationToken: async () => 'verification-token',
    SaveRemoteTrainingRecord: async (origin, payload) => {
      actions.push({ type: 'record', origin, payload });
      if (control.failRecord) throw new Error('D1 temporarily unavailable');
    },
  };
  const fetch = async (url, init) => {
    if (url === '/api/official-game-sessions') {
      sessions++;
      return { ok: true, json: async () => ({ subjectId, recordId: `abcdefab-1234-4234-8234-${String(sessions).padStart(12, '0')}`,
        token: `session-${sessions}`, version: '2.0.0', contentSha256: 'a'.repeat(64), capabilities }) };
    }
    assert.equal(url, '/api/raw-data');
    const metadata = JSON.parse(init.headers['X-Raw-Data']);
    actions.push({ type: 'raw', metadata, csv: init.body });
    if (control.uploadGate) await control.uploadGate;
    return { ok: metadata.kind !== control.failRawKind, status: metadata.kind === control.failRawKind ? 503 : 200 };
  };
  const uploader = LoadModule('../packages/ui/src/saveRawCoordinateCsv.ts', { './auth/authClient': auth }, { fetch });
  const frame = { contentWindow: { postMessage(message) { initialized.push(message); sequence = 0; } } };
  const dialog = { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
  const renderer = CreateRenderer(node => {
    if (node.props?.ref) node.props.ref.current ??= node.type === 'iframe' ? frame : node.type === 'dialog' ? dialog : { style: {}, focus() {} };
  });
  const dependencies = {
    react: renderer.hooks, 'react/jsx-runtime': jsxRuntime,
    '@rehab-trainer/ui/officialGameReleases.json': { default: { [gameId]: { origin: 'https://games.example', name: gameId } } },
    '@rehab-trainer/ui/selfContainedGame.js': gameMessages,
    '@rehab-trainer/ui/auth/authClient': auth,
    '@rehab-trainer/ui/storage/subjectId': { GetOrCreateSubjectIdForUser: () => '87654321-1234-4234-8234-123456789abc',
      IsSubjectId: value => value === subjectId, SetAccountSubjectId() {} },
    '@rehab-trainer/ui/handTrackingBroker.js': { CreateHandTrackingBroker(config) {
      handSend = config.send; return { Stop() {}, Start() {} };
    } },
    '@rehab-trainer/ui/handTrackingInput': {}, '@rehab-trainer/ui/eyeTrackingInput': {},
    '@rehab-trainer/ui/eyeTrackingBroker.js': {}, '@rehab-trainer/ui/saveOculomotorCsv': {},
    '@rehab-trainer/ui/fullscreen': { ExitFullscreenIfActive: async () => {} },
    '../i18n/HubLanguage': { useHubLanguage: () => ({ language: 'en' }) },
    '../i18n': { GetHubUiCopy: () => ({ practicePlans: {} }) },
    '../practicePlans.css': {},
    '@rehab-trainer/ui/resultFiles.js': {}, '@rehab-trainer/ui/sensorInput': {},
    '@rehab-trainer/ui/sensorInputBroker.js': { CreateSensorInputBroker: config => ({ Stop() {}, Start() {}, Emit: config.send }) },
    '@rehab-trainer/ui/sensorInputHost.js': { CreateSensorInputHost: config => CreateSensorInputHost({ ...config,
      createBroker: (input, send) => { const broker = config.createBroker(input, send); sensorBrokers.set(input, broker); return broker; } }) },
    '@rehab-trainer/ui/rawCoordinateRecorder.js': { CreateRawCoordinateRecorder: kinds => {
      const recorder = CreateRawCoordinateRecorder(kinds); recorders.push(recorder); return recorder;
    } },
    '@rehab-trainer/ui/saveRawCoordinateCsv': uploader,
  };
  const { R2GameOverlay } = LoadModule('../apps/rehabtrainerhub/app/train/R2GameOverlay.tsx', dependencies, {
    fetch, setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    window: { location: { origin: 'https://hub.example' }, scrollX: 0, scrollY: 0, scrollTo() {}, addEventListener() {}, removeEventListener() {} },
    document: { addEventListener() {}, removeEventListener() {}, activeElement: null }, navigator: { onLine: true },
    HTMLElement: class {},
    MessageChannel: class {
      constructor() {
        this.port1 = { postMessage: message => outbound.push(message), start() {}, close() {} };
        this.port2 = {};
        channels.push(this);
      }
    },
  });
  renderer.Mount(R2GameOverlay, { module: { runtimeId: gameId, copy: { en: { title: gameId }, 'zh-TW': { title: gameId } } },
    onClose: () => { closed++; } });
  await renderer.Flush();
  const Initialize = async () => { renderer.Find(node => node.type === 'iframe').props.onLoad(); await renderer.Flush(); };
  await Initialize();
  const Send = async (type, payload = {}) => {
    const init = initialized.at(-1);
    channels.at(-1).port1.onmessage({ data: { schema: 'trainerhub.game/v1', gameId, version: init.version,
      sessionNonce: init.sessionNonce, sequence: sequence++, type, payload } });
    await renderer.Flush();
  };
  return { renderer, control, actions, outbound, recorders, sensorBrokers, Initialize, Send,
    EmitHand: message => handSend(message), EmitSensor: (input, message) => sensorBrokers.get(input).Emit(message),
    Closed: () => closed,
    Result: () => Send('result', { config: {}, score: { schema: 'rehab-trainer.game-score/v1', gameId, summary: { total: 7 }, rounds: [] } }),
  };
}

function Frames(overlay, timestamp = 100) {
  const points = Array.from({ length: 21 }, () => ({ x: 0.1, y: 0.2, z: 0.3 }));
  overlay.EmitHand({ type: 'frame', payload: { timestamp, landmarks: points, image: 'never-upload-this' } });
  overlay.EmitSensor('pose', { type: 'frame', payload: { timestamp, hands: [points], pose: points.slice(0, 4) } });
  overlay.EmitSensor('microphone', { type: 'frame', payload: { timestamp, loudness: 0.5 } });
}

test('reviewed proxy frames upload numeric CSVs before the summary record is saved', async () => {
  const overlay = await CreateOverlay();
  Frames(overlay);
  await overlay.Result();
  assert.deepEqual(overlay.actions.map(action => action.type === 'raw' ? `raw:${action.metadata.kind}` : action.type), ['raw:hand', 'raw:pose', 'record']);
  for (const action of overlay.actions.filter(action => action.type === 'raw')) {
    assert.equal(action.csv.split('\n')[0], rawCoordinateColumns[action.metadata.kind].join(','));
    assert.equal(action.csv.split('\n').length, 3);
    assert.equal(action.metadata.subjectId, subjectId);
    assert.equal(action.metadata.runSessionToken, 'session-1');
    assert.doesNotMatch(action.csv, /never-upload-this|loudness|image/);
  }
  assert.equal(overlay.actions.at(-1).payload.subjectId, subjectId);
  assert.deepEqual(overlay.outbound.filter(message => message.type === 'saved').map(message => message.state), ['saving', 'saved']);
  assert.equal(overlay.sensorBrokers.has('head'), false, 'a capability for another game does not create its proxy');
  overlay.renderer.Unmount();
});

for (const [kind, gameId, capability, payload, expected] of [
  ['head', 'seagull-flight', 'head-tracking', { yaw: 1, pitch: 2, roll: 3, face: true }, '0,1,2,3,1'],
  ['tongue', 'tongue-catch', 'tongue-tracking', { mouth: { x: 0.1, y: 0.2 }, label: 'Tongue_Left', confidence: 0.9 }, '0,0.1,0.2,-1,0.9'],
]) {
  test(`the reviewed ${kind} proxy stores the coordinates forwarded to its owning game`, async () => {
    const overlay = await CreateOverlay({ gameId, capabilities: [capability] });
    overlay.EmitSensor(kind, { type: 'frame', payload: { timestamp: 100, ...payload } });
    await overlay.Result();
    const upload = overlay.actions[0];
    assert.equal(upload.type, 'raw');
    assert.equal(upload.metadata.kind, kind);
    assert.equal(upload.csv, `${rawCoordinateColumns[kind].join(',')}\n${expected}\n`);
    assert.equal(overlay.actions[1].type, 'record');
    overlay.renderer.Unmount();
  });
}

test('an official session without declared input capabilities records no proxy coordinates', async () => {
  const overlay = await CreateOverlay({ capabilities: [] });
  assert.equal(overlay.sensorBrokers.size, 0);
  await overlay.Result();
  assert.deepEqual(overlay.actions.map(action => action.type), ['record']);
  assert.deepEqual(overlay.recorders[0].Files(), []);
  overlay.renderer.Unmount();
});

test('a failed coordinate upload acknowledges error and leaves the record unsaved until retry', async () => {
  const overlay = await CreateOverlay();
  Frames(overlay); overlay.control.failRawKind = 'hand';
  await overlay.Result();
  assert.equal(overlay.actions.some(action => action.type === 'record'), false);
  assert.equal(overlay.outbound.at(-1).state, 'error');
  overlay.control.failRawKind = null;
  await overlay.Send('retry');
  assert.equal(overlay.actions.filter(action => action.type === 'record').length, 1);
  assert.equal(overlay.outbound.at(-1).state, 'saved');
  overlay.renderer.Unmount();
});

test('retry retains successful kinds through later upload and record failures', async () => {
  const overlay = await CreateOverlay();
  Frames(overlay); overlay.control.failRawKind = 'pose';
  await overlay.Result();
  overlay.control.failRawKind = null; overlay.control.failRecord = true;
  await overlay.Send('retry');
  assert.equal(overlay.outbound.at(-1).state, 'error');
  overlay.control.failRecord = false;
  await overlay.Send('retry');
  assert.deepEqual(overlay.actions.filter(action => action.type === 'raw').map(action => action.metadata.kind), ['hand', 'pose', 'pose']);
  assert.equal(overlay.outbound.at(-1).state, 'saved');
  overlay.renderer.Unmount();
});

test('regeneration clears captured data and uploaded-kind state; closing clears the next session', async () => {
  const overlay = await CreateOverlay();
  Frames(overlay); overlay.control.failRecord = true;
  await overlay.Result();
  await overlay.Initialize();
  overlay.renderer.Find(node => node.type === 'button' && Text(node) === 'Try again').props.onClick();
  await overlay.renderer.Flush();
  assert.deepEqual(overlay.recorders[0].Files(), []);
  await overlay.Initialize();
  assert.deepEqual(overlay.recorders[1].Files(), []);
  Frames(overlay, 500); overlay.control.failRecord = false;
  await overlay.Result();
  assert.deepEqual(overlay.actions.filter(action => action.type === 'raw').map(action => action.metadata.runSessionToken),
    ['session-1', 'session-1', 'session-2', 'session-2']);
  overlay.renderer.Find(node => node.type === 'dialog').props.onCancel({ preventDefault() {} });
  await overlay.renderer.Flush();
  assert.equal(overlay.Closed(), 1);
  assert.deepEqual(overlay.recorders[1].Files(), []);
  const previousRecords = overlay.actions.filter(action => action.type === 'record').length;
  await overlay.Send('retry');
  assert.equal(overlay.actions.filter(action => action.type === 'record').length, previousRecords);
  overlay.renderer.Unmount();
});

test('closing during an upload never saves the abandoned session summary', async () => {
  const overlay = await CreateOverlay();
  Frames(overlay);
  let finish;
  overlay.control.uploadGate = new Promise(resolve => { finish = resolve; });
  await overlay.Result();
  overlay.renderer.Find(node => node.type === 'dialog').props.onCancel({ preventDefault() {} });
  await overlay.renderer.Flush();
  finish(); await overlay.renderer.Flush();
  assert.equal(overlay.actions.some(action => action.type === 'record'), false);
  assert.deepEqual(overlay.recorders[0].Files(), []);
  overlay.renderer.Unmount();
});

for (const language of ['en', 'zh-TW']) {
  test(`an archived eye file removes its download control and explains the retained summary: ${language}`, async () => {
    const renderer = CreateRenderer();
    const user = { id: 'owner' };
    const dependencies = {
      react: renderer.hooks, 'react/jsx-runtime': jsxRuntime, 'next/link': { default: 'a' },
      '@rehab-trainer/ui/auth/authClient': { GetAuthToken: () => 'account-token', FetchRehabProgress: async () => null },
      '@rehab-trainer/hub-modules/catalog': { trainingCatalog: [] },
      '../HubNavigation': { useHubAuth: () => ({ user }) },
      '../i18n': { GetHubUiCopy: () => ({ progress: { dailyTaskTitles: {} } }) },
      '../i18n/HubLanguage': { useHubLanguage: () => ({ language, locale: language === 'en' ? 'en-US' : 'zh-TW', t: key => key }) },
      '../siteUrls': { siteUrls: { hub: 'https://hub.example' } }, '../trainingThemeStyle': {}, '../TrophyIcon': { TrophyIcon: 'svg' },
    };
    const downloads = [];
    const { ProgressDashboard } = LoadModule('../apps/rehabtrainerhub/app/progress/ProgressDashboard.tsx', dependencies, {
      fetch: async url => {
        if (url === '/api/oculomotor-data') return { ok: true, json: async () => ({ records: [{ recordId: 'eye-record', uploadedAt: '2026-10-24T02:00:00Z', size: 80 }], cursor: null }) };
        downloads.push(url); return { ok: false, status: 404 };
      },
      URL: { createObjectURL() { assert.fail('An archived CSV has no download body'); } },
    });
    renderer.Mount(ProgressDashboard); await renderer.Flush();
    const label = language === 'en' ? 'Download CSV' : '下載 CSV';
    renderer.Find(node => node.type === 'button' && Text(node) === label).props.onClick();
    await renderer.Flush();
    assert.deepEqual(downloads, ['/api/oculomotor-data?recordId=eye-record']);
    assert.equal(renderer.Find(node => node.type === 'button' && Text(node) === label), undefined);
    assert.match(renderer.Text(), language === 'en' ? /session summary is still here/ : /當次摘要仍保留/);
    assert.equal(renderer.All(node => node.props?.role === 'alert').length, 0);
    renderer.Unmount();
  });
}
