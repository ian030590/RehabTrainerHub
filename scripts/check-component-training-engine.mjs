import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const reactModuleUrl = ToDataUrl(`
  export const createElement = (type, props) => ({ type, props });
`);
const reactDomModuleUrl = ToDataUrl(`
  export function flushSync(callback) {
    globalThis.__componentTrainingEngineTestFlushes = (globalThis.__componentTrainingEngineTestFlushes ?? 0) + 1;
    return callback();
  }
`);
const reactDomClientModuleUrl = ToDataUrl(`
  export function createRoot(container) {
    const root = {
      container,
      rendered: [],
      unmountCount: 0,
      render(element) {
        this.rendered.push(element);
        if (typeof element?.type === 'function') element.type(element.props);
      },
      unmount() {
        this.unmountCount += 1;
      },
    };
    globalThis.__componentTrainingEngineTestRoots ??= [];
    globalThis.__componentTrainingEngineTestRoots.push(root);
    return root;
  }
`);

const engineModule = await LoadEngineModule();
const {
  CreateComponentTrainingSetup,
} = engineModule;

const manifest = {
  id: 'test:component-training-engine',
  implementationVersion: 'test-v1',
  assets: [],
};
const defaultConfig = Object.freeze({ durationSec: 10 });
let componentLoadCount = 0;
let latestControls = null;
let renderShouldFail = false;
let pauseCount = 0;
let resumeCount = 0;

function Surface({ controls }) {
  if (renderShouldFail) throw new Error('surface render failed');
  latestControls = controls;
  controls.registerControls({
    pause: () => { pauseCount += 1; },
    resume: () => { resumeCount += 1; },
  });
  return null;
}

const setup = CreateComponentTrainingSetup({
  manifest,
  defaultConfig,
  validateConfig(input) {
    if (!input || typeof input !== 'object') {
      return { ok: false, issues: [{ path: 'config', message: 'config must be an object' }] };
    }
    const value = Number(input.durationSec);
    if (!Number.isFinite(value) || value < 1) {
      return { ok: false, issues: [{ path: 'durationSec', message: 'durationSec must be positive' }] };
    }
    return { ok: true, value: { durationSec: value } };
  },
  ConfigPanel: () => null,
  RulesPanel: () => null,
  loadComponent: async () => {
    componentLoadCount += 1;
    return Surface;
  },
  buildComponentProps: ({ controls }) => ({ controls }),
  summarize: ({ status, startedAt, endedAt, result }) => ({
    moduleId: manifest.id,
    moduleVersion: manifest.implementationVersion,
    status,
    startedAt,
    endedAt,
    result,
  }),
});

await assert.rejects(
  setup.loadEngine({
    trigger: 'card-visible',
    signal: new AbortController().signal,
    assets: { resolve: () => '' },
    reportProgress: () => undefined,
  }),
  /may only load when rules are visible/,
);

const cancelledPreload = new AbortController();
cancelledPreload.abort();
await assert.rejects(
  setup.loadEngine({
    trigger: 'rules-visible',
    signal: cancelledPreload.signal,
    assets: { resolve: () => '' },
    reportProgress: () => undefined,
  }),
  (error) => error?.name === 'AbortError',
);

const progress = [];
const engine = await setup.loadEngine({
  trigger: 'rules-visible',
  signal: new AbortController().signal,
  assets: { resolve: () => '' },
  reportProgress: (value) => progress.push(value),
});
assert.deepEqual(progress, [0, 1]);
assert.equal(componentLoadCount, 1);

const createContext = (signal = new AbortController().signal) => ({
  config: { durationSec: 10 },
  mountElement: {},
  signal,
  sessionNonce: 'test-session',
  language: 'en',
});

const firstRun = await engine.startRun(createContext());
assert.equal(globalThis.__componentTrainingEngineTestFlushes, 1, 'module root renders synchronously before the host transitions');
assert.equal(typeof latestControls?.onCompleted, 'function');
await firstRun.pause();
await firstRun.resume();
assert.equal(pauseCount, 1);
assert.equal(resumeCount, 1);
await assert.rejects(engine.startRun(createContext()), /already has an active run/);
latestControls.onCompleted({ score: 7 });
const firstResult = await firstRun.result;
assert.equal(firstResult.status, 'completed');
assert.deepEqual(firstResult.result, { score: 7 });
await WaitForCleanup();
const firstRoot = globalThis.__componentTrainingEngineTestRoots.at(-1);
assert.equal(firstRoot.unmountCount, 1);

const secondRun = await engine.startRun(createContext());
await secondRun.dispose();
const secondResult = await secondRun.result;
assert.equal(secondResult.status, 'aborted');
await WaitForCleanup();
assert.equal(globalThis.__componentTrainingEngineTestRoots.at(-1).unmountCount, 1);

const signalController = new AbortController();
const thirdRun = await engine.startRun(createContext(signalController.signal));
signalController.abort();
const thirdResult = await thirdRun.result;
assert.equal(thirdResult.status, 'aborted');
await WaitForCleanup();
assert.equal(globalThis.__componentTrainingEngineTestRoots.at(-1).unmountCount, 1);

renderShouldFail = true;
await assert.rejects(engine.startRun(createContext()), /surface render failed/);
renderShouldFail = false;
await WaitForCleanup();
assert.equal(globalThis.__componentTrainingEngineTestRoots.at(-1).unmountCount, 1);

const disposeEngine = await setup.loadEngine({
  trigger: 'rules-visible',
  signal: new AbortController().signal,
  assets: { resolve: () => '' },
  reportProgress: () => undefined,
});
const disposedRun = await disposeEngine.startRun(createContext());
await disposeEngine.dispose('error');
const disposedResult = await disposedRun.result;
assert.equal(disposedResult.status, 'aborted');
await assert.rejects(disposeEngine.startRun(createContext()), /has been disposed/);

await engine.dispose('complete');
await assert.rejects(engine.startRun(createContext()), /has been disposed/);

console.log('Component training engine lifecycle contract passed.');

async function LoadEngineModule() {
  const source = readFileSync(
    resolve(repoRoot, 'apps/rehabtrainerhub/training-modules/shared/componentTrainingEngine.ts'),
    'utf8',
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
    .replace(/from\s+['"]react['"]/g, `from '${reactModuleUrl}'`)
    .replace(/import\(\s*['"]react-dom['"]\s*\)/g, `import('${reactDomModuleUrl}')`)
    .replace(/import\(\s*['"]react-dom\/client['"]\s*\)/g, `import('${reactDomClientModuleUrl}')`);
  return import(ToDataUrl(code));
}

function ToDataUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}

function WaitForCleanup() {
  return new Promise((resolvePromise) => setImmediate(resolvePromise));
}
