import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { AcceptGameMessage, IsGameResult, IsGameSettings } from '../packages/ui/src/selfContainedGame.js';
import { IsUfovResultFile, ufovTrialColumns } from '../packages/ui/src/resultFiles.js';

const root = resolve(import.meta.dirname, '..');
const gameRoot = resolve(root, 'apps/rehabtrainerhub/games/ufov');
const legacy = JSON.parse(await readFile(resolve(import.meta.dirname, 'fixtures/ufov-legacy.json'), 'utf8'));

test('interrupting a UFOV trial discards it and restarts after continuation', async () => {
  const { TrialInterrupt } = await Load('logic/trialInterrupt.ts');
  const gate = new TrialInterrupt();
  const parent = new AbortController();
  let starts = 0;
  const run = gate.run(parent.signal, signal => new Promise((resolve, reject) => {
    starts++;
    signal.addEventListener('abort', () => reject(new DOMException('Interrupted', 'AbortError')), { once: true });
    if (starts === 2) resolve('completed');
  }));
  await Promise.resolve();
  gate.pause();
  await Promise.resolve();
  assert.equal(starts, 1);
  gate.resume();
  assert.equal(await run, 'completed');
  assert.equal(starts, 2);
});

test('stopping while UFOV is paused releases the pending trial without restarting it', async () => {
  const { TrialInterrupt } = await Load('logic/trialInterrupt.ts');
  const gate = new TrialInterrupt();
  const parent = new AbortController();
  gate.pause();
  let starts = 0;
  const run = gate.run(parent.signal, async () => { starts++; });
  parent.abort();
  await assert.rejects(run, { name: 'AbortError' });
  gate.resume();
  assert.equal(starts, 0);
});

async function Load(path, dependencies = {}, globals = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(await readFile(resolve(gameRoot, path), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('require', 'module', 'exports', ...Object.keys(globals), output)(name => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, module, module.exports, ...Object.values(globals));
  return module.exports;
}

test('UFOV reruns an interrupted exposure without recording the partial attempt', async () => {
  const gate = await Load('logic/trialInterrupt.ts');
  const staircase = await Load('logic/staircase.ts');
  const timing = await Load('timing/peripheralAttentionTiming.ts');
  const { UfovRun } = await Load('logic/ufovRun.ts', {
    '../runtime/displayTiming': { MeasureDisplayRefreshRate: async () => ({ refreshMs: 16, refreshHz: 62.5 }) },
    '../runtime/peripheralAttentionCanvas': { CreatePeripheralAttentionCanvasSlots: () => [{ ring: 2, isTargetCandidate: true, axis: 0 }] },
    '../runtime/peripheralAttentionResults': { EstimatePeripheralAttentionThresholdMs: () => 500 },
    '../timing/peripheralAttentionTiming': timing,
    './staircase': staircase,
    './trialInterrupt': gate,
  });
  let completed;
  const config = { subtestId: 1, mode: 'formal', stopCondition: 'fixed_trials', trialCount: 1, targetAxes: [0] };
  const run = new UfovRun(config, { host: {}, label: 'test', prompt() {}, progress() {} }, session => { completed = session; });
  let starts = 0;
  run.runTrial = (stimulus, refresh, attempt, signal) => new Promise((resolve, reject) => {
    starts++;
    if (starts === 1) signal.addEventListener('abort', () => reject(new DOMException('Interrupted', 'AbortError')), { once: true });
    else resolve({ timingAttempt: { syncValid: true, refreshMs: 16 }, record: { correct: true, durationMs: 500, practice: false } });
  });
  const running = run.start();
  await new Promise(resolve => setImmediate(resolve));
  run.pause();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(starts, 1);
  run.resume();
  await running;
  assert.equal(starts, 2);
  assert.equal(completed.trials.length, 1);
  assert.equal(completed.timing_attempts.length, 1);
});

async function LoadScoring() {
  const results = await Load('runtime/peripheralAttentionResults.ts');
  const summary = await Load('logic/ufovSummary.ts', { '../runtime/peripheralAttentionResults': results });
  const score = await Load('score.ts', { './logic/ufovSummary': summary });
  const files = await Load('resultFiles.ts', { './logic/ufovSummary': summary });
  return { ...summary, ...score, ...files };
}

function Trial(trialNumber, patch = {}) {
  return { subtestId: 2, practice: false, trialNumber, durationFrames: 3, displayFrameCount: 3, plannedDurationMs: 50.01,
    durationMs: 50.01, refreshMs: 16.67, refreshHz: 59.99, refreshSampleCount: 12, refreshStandardDeviationMs: 0.2, syncRetryCount: 0,
    centralTarget: 'car', centralResponse: 'car', peripheralAxis: 4, peripheralResponse: 4, correct: true, responseTimeMs: 812.4,
    contrastPercent: 100, targetVisualAngleDeg: 15, vehicleVisualAngleDeg: 2.5, syncValid: true, syncReason: 'synchronized',
    requestedFrameCount: 3, actualFrameCount: 3, estimatedDisplayFrameCount: 3, droppedFrameCount: 0, actualDurationMs: 50.02,
    measuredFrameMs: 16.67, measuredRefreshHz: 59.99, frameJitterMs: 0.1, maxFrameIntervalMs: 16.9,
    mouseTrajectory: [{ x: 640, y: 360, t: 0 }, { x: 642, y: 361, t: 16 }], ...patch };
}

function Session(trials, patch = {}) {
  return { subtest_id: 2, mode: 'formal', configured_trial_count: 60, target_axes: [0, 1, 2, 3, 4, 5, 6, 7], stop_condition: 'adaptive_80',
    contrast_percent: 100, target_visual_angle_deg: 15, vehicle_visual_angle_deg: 2.5, screen_width_cm: 53.1, screen_height_cm: 29.9,
    viewing_distance_cm: 50, refresh_ms: 16.67, refresh_hz: 59.99, refresh_is_60hz_family: true, refresh_device_kind: 'desktop', trials,
    timing_attempts: trials.map(trial => ({ syncValid: true, syncReason: 'synchronized' })).concat([{ syncValid: false, syncReason: 'dropped-frame' }]),
    invalid_timing_attempt_count: 1, synchronization_pause_count: 0,
    results: [{ subtestId: 2, thresholdMs: 83.35, trialCount: trials.filter(trial => !trial.practice).length, aborted: false }],
    aborted: false, ...patch };
}

test('UFOV keeps every legacy setting, default, range and option in its own form', async () => {
  const { defaultSettings, rangeSettings, listSettings, axisKeys, ValidateSettings } = await Load('settings.ts');
  assert.deepEqual(Object.keys(defaultSettings), legacy.settings.map(field => field.key));
  for (const field of legacy.settings) {
    assert.equal(defaultSettings[field.key], field.default, field.key);
    if (field.type === 'slider') {
      const range = rangeSettings.find(item => item.key === field.key);
      assert.deepEqual([range.min, range.max, range.step], [field.min, field.max, field.step], field.key);
    }
    if (field.type === 'list') {
      assert.deepEqual(listSettings.find(item => item.key === field.key).options.map(option => option.value), field.options, field.key);
    }
  }
  assert.deepEqual(axisKeys, legacy.settings.filter(field => field.type === 'checkbox').map(field => field.key));
  assert.equal(ValidateSettings(defaultSettings), true);
  assert.equal(IsGameSettings(defaultSettings), true, 'The container may store the full settings.');
  for (const field of legacy.settings.filter(item => item.type === 'slider')) {
    assert.equal(ValidateSettings({ ...defaultSettings, [field.key]: field.min }), true, `${field.key} min`);
    assert.equal(ValidateSettings({ ...defaultSettings, [field.key]: field.max }), true, `${field.key} max`);
    for (const value of [field.min - field.step, field.max + field.step, field.min + field.step / 2, NaN, Infinity, String(field.default)]) {
      assert.equal(ValidateSettings({ ...defaultSettings, [field.key]: value }), false, `${field.key} ${value}`);
    }
  }
  assert.equal(ValidateSettings({ ...defaultSettings, screenWidthCm: 53.1 + 0.1 }), true, 'Decimal steps survive floating point sums.');
  for (const change of [{ subtestId: 0 }, { subtestId: 4 }, { subtestId: '2' }, { mode: 'instruction' }, { stopCondition: 'adaptive' },
    { axis3Enabled: 'true' }, Object.fromEntries(axisKeys.map(key => [key, false]))]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
});

test('the exposure staircase starts at 500 ms, steps down 50 ms per correct answer and up three steps per miss', async () => {
  const { InitialAdaptiveState, UpdateAdaptiveState, NextDurationMs, MaxTestTrials, MsToFrameCount, FramesToMs, ufovTiming } = await Load('logic/staircase.ts');
  assert.deepEqual([ufovTiming.maxDurationMs, ufovTiming.startStepMs, ufovTiming.practiceTrials, ufovTiming.practiceDurationMs,
    ufovTiming.fixationMs, ufovTiming.maskMs, ufovTiming.adaptiveMaxTrials], [500, 50, 5, 250, 1000, 500, 60]);
  const refresh = 1000 / 60;
  let state = InitialAdaptiveState();
  let duration = ufovTiming.maxDurationMs;
  const path = [];
  for (const correct of [true, true, false, true]) {
    state = UpdateAdaptiveState(state, correct, duration, refresh, ufovTiming.maxDurationMs);
    duration = NextDurationMs(duration, correct, state.stepMs, refresh, ufovTiming.maxDurationMs);
    path.push([duration, state.stepMs, state.reversals.length]);
  }
  assert.deepEqual(path, [[450, 50, 0], [400, 50, 0], [500, 37.5, 1], [471.875, 28.125, 2]]);
  assert.equal(NextDurationMs(refresh, true, 50, refresh, 500), refresh, 'The exposure never goes below one frame.');
  let floor = InitialAdaptiveState();
  for (let index = 0; index < 3; index++) floor = UpdateAdaptiveState(floor, true, refresh, refresh, 500);
  assert.equal(floor.limitStreak, 3, 'Correct answers at one frame count toward the floor streak.');
  let ceiling = InitialAdaptiveState();
  for (let index = 0; index < 2; index++) ceiling = UpdateAdaptiveState(ceiling, false, 500, refresh, 500);
  assert.equal(ceiling.failAtMaxStreak, 2);
  assert.equal(MaxTestTrials({ stopCondition: 'adaptive_80', trialCount: 240 }), 60);
  assert.equal(MaxTestTrials({ stopCondition: 'fixed_trials', trialCount: 240 }), 240);
  assert.equal(MsToFrameCount(50, refresh), 3);
  assert.equal(MsToFrameCount(1, refresh), 1, 'Every stimulus shows for at least one frame.');
  assert.ok(Math.abs(FramesToMs(3, 16.67) - 50.01) < 1e-9);
});

test('UFOV results keep the legacy summary and round keys as bounded numbers', async () => {
  const { BuildGameScore, SummarizeUfovSession } = await LoadScoring();
  const trials = [Trial(1), Trial(2, { correct: false, peripheralResponse: 2, actualDurationMs: 100.03, peripheralAxis: 0 }),
    Trial(3, { actualDurationMs: 33.34 })];
  const session = Session(trials);
  const score = BuildGameScore(session);
  assert.deepEqual(Object.keys(score.summary), legacy.score.summary.map(field => field.key));
  assert.deepEqual(Object.keys(score.rounds[0]), legacy.score.columns.map(field => field.key));
  assert.deepEqual(score.summary, { trials: 3, correct: 2, thresholdMs: 83.35, bestMs: 33.34, invalidTiming: 1, timingAttempts: 4, aborted: 0 });
  assert.deepEqual(score.rounds[1], { trial: 2, correct: 0, subtest: 2, axis: 0, exposureMs: 100.03, requestedMs: 50.01, responseMs: 812,
    syncValid: 1, dropped: 0, contrast: 100, angle: 15 });
  const centerOnly = BuildGameScore(Session([Trial(1, { subtestId: 1, peripheralAxis: undefined, peripheralResponse: undefined })], { subtest_id: 1 }));
  assert.equal(centerOnly.rounds[0].axis, null, 'Activity 1 has no outer target.');
  const practice = BuildGameScore(Session([Trial(1, { practice: true }), Trial(2, { practice: true, correct: false })],
    { mode: 'practice', results: [{ subtestId: 2, thresholdMs: 250, trialCount: 2, aborted: false }] }));
  assert.equal(practice.summary.bestMs, 250, 'Practice reports its fixed exposure, as before.');
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.equal(IsGameResult({ config: { subtestId: 2, mode: 'formal' }, score: { schema: 'rehab-trainer.game-score/v1', gameId: 'ufov', ...score } }, 'ufov'), true);
  const summary = SummarizeUfovSession(session);
  assert.deepEqual(summary.directions.find(item => item.axis === 4), { axis: 4, trials: 2, correct: 2, accuracyPercent: 100, meanResponseMs: 812, meanExposureMs: 41.68 });
  assert.deepEqual(summary.directions.find(item => item.axis === 6), { axis: 6, trials: 0, correct: 0, accuracyPercent: null, meanResponseMs: null, meanExposureMs: null });
  assert.equal(summary.peripheralAccuracyPercent, 67);
});

test('the three result files pass the container check and hold no identity or formulas', async () => {
  const { BuildResultFiles, ufovTrialColumns: gameColumns } = await LoadScoring();
  assert.deepEqual([...gameColumns], [...ufovTrialColumns], 'The game writes the columns the container checks.');
  const files = BuildResultFiles(Session([Trial(1), Trial(2, { centralResponse: 'truck', correct: false, peripheralAxis: undefined, peripheralResponse: undefined, mouseTrajectory: undefined })]),
    new Date(2026, 9, 23, 9, 15, 0));
  assert.deepEqual(files.map(file => file.fileName), ['ufov-20261023-091500-trials.csv', 'ufov-20261023-091500-summary.csv', 'ufov-20261023-091500-trajectory.json']);
  for (const file of files) assert.equal(IsUfovResultFile(file), true, file.fileName);
  const [trials, summary, trajectory] = files;
  assert.equal(trials.text.split('\r\n')[1], '1,0,2,50.01,50.02,3,0,59.99,1,100,2.5,15,car,car,1,4,4,1,1,812,2');
  assert.equal(trials.text.split('\r\n')[2].split(',').slice(12, 18).join(','), 'car,truck,0,,,');
  assert.match(summary.text, /\r\nthreshold_ms,83\.35,ms\r\n/);
  assert.match(summary.text, /\r\ndirection_4_trials,1,count\r\n/);
  assert.doesNotMatch(summary.text + trials.text, /subject|participant|user|token|=|"/i);
  assert.doesNotMatch(trajectory.text, /subject|participant|user|token/i);
  const parsed = JSON.parse(trajectory.text);
  assert.deepEqual(parsed.trials[0].trajectory, [[0, 640, 360], [16, 642, 361]]);
  assert.equal(parsed.trials[1].peripheral_axis, null);
  const long = Array.from({ length: 6000 }, (_, index) => ({ x: index % 1920, y: index % 1080, t: index * 8 }));
  const many = BuildResultFiles(Session(Array.from({ length: 245 }, (_, index) => Trial(index + 1, { mouseTrajectory: long }))), new Date(2026, 9, 23, 9, 15, 0));
  assert.equal(IsUfovResultFile(many[2]), true, 'Long mouse paths are thinned to fit the container limits.');
  assert.equal(many[0].text.split('\r\n')[1].split(',').at(-1), '6000', 'The CSV keeps the recorded sample count.');
});

test('UFOV hands its result files to the container before the result and asks for downloads by name', async () => {
  const listeners = new Map(), sent = [], parent = {};
  const window = { parent, addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: name => listeners.delete(name), dispatchEvent() {} };
  const module = { exports: {} };
  const document = { referrer: 'https://trainerhub.cc/', fullscreenElement: null };
  new Function('require', 'module', 'exports', 'window', 'document', ts.transpileModule(await readFile(resolve(gameRoot, 'runtime/hubBridge.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(name => name.endsWith('package.json') ? { version: '2.0.0' } : { DisposeAudioFeedback() {} }, module, module.exports, window, document);
  const api = module.exports;
  const { BuildResultFiles, BuildGameScore } = await LoadScoring();
  const session = Session([Trial(1)]);
  const files = BuildResultFiles(session, new Date(2026, 9, 23, 9, 15, 0));
  const score = BuildGameScore(session);
  api.InstallHubBridge();
  assert.equal(api.CanDownloadResultFiles(), false, 'Without a container there is nowhere to download from.');
  api.SendGameResult({ subtestId: 2 }, score.summary, score.rounds, files);
  const port = { start() {}, postMessage: message => sent.push(message) };
  listeners.get('message')({ source: parent, origin: 'https://trainerhub.cc', ports: [port], data: {
    schema: 'trainerhub.game/v1', type: 'init', gameId: 'ufov', version: '2.0.0', sessionNonce: 'a'.repeat(64), language: 'zh' } });
  assert.equal(api.CanDownloadResultFiles(), true);
  api.RequestResultDownload(files[0].fileName);
  assert.deepEqual(sent.map(message => message.type), ['ready', 'result-file', 'result-file', 'result-file', 'result', 'result-file-download']);
  const state = { gameId: 'ufov', version: '2.0.0', sessionNonce: 'a'.repeat(64), sequence: -1, complete: false, capabilities: ['result-files'] };
  for (const message of sent) assert.equal(AcceptGameMessage(message, state), true, message.type);
});

test('UFOV owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  const pkg = JSON.parse(await readFile(resolve(gameRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.name, '@rehab-trainer/game-ufov');
  assert.equal(pkg.version, '2.2.2');
  for (const name of ['react', 'react-dom', 'jspsych', 'tone']) assert.ok(pkg.dependencies[name], name);
  assert.equal(pkg.dependencies['@rehab-trainer/ui'], undefined);
  for (const capability of ['result-files', 'settings-storage', 'pointer', 'fullscreen']) assert.ok(pkg.rehabTrainer.capabilities.includes(capability), capability);
  for (const file of await readdir(gameRoot, { recursive: true })) {
    if (!/\.(tsx?|css)$/.test(file) || /^(dist|node_modules)[\\/]/.test(file)) continue;
    const source = await readFile(resolve(gameRoot, file), 'utf8');
    assert.doesNotMatch(source, /@rehab-trainer\/|packages\/ui|localStorage|SaveTrainingRecord|react-router-dom|GetAuth|subjectId/, file);
    if (/\.tsx?$/.test(file)) assert.doesNotMatch(source, /#[0-9a-f]{3,6}\b|rgba?\(\s*\d/i, `${file}: colors come from CSS tokens.`);
    // subtestId and the subtest score column are legacy keys; the visible copy never says Subtest.
    assert.doesNotMatch(source, /評估|測驗|診斷|治療|療效|Subtest|[Aa]ssessment|[Dd]iagnos|[Tt]reat/, `${file}: practice wording only.`);
  }
  for (const name of ['settings.json', 'score.json', 'PeripheralAttentionPage.tsx', 'styles/PeripheralAttentionPage.css']) {
    await assert.rejects(access(resolve(gameRoot, name)), name);
  }
  const registry = JSON.parse(await readFile(resolve(root, 'packages/ui/src/officialGameReleases.json'), 'utf8'));
  assert.equal(registry.ufov.origin, 'https://trainerhubgames.rainbowh9490.workers.dev');
  const metadata = JSON.parse(await readFile(resolve(gameRoot, 'public/game.json'), 'utf8'));
  assert.deepEqual([metadata.gameId, metadata.trainer, metadata.category], ['ufov', 'brain', 'attention']);
  assert.equal(metadata.copy['zh-TW'].title, '周邊視野訓練');
  const capture = JSON.parse(await readFile(new URL('../docs/game-preview-captures.json', import.meta.url), 'utf8')).find(item => item.gameId === metadata.gameId);
  assert.equal(createHash('sha256').update(await readFile(resolve(gameRoot, 'public', metadata.preview))).digest('hex'), capture.previewSha256);
  for (const copy of Object.values(metadata.copy)) assert.doesNotMatch(`${copy.title} ${copy.description}`, /治療|診斷|療效|改善|評估|測驗|treat|diagnos|improve|assess/i);
  const css = await readFile(resolve(gameRoot, 'game.css'), 'utf8');
  for (const token of ['--ufov-stimulus', '--ufov-field']) assert.match(css, new RegExp(`${token}:`), token);
  const source = await readFile(resolve(gameRoot, 'UfovGame.tsx'), 'utf8');
  assert.match(source, /<ScoreAnalysis rounds=\{score\.rounds\}/);
  assert.match(source, /ValidateSettings\(settings\)/);
  assert.match(source, /RequestResultDownload\(/);
  assert.doesNotMatch(source, /良好|中等|偏弱|Needs attention|Good|Moderate/, 'Direction results describe counts, not grades.');
});

test('the canvas uses device pixels for its backing store and mask, and CSS pixels for drawing', async () => {
  const sizes = [];
  const transforms = [];
  const masks = [];
  const context = {
    setTransform: (...args) => transforms.push(args), clearRect() {}, fillRect() {}, strokeRect() {},
    createImageData(width, height) { sizes.push([width, height]); return { width, height, data: new Uint8ClampedArray(width * height * 4) }; },
    putImageData: (...args) => masks.push(args),
  };
  const canvas = { width: 0, height: 0, getContext: () => context };
  const stage = { querySelector: () => canvas, setAttribute() {}, getBoundingClientRect: () => ({ width: 321, height: 181 }) };
  const window = { devicePixelRatio: 1.25 };
  const { DrawPeripheralAttentionCanvasStage, PreparePeripheralAttentionNoiseMask } = await Load('runtime/peripheralAttentionCanvas.ts', {}, {
    window, getComputedStyle: () => ({ getPropertyValue: () => 'rgb(0, 0, 0)' }),
  });
  DrawPeripheralAttentionCanvasStage(stage, { phase: 'fixation' });
  assert.deepEqual([canvas.width, canvas.height], [401, 226]);
  assert.deepEqual(transforms.at(-1), [1.25, 0, 0, 1.25, 0, 0]);
  const maskImageData = PreparePeripheralAttentionNoiseMask(stage);
  DrawPeripheralAttentionCanvasStage(stage, { phase: 'mask', maskImageData });
  assert.deepEqual(sizes, [[401, 226]]);
  assert.deepEqual(masks, [[maskImageData, 0, 0]]);
  assert.deepEqual(transforms.at(-1), [1, 0, 0, 1, 0, 0]);
  window.devicePixelRatio = 0;
  DrawPeripheralAttentionCanvasStage(stage, { phase: 'fixation' });
  assert.deepEqual([canvas.width, canvas.height], [321, 181]);
});

test('tutorial markers follow the canvas box and the scaled car in the selected ring slot', async () => {
  const { GetPeripheralAttentionTargetRects, CreatePeripheralAttentionCanvasSlots } = await Load('runtime/peripheralAttentionCanvas.ts');
  const stage = { width: 640, height: 480 };
  const geometry = { radiusPx: 120, vehicleScale: .75 };
  const slot = CreatePeripheralAttentionCanvasSlots().find(item => item.isTargetCandidate && item.axis === 2);
  const { center, outer } = GetPeripheralAttentionTargetRects(stage, geometry, slot);
  assert.deepEqual(center, { left: 279.5, top: 199.5, width: 81, height: 81 });
  assert.deepEqual(outer, { left: 413, top: 219, width: 54, height: 42 });
  assert.equal(GetPeripheralAttentionTargetRects(stage, geometry).outer, undefined);
});

test('answer screens show icon-only vehicles, eight numbered directions and announced feedback', async () => {
  const { VehicleQuestion, DirectionQuestion, StimulusFeedback } = await Load('AnswerPad.tsx', { 'react/jsx-runtime': jsxRuntime });
  const vehicle = renderToStaticMarkup(VehicleQuestion({ lang: 'zh', onChoose() {} }));
  assert.match(vehicle, /<button[^>]*aria-label="汽車"><svg[^>]*aria-hidden="true"/);
  assert.match(vehicle, /<button[^>]*aria-label="卡車"><svg[^>]*aria-hidden="true"/);
  assert.doesNotMatch(vehicle, /<h2|>汽車<|>卡車</);
  assert.match(renderToStaticMarkup(VehicleQuestion({ lang: 'en' })), /\binert=""/);
  const direction = renderToStaticMarkup(DirectionQuestion({ lang: 'en', onChoose() {} }));
  assert.equal((direction.match(/<button/g) ?? []).length, 8);
  assert.match(direction, /aria-label="1. Up"[^>]*>1<\/button>/);
  assert.match(direction, /aria-label="8. Up left"[^>]*>8<\/button>/);
  assert.equal((direction.match(/ufov-axis-guide/g) ?? []).length, 8);
  assert.match(renderToStaticMarkup(StimulusFeedback({ lang: 'zh', correct: false })), /role="status".*aria-hidden="true">×<\/span><span class="ufov-visually-hidden">答錯/);
});

test('settings keep a native form with option cards, an eight-way compass and readouts', async () => {
  const source = await readFile(resolve(gameRoot, 'UfovGame.tsx'), 'utf8');
  assert.match(source, /<dialog[\s\S]*?<form[\s\S]*?onSubmit=.*confirmSettings\(\).*?[\s\S]*?onKeyDown=.*Enter.*confirmSettings\(\)/);
  assert.match(source, /type="radio" name=\{key\}/);
  assert.match(source, /handheld && option\.value !== 1/);
  assert.match(source, /type="checkbox" name=\{key\}/);
  assert.match(source, /ufov-compass-toggle[^\n]*aria-pressed/);
  assert.match(source, /geometry\.pixelsPerCm[\s\S]*?geometry\.maxVisualAngleDeg[\s\S]*?geometry\.vehicleWidthPx[\s\S]*?geometry\.isOverLimit/);
  assert.match(source, /fixed && rangeInput\('trialCount'[^\n]*!formal/);
});

function FindElements(node, matches) {
  if (Array.isArray(node)) return node.flatMap(child => FindElements(child, matches));
  if (!node?.props) return [];
  return [...(matches(node) ? [node] : []), ...FindElements(node.props.children, matches)];
}

test('settings keep a direction selected, retain the formal ending in practice, and limit handheld activities', async () => {
  const settingsModule = await Load('settings.ts');
  let settings = { ...settingsModule.defaultSettings, subtestId: 2, stopCondition: 'fixed_trials', trialCount: 15 };
  let device = 'desktop';
  const game = await Load('UfovGame.tsx', {
    jspsych: {}, './score': {}, './resultFiles': {}, './ScoreAnalysis': {}, './logic/ufovSummary': {}, './logic/ufovRun': {},
    './runtime/jsPsychLifecycle': {}, './runtime/soundManager': {}, './music': {}, './runtime/settingsMemory': {},
    './runtime/hubBridge': { IsHubGame: () => true }, './rules/UfovTutorial': {},
    './runtime/displayTiming': { DetectDisplayDeviceKind: () => device },
    './runtime/peripheralAttentionCanvas': await Load('runtime/peripheralAttentionCanvas.ts'),
    './logic/staircase': await Load('logic/staircase.ts'), './settings': settingsModule,
    './AnswerPad': await Load('AnswerPad.tsx', { 'react/jsx-runtime': jsxRuntime }),
    './i18n/useT': { useT: () => ({ lang: 'en', t: () => 'Peripheral Visual Field Training' }) },
    'react/jsx-runtime': jsxRuntime,
    react: {
      useCallback: callback => callback, useEffect() {}, useRef: current => ({ current }),
      useState: initial => initial && typeof initial === 'object' && 'subtestId' in initial
        ? [settings, next => { settings = typeof next === 'function' ? next(settings) : next; }]
        : [typeof initial === 'function' ? initial() : initial, () => {}],
    },
  });
  const inputs = name => FindElements(game.UfovGame(), node => node.type === 'input' && node.props.name === name).map(node => node.props);
  const toggle = () => FindElements(game.UfovGame(), node => node.props.className === 'ufov-compass-toggle')[0].props.onClick();
  toggle();
  assert.deepEqual(settingsModule.EnabledAxes(settings), [0, 2, 4, 6]);
  toggle();
  assert.equal(settingsModule.EnabledAxes(settings).length, 8);
  for (const axis of [0, 1, 3, 4, 5, 6, 7]) inputs(settingsModule.axisKeys[axis])[0].onChange({ target: { checked: false } });
  assert.deepEqual(settingsModule.EnabledAxes(settings), [2]);
  assert.equal(inputs('axis2Enabled')[0].disabled, true);
  assert.ok(settingsModule.ValidateSettings(settings));

  inputs('mode').find(input => input.value === 'practice').onChange();
  assert.ok(inputs('stopCondition').every(input => input.disabled));
  assert.equal(inputs('trialCount')[0].disabled, true);
  inputs('mode').find(input => input.value === 'formal').onChange();
  assert.equal(inputs('trialCount')[0].value, 15);
  assert.equal(inputs('trialCount')[0].disabled, false);
  assert.equal(inputs('stopCondition').find(input => input.checked).value, 'fixed_trials');
  assert.equal(inputs('subtestId').find(input => input.checked).value, 2);
  for (const handheld of ['phone', 'tablet']) {
    device = handheld;
    assert.deepEqual(inputs('subtestId').map(input => [input.checked, input.disabled]), [[true, false], [false, true], [false, true]]);
  }
  assert.equal(settings.subtestId, 2, 'A handheld view preserves the saved desktop activity.');
  assert.equal(FindElements(game.UfovGame(), node => node.props.className === 'ufov-geometry-note').length, 0);
  inputs('viewingDistanceCm')[0].onChange({ target: { value: '120' } });
  const [warning] = FindElements(game.UfovGame(), node => node.props.className === 'ufov-geometry-note');
  assert.match(warning.props.children, /Move closer than \d+\.\d cm or choose a smaller angle/);
});

test('short and narrow viewports compact the UFOV tour with full-size navigation controls', async () => {
  const css = await readFile(resolve(gameRoot, 'game.css'), 'utf8');
  const compact = css.match(/@media \(max-height: 600px\), \(max-width: 480px\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(compact, 'Both the short desktop and narrow phone use the compact tour layout.');
  assert.match(compact, /\.game-tour\s*\{[^}]*flex-wrap:\s*wrap;[^}]*padding:\s*12px 16px;[^}]*line-height:\s*1\.35;/);
  assert.match(compact, /\.game-tour h2, \.game-tour p\s*\{[^}]*margin:\s*0;/);
  assert.match(compact, /\.game-tour button\s*\{[^}]*margin:\s*0;/);
  assert.doesNotMatch(compact, /min-height:/, 'The compact rules inherit the 44 px button minimum.');
  assert.match(css, /button, span\.btn\s*\{[^}]*min-height:\s*44px;/);
  assert.match(css, /\.game-tour\s*\{[^}]*font-weight:\s*700;/);
});

test('spotlights follow the phases for each activity, with distinct outer-car instructions', async () => {
  const { GetUfovTutorialSteps } = await Load('rules/tutorialSteps.ts');
  for (const language of ['zh', 'en']) {
    for (const activity of [1, 2, 3]) {
      const steps = GetUfovTutorialSteps(language, activity);
      assert.deepEqual(steps.map(({ scene, target }) => [scene, target]), [
        ['fixation', '.ufov-tutorial-center'], ['stimulus', '.ufov-tutorial-center'],
        ...(activity === 1 ? [] : [['stimulus', '.ufov-tutorial-outer']]),
        ['mask', '.ufov-tutorial-mask'], ['vehicle', '.ufov-answer-choices'],
        ...(activity === 1 ? [] : [['direction', '.ufov-axis-button[data-tutorial-target]']]),
        ['fixation', '.ufov-tutorial .ufov-stop'],
      ]);
      assert.equal(new Set(steps.map(step => step.text)).size, steps.length);
      assert.ok(steps.every(step => step.title && step.text && step.place && step.scene));
    }
    assert.notEqual(GetUfovTutorialSteps(language, 2)[2].text, GetUfovTutorialSteps(language, 3)[2].text);
  }
});
