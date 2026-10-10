import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const games = 'apps/rehabtrainerhub/games';

async function LoadFunction(path, name, context) {
  const source = await readFile(resolve(root, path), 'utf8');
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let functionSource;
  const visit = node => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
      functionSource = node.getText(tree).replace(/^export /, '');
    }
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) {
      const value = node.initializer;
      functionSource = `const ${name} = ${ts.isCallExpression(value) ? value.arguments[0].getText(tree) : value.getText(tree)};`;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.ok(functionSource, `${path} provides ${name}`);
  const code = ts.transpileModule(functionSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return runInNewContext(`${code}\n${name}`, context);
}

function Deferred() {
  let resolvePromise;
  const promise = new Promise(resolve => { resolvePromise = resolve; });
  return { promise, resolve: resolvePromise };
}

test('motor camera consent and initialization finish in windowed mode before the final Start click', async () => {
  const camera = Deferred();
  const fullscreen = Deferred();
  const actions = [];
  const context = {
    phaseRef: { current: 'ready' }, generationRef: { current: 0 }, handInputReady: false,
    config: { handChoice: 'left' }, IsMotorConfig: () => true,
    stopInput: () => { context.generationRef.current++; },
    setPhase: phase => { context.phaseRef.current = phase; }, setError() {},
    setHandInputReady: ready => { context.handInputReady = ready; },
    rootRef: { current: { requestFullscreen: () => { actions.push('fullscreen'); return fullscreen.promise; } } },
    StartHandInput: hand => { actions.push(`camera:${hand}`); return camera.promise; },
    PrepareAudioFeedback() {}, jsPsychRef: {}, metricsRef: {}, targetRef: {},
    CreateEmptyMetrics: () => ({}), performance: { now: () => 10 },
    jsPsychLifecycleRef: { current: { start: async ({ onStart }) => { actions.push('timer'); onStart(); } } },
    SendGameEvent: type => actions.push(type), requestAnimationFrame: () => 1, animationRef: {},
  };
  const start = await LoadFunction(`${games}/motor-cortex-rehab/MotorCortexRehabGame.tsx`, 'startTraining', context);
  const preparing = start();
  assert.deepEqual(actions, ['camera:left'], 'The camera dialog must be visible outside fullscreen.');
  camera.resolve();
  await preparing;
  assert.equal(context.phaseRef.current, 'ready', 'A fresh Start click preserves browser user activation after camera loading.');
  assert.equal(context.handInputReady, true);
  const playing = start();
  assert.deepEqual(actions, ['camera:left', 'fullscreen']);
  fullscreen.resolve();
  await playing;
  assert.equal(context.phaseRef.current, 'playing');
  assert.deepEqual(actions, ['camera:left', 'fullscreen', 'timer', 'active']);
});

test('motor cancellation while camera permission is pending cannot enter fullscreen or start a timer', async () => {
  const camera = Deferred();
  const actions = [];
  const context = {
    phaseRef: { current: 'ready' }, generationRef: { current: 0 }, handInputReady: false,
    config: {}, IsMotorConfig: () => true,
    stopInput: () => { context.generationRef.current++; }, setError() {},
    setPhase: phase => { context.phaseRef.current = phase; }, setHandInputReady() {},
    rootRef: { current: { requestFullscreen: async () => actions.push('fullscreen') } },
    StartHandInput: () => camera.promise, PrepareAudioFeedback() {}, jsPsychRef: {},
  };
  const start = await LoadFunction(`${games}/motor-cortex-rehab/MotorCortexRehabGame.tsx`, 'startTraining', context);
  const pending = start();
  await Promise.resolve();
  context.generationRef.current++;
  context.phaseRef.current = 'menu';
  camera.resolve();
  await pending;
  assert.deepEqual(actions, []);
  assert.equal(context.phaseRef.current, 'menu');
});

test('gesture calibration requests fullscreen after camera readiness on desktop and mobile before capturing', async () => {
  for (const mobile of [false, true]) {
    const fullscreen = Deferred();
    const actions = [];
    const context = {
      IsMobileGameViewport: () => mobile, document: { fullscreenElement: null },
      phaseRef: { current: 'calibration' }, mountedRef: { current: true }, inputGenerationRef: { current: 1 },
      enterTrainingFullscreen: () => { actions.push('fullscreen'); return fullscreen.promise; },
      calibrationCapturingRef: {}, calibrationHoldStartRef: {}, calibrationSamplesRef: {},
      setIsCalibrationCapturing: () => actions.push('capture'), setCalibrationProgress() {}, setCalibrationNotice() {},
    };
    const start = await LoadFunction(`${games}/gesture-battler/GestureBattlerGame.tsx`, 'startCurrentCalibration', context);
    const pending = start();
    assert.deepEqual(actions, ['fullscreen'], `Fullscreen settles before capture (mobile=${mobile}).`);
    fullscreen.resolve();
    await pending;
    assert.deepEqual(actions, ['fullscreen', 'capture']);
  }
});

test('motor return during a pending fullscreen request cancels play and exits a late fullscreen transition', async () => {
  const fullscreen = Deferred();
  const actions = [];
  const context = {
    phaseRef: { current: 'ready' }, generationRef: { current: 0 }, handInputReady: true,
    config: {}, IsMotorConfig: () => true, setError() {},
    setPhase: phase => { context.phaseRef.current = phase; }, PrepareAudioFeedback() {}, jsPsychRef: {},
    rootRef: { current: { requestFullscreen: () => fullscreen.promise } },
    document: { fullscreenElement: {}, exitFullscreen: async () => actions.push('exit-fullscreen') },
  };
  const start = await LoadFunction(`${games}/motor-cortex-rehab/MotorCortexRehabGame.tsx`, 'startTraining', context);
  const pending = start();
  context.generationRef.current++;
  context.phaseRef.current = 'menu';
  fullscreen.resolve();
  await pending;
  assert.deepEqual(actions, ['exit-fullscreen']);
  assert.equal(context.phaseRef.current, 'menu');
});

test('gesture return during a pending fullscreen transition cannot leave its settings fullscreen', async () => {
  const fullscreen = Deferred();
  const actions = [];
  const context = {
    phaseRef: { current: 'calibration' }, mountedRef: { current: true }, inputGenerationRef: { current: 1 },
    calibrationCapturingRef: { current: false },
    document: { fullscreenElement: null, exitFullscreen: async () => actions.push('exit-fullscreen') },
    enterTrainingFullscreen: () => fullscreen.promise,
  };
  const start = await LoadFunction(`${games}/gesture-battler/GestureBattlerGame.tsx`, 'startCurrentCalibration', context);
  const pending = start();
  context.inputGenerationRef.current++;
  context.phaseRef.current = 'menu';
  context.document.fullscreenElement = {};
  fullscreen.resolve();
  await pending;
  assert.deepEqual(actions, ['exit-fullscreen']);
  assert.equal(context.calibrationCapturingRef.current, false);
});

test('moving-card starts only after fullscreen settles and exits a late transition after cancellation', async () => {
  for (const cancelled of [false, true]) {
    const fullscreen = Deferred();
    const actions = [];
    const context = {
      ready: true, phaseRef: { current: 'rules' }, generationRef: { current: 1 },
      settings: {}, ValidateSettings: () => true, PrepareAudioFeedback() {},
      rootRef: { current: { requestFullscreen: () => fullscreen.promise } },
      document: { fullscreenElement: null, exitFullscreen: async () => actions.push('exit-fullscreen') },
      setPhase: phase => actions.push(phase),
    };
    const start = await LoadFunction(`${games}/moving-card/MovingCardGame.tsx`, 'startTraining', context);
    const pending = start();
    assert.deepEqual(actions, []);
    if (cancelled) { context.generationRef.current++; context.phaseRef.current = 'menu'; }
    context.document.fullscreenElement = {};
    fullscreen.resolve();
    await pending;
    assert.deepEqual(actions, cancelled ? ['exit-fullscreen'] : ['running']);
  }
});

for (const gameId of ['drawing-defense', 'asteroid-shield', 'gesture-battler', 'motor-cortex-rehab', 'moving-card']) {
  test(`${gameId} exits fullscreen before returning to Hub or its standalone entry`, async () => {
    for (const embedded of [false, true]) {
      const fullscreen = Deferred();
      const actions = [];
      const context = {
        document: { fullscreenElement: {}, exitFullscreen: () => { actions.push('exit-fullscreen'); return fullscreen.promise; } },
        IsHubGame: () => embedded, port: embedded ? {} : null,
        SendGameEvent: type => actions.push(type), window: { dispatchEvent: event => actions.push(event.type) }, Event,
      };
      const exit = await LoadFunction(`${games}/${gameId}/runtime/hubBridge.ts`, 'ExitGame', context);
      const pending = exit();
      assert.ok(actions.includes('exit-fullscreen'));
      assert.ok(!actions.includes('exit') && !actions.includes('game:configure'), 'Keep the container mounted until fullscreen exits.');
      fullscreen.resolve();
      await pending;
      assert.equal(actions.at(-1), embedded ? 'exit' : 'game:configure');
    }
  });
}

test('Hub closes every R2 game only after fullscreen and camera cleanup', async () => {
  const fullscreen = Deferred();
  const actions = [];
  const close = await LoadFunction('apps/rehabtrainerhub/app/train/R2GameOverlay.tsx', 'close', {
    inputRef: { current: { Stop: () => actions.push('stop-camera') } },
    ExitFullscreenIfActive: () => { actions.push('exit-fullscreen'); return fullscreen.promise; },
    onClose: () => actions.push('close'),
  });
  const pending = close();
  assert.deepEqual(actions, ['stop-camera', 'exit-fullscreen']);
  fullscreen.resolve();
  await pending;
  assert.equal(actions.at(-1), 'close');
});
