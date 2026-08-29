#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const contractsUrl = pathToFileURL(resolve(repoRoot, 'packages/training-contracts/src/index.js')).href;
const engine = await LoadEngine();

await TestCompletedRun();
await TestAbortAndDispose();
await TestSignalAbort();
await TestRunFailureCleansMount();
await TestStartMutex();

console.log('Native timeline engine lifecycle passed: complete, abort, dispose, and signal cancellation.');

async function TestCompletedRun() {
  const state = CreateJsPsychState({ autoFinish: true });
  const mount = CreateMount();
  const timelineCalls = [];
  const nativeEngine = engine.CreateNativeTimelineEngine({
    moduleId: 'vision:moving-card',
    moduleVersion: '1.0.0',
    initJsPsych: state.initJsPsych,
    buildTimeline: ({ context }) => {
      timelineCalls.push(context.mountElement);
      return [{ type: 'simulated' }];
    },
    summarize: ({ status, startedAt, endedAt, values }) => engine.CreateDefaultNativeTimelineResult({
      moduleId: 'vision:moving-card',
      moduleVersion: '1.0.0',
      status,
      startedAt,
      endedAt,
      values,
    }),
  });

  const controller = new AbortController();
  const handle = await nativeEngine.startRun({
    config: {},
    mountElement: mount,
    signal: controller.signal,
    sessionNonce: 'session-1',
  });
  await handle.pause();
  await handle.resume();
  const result = await handle.result;
  assert.equal(result.status, 'completed');
  assert.equal(result.trialCount, 1);
  assert.equal(state.pauseCount, 1);
  assert.equal(state.resumeCount, 1);
  assert.deepEqual(timelineCalls, [mount]);
  await nativeEngine.dispose('complete');
}

async function TestAbortAndDispose() {
  const state = CreateJsPsychState({ autoFinish: false });
  const mount = CreateMount();
  let disposed = 0;
  const nativeEngine = engine.CreateNativeTimelineEngine({
    moduleId: 'brain:ufov',
    moduleVersion: '1.0.0',
    initJsPsych: state.initJsPsych,
    buildTimeline: () => [{ type: 'pending' }],
    summarize: ({ status, startedAt, endedAt, values }) => engine.CreateDefaultNativeTimelineResult({
      moduleId: 'brain:ufov',
      moduleVersion: '1.0.0',
      status,
      startedAt,
      endedAt,
      values,
    }),
    onDispose: () => { disposed += 1; },
  });
  const controller = new AbortController();
  const handle = await nativeEngine.startRun({
    config: {},
    mountElement: mount,
    signal: controller.signal,
    sessionNonce: 'session-2',
  });
  await handle.abort('back');
  assert.equal((await handle.result).status, 'aborted');
  await nativeEngine.dispose('back');
  assert.equal(disposed, 1);
  assert.equal(mount.cleared, 1);

  const secondState = CreateJsPsychState({ autoFinish: false });
  const secondEngine = engine.CreateNativeTimelineEngine({
    moduleId: 'brain:ufov',
    moduleVersion: '1.0.0',
    initJsPsych: secondState.initJsPsych,
    buildTimeline: () => [{ type: 'pending' }],
    summarize: ({ status, startedAt, endedAt, values }) => engine.CreateDefaultNativeTimelineResult({
      moduleId: 'brain:ufov',
      moduleVersion: '1.0.0',
      status,
      startedAt,
      endedAt,
      values,
    }),
  });
  const secondHandle = await secondEngine.startRun({
    config: {},
    mountElement: CreateMount(),
    signal: new AbortController().signal,
    sessionNonce: 'session-3',
  });
  await secondEngine.dispose('exit');
  assert.equal((await secondHandle.result).status, 'aborted');
}

async function TestSignalAbort() {
  const state = CreateJsPsychState({ autoFinish: false });
  const nativeEngine = engine.CreateNativeTimelineEngine({
    moduleId: 'vision:gabor-patching',
    moduleVersion: '1.0.0',
    initJsPsych: state.initJsPsych,
    buildTimeline: () => [{ type: 'pending' }],
    summarize: ({ status, startedAt, endedAt, values }) => engine.CreateDefaultNativeTimelineResult({
      moduleId: 'vision:gabor-patching',
      moduleVersion: '1.0.0',
      status,
      startedAt,
      endedAt,
      values,
    }),
  });
  const controller = new AbortController();
  const handle = await nativeEngine.startRun({
    config: {},
    mountElement: CreateMount(),
    signal: controller.signal,
    sessionNonce: 'session-4',
  });
  controller.abort();
  assert.equal((await handle.result).status, 'aborted');
  await nativeEngine.dispose('error');
}

async function TestRunFailureCleansMount() {
  const state = CreateJsPsychState({ autoFinish: false, runThrows: true });
  const mount = CreateMount();
  const nativeEngine = engine.CreateNativeTimelineEngine({
    moduleId: 'vision:reading-training',
    moduleVersion: '1.0.0',
    initJsPsych: state.initJsPsych,
    buildTimeline: () => [{ type: 'throws-when-run' }],
    summarize: ({ status, startedAt, endedAt, values }) => engine.CreateDefaultNativeTimelineResult({
      moduleId: 'vision:reading-training',
      moduleVersion: '1.0.0',
      status,
      startedAt,
      endedAt,
      values,
    }),
  });
  await assert.rejects(
    () => nativeEngine.startRun({
      config: {},
      mountElement: mount,
      signal: new AbortController().signal,
      sessionNonce: 'session-run-failure',
    }),
    /simulated jsPsych run failure/,
  );
  assert.equal(mount.cleared, 1, 'a jsPsych.run failure must clear the training mount');
  await nativeEngine.dispose('error');
}

async function TestStartMutex() {
  const state = CreateJsPsychState({ autoFinish: false });
  const mount = CreateMount();
  let releaseTimeline;
  const timelineReady = new Promise((resolve) => { releaseTimeline = resolve; });
  const nativeEngine = engine.CreateNativeTimelineEngine({
    moduleId: 'vision:moving-card',
    moduleVersion: '1.0.0',
    initJsPsych: state.initJsPsych,
    buildTimeline: async () => {
      await timelineReady;
      return [{ type: 'pending' }];
    },
    summarize: ({ status, startedAt, endedAt, values }) => engine.CreateDefaultNativeTimelineResult({
      moduleId: 'vision:moving-card',
      moduleVersion: '1.0.0',
      status,
      startedAt,
      endedAt,
      values,
    }),
  });
  const context = {
    config: {},
    mountElement: mount,
    signal: new AbortController().signal,
    sessionNonce: 'session-start-mutex',
  };
  const firstStart = nativeEngine.startRun(context);
  await Promise.resolve();
  await assert.rejects(
    () => nativeEngine.startRun({ ...context, sessionNonce: 'session-start-mutex-duplicate' }),
    /already has an active run/,
    'a second start must be rejected while the first timeline is still preparing',
  );
  releaseTimeline();
  const handle = await firstStart;
  await handle.abort('back');
  await nativeEngine.dispose('back');

  const disposingState = CreateJsPsychState({ autoFinish: false });
  const disposingMount = CreateMount();
  let releaseDisposedTimeline;
  const disposingTimelineReady = new Promise((resolve) => { releaseDisposedTimeline = resolve; });
  const disposingEngine = engine.CreateNativeTimelineEngine({
    moduleId: 'vision:moving-card',
    moduleVersion: '1.0.0',
    initJsPsych: disposingState.initJsPsych,
    buildTimeline: async () => {
      await disposingTimelineReady;
      return [{ type: 'pending' }];
    },
    summarize: ({ status, startedAt, endedAt, values }) => engine.CreateDefaultNativeTimelineResult({
      moduleId: 'vision:moving-card',
      moduleVersion: '1.0.0',
      status,
      startedAt,
      endedAt,
      values,
    }),
  });
  const disposingStart = disposingEngine.startRun({
    config: {},
    mountElement: disposingMount,
    signal: new AbortController().signal,
    sessionNonce: 'session-dispose-during-build',
  });
  await Promise.resolve();
  await disposingEngine.dispose('exit');
  releaseDisposedTimeline();
  await assert.rejects(
    () => disposingStart,
    /has been disposed/,
    'disposing a pending timeline must reject the late start',
  );
  assert.ok(disposingMount.cleared > 0, 'disposing a pending timeline must clear its mount');
}

function CreateJsPsychState({ autoFinish, runThrows = false }) {
  const state = {
    values: [],
    pauseCount: 0,
    resumeCount: 0,
    onFinish: null,
    aborted: false,
  };
  state.initJsPsych = (options) => {
    state.onFinish = options.on_finish;
    return {
      run: (timeline) => {
        if (runThrows) throw new Error('simulated jsPsych run failure');
        state.values = [{ timelineLength: timeline.length }];
        if (autoFinish) queueMicrotask(() => state.onFinish?.());
      },
      pauseExperiment: () => { state.pauseCount += 1; },
      resumeExperiment: () => { state.resumeCount += 1; },
      abortExperiment: () => {
        state.aborted = true;
        queueMicrotask(() => state.onFinish?.());
      },
      data: { get: () => ({ values: () => state.values }) },
    };
  };
  return state;
}

function CreateMount() {
  return {
    cleared: 0,
    replaceChildren() { this.cleared += 1; },
  };
}

async function LoadEngine() {
  const source = readFileSync(resolve(repoRoot, 'apps/rehabtrainerhub/training-modules/shared/nativeTimelineEngine.ts'), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: 'nativeTimelineEngine.ts',
  }).outputText.replaceAll("from '@rehab-trainer/training-contracts'", `from '${contractsUrl}'`);
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}
