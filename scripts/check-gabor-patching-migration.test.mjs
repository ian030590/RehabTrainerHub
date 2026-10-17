import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const gameRoot = resolve(root, 'apps/rehabtrainerhub/games/gabor-patching');

async function LoadModule(file, dependencies = {}, globals = {}) {
  const module = { exports: {} };
  const source = await readFile(resolve(gameRoot, file), 'utf8');
  new Function('require', 'module', 'exports', ...Object.keys(globals), ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(name => { assert.ok(name in dependencies, name); return dependencies[name]; }, module, module.exports, ...Object.values(globals));
  return module.exports;
}

test('Gabor keeps the original three difficulty conditions and every parameter boundary', async () => {
  const { defaultSettings, ValidateSettings } = await LoadModule('settings.ts');
  assert.deepEqual(defaultSettings, { difficulty: 'medium', durationSec: 60, maxSpots: 8, soundEnabled: true });
  const legacy = JSON.parse(await readFile(resolve(root, 'scripts/fixtures/gabor-patching-legacy.json'), 'utf8'));
  for (const field of legacy.settings.sections.flatMap(section => section.fields)) assert.equal(defaultSettings[field.key], field.default);
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const durationSec of [30, 60, 180]) for (const maxSpots of [3, 8, 20]) {
      assert.equal(ValidateSettings({ ...defaultSettings, difficulty, durationSec, maxSpots }), true);
    }
  }
  for (const patch of [{ difficulty: 'wrong' }, { durationSec: 29 }, { durationSec: 181 }, { durationSec: 31 },
    { durationSec: NaN }, { maxSpots: 2 }, { maxSpots: 21 }, { maxSpots: 3.5 }, { soundEnabled: 'false' }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...patch }), false);
  }
  const timeline = await LoadModule('timeline/gaborPatchingTimeline.ts', {
    '../settings': { ValidateSettings }, '../pixi-gabor-patching': { default: class Plugin {} },
  });
  for (const [difficulty, engine] of [['easy', 'beginner'], ['medium', 'intermediate'], ['hard', 'advanced']]) {
    const [trial] = timeline.BuildGaborPatchingTimeline({ ...defaultSettings, difficulty, durationSec: 180, maxSpots: 20 }, 'en');
    assert.equal(trial.duration_ms, 180000); assert.equal(trial.max_spots, 20);
    assert.equal(trial.difficulty, engine); assert.equal(trial.language, 'en');
  }
  assert.throws(() => timeline.BuildGaborPatchingTimeline({ ...defaultSettings, durationSec: 31 }, 'zh'));
});

test('Gabor preserves original aggregate numbers and saves actual patch records without inventing misses or reaction times', async () => {
  const { BuildGameScore } = await LoadModule('score.ts');
  const patchRecords = [
    { patch: 1, type: 0, outcome: 1, spawnedMs: 0, endedMs: 1000, reactionMs: 1000, points: 750, lifetimeMs: 4000 },
    { patch: 2, type: 1, outcome: 0, spawnedMs: 0, endedMs: 4000, reactionMs: null, points: 0, lifetimeMs: 4000 },
    { patch: 3, type: 2, outcome: 2, spawnedMs: 28000, endedMs: 30000, reactionMs: null, points: 0, lifetimeMs: 4000 },
  ];
  const score = BuildGameScore([{ trial_type: 'pixi-gabor-patching', score: 750, acquired_targets: 1, duration_ms: 30000, patchRecords },
    { trial_type: 'unrelated', score: 999 }]);
  assert.deepEqual(score.summary, { score: 750, hits: 1, durationMs: 30000 });
  assert.deepEqual(score.rounds, patchRecords);
  const { CalculateScoreStatistics } = await LoadModule('scoreStatistics.ts');
  assert.equal(CalculateScoreStatistics([0, null, 4]).mean, 2);
  assert.equal(CalculateScoreStatistics([]).mean, null);
  assert.equal(CalculateScoreStatistics([0]).sampleSd, null);
  const empty = BuildGameScore([]);
  assert.deepEqual(empty, { schema: 'rehab-trainer.game-score/v1', gameId: 'gabor-patching',
    summary: { score: null, hits: null, durationMs: null }, rounds: [] });
  const { AcceptGameMessage } = await import('../packages/ui/src/selfContainedGame.js');
  assert.equal(AcceptGameMessage({ schema: 'trainerhub.game/v1', gameId: 'gabor-patching', version: '2.0.0',
    sessionNonce: 'a'.repeat(64), sequence: 0, type: 'result', payload: { config: { difficulty: 'easy', durationSec: 30, maxSpots: 3 }, score } },
  { gameId: 'gabor-patching', version: '2.0.0', sessionNonce: 'a'.repeat(64), sequence: -1, complete: false }), true);
});

test('Gabor owns UI, dependencies, metadata and the exact original preview; the Hub excludes its bundle', async () => {
  for (const file of (await readdir(gameRoot, { recursive: true })).filter(file => /\.(tsx?|css|js)$/.test(file) && !/^(dist|node_modules)[\\/]/.test(file))) {
    assert.doesNotMatch(await readFile(resolve(gameRoot, file), 'utf8'), /@rehab-trainer\/|packages\/ui|SaveTrainingRecord|GetHostedGameSetting/, file);
  }
  for (const file of ['settings.json', 'score.json', 'results/GaborResults.tsx']) await assert.rejects(access(resolve(gameRoot, file)));
  const pkg = JSON.parse(await readFile(resolve(gameRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '2.0.2');
  for (const name of ['react', 'react-dom', 'pixi.js', 'jspsych', 'tone']) assert.ok(pkg.dependencies[name]);
  const hub = JSON.parse(await readFile(resolve(root, 'apps/rehabtrainerhub/package.json'), 'utf8'));
  assert.equal(hub.dependencies[pkg.name], undefined);
  const metadata = JSON.parse(await readFile(resolve(gameRoot, 'public/game.json'), 'utf8'));
  assert.equal(metadata.trainer, 'vision'); assert.equal(metadata.category, 'vision');
  assert.equal(metadata.copy['zh-TW'].title, '蓋伯斑塊練習');
  assert.equal(createHash('sha256').update(await readFile(resolve(gameRoot, 'public', metadata.preview))).digest('hex'),
    'b9045dbfdb81944472874e73bee32f2594003337806d88390293e30ad4885de8');
});

async function LoadPlugin(deferred = false) {
  const frames = new Map(), listeners = new Map(), finished = [];
  let now = 0, nextId = 1;
  let initialize;
  let randomState = 17;
  const randomMath = Object.create(Math);
  randomMath.random = () => { randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0; return randomState / 4294967296; };
  class Sprite {
    constructor(texture) { this.texture = texture; }
    events = {}; anchor = { set() {} }; scale = { set: value => { this.size = value; } };
    on(name, handler) { this.events[name] = handler; }
    destroy() { this.destroyed = true; }
  }
  class Text extends Sprite { constructor(options) { super(); Object.assign(this, options); } }
  const app = { screen: { width: 390, height: 844 }, stage: { children: [],
    addChild(sprite) { this.children.push(sprite); }, removeChild(sprite) { this.children = this.children.filter(item => item !== sprite); } },
  renderer: { background: {}, on: (name, fn) => listeners.set(name, fn), off: name => listeners.delete(name) } };
  const display = { isConnected: true };
  const document = { createElement: () => ({ style: {}, classList: { add() {} }, setAttribute() {}, appendChild() {},
    getContext: () => ({ createImageData: size => ({ data: new Uint8Array(size * size * 4) }), putImageData() {} }) }) };
  const pool = { pixiRuntimeScopes: { gaborPatching: 'gabor-patching' }, CreatePixiTrialContainer: () => document.createElement(),
    RunPixiTrial: (_scope, _display, callback) => { initialize = () => callback(app); if (!deferred) initialize(); },
    AttachPixiTrialCanvas() {}, CleanupPixiTrial() {} };
  const module = await LoadModule('pixi-gabor-patching.ts', {
    jspsych: { ParameterType: {} }, 'pixi.js': { Sprite, Text, Texture: { from: () => ({ width: 256, height: 256 }) } },
    './runtime/pixiPool': pool, './runtime/theme': { typography: { fontFamily: 'sans-serif' }, cssColors: { gaborBackground: '#808080' }, pixiColors: {} },
    './runtime/soundManager': { soundManager: { playSuccess() {} } },
    './gaborTexture': { GetGaborTexture: () => ({ width: 256, height: 256 }), DisposeGaborTextures() {},
      gaborTextureSpecs: [{ size: 256, freq: .05, angle: 0 }, { size: 256, freq: .08, angle: Math.PI / 4 }, { size: 256, freq: .03, angle: Math.PI / 2 }] },
  }, { window: { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) },
    document, Math: randomMath, performance: { now: () => now },
    requestAnimationFrame: fn => { const id = nextId++; frames.set(id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id) });
  const plugin = new module.default({ finishTrial: row => finished.push(row) });
  return { app, listeners, frames, finished, plugin, display,
    initialize: () => initialize(),
    start: (difficulty, duration = 30000) => plugin.trial(display, { duration_ms: duration, max_spots: 3, difficulty, language: 'zh' }),
    setNow: value => { now = value; },
    tick: value => { now = value; const pending = [...frames]; frames.clear(); for (const [, fn] of pending) fn(now); } };
}

test('real Gabor gameplay retains scoring and lifetime, records hits/expiry/end separately, and cleans up', async () => {
  for (const [difficulty, lifetimeMs] of [['beginner', 4000], ['intermediate', 3000], ['advanced', 2000]]) {
    const game = await LoadPlugin(); game.start(difficulty);
    assert.equal(game.app.stage.children.length, 3);
    game.tick(1000);
    const target = game.app.stage.children[0];
    assert.ok(Math.abs(target.size - (.2 + 1000 / lifetimeMs * .6)) < .0001);
    assert.ok(Math.abs(target.alpha - 1000 / lifetimeMs * .8) < .0001);
    target.events.pointerdown({ stopPropagation() {} });
    target.events.pointerdown({ stopPropagation() {} });
    assert.equal(game.plugin.hits, 1, 'A stale/double click cannot score twice.');
    game.tick(lifetimeMs);
    game.tick(30000);
    assert.equal(game.finished.length, 1);
    const result = game.finished[0];
    assert.equal(result.score, Math.ceil(1000 * (1 - 1000 / lifetimeMs)));
    assert.equal(result.acquired_targets, 1); assert.equal(result.duration_ms, 30000);
    assert.deepEqual(result.patchRecords[0], { patch: 1, type: result.patchRecords[0].type, outcome: 1,
      spawnedMs: 0, endedMs: 1000, reactionMs: 1000, points: result.score, lifetimeMs });
    assert.equal(result.patchRecords[1].outcome, 0); assert.equal(result.patchRecords[1].reactionMs, null);
    assert.equal(game.frames.size, 0); assert.equal(game.listeners.size, 0);
  }
});

test('aborting Gabor stops input and animation without producing a completed result, even after a pending renderer init', async () => {
  for (const deferred of [false, true]) {
    const game = await LoadPlugin(deferred); game.start('beginner');
    assert.ok(game.listeners.has('game:abort'));
    game.listeners.get('game:abort')();
    if (deferred) game.initialize();
    game.tick(30000);
    assert.equal(game.frames.size, 0); assert.equal(game.listeners.size, 0); assert.equal(game.finished.length, 0);
  }
});

test('a renderer arriving after its display was removed leaves no callbacks or result', async () => {
  const game = await LoadPlugin(true); game.start('beginner');
  game.display.isConnected = false;
  game.initialize();
  assert.equal(game.listeners.size, 0);
  assert.equal(game.frames.size, 0); assert.equal(game.finished.length, 0);
});

test('maximum-duration high-refresh gameplay preserves every patch within the existing result limits', async () => {
  const game = await LoadPlugin(); game.start('advanced', 180000);
  for (let frame = 1; frame <= 180 * 240; frame++) {
    game.tick(frame * 1000 / 240);
    for (const patch of [...game.app.stage.children].filter(sprite => sprite.events.pointerdown && sprite.alpha > 0)) {
      patch.events.pointerdown({ stopPropagation() {} });
    }
  }
  const { BuildGameScore } = await LoadModule('score.ts');
  const score = BuildGameScore([{ ...game.finished[0], trial_type: 'pixi-gabor-patching' }]);
  assert.equal(score.summary.hits, score.rounds.filter(row => row.outcome === 1).length);
  const { IsGameResult } = await import('../packages/ui/src/selfContainedGame.js');
  assert.equal(IsGameResult({ config: { difficulty: 'hard', durationSec: 180, maxSpots: 3 }, score }, 'gabor-patching'), true,
    `All ${score.rounds.length} patch records must remain saveable without truncation.`);
});

test('gabor-patching bridge binds once to the parent private port and ignores forged initialization and acknowledgements', async () => {
  const source = await readFile(resolve(gameRoot, 'runtime/hubBridge.ts'), 'utf8');
  const listeners = new Map();
  const events = [];
  const parent = {};
  const window = { parent, addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener: type => listeners.delete(type), dispatchEvent: event => events.push(event) };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'window', 'document', ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(name => name.endsWith('package.json') ? { version: '2.0.0' } : { DisposeAudioFeedback() {} }, module, module.exports, window, { referrer: 'https://trainerhub.cc/' });
  module.exports.InstallHubBridge();
  assert.equal(module.exports.GetGameLanguage(), null);
  const sent = [];
  const port = { postMessage: message => sent.push(message), start: () => {}, onmessage: null };
  const event = { source: parent, origin: 'https://trainerhub.cc', ports: [port], data: {
    schema: 'trainerhub.game/v1', type: 'init', gameId: 'gabor-patching', version: '2.0.0', sessionNonce: 'a'.repeat(64), language: 'en' } };
  for (const changes of [{ source: {} }, { origin: 'https://evil.example' }, { ports: [] },
    { data: { ...event.data, version: '1.0.0' } }, { data: { ...event.data, sessionNonce: 'invalid' } }]) {
    listeners.get('message')({ ...event, ...changes });
    assert.equal(module.exports.IsHubGame(), false);
  }
  listeners.get('message')(event);
  assert.equal(module.exports.IsHubGame(), true);
  assert.equal(module.exports.GetGameLanguage(), 'en', 'Retain init language for a provider that mounts later.');
  assert.equal(sent[0].type, 'ready');
  assert.equal(sent[0].gameId, 'gabor-patching');
  assert.equal(listeners.has('message'), false);
  events.length = 0;
  port.onmessage({ data: { schema: 'trainerhub.game/v1', sessionNonce: 'b'.repeat(64), type: 'saved', state: 'saved' } });
  assert.equal(events.length, 0);
  port.onmessage({ data: { schema: 'trainerhub.game/v1', sessionNonce: 'a'.repeat(64), type: 'saved', state: 'error' } });
  assert.equal(events[0].detail, 'error');
  module.exports.RetryGameSave();
  module.exports.ExitGame();
  assert.deepEqual(sent.map(message => [message.type, message.sequence]), [['ready', 0], ['retry', 1], ['exit', 2]]);
});
