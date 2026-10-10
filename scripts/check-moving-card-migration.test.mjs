import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const gameRoot = resolve(root, 'apps/rehabtrainerhub/games/moving-card');
const originalPreviewSha256 = 'e14346b7bef3fba14f82f9c377fde9d0709c529d75f5cc23ef5e81652180e2b6';

test('moving-card releases a failed renderer and can retry initialization', async () => {
  const applications = [];
  class Application {
    constructor() { this.renderer = {}; this.destroyed = false; applications.push(this); }
    async init() { if (applications.length === 1) throw new Error('Renderer initialization failed'); }
    destroy() { this.destroyed = true; }
  }
  const module = { exports: {} };
  const dependencies = { 'pixi.js': { Application }, 'pixi.js/unsafe-eval': {}, './theme': { pixiColors: {} } };
  new Function('require', 'module', 'exports', 'window', ts.transpileModule(
    await readFile(resolve(gameRoot, 'runtime/pixiPool.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText)(name => dependencies[name], module, module.exports, { devicePixelRatio: 1 });
  await assert.rejects(module.exports.WarmUpPixiTrainingRuntime('moving-card'), /initialization failed/);
  assert.equal(applications[0].destroyed, true);
  await module.exports.WarmUpPixiTrainingRuntime('moving-card');
  assert.equal(applications.length, 2);
  module.exports.DestroyPixiTrainingRuntime('moving-card');
  assert.equal(applications[1].destroyed, true);
});

test('moving card retains every original setting, boundary and calibrated millimeter conversion', async () => {
  const { defaultSettings, ValidateSettings, PixelFromMillimeter } = await import('../apps/rehabtrainerhub/games/moving-card/settings.ts');
  assert.deepEqual(defaultSettings, { difficulty: 'medium', rounds: 10, soundEnabled: true,
    optionCount: 18, optionMoveIntervalMs: 800, targetPhysicalSizeMm: 15, optionPhysicalSizeMm: 10,
    calibrationLengthMm: 149 });
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const patch of [{ rounds: 5, optionCount: 4, optionMoveIntervalMs: 200, targetPhysicalSizeMm: 2, optionPhysicalSizeMm: 2 },
      { rounds: 40, optionCount: 40, optionMoveIntervalMs: 5000, targetPhysicalSizeMm: 100, optionPhysicalSizeMm: 80 }]) {
      assert.equal(ValidateSettings({ ...defaultSettings, difficulty, ...patch }), true);
    }
  }
  for (const patch of [{ difficulty: 'wrong' }, { rounds: 4 }, { rounds: 41 }, { rounds: 6 },
    { optionCount: 3 }, { optionCount: 41 }, { optionMoveIntervalMs: 199 }, { optionMoveIntervalMs: 5001 },
    { optionMoveIntervalMs: 250 }, { targetPhysicalSizeMm: 1 }, { targetPhysicalSizeMm: 101 },
    { optionPhysicalSizeMm: 81 }, { soundEnabled: 'false' }, { calibrationLengthMm: 0 }, { calibrationLengthMm: Infinity }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...patch }), false, JSON.stringify(patch));
  }
  assert.equal(PixelFromMillimeter(15, defaultSettings.calibrationLengthMm), 15 * 700 / 149);
  assert.equal(PixelFromMillimeter(15, 175), 60);
});

test('moving card saves the complete original numeric trial fields and distinguishes missing data from zero', async () => {
  const { BuildGameScore } = await import('../apps/rehabtrainerhub/games/moving-card/score.ts');
  const rows = [{ trial_type: 'pixi-moving-card', correct: true, rt: 0, attempts: 1, wrong_attempts: 0 },
    { trial_type: 'pixi-moving-card', correct: true, rt: 3000, attempts: 3, wrong_attempts: 2 },
    { trial_type: 'pixi-moving-card', correct: false, rt: null, attempts: 0, wrong_attempts: 0 },
    { trial_type: 'unrelated', correct: true, rt: 1 }];
  const score = BuildGameScore(rows);
  assert.deepEqual(score.summary, { trials: 3, completed: 2 });
  assert.deepEqual(score.rounds, [{ completed: 1, searchMs: 0, attempts: 1, errors: 0 },
    { completed: 1, searchMs: 3000, attempts: 3, errors: 2 },
    { completed: 0, searchMs: null, attempts: 0, errors: 0 }]);
  const { AcceptGameMessage } = await import('../packages/ui/src/selfContainedGame.js');
  const state = { gameId: 'moving-card', version: '2.0.0', sessionNonce: 'a'.repeat(64), sequence: -1, complete: false };
  assert.equal(AcceptGameMessage({ schema: 'trainerhub.game/v1', gameId: state.gameId, version: state.version, sessionNonce: state.sessionNonce, sequence: 0, type: 'result',
    payload: { config: { difficulty: 'medium', rounds: 5 }, score } }, state), true);
  const { CalculateScoreStatistics } = await import('../apps/rehabtrainerhub/games/moving-card/scoreStatistics.ts');
  assert.deepEqual(CalculateScoreStatistics([0, null, 3000]), {
    observations: 2, mean: 1500, median: 1500, sampleSd: Math.sqrt(4500000), minimum: 0, maximum: 3000 });
  assert.equal(CalculateScoreStatistics([]).mean, null);
  assert.equal(CalculateScoreStatistics([0]).sampleSd, null);
});

test('moving card owns dependencies, UI and exact original preview and is excluded from the Hub bundle', async () => {
  for (const file of (await readdir(gameRoot, { recursive: true })).filter(file => /\.(?:tsx?|css|js)$/.test(file) && !/^(?:dist|node_modules)[\\/]/.test(file))) {
    assert.doesNotMatch(await readFile(resolve(gameRoot, file), 'utf8'), /@rehab-trainer\/|packages\/ui|SaveTrainingRecord|GetHostedGameSetting/, file);
  }
  for (const file of ['settings.json', 'score.json', 'exportCsv.ts', 'results/DefaultTrainingResults.tsx']) await assert.rejects(access(resolve(gameRoot, file)));
  const pkg = JSON.parse(await readFile(resolve(gameRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '2.0.0');
  assert.deepEqual(pkg.rehabTrainer?.capabilities, ['audio', 'fullscreen', 'keyboard', 'pointer', 'touch']);
  for (const name of ['react', 'react-dom', 'pixi.js', 'jspsych']) assert.ok(pkg.dependencies[name]);
  const hub = JSON.parse(await readFile(resolve(root, 'apps/rehabtrainerhub/package.json'), 'utf8'));
  assert.equal(hub.dependencies[pkg.name], undefined);
  const metadata = JSON.parse(await readFile(resolve(gameRoot, 'public/game.json'), 'utf8'));
  assert.equal(metadata.trainer, 'vision'); assert.equal(metadata.category, 'vision');
  assert.equal(metadata.copy['zh-TW'].title, '移動卡片訓練');
  assert.equal(createHash('sha256').update(await readFile(resolve(gameRoot, 'public', metadata.preview))).digest('hex'), originalPreviewSha256);
});

async function LoadPlugin() {
  const source = await readFile(resolve(gameRoot, 'pixi-moving-card.ts'), 'utf8');
  const timers = new Map(); const frames = new Map(); const listeners = new Map(); const finished = [];
  let nextId = 1; let now = 0;
  class Container {
    children = []; events = {}; x = 0; y = 0; rotation = 0;
    pivot = { set() {} }; anchor = { set() {} };
    addChild(...children) { this.children.push(...children); }
    on(name, handler) { this.events[name] = handler; }
    destroy() { this.destroyed = true; }
  }
  class Graphics extends Container {
    clear() { return this; } rect() { return this; } fill() { return this; }
    roundRect() { return this; } stroke() { return this; } moveTo() { return this; } lineTo() { return this; }
  }
  class Text extends Container {
    constructor(options = {}) { super(); Object.assign(this, { style: {}, ...options }); }
  }
  const app = { stage: new Container(), screen: { width: 390, height: 844 }, renderer: { on(name, handler) { listeners.set(name, handler); }, off(name) { listeners.delete(name); } } };
  const wrapper = { appendChild() {} };
  const pool = { pixiRuntimeScopes: { movingCard: 'moving-card' }, CreatePixiTrialContainer: () => wrapper,
    RunPixiTrial: (_scope, _display, run) => run(app), AttachPixiTrialCanvas() {}, CleanupPixiTrial() {} };
  const mathSource = await readFile(resolve(root, 'packages/ui/src/mathUtils.ts'), 'utf8');
  const mathModule = { exports: {} };
  new Function('module', 'exports', ts.transpileModule(mathSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(mathModule, mathModule.exports);
  const dependencies = { jspsych: { ParameterType: {} }, 'pixi.js': { Container, Graphics, Text },
    '@rehab-trainer/ui/trainerTheme': { pixiColors: {}, typography: { fontSizeM: 18 } },
    './runtime/theme': { pixiColors: {}, typography: { fontSizeM: 18 } },
    '@rehab-trainer/ui/mathUtils': mathModule.exports, './gameUtils': mathModule.exports,
    '@rehab-trainer/ui/spatialUtils': { PixelFromMillimeter: value => value * 700 / 149 },
    './settings': { PixelFromMillimeter: value => value * 700 / 149 },
    './runtime/soundManager': { soundManager: { playSuccess() {}, playFailure() {} } },
    './runtime/pixiPool': pool };
  const window = { addEventListener: (name, handler) => listeners.set(name, handler), removeEventListener: name => listeners.delete(name),
    getComputedStyle: () => ({}) };
  const document = { createElement: () => ({ style: {}, setAttribute() {} }) };
  const schedule = handler => { const id = nextId++; timers.set(id, handler); return id; };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'window', 'document', 'performance', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame',
    ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(
    name => { assert.ok(name in dependencies, name); return dependencies[name]; }, module, module.exports, window, document,
    { now: () => now }, schedule, id => timers.delete(id), schedule, id => timers.delete(id),
    handler => { const id = nextId++; frames.set(id, handler); return id; }, id => frames.delete(id));
  const plugin = new module.exports.default({ finishTrial: data => finished.push(data) });
  const start = (count = 18, difficulty = 'beginner') => plugin.trial({ isConnected: true }, { target_letters: 'AB', option_count: count,
    difficulty, move_interval_ms: 800, target_size_mm: 15, option_size_mm: 10, round_number: 1, total_rounds: 5, language: 'en', calibration_length_mm: 149 });
  return { app, timers, frames, listeners, finished, start, setNow: value => { now = value; },
    options: () => app.stage.children.at(-1).children,
    flushFeedback: () => { for (const [id, callback] of [...timers]) if (id > 1) { timers.delete(id); callback(); } } };
}

test('original moving-card gameplay keeps wrong selections retryable and times the complete search', async () => {
  const game = await LoadPlugin(); game.start();
  const options = game.options(); assert.equal(options.length, 18);
  const find = letters => options.find(option => option.children[1].text === letters);
  game.setNow(100); options.find(option => option !== find('AB')).events.pointertap();
  game.flushFeedback(); assert.equal(game.finished.length, 0);
  game.setNow(2000); find('AB').events.pointertap(); game.flushFeedback();
  assert.deepEqual(game.finished, [{ rt: 2000, correct: true, attempts: 2, wrong_attempts: 1, target: 'AB', response: 'AB' }]);
  assert.equal(game.timers.size, 0); assert.equal(game.listeners.size, 0);
});

test('every allowed card count renders all choices and a reachable target at all difficulty levels', async () => {
  for (const difficulty of ['beginner', 'intermediate', 'advanced']) {
    const game = await LoadPlugin(); game.start(40, difficulty);
    assert.equal(game.options().length, 40, difficulty);
    assert.equal(game.options().filter(option => option.children[1].text === 'AB').length, 1);
  }
});

test('aborting a trial removes movement, feedback, resize and input callbacks without producing a result', async () => {
  const game = await LoadPlugin(); game.start();
  game.options()[0].events.pointertap();
  assert.ok(game.timers.size >= 2);
  assert.ok(game.listeners.has('game:abort'), 'Game lifecycle provides explicit trial cancellation.');
  game.listeners.get('game:abort')();
  assert.equal(game.timers.size, 0); assert.equal(game.frames.size, 0); assert.equal(game.listeners.size, 0);
  game.flushFeedback(); assert.equal(game.finished.length, 0);
});

test('the timeline passes the same validated settings to every actual jsPsych round', async () => {
  const settings = await import('../apps/rehabtrainerhub/games/moving-card/settings.ts');
  const source = await readFile(resolve(gameRoot, 'timeline/movingCardTimeline.ts'), 'utf8');
  const module = { exports: {} };
  const plugin = class {};
  const dependencies = { '../settings': settings, '../gameUtils': { GenerateRandomLetters: () => 'AB' }, '../pixi-moving-card': { default: plugin } };
  new Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(
    name => dependencies[name], module, module.exports);
  const selected = { ...settings.defaultSettings, difficulty: 'hard', rounds: 40, optionCount: 40, calibrationLengthMm: 175 };
  const timeline = module.exports.BuildMovingCardTimeline(selected, 'en');
  assert.equal(timeline.length, 40);
  assert.deepEqual(timeline[39], { type: plugin, target_letters: 'AB', option_count: 40, difficulty: 'advanced',
    move_interval_ms: 800, target_size_mm: 15, option_size_mm: 10, calibration_length_mm: 175, language: 'en', round_number: 40, total_rounds: 40 });
  assert.throws(() => module.exports.BuildMovingCardTimeline({ ...selected, rounds: 6 }, 'en'));
});

test('moving-card bridge binds once to the parent private port and ignores forged initialization and acknowledgements', async () => {
  const source = await readFile(resolve(gameRoot, 'runtime/hubBridge.ts'), 'utf8');
  const listeners = new Map();
  const events = [];
  const parent = {};
  const window = { parent, addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener: type => listeners.delete(type), dispatchEvent: event => events.push(event) };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'window', 'document', ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(() => ({ version: '2.0.1' }), module, module.exports, window, { referrer: 'https://trainerhub.cc/' });
  module.exports.InstallHubBridge();
  assert.equal(module.exports.GetGameLanguage(), null);
  const sent = [];
  const port = { postMessage: message => sent.push(message), start: () => {}, onmessage: null };
  const event = { source: parent, origin: 'https://trainerhub.cc', ports: [port], data: {
    schema: 'trainerhub.game/v1', type: 'init', gameId: 'moving-card', version: '2.0.1', sessionNonce: 'a'.repeat(64), language: 'en' } };
  for (const changes of [{ source: {} }, { origin: 'https://evil.example' }, { ports: [] },
    { data: { ...event.data, version: '1.0.0' } }, { data: { ...event.data, sessionNonce: 'invalid' } }]) {
    listeners.get('message')({ ...event, ...changes });
    assert.equal(module.exports.IsHubGame(), false);
  }
  listeners.get('message')(event);
  assert.equal(module.exports.IsHubGame(), true);
  assert.equal(module.exports.GetGameLanguage(), 'en', 'Retain init language for a provider that mounts later.');
  assert.equal(sent[0].type, 'ready');
  assert.equal(sent[0].gameId, 'moving-card');
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
