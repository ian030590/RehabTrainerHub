import assert from 'node:assert/strict';
import { readFile, access, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { createHash } from 'node:crypto';
import { AcceptGameMessage } from '../packages/ui/src/selfContainedGame.js';

const root = resolve(import.meta.dirname, '..');
const gameRoot = resolve(root, 'apps/rehabtrainerhub/games/hart-chart');
async function Load(path) {
  const module = { exports: {} };
  new Function('module', 'exports', ts.transpileModule(await readFile(resolve(gameRoot, path), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(module, module.exports);
  return module.exports;
}

test('Hart settings preserve both original defaults, every size and the decoder count boundaries', async () => {
  const { defaultSettings, ValidateSettings, ChartScale } = await Load('settings.ts');
  assert.deepEqual(defaultSettings, { rounds: 10, chartSize: 'medium' });
  const original = JSON.parse(await readFile(resolve(root, 'scripts/fixtures/hart-chart/settings.json'), 'utf8'));
  assert.deepEqual(defaultSettings, Object.fromEntries(original.sections.flatMap(section => section.fields).map(field => [field.key, field.default])));
  for (const chartSize of ['small', 'medium', 'large']) for (const rounds of [5, 10, 15, 20, 25, 30]) {
    assert.equal(ValidateSettings({ chartSize, rounds }), true);
    assert.equal(ChartScale(chartSize), { small: .75, medium: 1, large: 1.25 }[chartSize]);
  }
  for (const settings of [{ rounds: 0 }, { rounds: 31 }, { rounds: 6 }, { rounds: '10' }, { rounds: NaN }, { chartSize: 'huge' }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...settings }), false);
  }
});

test('original seeded chart, decoder coordinates, exact requested count and zoom remain usable', async () => {
  const source = (await readFile(resolve(gameRoot, 'logic/hartChart.ts'), 'utf8')).replace(/\r\n/g, '\n');
  assert.equal(createHash('sha256').update(source).digest('hex'), 'd76e529b7e6e4d657b292f0dd3b846f7c2201cd2e59af17767215ca11130e736');
  const { CreateHartChart, CreateHartDecoder, ClampHartScale } = await Load('logic/hartChart.ts');
  for (const seed of [1, 42, 12345678]) {
    const chart = CreateHartChart(seed);
    assert.equal(chart.length, 100);
    assert.deepEqual(CreateHartChart(seed), chart);
    for (const count of [5, 10, 30]) {
      const decoder = CreateHartDecoder(chart, seed, count);
      assert.equal(decoder.tokens.filter(token => token.coordinate).length, count);
      for (const token of decoder.tokens.filter(token => token.coordinate)) {
        assert.equal(chart.find(cell => cell.row === token.coordinate.row && cell.col === token.coordinate.col).char, token.char);
      }
    }
  }
  assert.equal(ClampHartScale(0), .65); assert.equal(ClampHartScale(2), 1.45);
});

test('Hart numeric results preserve all five original summary and round values without phrase or identity data', async () => {
  const { BuildGameScore } = await Load('score.ts');
  const score = BuildGameScore({ durationMs: 2500, targetCount: 10, attempts: 12, accuracy: 83, hintsUsed: true });
  assert.deepEqual(score.summary, { durationMs: 2500, targets: 10, attempts: 12, accuracy: 83, hints: 1 });
  assert.deepEqual(score.rounds, [score.summary]);
  const original = JSON.parse(await readFile(resolve(root, 'scripts/fixtures/hart-chart/score.json'), 'utf8'));
  assert.deepEqual(Object.keys(score.summary).sort(), original.summary.map(field => field.key).sort());
  assert.deepEqual(Object.keys(score.rounds[0]).sort(), original.columns.map(field => field.key).sort());
  const state = { gameId: 'hart-chart', version: '2.0.0', sessionNonce: 'a'.repeat(64), sequence: -1, complete: false };
  const message = { schema: 'trainerhub.game/v1', ...state, sequence: 0, type: 'result', payload: { config: { rounds: 10, chartSize: 'medium' }, score } };
  delete message.complete;
  assert.equal(AcceptGameMessage(message, state), true);
  assert.equal(AcceptGameMessage(message, state), false);
  const empty = BuildGameScore(null);
  assert.deepEqual(empty.rounds, []);
  assert.ok(Object.values(empty.summary).every(value => value === null));
});

test('Hart owns its runtime, catalogue, settings and full results and is excluded from Hub bundles', async () => {
  const pkg = JSON.parse(await readFile(resolve(gameRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '2.0.3');
  for (const name of ['react', 'react-dom', 'jspsych', 'qrcode']) assert.ok(pkg.dependencies[name], name);
  assert.ok(pkg.rehabTrainer.capabilities.includes('settings-storage'));
  for (const file of await readdir(gameRoot, { recursive: true })) {
    if (!/\.(tsx?|css)$/.test(file) || /^(dist|node_modules)[\\/]/.test(file)) continue;
    assert.doesNotMatch(await readFile(resolve(gameRoot, file), 'utf8'), /@rehab-trainer\/|localStorage|SaveTrainingRecord|react-router-dom/, file);
  }
  for (const name of ['settings.json', 'score.json']) await assert.rejects(access(resolve(gameRoot, name)));
  const registry = JSON.parse(await readFile(resolve(root, 'packages/ui/src/officialGameReleases.json'), 'utf8'));
  assert.equal(registry['hart-chart'].origin, 'https://trainerhubgames.rainbowh9490.workers.dev');
  const hub = JSON.parse(await readFile(resolve(root, 'apps/rehabtrainerhub/package.json'), 'utf8'));
  assert.equal(hub.dependencies[pkg.name], undefined);
  const metadata = JSON.parse(await readFile(resolve(gameRoot, 'public/game.json'), 'utf8'));
  assert.equal(metadata.trainer, 'vision'); assert.equal(metadata.category, 'vision');
  assert.deepEqual(await readFile(resolve(gameRoot, 'public', metadata.preview)), await readFile(resolve(root, 'apps/rehabtrainerhub/public/assets/training-modules/hart-chart.webp')));
});

test('Hart private bridge rejects forged initialization and replays settings and language from the valid parent only', async () => {
  const listeners = new Map(), events = [], sent = [], parent = {};
  const window = { parent, addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: name => listeners.delete(name), dispatchEvent: event => events.push(event) };
  const module = { exports: {} };
  const document = { referrer: 'https://trainerhub.cc/', fullscreenElement: null };
  new Function('require','module','exports','window','document', ts.transpileModule(await readFile(resolve(gameRoot,'runtime/hubBridge.ts'),'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(name => name.endsWith('package.json') ? { version: '2.0.0' } : { DisposeAudioFeedback() {} }, module, module.exports, window, document);
  const api = module.exports;
  api.InstallHubBridge();
  const port = { start() {}, postMessage: message => sent.push(message) };
  const event = { source: parent, origin: 'https://trainerhub.cc', ports: [port], data: {
    schema: 'trainerhub.game/v1', type: 'init', gameId: 'hart-chart', version: '2.0.0', sessionNonce: 'a'.repeat(64),
    language: 'en', settings: { rounds: 5, chartSize: 'small' } } };
  for (const change of [{ source: {} }, { origin: 'https://evil.example' }, { ports: [] },
    { data: { ...event.data, gameId: 'other' } }, { data: { ...event.data, version: '1.0.0' } },
    { data: { ...event.data, sessionNonce: 'bad' } }]) {
    listeners.get('message')({ ...event, ...change }); assert.equal(api.IsHubGame(), false);
  }
  listeners.get('message')(event);
  assert.equal(api.IsHubGame(), true); assert.equal(api.GetGameLanguage(), 'en');
  let restored; api.OnSavedSettings(settings => { restored = settings; });
  assert.deepEqual(restored, { rounds: 5, chartSize: 'small' });
  const count = events.length;
  port.onmessage({ data: { schema: 'trainerhub.game/v1', sessionNonce: 'b'.repeat(64), type: 'saved', state: 'saved' } });
  assert.equal(events.length, count);
  api.SaveGameSettings(restored); api.RetryGameSave(); await api.ExitGame();
  assert.deepEqual(sent.map(message => [message.type, message.sequence]), [['ready',0],['settings',1],['retry',2],['exit',3]]);
});

async function LoadFunction(file, name, context) {
  const source = await readFile(resolve(gameRoot, file), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) expression = node.initializer.getText(ast);
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) expression = node.getText(ast).replace('export ', '');
    ts.forEachChild(node, visit);
  };
  visit(ast); assert.ok(expression, name);
  const js = ts.transpileModule(`const action = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(context), `${js}; return action;`)(...Object.values(context));
}

test('Hart keeps the taught chart when starting after fullscreen, and cancels a late start without activity or results', async () => {
  for (const cancelled of [false,true]) {
    let resolveFullscreen;
    const pendingFullscreen = new Promise(resolve => { resolveFullscreen = resolve; });
    const actions = [];
    const context = { phaseRef: { current: 'rules' }, tourFinished: true, settings: {}, ValidateSettings: () => true,
      generationRef: { current: 0 }, fullscreenRootRef: { current: { requestFullscreen: () => pendingFullscreen } },
      PrepareAudioFeedback() {},
      document: { fullscreenElement: {}, exitFullscreen: async () => actions.push('exit-fullscreen') },
      resetChart: () => actions.push('reset'), setDecoderOpen() {}, setShowHints() {},
      SendGameEvent: type => actions.push(type), setPhase: phase => actions.push(phase) };
    const start = await LoadFunction('HartChartPage.tsx','startTraining', context);
    const pending = start(); assert.deepEqual(actions, []);
    if (cancelled) { context.generationRef.current++; context.phaseRef.current = 'menu'; }
    resolveFullscreen(); await pending;
    assert.deepEqual(actions, cancelled ? ['exit-fullscreen'] : ['active','playing']);
  }
});

test('Hart exit waits for fullscreen cleanup before returning to Hub or standalone settings', async () => {
  for (const embedded of [true,false]) {
    let resolveFullscreen;
    const actions = [];
    const context = { document: { fullscreenElement: {}, exitFullscreen: () => new Promise(resolve => { resolveFullscreen = resolve; }) },
      port: embedded ? {} : null, DisposeAudioFeedback() {}, SendGameEvent: type => actions.push(type), window: { dispatchEvent: event => actions.push(event.type) }, Event };
    const exit = await LoadFunction('runtime/hubBridge.ts','ExitGame',context);
    const pending = exit(); assert.deepEqual(actions, []);
    resolveFullscreen(); await pending;
    assert.deepEqual(actions,[embedded ? 'exit' : 'game:configure']);
  }
});
