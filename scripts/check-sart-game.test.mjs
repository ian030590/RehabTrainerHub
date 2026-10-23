import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { AcceptGameMessage } from '../packages/ui/src/selfContainedGame.js';

const root = resolve(import.meta.dirname, '..');
const gameRoot = resolve(root, 'apps/rehabtrainerhub/games/sart');

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

// A manual clock: timers fire only when the test advances time.
function FakeClock() {
  let now = 0, id = 0;
  const timers = new Map();
  return {
    now: () => now,
    set: (callback, ms) => { timers.set(++id, { at: now + Math.max(0, ms), callback }); return id; },
    clear: timer => timers.delete(timer),
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]); now = due[1].at; due[1].callback();
      }
      now = end;
    },
    pending: () => timers.size,
  };
}

test('SART settings keep the classic defaults and reject values outside each range', async () => {
  const { defaultSettings, ValidateSettings, EstimatedSeconds } = await Load('settings.ts');
  assert.deepEqual(defaultSettings, { trials: 135, noGoDigit: 3, digitMs: 250, maskMs: 900 });
  assert.equal(ValidateSettings(defaultSettings), true);
  assert.equal(EstimatedSeconds(defaultSettings), 155);
  for (const trials of [45, 90, 225]) assert.equal(ValidateSettings({ ...defaultSettings, trials }), true);
  for (const noGoDigit of [1, 9]) assert.equal(ValidateSettings({ ...defaultSettings, noGoDigit }), true);
  for (const change of [{ trials: 44 }, { trials: 100 }, { trials: 270 }, { noGoDigit: 0 }, { noGoDigit: 10 }, { noGoDigit: 2.5 },
    { digitMs: 100 }, { digitMs: 450 }, { digitMs: 275 }, { maskMs: 500 }, { maskMs: 1600 }, { maskMs: '900' }, { trials: NaN }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
});

test('every block of nine shows each digit once, so the skip digit stays rare and evenly spread', async () => {
  const { CreateSartTrials, CreateRandom } = await Load('logic/sartTrials.ts');
  for (const seed of [1, 7, 99]) {
    const trials = CreateSartTrials(90, 3, CreateRandom(seed));
    assert.equal(trials.length, 90);
    assert.deepEqual(CreateSartTrials(90, 3, CreateRandom(seed)), trials, 'The same seed repeats the sequence.');
    for (let block = 0; block < 10; block++) {
      assert.deepEqual(trials.slice(block * 9, block * 9 + 9).map(trial => trial.digit).sort(), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }
    assert.equal(trials.filter(trial => trial.noGo).length, 10);
    assert.ok(trials.every(trial => trial.noGo === (trial.digit === 3)));
    for (let index = 1; index < trials.length; index++) assert.notEqual(trials[index].digit, trials[index - 1].digit, 'No digit repeats back to back.');
    assert.ok(new Set(trials.map(trial => trial.size)).size > 1, 'Digit sizes vary so the shape alone does not give the answer.');
  }
});

test('the run shows each digit, masks it on time and records only the first press per digit', async () => {
  const { SartRun } = await Load('logic/sartRun.ts');
  const clock = FakeClock();
  const shown = [];
  let finished = null;
  const trials = [{ digit: 5, noGo: false, size: 1 }, { digit: 3, noGo: true, size: 1 }, { digit: 8, noGo: false, size: 1 }];
  const run = new SartRun(trials, { digitMs: 250, maskMs: 900, leadInMs: 1000 },
    { show: (trial, index) => shown.push(['digit', trial.digit, index, clock.now()]), mask: () => shown.push(['mask', clock.now()]) },
    clock, rows => { finished = rows; });
  run.start();
  run.respond();
  clock.advance(1000);
  assert.deepEqual(shown, [['digit', 5, 0, 1000]], 'Presses during the lead-in are ignored.');
  clock.advance(320); run.respond(); run.respond();
  clock.advance(830 + 1150);
  clock.advance(500); run.respond();
  clock.advance(650);
  assert.deepEqual(shown.map(entry => entry[0] === 'mask' ? entry[1] : entry[3]), [1000, 1250, 2150, 2400, 3300, 3550]);
  assert.deepEqual(finished, [
    { trial: 1, digit: 5, noGo: false, responded: true, rtMs: 320 },
    { trial: 2, digit: 3, noGo: true, responded: false, rtMs: null },
    { trial: 3, digit: 8, noGo: false, responded: true, rtMs: 500 },
  ]);
  assert.equal(clock.pending(), 0);
});

test('stopping a run clears its timers and never reports results', async () => {
  const { SartRun } = await Load('logic/sartRun.ts');
  const clock = FakeClock();
  let finished = false;
  const run = new SartRun([{ digit: 1, noGo: false, size: 1 }], { digitMs: 250, maskMs: 900, leadInMs: 1000 },
    { show() {}, mask() {} }, clock, () => { finished = true; });
  run.start(); clock.advance(1100); run.stop(); clock.advance(5000);
  assert.equal(finished, false);
  assert.equal(clock.pending(), 0);
});

test('SART scoring counts skip-digit presses, missed presses, response speed and its variability', async () => {
  const { SummarizeSart } = await Load('logic/sartScore.ts');
  const go = (rtMs) => ({ noGo: false, responded: rtMs !== null, rtMs });
  const rows = [go(400), go(380), go(360), go(340), { noGo: true, responded: true, rtMs: 300 },
    go(500), go(520), go(null), go(540), { noGo: true, responded: false, rtMs: null }]
    .map((row, index) => ({ trial: index + 1, digit: row.noGo ? 3 : 5, ...row }));
  const summary = SummarizeSart(rows);
  assert.equal(summary.trials, 10);
  assert.equal(summary.noGoTrials, 2);
  assert.equal(summary.commissionErrors, 1);
  assert.equal(summary.omissionErrors, 1);
  assert.equal(summary.accuracyPercent, 80);
  assert.equal(summary.meanGoRtMs, 434);
  assert.equal(summary.goRtSdMs, 83);
  assert.equal(summary.rtCvPercent, 19.1);
  assert.equal(summary.preCommissionRtMs, 370, 'Mean of the four presses before the skip-digit press.');
  assert.equal(summary.preWithholdRtMs, 520, 'Mean of the presses among the four trials before a correct skip.');
  const empty = SummarizeSart([]);
  assert.equal(empty.trials, 0);
  for (const key of ['accuracyPercent', 'meanGoRtMs', 'goRtSdMs', 'rtCvPercent', 'preCommissionRtMs', 'preWithholdRtMs']) assert.equal(empty[key], null, key);
});

test('SART results save bounded numeric rows through the private channel', async () => {
  const sartScore = await Load('logic/sartScore.ts');
  const { BuildGameScore } = await Load('score.ts', { './logic/sartScore': sartScore });
  const score = BuildGameScore([{ trial: 1, digit: 3, noGo: true, responded: true, rtMs: 280 }, { trial: 2, digit: 4, noGo: false, responded: false, rtMs: null }]);
  assert.deepEqual(score.rounds, [
    { trial: 1, digit: 3, noGo: 1, responded: 1, correct: 0, rtMs: 280 },
    { trial: 2, digit: 4, noGo: 0, responded: 0, correct: 0, rtMs: null },
  ]);
  assert.ok(Object.keys(score.summary).length <= 12);
  const state = { gameId: 'sart', version: '1.0.0', sessionNonce: 'a'.repeat(64), sequence: -1, complete: false };
  const message = { schema: 'trainerhub.game/v1', gameId: 'sart', version: '1.0.0', sessionNonce: state.sessionNonce, sequence: 0, type: 'result',
    payload: { config: { trials: 135, noGoDigit: 3, digitMs: 250, maskMs: 900 }, score } };
  assert.equal(AcceptGameMessage(message, state), true);
  assert.equal(AcceptGameMessage(message, state), false, 'A replayed result is rejected.');
});

test('SART owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  const pkg = JSON.parse(await readFile(resolve(gameRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.name, '@rehab-trainer/game-sart');
  assert.equal(pkg.version, '1.0.1');
  for (const name of ['react', 'react-dom', 'jspsych', 'tone']) assert.ok(pkg.dependencies[name], name);
  for (const capability of ['settings-storage', 'keyboard', 'touch', 'fullscreen']) assert.ok(pkg.rehabTrainer.capabilities.includes(capability), capability);
  for (const file of await readdir(gameRoot, { recursive: true })) {
    if (!/\.(tsx?|css)$/.test(file) || /^(dist|node_modules)[\\/]/.test(file)) continue;
    assert.doesNotMatch(await readFile(resolve(gameRoot, file), 'utf8'), /@rehab-trainer\/|localStorage|SaveTrainingRecord|react-router-dom|hart-chart/, file);
  }
  for (const name of ['settings.json', 'score.json']) await assert.rejects(access(resolve(gameRoot, name)));
  const registry = JSON.parse(await readFile(resolve(root, 'packages/ui/src/officialGameReleases.json'), 'utf8'));
  assert.equal(registry.sart.origin, 'https://trainerhubgames.rainbowh9490.workers.dev');
  const hub = JSON.parse(await readFile(resolve(root, 'apps/rehabtrainerhub/package.json'), 'utf8'));
  assert.equal(hub.dependencies[pkg.name], undefined);
  const metadata = JSON.parse(await readFile(resolve(gameRoot, 'public/game.json'), 'utf8'));
  assert.deepEqual([metadata.gameId, metadata.trainer, metadata.category], ['sart', 'brain', 'attention']);
  await access(resolve(gameRoot, 'public', metadata.preview));
  for (const copy of Object.values(metadata.copy)) assert.doesNotMatch(`${copy.title} ${copy.description}`, /治療|診斷|療效|改善|ADHD|過動|treat|diagnos|improve/i);
  const source = await readFile(resolve(gameRoot, 'SartGame.tsx'), 'utf8');
  assert.match(source, /<ScoreAnalysis rounds=\{score\.rounds\}/);
  assert.match(source, /ValidateSettings\(settings\)/);
});

test('SART private bridge accepts only its own parent and replays settings and language', async () => {
  const listeners = new Map(), events = [], sent = [], parent = {};
  const window = { parent, addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: name => listeners.delete(name), dispatchEvent: event => events.push(event) };
  const module = { exports: {} };
  const document = { referrer: 'https://trainerhub.cc/', fullscreenElement: null };
  new Function('require', 'module', 'exports', 'window', 'document', ts.transpileModule(await readFile(resolve(gameRoot, 'runtime/hubBridge.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(name => name.endsWith('package.json') ? { version: '1.0.0' } : { DisposeAudioFeedback() {} }, module, module.exports, window, document);
  const api = module.exports;
  api.InstallHubBridge();
  const port = { start() {}, postMessage: message => sent.push(message) };
  const event = { source: parent, origin: 'https://trainerhub.cc', ports: [port], data: {
    schema: 'trainerhub.game/v1', type: 'init', gameId: 'sart', version: '1.0.0', sessionNonce: 'a'.repeat(64),
    language: 'en', settings: { trials: 45 } } };
  for (const change of [{ source: {} }, { origin: 'https://evil.example' }, { ports: [] },
    { data: { ...event.data, gameId: 'hart-chart' } }, { data: { ...event.data, version: '0.9.0' } }]) {
    listeners.get('message')({ ...event, ...change }); assert.equal(api.IsHubGame(), false);
  }
  listeners.get('message')(event);
  assert.equal(api.IsHubGame(), true); assert.equal(api.GetGameLanguage(), 'en');
  let restored; api.OnSavedSettings(settings => { restored = settings; });
  assert.deepEqual(restored, { trials: 45 });
  api.SaveGameSettings(restored); await api.ExitGame();
  assert.deepEqual(sent.map(message => message.type), ['ready', 'settings', 'exit']);
});
