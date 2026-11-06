import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as gameMessages from '../packages/ui/src/selfContainedGame.js';

const subjectId = '12345678-1234-4234-8234-123456789abc';
const gameId = 'drawing-defense';
const jsxRuntime = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'fragment' };

function Nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(Nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...Nodes(tree.props?.children)];
}

function CreateRenderer(attach) {
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
    Unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

async function CreateOverlay(context, options = {}) {
  const outbound = [], initialized = [], channels = [], records = [];
  const control = { saveGate: null, failSave: false };
  let sequence = 0, closed = 0;
  const page = Object.assign(new EventTarget(), {
    location: { origin: 'https://hub.example' }, scrollX: 0, scrollY: 0, scrollTo() {},
  });
  const frame = { contentWindow: { postMessage(message) { initialized.push(message); sequence = 0; } } };
  const dialog = { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
  const renderer = CreateRenderer(node => {
    if (node.props?.ref) node.props.ref.current ??= node.type === 'iframe' ? frame : node.type === 'dialog' ? dialog : { focus() {} };
  });
  context.after(() => renderer.Unmount());
  const dependencies = {
    react: renderer.hooks, 'react/jsx-runtime': jsxRuntime,
    '@rehab-trainer/ui/officialGameReleases.json': { default: { [gameId]: { origin: 'https://games.example', name: gameId } } },
    '@rehab-trainer/ui/selfContainedGame.js': gameMessages,
    '@rehab-trainer/ui/auth/authClient': {
      GetAuthToken: () => null, GetAuthUserIdFromToken: () => null,
      SaveRemoteTrainingRecord: async (origin, payload) => {
        records.push(payload);
        if (control.saveGate) await control.saveGate;
        if (control.failSave) throw new Error('Record save failed');
      },
    },
    '@rehab-trainer/ui/storage/subjectId': { GetOrCreateSubjectIdForUser: () => subjectId, IsSubjectId: value => value === subjectId },
    '@rehab-trainer/ui/fullscreen': { ExitFullscreenIfActive: async () => {} },
    '@rehab-trainer/ui/rawCoordinateRecorder.js': { CreateRawCoordinateRecorder: () => ({ Files: () => [], Reset() {} }) },
    '../i18n/HubLanguage': { useHubLanguage: () => ({ language: 'en' }) },
    '../i18n': { GetHubUiCopy: () => ({ practicePlans: {} }) },
    '../practicePlans.css': {},
  };
  for (const name of ['handTrackingBroker.js', 'handTrackingInput', 'eyeTrackingBroker.js', 'eyeTrackingInput',
    'saveOculomotorCsv', 'resultFiles.js', 'sensorInputBroker.js', 'sensorInputHost.js', 'sensorInput', 'saveRawCoordinateCsv']) {
    dependencies[`@rehab-trainer/ui/${name}`] = {};
  }
  const source = readFileSync(new URL('../apps/rehabtrainerhub/app/train/R2GameOverlay.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const exports = {};
  runInNewContext(compiled, {
    exports, require: name => {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected test import: ${name}`);
      return dependencies[name];
    },
    AbortController, Uint8Array, crypto: globalThis.crypto, window: page,
    document: { activeElement: null, addEventListener() {}, removeEventListener() {} },
    HTMLElement: class {}, navigator: { onLine: true },
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    fetch: async url => {
      assert.equal(url, '/api/official-game-sessions');
      return { ok: true, json: async () => ({ subjectId, recordId: subjectId, token: 'session-token', version: '2.0.0',
        contentSha256: 'a'.repeat(64), capabilities: ['settings-storage'] }) };
    },
    MessageChannel: class {
      constructor() {
        this.port1 = { postMessage: message => outbound.push(message), start() {}, close() {} };
        this.port2 = {};
        channels.push(this);
      }
    },
  });
  renderer.Mount(exports.R2GameOverlay, {
    module: { runtimeId: gameId, copy: { en: { title: gameId }, 'zh-TW': { title: gameId } } },
    onClose: () => { closed++; }, ...options,
  });
  await renderer.Flush();
  const Initialize = async () => { renderer.Find(node => node.type === 'iframe').props.onLoad(); await renderer.Flush(); };
  await Initialize();
  const Send = async (type, payload = {}, overrides = {}) => {
    const init = initialized.at(-1);
    channels.at(-1).port1.onmessage({ data: { schema: 'trainerhub.game/v1', gameId, version: init.version,
      sessionNonce: init.sessionNonce, sequence: sequence++, type, payload, ...overrides } });
    await renderer.Flush();
  };
  return { renderer, page, control, records, outbound, Send, Initialize, Closed: () => closed,
    Result: () => Send('result', { config: {}, score: { schema: 'rehab-trainer.game-score/v1', gameId, summary: { total: 7 }, rounds: [] } }),
  };
}

function AssertProtected(overlay, expected) {
  const event = new Event('beforeunload', { cancelable: true });
  Object.defineProperty(event, 'returnValue', { value: 'unchanged', writable: true });
  overlay.page.dispatchEvent(event);
  assert.equal(event.defaultPrevented, expected, 'beforeunload defaultPrevented');
  assert.equal(getEventListeners(overlay.page, 'beforeunload').length, expected ? 1 : 0, 'beforeunload listener count');
  assert.equal(event.returnValue, expected ? '' : 'unchanged', 'beforeunload returnValue');
}

test('settings and tutorial have no leave guard before active', async context => {
  const overlay = await CreateOverlay(context);
  AssertProtected(overlay, false);
  await overlay.Send('ready');
  await overlay.Send('settings', { difficulty: 1 });
  AssertProtected(overlay, false);
  assert.equal(overlay.renderer.Find(node => node.type === 'iframe').props.sandbox, 'allow-scripts');
});

test('an accepted active message guards page unload', async context => {
  const overlay = await CreateOverlay(context);
  await overlay.Send('active', {}, { sessionNonce: 'wrong-nonce' });
  AssertProtected(overlay, false);
  await overlay.Send('active');
  AssertProtected(overlay, true);
  await overlay.Send('active');
  AssertProtected(overlay, true);
});

test('the leave guard stays installed while a result is saving', async context => {
  const overlay = await CreateOverlay(context);
  await overlay.Send('active');
  let finish;
  overlay.control.saveGate = new Promise(resolve => { finish = resolve; });
  context.after(() => finish());
  await overlay.Result();
  assert.equal(overlay.outbound.at(-1).state, 'saving');
  AssertProtected(overlay, true);
  finish();
  await overlay.renderer.Flush();
  assert.equal(overlay.outbound.at(-1).state, 'saved');
  AssertProtected(overlay, false);
});

test('a failed save keeps the leave guard until retry succeeds', async context => {
  const overlay = await CreateOverlay(context);
  await overlay.Send('active');
  overlay.control.failSave = true;
  await overlay.Result();
  assert.equal(overlay.outbound.at(-1).state, 'error');
  AssertProtected(overlay, true);
  overlay.control.failSave = false;
  await overlay.Send('retry');
  assert.equal(overlay.outbound.at(-1).state, 'saved');
  assert.equal(overlay.records.length, 2);
  AssertProtected(overlay, false);
});

test('a successful save releases the leave guard', async context => {
  const overlay = await CreateOverlay(context);
  await overlay.Send('active');
  AssertProtected(overlay, true);
  await overlay.Result();
  assert.equal(overlay.outbound.at(-1).state, 'saved');
  AssertProtected(overlay, false);
});

test('exit releases the leave guard', async context => {
  const overlay = await CreateOverlay(context);
  await overlay.Send('active');
  AssertProtected(overlay, true);
  await overlay.Send('exit');
  assert.equal(overlay.Closed(), 1);
  AssertProtected(overlay, false);
});

test('closing the overlay releases the leave guard', async context => {
  const overlay = await CreateOverlay(context);
  await overlay.Send('active');
  AssertProtected(overlay, true);
  overlay.renderer.Find(node => node.type === 'dialog').props.onCancel({ preventDefault() {} });
  await overlay.renderer.Flush();
  assert.equal(overlay.Closed(), 1);
  AssertProtected(overlay, false);
});

test('captureSettings never installs a leave guard or saves a result', async context => {
  const overlay = await CreateOverlay(context, { captureSettings() {} });
  AssertProtected(overlay, false);
  await overlay.Send('active');
  AssertProtected(overlay, false);
  await overlay.Result();
  AssertProtected(overlay, false);
  assert.equal(overlay.records.length, 0);
  await overlay.Send('exit');
  assert.equal(overlay.Closed(), 1);
  AssertProtected(overlay, false);
});

test('unmount removes the leave guard listener', async context => {
  const overlay = await CreateOverlay(context);
  await overlay.Send('active');
  AssertProtected(overlay, true);
  overlay.renderer.Unmount();
  AssertProtected(overlay, false);
});

test('error retry releases the leave guard until a new active message', async context => {
  const overlay = await CreateOverlay(context);
  await overlay.Send('active');
  AssertProtected(overlay, true);
  await overlay.Initialize();
  overlay.renderer.Find(node => node.type === 'button' && node.props.children === 'Try again').props.onClick();
  await overlay.renderer.Flush();
  AssertProtected(overlay, false);
  await overlay.Initialize();
  AssertProtected(overlay, false);
  await overlay.Send('active');
  AssertProtected(overlay, true);
});
