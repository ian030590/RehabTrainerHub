import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { AcceptGameMessage, IsGameResult, IsGameSettings } from '../packages/ui/src/selfContainedGame.js';

const root = resolve(import.meta.dirname, '..');
const gameRoot = resolve(root, 'apps/rehabtrainerhub/games/tongue-catch');
const legacy = JSON.parse(await readFile(resolve(import.meta.dirname, 'fixtures/tongue-catch-legacy.json'), 'utf8'));
const nonce = 'a'.repeat(64);
const capabilities = ['audio', 'fullscreen', 'keyboard', 'pointer', 'settings-storage', 'tongue-tracking', 'touch'];

async function Load(path, dependencies = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(await readFile(resolve(gameRoot, path), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', output)(name => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}

// Pulls one `const name = useCallback(...)` body out of the component so its ordering can be checked alone.
async function LoadFunction(path, name, context) {
  const source = await readFile(resolve(gameRoot, path), 'utf8');
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let functionSource;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) {
      const value = node.initializer;
      functionSource = `const ${name} = ${ts.isCallExpression(value) ? value.arguments[0].getText(tree) : value.getText(tree)};`;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.ok(functionSource, `${path} provides ${name}`);
  const code = ts.transpileModule(functionSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  return runInNewContext(`${code}\n${name}`, context);
}

// Returns the given values in order, so every random draw of the legacy spawn can be checked.
const Sequence = values => () => {
  assert.ok(values.length > 0, 'The game drew more random numbers than expected.');
  return values.shift();
};
const Recognition = (label, confidence = 0.9, faceVisible = true) => ({ label, confidence, faceVisible });
const Step = (session, logic, input, config) => logic.StepTongueSession(session, {
  dtMs: 50, now: 0, width: 1000, height: 600, mouth: null, recognition: Recognition('Rest', 0, false), random: Sequence([]), ...input,
}, config);

async function LoadPlay() {
  const settings = await Load('settings.ts');
  const logic = await Load('logic/tongueCatch.ts');
  return { settings, logic, config: settings.ToPlayConfig(settings.defaultSettings) };
}

test('Tongue Catch keeps the Hub settings and brings back the growth, fall speed and spawn options in its own form', async () => {
  const { defaultSettings, rangeSettings, ValidateSettings, ToPlayConfig } = await Load('settings.ts');
  assert.deepEqual(Object.keys(defaultSettings), ['sensitivityPercent', 'durationSec', 'edgeChancePercent', 'growthRate', 'appleSpeed', 'spawnIntervalSec']);
  for (const field of [...legacy.settings, ...legacy.hiddenSettings.filter(item => 'step' in item)]) {
    assert.equal(defaultSettings[field.key], field.default, field.key);
    const range = rangeSettings.find(item => item.key === field.key);
    assert.deepEqual([range.min, range.max, range.step], [field.min, field.max, field.step], field.key);
  }
  assert.equal(ValidateSettings(defaultSettings), true);
  assert.equal(IsGameSettings(defaultSettings), true, 'The container may store the full settings.');
  assert.ok(Object.keys(defaultSettings).every(key => !/phone|name|user/i.test(key)), 'Saved keys avoid words the record checks treat as personal.');
  for (const range of rangeSettings) {
    const steps = Math.round((range.max - range.min) / range.step);
    for (let index = 0; index <= steps; index++) {
      const value = Number((range.min + index * range.step).toFixed(1));
      assert.equal(ValidateSettings({ ...defaultSettings, [range.key]: value }), true, `${range.key} ${value}`);
    }
    for (const value of [range.min - range.step, range.max + range.step, range.min + range.step / 2, NaN, Infinity, String(range.min)]) {
      assert.equal(ValidateSettings({ ...defaultSettings, [range.key]: value }), false, `${range.key} ${value}`);
    }
  }
  assert.deepEqual({ ...ToPlayConfig(defaultSettings) }, {
    sensitivity: 0.65, durationSec: 60, edgeChance: 0.4, growthRate: 240, appleSpeed: 90, spawnIntervalSec: 2.2,
  });
});

test('the tongue grows toward the recognized side, retracts at rest and follows the mouth like the legacy game', async () => {
  let { logic, config } = await LoadPlay();
  assert.deepEqual({ ...logic.tonguePlay }, {
    maxFrameSeconds: legacy.play.maxFrameSeconds, mouthFollowRate: legacy.play.mouthFollowRate, retractFactor: legacy.play.retractFactor,
    tongueSegments: legacy.play.tongueSegments, tongueWidth: legacy.play.tongueWidth, catchMinLength: legacy.play.catchMinLength,
    visibleMinLength: legacy.play.visibleMinLength, minHoldSeconds: legacy.play.minHoldSeconds, startY: legacy.play.startY,
  });
  // No apples here: this test only follows the tongue.
  config = { ...config, spawnIntervalSec: 1000 };
  const session = logic.CreateTongueSession(1000, 600);
  assert.deepEqual([session.mouthX, session.mouthY, session.tongueLength, session.points.length], [500, 396, 0, 10]);
  Step(session, logic, { dtMs: 400 }, config);
  assert.equal(session.elapsed, 0.05, 'A long frame counts as at most 50 ms.');
  Step(session, logic, { mouth: { x: 700, y: 300 } }, config);
  assert.ok(Math.abs(session.mouthX - 590) < 1e-9 && Math.abs(session.mouthY - 352.8) < 1e-9, 'The mouth eases 45% of the way per 50 ms.');
  for (let index = 0; index < 3; index++) Step(session, logic, { now: 1000 + index * 50, recognition: Recognition('Tongue_Right') }, config);
  assert.ok(Math.abs(session.tongueLength - 36) < 1e-9, '240 px/s for 150 ms.');
  assert.equal(session.tongueDirection, 1);
  assert.deepEqual([session.points[0].x, session.points.at(-1).x, session.points.at(-1).y], [590, 626, 352.8]);
  assert.equal(session.tongueVisible, true);
  Step(session, logic, { now: 1150, recognition: Recognition('Tongue_Right', 0.6) }, config);
  assert.ok(Math.abs(session.tongueLength - 15.6) < 1e-9, 'Below the sensitivity the tongue retracts 1.7 times as fast.');
  Step(session, logic, { now: 1200, recognition: Recognition('Tongue_Left') }, config);
  assert.equal(session.tongueLength, 12, 'Switching sides starts the tongue over.');
  assert.equal(session.tongueDirection, -1);
  Step(session, logic, { now: 1250, recognition: Recognition('Tongue_Left', 0.99, false) }, config);
  assert.equal(session.tongueLength, 0, 'No face, no tongue.');
  for (let index = 0; index < 100; index++) Step(session, logic, { recognition: Recognition('Tongue_Left') }, config);
  assert.equal(session.tongueLength, 590, 'The tongue stops at the edge of the stage.');
  Step(session, logic, { dtMs: 0, recognition: Recognition('Rest') }, config);
  assert.ok(session.holdDurations.length > 0);
});

test('hold times count from the first recognized frame and ignore holds under 0.12 s', async () => {
  const { logic, config } = await LoadPlay();
  const session = logic.CreateTongueSession(1000, 600);
  const frames = [[1000, 'Tongue_Right'], [1300, 'Tongue_Right'], [1500, 'Rest'], [2000, 'Tongue_Left'], [2100, 'Rest'], [3000, 'Tongue_Left'], [3400, 'Tongue_Right'], [3900, 'Rest']];
  for (const [now, label] of frames) Step(session, logic, { now, recognition: Recognition(label) }, config);
  assert.deepEqual(session.holdDurations, [0.5, 0.4, 0.5]);
  Step(session, logic, { now: 4000, recognition: Recognition('Tongue_Right') }, config);
  const summary = logic.SummarizeTongueSession(session, 4600);
  assert.equal(summary.averageHoldSeconds, 0.5, 'A hold still running when time is up is closed and counted.');
});

test('apples spawn on the legacy interval, edge share, size and sway, then count as caught or missed', async () => {
  const { logic, config } = await LoadPlay();
  assert.deepEqual({ ...logic.appleSpawn }, {
    size: legacy.play.appleSize, edgeLeft: legacy.play.edgeLeft, edgeRight: legacy.play.edgeRight, center: legacy.play.center,
    swayAmplitude: legacy.play.swayAmplitude, swaySpeed: legacy.play.swaySpeed, swayRotation: legacy.play.swayRotation,
  });
  const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message ?? ''} ${actual} vs ${expected}`);
  const session = logic.CreateTongueSession(1000, 600);
  for (let index = 0; index < 43; index++) Step(session, logic, {}, config);
  assert.equal(session.apples.length, 0, 'Nothing before 2.2 s.');
  session.spawnElapsed = 2.2;
  // Draw order: edge or not, side, position, size, sway amplitude, phase and speed.
  const events = Step(session, logic, { dtMs: 0, random: Sequence([0.1, 0.2, 0.5, 0.5, 0.5, 0, 0.5]) }, config);
  assert.equal(session.apples.length, 1);
  const [apple] = session.apples;
  near(apple.normalizedX, 0.19, 'An edge draw on the left falls between 10% and 28%.');
  near(apple.swaySpeed, 2);
  assert.deepEqual([apple.size, apple.swayAmplitude, apple.swayPhase], [107.5, 7, 0]);
  assert.deepEqual(events.spawned, [apple.id]);
  assert.deepEqual(session.appleResults, [{ horizontalPositionPercent: -62, caught: false }]);
  assert.equal(apple.y, -107.5, 'An apple starts just above the stage.');
  near(apple.x, 190);
  Step(session, logic, {}, config);
  near(apple.y, -107.5 + 4.5, '90 px/s.');
  const sway = Math.sin(0 + 0.05 * apple.swaySpeed);
  near(apple.x, 190 + sway * 7);
  near(apple.rotation, sway * 0.09);

  const center = logic.CreateTongueSession(1000, 600);
  center.spawnElapsed = 2.2;
  Step(center, logic, { dtMs: 0, random: Sequence([0.9, 0.9, 0, 0, 0, 0, 0]) }, config);
  near(center.apples[0].normalizedX, 0.27, 'Without an edge draw the apple falls in the middle band.');
  const right = logic.CreateTongueSession(1000, 600);
  right.spawnElapsed = 2.2;
  Step(right, logic, { dtMs: 0, random: Sequence([0, 0.9, 1, 1, 1, 1, 1]) }, config);
  near(right.apples[0].normalizedX, 0.9);
  assert.equal(right.appleResults[0].horizontalPositionPercent, 80);

  // Missed: the apple falls past the bottom.
  apple.y = 600 + apple.size / 2 - 1;
  const missed = Step(session, logic, {}, config);
  assert.deepEqual([missed.missed, session.missed, session.apples.length], [[apple.id], 1, 0]);

  // Caught: the extended tongue touches the apple.
  const catching = logic.CreateTongueSession(1000, 600);
  catching.spawnElapsed = 2.2;
  Step(catching, logic, { dtMs: 0, random: Sequence([0.9, 0.9, 0.5, 0, 0, 0, 0]) }, config);
  const target = catching.apples[0];
  target.y = 396;
  target.fallElapsed = 0;
  for (let index = 0; index < 2; index++) Step(catching, logic, { dtMs: 0.001, recognition: Recognition('Tongue_Right') }, config);
  assert.equal(catching.score, 0, 'A tongue of 20 px or less does not catch.');
  catching.tongueLength = 21;
  const caught = Step(catching, logic, { dtMs: 0, recognition: Recognition('Tongue_Right') }, config);
  assert.deepEqual([caught.caught, catching.score, catching.appleResults[0].caught], [[target.id], 1, true]);
});

test('the mouth point maps onto the stage the way the mirrored, cover-fitted camera image shows it', async () => {
  const { MapVideoPointToStage, RecognitionFromFrame } = await Load('logic/tongueCatch.ts');
  assert.deepEqual(MapVideoPointToStage(0.25, 0.5, 960, 720, 1200, 600), { x: 900, y: 300 });
  assert.deepEqual(MapVideoPointToStage(0.5, 0.25, 960, 720, 600, 1200), { x: 300, y: 300 });
  const frame = { timestamp: 1, videoWidth: 960, videoHeight: 720, face: true, mouth: { x: 0.5, y: 0.6 }, label: 'Tongue_Left', confidence: 0.7, samples: { Rest: 10, Tongue_Left: 10, Tongue_Right: 10 } };
  assert.deepEqual({ ...RecognitionFromFrame(frame, 0.65) }, { label: 'Tongue_Left', confidence: 0.7, faceVisible: true });
  assert.deepEqual({ ...RecognitionFromFrame(frame, 0.75) }, { label: 'Rest', confidence: 0.7, faceVisible: true }, 'A guess below the sensitivity is rest.');
  assert.deepEqual({ ...RecognitionFromFrame({ ...frame, label: null, confidence: 0 }, 0.65) }, { label: 'Rest', confidence: 0, faceVisible: true });
  assert.deepEqual({ ...RecognitionFromFrame({ ...frame, face: false, mouth: null, label: null, confidence: 0 }, 0.65) }, { label: 'Rest', confidence: 0, faceVisible: false });
});

test('calibration captures rest, left and right for 1.9 s and at least 10 samples each, in order', async () => {
  const { calibrationSteps, calibrationTiming, CreateCalibration } = await Load('logic/calibration.ts');
  assert.deepEqual([...calibrationSteps], legacy.detection.labels);
  assert.deepEqual({ ...calibrationTiming }, { captureMs: legacy.detection.calibrationCaptureMs, minSamples: legacy.detection.minClassExamples });
  const calibration = CreateCalibration();
  assert.deepEqual({ ...calibration.State() }, { index: 0, label: 'Rest', capturing: false, progress: 0, complete: false });
  assert.equal(calibration.Update({ Rest: 3, Tongue_Left: 0, Tongue_Right: 0 }, 500), null, 'Frames before Capture are ignored.');
  assert.equal(calibration.Start(1000), 'Rest');
  assert.equal(calibration.Start(1100), null, 'A second press while capturing does nothing.');
  assert.deepEqual({ ...calibration.Update({ Rest: 4, Tongue_Left: 0, Tongue_Right: 0 }, 1950) }, { progress: 0.5, finished: null });
  assert.deepEqual({ ...calibration.Update({ Rest: 9, Tongue_Left: 0, Tongue_Right: 0 }, 2950) }, { progress: 1, finished: null }, 'Time alone is not enough.');
  assert.deepEqual({ ...calibration.Update({ Rest: 10, Tongue_Left: 0, Tongue_Right: 0 }, 3000) }, { progress: 1, finished: 'Rest' });
  assert.deepEqual({ ...calibration.State() }, { index: 1, label: 'Tongue_Left', capturing: false, progress: 1, complete: false });
  assert.equal(calibration.Start(4000), 'Tongue_Left');
  assert.deepEqual({ ...calibration.Update({ Rest: 10, Tongue_Left: 12, Tongue_Right: 0 }, 5900) }, { progress: 1, finished: 'Tongue_Left' });
  calibration.Start(6000);
  assert.deepEqual({ ...calibration.Update({ Rest: 10, Tongue_Left: 12, Tongue_Right: 10 }, 7900) }, { progress: 1, finished: 'Tongue_Right' });
  assert.equal(calibration.State().complete, true);
  assert.equal(calibration.Start(8000), null);
});

test('results keep the legacy summary and apple keys and add the catch share', async () => {
  const { logic, config } = await LoadPlay();
  const { BuildGameScore } = await Load('score.ts');
  const session = logic.CreateTongueSession(1000, 600);
  Object.assign(session, { elapsed: 60.04, score: 2, missed: 1, holdDurations: [0.4, 0.456],
    appleResults: [{ horizontalPositionPercent: -62, caught: true }, { horizontalPositionPercent: 3.4, caught: false }, { horizontalPositionPercent: 80, caught: true },
      { horizontalPositionPercent: 10, caught: false }] });
  const summary = logic.SummarizeTongueSession(session, 1000);
  const score = BuildGameScore(summary, config);
  assert.equal(score.schema, 'rehab-trainer.game-score/v1');
  assert.equal(score.gameId, 'tongue-catch');
  assert.deepEqual(Object.keys(score.summary).slice(0, legacy.score.summary.length), legacy.score.summary.map(field => field.key));
  assert.deepEqual({ ...score.summary }, { duration: 60, caught: 2, missed: 1, holdSeconds: 0.43, threshold: 0.65, catchRate: 67 });
  assert.deepEqual(Object.keys(score.rounds[0]), legacy.score.columns.map(field => field.key));
  assert.deepEqual(score.rounds.map(row => ({ ...row })), [
    { object: 1, caught: 1, position: -62 }, { object: 2, caught: 0, position: 3.4 }, { object: 3, caught: 1, position: 80 }, { object: 4, caught: 0, position: 10 },
  ]);
  const empty = BuildGameScore(logic.SummarizeTongueSession(logic.CreateTongueSession(1000, 600), 0), config);
  assert.deepEqual({ ...empty.summary }, { duration: 0, caught: 0, missed: 0, holdSeconds: 0, threshold: 0.65, catchRate: null }, 'No finished apple, no share.');
  const settings = await Load('settings.ts');
  assert.equal(IsGameResult({ config: { ...settings.defaultSettings }, score: { schema: score.schema, gameId: score.gameId, summary: score.summary, rounds: score.rounds } }, 'tongue-catch'), true);
});

const TongueFrame = patch => ({ timestamp: 5, videoWidth: 960, videoHeight: 720, face: true, mouth: { x: 0.5, y: 0.62 }, label: 'Tongue_Right', confidence: 0.81,
  samples: { Rest: 12, Tongue_Left: 11, Tongue_Right: 10 }, ...patch });

test('only well-formed mouth frames from the container reach the game', async () => {
  const { AcceptSensorInput } = await Load('runtime/sensorInput.ts');
  const state = { sessionNonce: nonce, sequence: -1 };
  let sequence = 0;
  const message = (type, payload, patch = {}) => ({ schema: 'trainerhub.input/v1', sessionNonce: nonce, sequence: sequence++, type, payload, ...patch });
  for (const payload of [TongueFrame(), TongueFrame({ label: null, confidence: 0 }), TongueFrame({ face: false, mouth: null, label: null, confidence: 0 })]) {
    assert.equal(AcceptSensorInput(message('frame', payload), state), true, JSON.stringify(payload));
  }
  assert.equal(AcceptSensorInput(message('ready', {}), state), true);
  for (const reason of ['permission', 'unsupported', 'disconnected', 'initialization']) assert.equal(AcceptSensorInput(message('error', { reason }), state), true);
  for (const payload of [
    { ...TongueFrame(), extra: 1 }, TongueFrame({ label: 'Up' }), TongueFrame({ confidence: 1.2 }), TongueFrame({ mouth: { x: 0.5, y: 0.6, z: 0 } }),
    TongueFrame({ mouth: { x: NaN, y: 0.6 } }), TongueFrame({ samples: { Rest: -1, Tongue_Left: 0, Tongue_Right: 0 } }), TongueFrame({ samples: { Rest: 1.5, Tongue_Left: 0, Tongue_Right: 0 } }),
    TongueFrame({ samples: { Rest: 1, Tongue_Left: 0 } }), TongueFrame({ face: true, mouth: null }), TongueFrame({ face: false }), TongueFrame({ videoWidth: 0 }),
    { timestamp: 3, rms: 0.04, highRatio: 0.31 },
  ]) assert.equal(AcceptSensorInput(message('frame', payload), state), false, JSON.stringify(payload));
  assert.equal(AcceptSensorInput(message('error', { reason: 'other' }), state), false);
  assert.equal(AcceptSensorInput(message('frame', TongueFrame(), { sessionNonce: 'b'.repeat(64) }), state), false, 'Another session is ignored.');
  const replay = message('ready', {});
  assert.equal(AcceptSensorInput(replay, state), true);
  assert.equal(AcceptSensorInput(replay, state), false, 'A repeated sequence is ignored.');
});

async function LoadBridge() {
  const listeners = new Map();
  const events = [];
  const parent = {};
  const window = {
    parent, addEventListener: (name, listener) => listeners.set(name, [...(listeners.get(name) ?? []), listener]),
    removeEventListener: (name, listener) => listeners.set(name, (listeners.get(name) ?? []).filter(item => item !== listener)),
    dispatchEvent: event => { events.push(event.type); for (const listener of listeners.get(event.type) ?? []) listener(event); },
    setTimeout, clearTimeout,
  };
  const document = { referrer: 'https://trainerhub.cc/', fullscreenElement: null, exitFullscreen: async () => events.push('document-exit') };
  const sent = [];
  const module = { exports: {} };
  const sensorInput = await Load('runtime/sensorInput.ts');
  new Function('require', 'module', 'exports', 'window', 'document', 'CustomEvent', 'Event', ts.transpileModule(await readFile(resolve(gameRoot, 'runtime/hubBridge.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(name => ({ '../package.json': { version: '2.0.0' }, './soundManager': { DisposeAudioFeedback: () => sent.push('stop-audio') }, './sensorInput': sensorInput })[name],
  module, module.exports, window, document, CustomEvent, Event);
  const api = module.exports;
  api.InstallHubBridge();
  const port = { start() {}, postMessage: message => sent.push(message) };
  for (const listener of listeners.get('message')) listener({ source: parent, origin: 'https://trainerhub.cc', ports: [port], data: {
    schema: 'trainerhub.game/v1', type: 'init', gameId: 'tongue-catch', version: '2.0.0', sessionNonce: nonce, language: 'zh' } });
  let inputSequence = 0;
  const deliver = data => port.onmessage({ data });
  return {
    api, sent, events, deliver,
    input: (type, payload) => deliver({ schema: 'trainerhub.input/v1', sessionNonce: nonce, sequence: inputSequence++, type, payload }),
    fullscreen: active => deliver({ schema: 'trainerhub.game/v1', type: 'fullscreen', sessionNonce: nonce, active }),
    types: () => sent.map(message => typeof message === 'string' ? message : message.type),
  };
}

test('the bridge asks for the mouth proxy, calibration captures, the camera area and fullscreen, and every message passes the container check', async () => {
  const bridge = await LoadBridge();
  const { api, sent } = bridge;
  const starting = api.StartSensorInput();
  assert.deepEqual(sent.at(-1).payload, { input: 'tongue' });
  bridge.input('ready', {});
  await starting;
  api.SetInputCapture('Tongue_Left', true);
  assert.deepEqual([sent.at(-1).type, sent.at(-1).payload], ['input-capture', { label: 'Tongue_Left', active: true }]);
  api.SetInputCapture('Tongue_Left', false);
  assert.deepEqual(sent.at(-1).payload, { label: 'Tongue_Left', active: false });
  api.SetInputPreview({ x: 0, y: 0, width: 1, height: 1 });
  assert.deepEqual(sent.at(-1).payload, { visible: true, x: 0, y: 0, width: 1, height: 1 });
  assert.deepEqual(api.ToPreviewRect({ left: 0, top: 0, width: 760, height: 800 }, 1200, 800), { x: 0, y: 0, width: 0.6333, height: 1 });
  api.SetInputPreview(null);
  assert.deepEqual(sent.at(-1).payload, { visible: false, x: 0, y: 0, width: 0, height: 0 });
  const failing = api.StartSensorInput();
  bridge.input('error', { reason: 'permission' });
  await assert.rejects(failing, /permission/);
  const entering = api.RequestContainerFullscreen();
  assert.equal(sent.at(-1).type, 'fullscreen-request');
  bridge.fullscreen(true);
  assert.equal(await entering, true);
  api.StopSensorInput();
  const state = { gameId: 'tongue-catch', version: '2.0.0', sessionNonce: nonce, sequence: -1, complete: false, capabilities };
  for (const message of sent.filter(item => typeof item === 'object')) assert.equal(AcceptGameMessage(message, state), true, message.type);
});

test('leaving the game stops audio and the camera, waits for the container to leave fullscreen, then exits', async () => {
  const bridge = await LoadBridge();
  bridge.fullscreen(true);
  const leaving = bridge.api.ExitGame();
  await new Promise(done => setImmediate(done));
  assert.deepEqual(bridge.types().slice(1), ['stop-audio', 'input-stop', 'fullscreen-exit'], 'The container stays mounted until fullscreen ends.');
  bridge.fullscreen(false);
  await leaving;
  assert.equal(bridge.types().at(-1), 'exit');
});

function Deferred() {
  let resolvePromise;
  const promise = new Promise(done => { resolvePromise = done; });
  return { promise, resolve: resolvePromise };
}

test('the camera is enabled windowed, and a fresh Start click enters fullscreen before calibration', async () => {
  const sensor = Deferred();
  const fullscreen = Deferred();
  const actions = [];
  const context = {
    phaseRef: { current: 'rules' }, generationRef: { current: 0 }, sensorReadyRef: { current: false },
    settings: {}, ValidateSettings: () => true, labels: {},
    setPhase: phase => { context.phaseRef.current = phase; actions.push(`phase:${phase}`); }, setError() {},
    setSensorReady: ready => actions.push(`ready:${ready}`),
    StartSensorInput: () => { actions.push('sensor'); return sensor.promise; },
    RequestContainerFullscreen: () => { actions.push('fullscreen'); return fullscreen.promise; },
    ExitContainerFullscreen: async () => actions.push('exit-fullscreen'),
    PrepareAudioFeedback: () => actions.push('audio'), beginCalibration: () => actions.push('calibration'),
    showConfiguration() {}, InputErrorMessage: () => '',
  };
  const start = await LoadFunction('TongueCatchGame.tsx', 'startTraining', context);
  const enabling = start();
  assert.deepEqual(actions, ['phase:initializing', 'sensor'], 'The permission prompt appears outside fullscreen.');
  sensor.resolve();
  await enabling;
  assert.deepEqual(actions.slice(2), ['ready:true', 'phase:rules'], 'Loading ends on the confirmation so the next click has user activation.');
  const starting = start();
  assert.deepEqual(actions.slice(4), ['audio', 'fullscreen']);
  fullscreen.resolve(true);
  await starting;
  assert.deepEqual(actions.slice(6), ['calibration']);

  const cancelled = { ...context, phaseRef: { current: 'rules' }, generationRef: { current: 0 }, sensorReadyRef: { current: false } };
  const pending = Deferred();
  const cancelledActions = [];
  Object.assign(cancelled, { StartSensorInput: () => pending.promise, setPhase: phase => { cancelled.phaseRef.current = phase; },
    setSensorReady: () => cancelledActions.push('ready'), RequestContainerFullscreen: async () => cancelledActions.push('fullscreen') });
  const cancelledStart = await LoadFunction('TongueCatchGame.tsx', 'startTraining', cancelled);
  const waiting = cancelledStart();
  cancelled.generationRef.current++;
  pending.resolve();
  await waiting;
  assert.deepEqual(cancelledActions, [], 'Going back during the permission prompt cannot mark the camera ready or enter fullscreen.');
});

test('the apple picture loads through an image element, because the runner blocks fetch for game packages', async () => {
  const runner = await readFile(resolve(root, 'apps/usergamerunner/functions/[[path]].js'), 'utf8');
  assert.match(runner, /"connect-src 'none'"/);
  for (const file of ['TongueCatchGame.tsx', 'scene.ts']) {
    const source = await readFile(resolve(gameRoot, file), 'utf8');
    // Pixi's SVG loader fetches the file first, so the stage would never start on the runner.
    assert.doesNotMatch(source, /Assets\.load|\bfetch\(/, `${file} must not fetch package files.`);
  }
  const source = await readFile(resolve(gameRoot, 'TongueCatchGame.tsx'), 'utf8');
  assert.match(source, /new Image\(\)/);
  assert.match(source, /Texture\.from\(/);
});

test('Tongue Catch owns its runtime, catalogue entry and results without Hub, camera or model code', async () => {
  const pkg = JSON.parse(await readFile(resolve(gameRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.name, '@rehab-trainer/game-tongue-catch');
  assert.equal(pkg.version, '2.0.0');
  for (const name of ['react', 'react-dom', 'jspsych', 'pixi.js', 'tone']) assert.ok(pkg.dependencies[name], name);
  assert.equal(pkg.dependencies['@rehab-trainer/ui'], undefined);
  assert.deepEqual(pkg.rehabTrainer.capabilities, capabilities);
  for (const file of await readdir(gameRoot, { recursive: true })) {
    if (!/\.(tsx?|css)$/.test(file) || /^(dist|node_modules)[\\/]/.test(file)) continue;
    const source = await readFile(resolve(gameRoot, file), 'utf8');
    assert.doesNotMatch(source, /@rehab-trainer\/|packages\/ui|localStorage|SaveTrainingRecord|react-router-dom|GetAuth|subjectId|getActiveUser/, file);
    assert.doesNotMatch(source, /getUserMedia|mediaDevices|tasks-vision|@tensorflow|knn-classifier|<video/, `${file}: the container owns the camera and the models.`);
    if (/\.tsx?$/.test(file)) assert.doesNotMatch(source, /#[0-9a-f]{3,6}\b|rgba?\(\s*\d|0x[0-9a-f]{6}/i, `${file}: colors come from CSS tokens.`);
    assert.doesNotMatch(source, /評估|測驗|診斷|治療|療效|[Aa]ssessment|[Dd]iagnos|[Tt]reat|practise/, `${file}: practice wording only.`);
  }
  for (const name of ['settings.json', 'score.json', 'storage/tongueRehabStorage.ts', 'runtime/components/rules/MouthTrainingRulesPanel.tsx', 'gameUtils.ts', 'types.ts']) {
    await assert.rejects(access(resolve(gameRoot, name)), name);
  }
  const registry = JSON.parse(await readFile(resolve(root, 'packages/ui/src/officialGameReleases.json'), 'utf8'));
  assert.equal(registry['tongue-catch'].origin, 'https://trainerhubgames.rainbowh9490.workers.dev');
  const metadata = JSON.parse(await readFile(resolve(gameRoot, 'public/game.json'), 'utf8'));
  assert.deepEqual([metadata.gameId, metadata.trainer, metadata.category], ['tongue-catch', legacy.catalog.trainer, legacy.catalog.category]);
  assert.equal(metadata.copy['zh-TW'].title, legacy.catalog['zh-TW'][0]);
  assert.equal(metadata.copy.en.title, legacy.catalog.en[0]);
  assert.equal(createHash('sha256').update(await readFile(resolve(gameRoot, 'public', metadata.preview))).digest('hex'), legacy.preview.sha256);
  for (const copy of Object.values(metadata.copy)) assert.doesNotMatch(`${copy.title} ${copy.description}`, /治療|診斷|療效|改善|評估|測驗|treat|diagnos|improve|assess|practise/i);
  const css = await readFile(resolve(gameRoot, 'game.css'), 'utf8');
  assert.match(css, /color-scheme: light/, 'The transparent camera area needs the same color scheme as the container.');
  for (const token of ['--tongue-field', '--tongue-rope-light', '--tongue-rope-dark', '--tongue-rope-edge', '--tongue-cue-lip', '--tongue-cue-tongue', '--tongue-warning-ink']) {
    assert.match(css, new RegExp(`${token}:`), token);
  }
  const opacity = legacy.hiddenSettings.find(item => item.key === 'cameraOpacity').default;
  assert.match(css, new RegExp(`--tongue-camera-tint: ${(1 - opacity).toFixed(2).replace(/^0/, '')};`), 'The camera shows through at the legacy 78% opacity.');
  const source = await readFile(resolve(gameRoot, 'TongueCatchGame.tsx'), 'utf8');
  assert.match(source, /<ScoreAnalysis rounds=\{score\.rounds\}/);
  assert.match(source, /SetInputPreview\(/);
  assert.match(source, /SetInputCapture\(/);
  assert.match(source, /RequestContainerFullscreen\(/);
  assert.doesNotMatch(source, /requestFullscreen\(/, 'The container enters fullscreen so the camera image stays visible.');
});

test('spotlights cover calibration, the mouth and tongue, the apples and the progress bar', async () => {
  const { GetTongueTutorialSteps } = await Load('rules/tutorialSteps.ts');
  for (const language of ['zh', 'en']) {
    const steps = GetTongueTutorialSteps(language);
    assert.deepEqual(steps.map(step => step.target), ['.tongue-preview-calibration', '.tongue-preview-mouth', '.tongue-preview-apples', '.tongue-hud']);
    assert.equal(new Set(steps.map(step => step.text)).size, steps.length);
    assert.ok(steps.every(step => step.title && step.text && step.place));
  }
});
