import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import '../apps/rehabtrainerhub/games/gesture-battler/fx/battleFeedback.test.mjs';

const root = resolve(import.meta.dirname, '..');
const gameRoot = resolve(root, 'apps/rehabtrainerhub/games/gesture-battler');

test('combat delays advance only while the Pixi ticker is running', async () => {
  const source = await readFile(resolve(gameRoot, 'GestureBattlerGame.tsx'), 'utf8');
  const syntax = ts.createSourceFile('game.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = syntax.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'AfterActiveTime');
  assert.ok(declaration, 'combat delays use the pausable game ticker');
  const js = ts.transpileModule(declaration.getText(syntax), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const after = new Function(`${js}; return AfterActiveTime;`)();
  const callbacks = new Set();
  let running = true;
  const ticker = { add: fn => callbacks.add(fn), remove: fn => callbacks.delete(fn) };
  const advance = deltaMS => { if (running) for (const fn of [...callbacks]) fn({ deltaMS }); };
  let completed = 0;
  after({ ticker }, 650, () => completed++);
  advance(200); running = false; advance(5000);
  assert.equal(completed, 0);
  running = true; advance(449); assert.equal(completed, 0);
  advance(1); assert.equal(completed, 1);
  advance(500); assert.equal(completed, 1);
});

test('paused combat ignores hand frames and removes the pause interval from clocks', async () => {
  const source = await readFile(resolve(gameRoot, 'GestureBattlerGame.tsx'), 'utf8');
  const syntax = ts.createSourceFile('game.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = new Map();
  const visit = node => { if (ts.isVariableDeclaration(node) && ['pause', 'resume', 'processFrame'].includes(node.name.getText(syntax))) declarations.set(node.name.getText(syntax), node.getText(syntax)); ts.forEachChild(node, visit); };
  visit(syntax);
  const code = ts.transpileModule([...declarations.values()].map(value => `const ${value};`).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  let now = 2000;
  const pausedRef = { current: false }, pausedAtRef = { current: 0 }, metricsRef = { current: { startedAt: 1000 } };
  const holdRef = { current: { lastTickAt: 1900, lastValidAt: 1800 } }, lastHandSeenAtRef = { current: 1900 };
  const calls = [];
  const create = new Function('useCallback', 'phaseRef', 'pausedRef', 'pausedAtRef', 'cameraLostRef', 'reconnectingRef', 'setPauseReason',
    'performance', 'appRef', 'battleFeedbackRef', 'DisposeAudioFeedback', 'setPaused', 'metricsRef', 'holdRef', 'lastHandSeenAtRef', 'restoreStopRef',
    'handleCalibrationHand', 'handleCombatHand', 'handleNoHand', 'resetHold', 'showConfiguration', 'stopVision', 't',
    `${code}; return { pause, resume, processFrame };`);
  const api = create(fn => fn, { current: 'combat' }, pausedRef, pausedAtRef, { current: false }, { current: false }, () => {},
    { now: () => now }, { current: { ticker: { stop: () => calls.push('stop'), start: () => calls.push('start') } } },
    { current: { clear() {} } }, () => {}, () => {}, metricsRef, holdRef, lastHandSeenAtRef, { current: false },
    () => {}, () => {}, () => {}, () => {}, () => {}, () => {}, () => {});
  api.pause();
  api.processFrame({ landmarks: [] });
  now += 5000;
  await api.resume();
  assert.deepEqual(calls, ['stop', 'start']);
  assert.equal(metricsRef.current.startedAt, 6000);
  assert.equal(holdRef.current.lastTickAt, 6900);
  assert.equal(holdRef.current.lastValidAt, 6800);
  assert.equal(pausedRef.current, false);
});

test('gesture game owns configuration, tutorial, calibration, combat and complete results', async () => {
  for (const file of (await readdir(gameRoot, { recursive: true })).filter(file =>
    /\.(tsx?|css)$/.test(file) && !file.startsWith('dist'))) {
    const source = await readFile(resolve(gameRoot, file), 'utf8');
    assert.doesNotMatch(source, /@rehab-trainer\/|packages\/ui|SaveTrainingSessionRecord|getActiveUser|\.\.\/\.\.\//, file);
    assert.doesNotMatch(source, /mediaDevices|\.getUserMedia\(/, file);
  }
  for (const file of ['settings.json', 'score.json']) await assert.rejects(access(resolve(gameRoot, file)));
  const source = await readFile(resolve(gameRoot, 'GestureBattlerGame.tsx'), 'utf8');
  for (const feature of ['GestureBattlerTutorial', 'StartHandInput', 'handleCalibrationHand', 'handleCombatHand',
    'Gesture_Stats', 'Cast_Records', 'SendGameResult', 'RetryGameSave']) assert.ok(source.includes(feature), feature);
  const manifest = JSON.parse(await readFile(resolve(gameRoot, 'package.json'), 'utf8'));
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), ['jspsych', 'pixi.js', 'react', 'react-dom', 'tone']);
  assert.ok(manifest.rehabTrainer.capabilities.includes('hand-tracking'));
});

test('gesture configuration retains all defaults, ranges and input steps', async () => {
  const { IsGestureConfig, defaultGestureConfig } = await LoadModule('config.ts');
  assert.deepEqual(defaultGestureConfig, { enemyMaxHp: 10, holdDurationSec: 2, strictnessPercent: 70, targetMode: 'free' });
  assert.equal(IsGestureConfig(defaultGestureConfig), true);
  for (const config of [
    { enemyMaxHp: 1, holdDurationSec: 0.5, strictnessPercent: 50, targetMode: 'directed' },
    { enemyMaxHp: 100, holdDurationSec: 10, strictnessPercent: 90, targetMode: 'free' },
  ]) assert.equal(IsGestureConfig(config), true);
  for (const [key, values] of Object.entries({ enemyMaxHp: [0, 101, 1.5, NaN],
    holdDurationSec: [0, 10.5, 0.75, Infinity], strictnessPercent: [45, 95, 72], targetMode: ['other', null] })) {
    for (const value of values) assert.equal(IsGestureConfig({ ...defaultGestureConfig, [key]: value }), false, `${key}: ${value}`);
  }
});

test('input frames require private nonce, increasing sequence and bounded xyz coordinates', async () => {
  const { AcceptHandInput } = await LoadModule('runtime/handInput.ts');
  const state = { sessionNonce: 'a'.repeat(64), sequence: -1 };
  const message = { schema: 'trainerhub.input/v1', sessionNonce: state.sessionNonce, sequence: 0, type: 'frame',
    payload: { timestamp: 100, landmarks: Array.from({ length: 21 }, () => ({ x: 0.1, y: 0.2, z: -0.3 })) } };
  assert.equal(AcceptHandInput(message, { ...state }), true);
  for (const change of [{ sessionNonce: 'b'.repeat(64) }, { sequence: -1 }, { schema: 'unknown' },
    { payload: { ...message.payload, image: 'private' } },
    { payload: { ...message.payload, landmarks: [{ x: NaN, y: 0, z: 0 }] } },
    { payload: { ...message.payload, landmarks: Array.from({ length: 21 }, () => ({ x: 100, y: 0, z: 0 })) } }]) {
    assert.equal(AcceptHandInput({ ...message, ...change }, { ...state }), false);
  }
  assert.equal(AcceptHandInput(message, state), true);
  assert.equal(AcceptHandInput(message, state), false);
  assert.equal(AcceptHandInput({ ...message, sequence: 1, payload: { timestamp: 200, landmarks: [] } }, state), true);
});

test('gesture bridge accepts one parent port, rejects forged input and cancels unfinished startup', async () => {
  const { AcceptHandInput } = await LoadModule('runtime/handInput.ts');
  const listeners = new Map();
  const events = [];
  const sent = [];
  const parent = {};
  const window = { parent, setTimeout, clearTimeout,
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: type => listeners.delete(type),
    dispatchEvent: event => { events.push(event); listeners.get(event.type)?.(event); },
  };
  const module = { exports: {} };
  const source = ts.transpileModule(await readFile(resolve(gameRoot, 'runtime/hubBridge.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('module', 'exports', 'require', 'window', 'document', source)(module, module.exports,
    path => path.endsWith('package.json') ? { version: '2.0.3' } : { AcceptHandInput }, window,
    { referrer: 'https://trainerhub.cc/' });
  const bridge = module.exports;
  bridge.InstallHubBridge();
  const init = listeners.get('message');
  const port = { postMessage: message => sent.push(message), start() {} };
  const message = { schema: 'trainerhub.game/v1', type: 'init', gameId: 'gesture-battler',
    version: '2.0.3', sessionNonce: 'a'.repeat(64), language: 'en' };
  init({ data: message, source: {}, origin: 'https://trainerhub.cc', ports: [port] });
  init({ data: message, source: parent, origin: 'https://evil.example', ports: [port] });
  assert.deepEqual(sent, []);
  init({ data: message, source: parent, origin: 'https://trainerhub.cc', ports: [port] });
  assert.equal(bridge.GetGameLanguage(), 'en');
  assert.equal(bridge.IsHubGame(), true);
  assert.equal(sent[0].type, 'ready');
  assert.equal(listeners.has('message'), false);
  const frame = { schema: 'trainerhub.input/v1', sessionNonce: message.sessionNonce,
    sequence: 0, type: 'frame', payload: { timestamp: 100, landmarks: [] } };
  port.onmessage({ data: { ...frame, sessionNonce: 'b'.repeat(64) } });
  port.onmessage({ data: frame });
  port.onmessage({ data: frame });
  assert.equal(events.filter(event => event.type === 'game:input').length, 1);
  const pending = bridge.StartHandInput();
  bridge.StopHandInput();
  await assert.rejects(pending, /cancelled/);
  assert.equal(listeners.has('game:input'), false);
  assert.deepEqual(sent.slice(-2).map(message => message.type), ['input-start', 'input-stop']);
});

async function LoadModule(path) {
  const source = await readFile(resolve(gameRoot, path), 'utf8');
  const module = { exports: {} };
  new Function('module', 'exports', ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(module, module.exports);
  return module.exports;
}

test('mobile touch layout for gesture-battler', async () => {
  const css = await readFile(new URL('../apps/rehabtrainerhub/games/gesture-battler/game.css', import.meta.url), 'utf8');
  assert.match(css, /\.gesture-mobile-back\s*\{[^}]*min-width: 44px/);
  assert.match(css, /\.gesture-camera > span\s*\{[^}]*font-size: .875rem/);
});
