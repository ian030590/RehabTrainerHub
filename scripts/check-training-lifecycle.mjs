#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jsPsychRuntimeUrl = pathToFileURL(resolve(repoRoot, 'node_modules/jspsych/dist/index.js')).href;
const simulationHelperUrl = await CreateTranspiledDataUrl(
  'apps/rehabtrainerhub/training-modules/shared/jsPsychSimulation.ts',
);
globalThis.window ??= {};
const { DrawingDefensePlugin } = await LoadTypeScriptModule(
  'apps/rehabtrainerhub/training-modules/motor/experiment/plugins/drawing-defense-lifecycle.ts',
);
const { GestureBattlerPlugin } = await LoadTypeScriptModule(
  'apps/rehabtrainerhub/training-modules/motor/experiment/plugins/gesture-battler-lifecycle.ts',
);
const { MotorCortexRehabPlugin } = await LoadTypeScriptModule(
  'apps/rehabtrainerhub/training-modules/motor/experiment/plugins/motor-cortex-rehab-lifecycle.ts',
);
const { AsteroidShieldPlugin } = await LoadTypeScriptModule(
  'apps/rehabtrainerhub/training-modules/motor/experiment/plugins/asteroid-shield-lifecycle.ts',
);
const { TongueCatchPlugin } = await LoadTypeScriptModule(
  'apps/rehabtrainerhub/training-modules/mouth/experiment/plugins/tongue-catch-lifecycle.ts',
);
const { JsPsychExternalLifecycle } = await LoadTypeScriptModule('packages/ui/src/jsPsychLifecycle.ts');

for (const [plugin, moduleId] of [
  [DrawingDefensePlugin, 'motor:drawing-defense'],
  [GestureBattlerPlugin, 'motor:gesture-battler'],
  [MotorCortexRehabPlugin, 'motor:motor-cortex-rehab'],
  [AsteroidShieldPlugin, 'motor:asteroid-shield'],
  [TongueCatchPlugin, 'mouth:tongue-catch'],
]) {
  await TestNativeLifecyclePlugin(plugin, moduleId);
}
await TestExternalLifecycleCompletion(JsPsychExternalLifecycle);
await TestExternalLifecycleAbortAndDispose(JsPsychExternalLifecycle);

console.log('Training lifecycle behavior passed for five native plugins and the compatibility adapter.');

async function TestNativeLifecyclePlugin(plugin, moduleId) {
  const simulationState = CreatePluginState(plugin, 'simulation-1');
  const simulationPlugin = new plugin(simulationState.jsPsych);
  let simulationLoadCount = 0;
  let simulationStartCount = 0;
  simulationPlugin.simulate(
    {
      module_id: moduleId,
      run_token: 'simulation-1',
      on_start: () => { simulationStartCount += 1; },
    },
    'data-only',
    { data: { score: 7, module_id: 'spoofed-module', lifecycle_status: 'spoofed' } },
    () => { simulationLoadCount += 1; },
  );
  assert.equal(simulationLoadCount, 1, 'data-only simulation must invoke jsPsych on_load once.');
  assert.equal(simulationStartCount, 0, 'data-only simulation must not start the module renderer.');
  assert.deepEqual(simulationState.finished, [{
    score: 7,
    lifecycle_status: 'simulated',
    simulation_mode: 'data-only',
    module_id: moduleId,
    run_token: 'simulation-1',
  }], 'data-only simulation must return deterministic, identity-bound trial data.');

  const state = CreatePluginState(plugin, 'run-1');
  const lifecyclePlugin = new plugin(state.jsPsych);
  const displayElement = { replaceChildren() {} };

  lifecyclePlugin.trial(displayElement, {
    module_id: moduleId,
    run_token: 'run-1',
    on_start: () => { state.startCount += 1; },
  });
  assert.equal(state.startCount, 1, 'native plugin must call module-owned on_start exactly once.');
  assert.deepEqual(state.finished, [], 'successful native start must wait for the owner to finish the trial.');

  state.currentTrial = { type: plugin, run_token: 'run-2' };
  lifecyclePlugin.trial(displayElement, {
    module_id: moduleId,
    run_token: 'run-1',
  });
  assert.deepEqual(state.finished, [], 'stale native trial errors must not finish a different run.');

  state.currentTrial = { type: plugin, run_token: 'run-3' };
  lifecyclePlugin.trial(displayElement, {
    module_id: moduleId,
    run_token: 'run-3',
    on_start: () => { throw new Error('renderer unavailable'); },
  });
  assert.equal(state.finished.at(-1).lifecycle_status, 'start-error');

  state.currentTrial = { type: plugin, run_token: 'run-4' };
  lifecyclePlugin.trial(displayElement, {
    module_id: moduleId,
    run_token: 'run-4',
    on_start: () => Promise.reject(new Error('async renderer unavailable')),
  });
  await WaitForMicrotask();
  assert.equal(state.finished.at(-1).run_token, 'run-4');
  assert.equal(state.finished.at(-1).lifecycle_status, 'start-error');
}

async function TestExternalLifecycleCompletion(lifecycle) {
  const state = CreateAdapterState();
  const lifecycleInstance = new lifecycle(state.jsPsych);
  let startCount = 0;
  assert.equal(await lifecycleInstance.start({
    moduleId: 'motor:gesture-battler',
    onStart: () => { startCount += 1; },
  }), true);
  assert.equal(startCount, 1);
  assert.equal(lifecycleInstance.finish({ score: 3 }), true);
  await state.runSettled;
  await WaitForMicrotask();
  assert.equal(lifecycleInstance.isActive(), false);
  assert.equal(state.finished.at(-1).lifecycle_status, 'completed');
  assert.equal(state.finished.at(-1).score, 3);
  assert.equal(state.aborted.length, 0);
}

async function TestExternalLifecycleAbortAndDispose(lifecycle) {
  const abortState = CreateAdapterState();
  const abortLifecycle = new lifecycle(abortState.jsPsych);
  assert.equal(await abortLifecycle.start({ moduleId: 'mouth:tongue-catch', onStart: () => undefined }), true);
  assert.equal(abortLifecycle.abort({ abort_reason: 'return-to-menu' }), true);
  await abortState.runSettled;
  await WaitForMicrotask();
  assert.equal(abortLifecycle.isActive(), false);
  assert.equal(abortState.aborted.at(-1).lifecycle_status, 'aborted');

  const disposeState = CreateAdapterState();
  const disposeLifecycle = new lifecycle(disposeState.jsPsych);
  assert.equal(await disposeLifecycle.start({ moduleId: 'motor:asteroid-shield', onStart: () => undefined }), true);
  disposeLifecycle.dispose();
  await disposeState.runSettled;
  await WaitForMicrotask();
  assert.equal(disposeLifecycle.isActive(), false);
  assert.equal(disposeState.aborted.at(-1).lifecycle_status, 'disposed');
  assert.equal(disposeState.clearedTimeouts, 1);
}

function CreatePluginState(plugin, runToken) {
  const state = {
    currentTrial: { type: plugin, run_token: runToken },
    finished: [],
    startCount: 0,
  };
  state.jsPsych = {
    getCurrentTrial: () => state.currentTrial,
    finishTrial: (data) => state.finished.push(data),
  };
  return state;
}

function CreateAdapterState() {
  let settleRun;
  const state = {
    currentTrial: null,
    finished: [],
    aborted: [],
    clearedTimeouts: 0,
    runSettled: new Promise((resolve) => { settleRun = resolve; }),
  };
  state.jsPsych = {
    getCurrentTrial: () => state.currentTrial,
    run: (timeline) => {
      state.currentTrial = timeline[0];
      const startResult = timeline[0].on_runtime_start();
      return Promise.resolve(startResult).then(() => state.runSettled);
    },
    finishTrial: (data) => {
      state.finished.push(data);
      state.currentTrial = null;
      settleRun();
    },
    abortExperiment: (_message, data) => {
      state.aborted.push(data);
      state.currentTrial = null;
      settleRun();
    },
    pluginAPI: {
      clearAllTimeouts: () => { state.clearedTimeouts += 1; },
    },
  };
  return state;
}

function WaitForMicrotask() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function LoadTypeScriptModule(relativePath) {
  const source = readFileSync(resolve(repoRoot, relativePath), 'utf8')
    .replaceAll("from 'jspsych'", `from '${jsPsychRuntimeUrl}'`)
    .replaceAll('from "jspsych"', `from '${jsPsychRuntimeUrl}'`)
    .replaceAll(
      "from '../../../shared/jsPsychSimulation'",
      `from '${simulationHelperUrl}'`,
    );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: relativePath,
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

async function CreateTranspiledDataUrl(relativePath) {
  const output = ts.transpileModule(
    readFileSync(resolve(repoRoot, relativePath), 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      },
      fileName: relativePath,
    },
  ).outputText;
  return `data:text/javascript;base64,${Buffer.from(output).toString('base64')}`;
}
