import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, FakeClock, GameRoot, LoadGameModule, root } from './brain-r2-game-checks.mjs';

const gameId = 'exploratory-saccade';
test('field settling waits for fullscreen and two stable frames, rejects promptly and caps at 1000 ms', async () => {
  const { WaitForField } = await LoadGameModule(gameId, 'logic/fieldSettle.ts');
  const clock = FakeClock(), frames = new Map();
  let id = 0, entered = false, size = { width: 120, height: 120 }, finished = [];
  const source = { ...clock, frame: callback => { frames.set(++id, callback); return id; },
    cancelFrame: handle => frames.delete(handle), size: () => size, entered: () => entered };
  const frame = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); };
  const request = Promise.resolve();
  WaitForField({ ...source, request }, bounds => finished.push(bounds));
  frame(); frame(); frame(); assert.equal(finished.length, 0, 'A resolved request alone does not mean fullscreen was entered.');
  entered = true; frame(); frame(); assert.equal(finished.length, 0);
  size = { width: 1000, height: 650 }; frame(); frame(); assert.equal(finished.length, 0);
  frame(); assert.deepEqual(finished, [size]); assert.equal(clock.pending(), 0); assert.equal(frames.size, 0);

  finished = []; entered = false;
  WaitForField({ ...source, request: Promise.reject(new Error('denied')) }, bounds => finished.push(bounds));
  await Promise.resolve();
  assert.deepEqual(finished, [size]); assert.equal(clock.pending(), 0); assert.equal(frames.size, 0);

  finished = [];
  WaitForField({ ...source, request: new Promise(() => {}) }, bounds => finished.push(bounds));
  clock.advance(999); assert.equal(finished.length, 0);
  size = { width: 900, height: 600 }; clock.advance(1);
  assert.deepEqual(finished, [size]); assert.equal(frames.size, 0);
  finished = []; entered = true;
  WaitForField({ ...source, request }, bounds => finished.push(bounds));
  for (let i = 0; i < 10; i++) { size = { width: 900 + i, height: 600 }; frame(); clock.advance(100); }
  assert.deepEqual(finished, [size], 'Changing sizes cannot extend the cap.');

  finished = [];
  const cancel = WaitForField({ ...source, request: null }, bounds => finished.push(bounds));
  cancel(); clock.advance(1000); frame();
  assert.deepEqual(finished, []); assert.equal(clock.pending(), 0); assert.equal(frames.size, 0);
});

test('failed layout retries only on a size change for 1000 ms from the first failure', async () => {
  const { CreateLayoutRetry } = await LoadGameModule(gameId, 'logic/fieldSettle.ts');
  const clock = FakeClock();
  let fits = false, attempts = 0, starts = 0, errors = 0;
  const create = () => CreateLayoutRetry(clock, () => { attempts++; if (!fits) throw new Error('field'); return 'block'; },
    block => { assert.equal(block, 'block'); starts++; }, () => errors++);
  let retry = create();
  retry.tryLayout(); clock.advance(500);
  assert.equal(attempts, 1); assert.equal(errors, 0);
  retry.tryLayout(); clock.advance(499); assert.equal(errors, 0);
  fits = true; retry.tryLayout(); assert.equal(starts, 1);
  clock.advance(1000); assert.equal(errors, 0); assert.equal(clock.pending(), 0);
  retry.cancel();

  fits = false; retry = create(); retry.tryLayout(); clock.advance(800); retry.tryLayout();
  clock.advance(199); assert.equal(errors, 0); clock.advance(1); assert.equal(errors, 1);
  fits = true; retry.tryLayout(); assert.equal(starts, 1, 'An expired window leaves the adjust panel in place.');
  retry = create(); fits = false; retry.tryLayout(); retry.cancel(); clock.advance(1000);
  assert.equal(errors, 1); assert.equal(clock.pending(), 0);
});

test('only the first unstarted screen allows a silent layout change', async () => {
  const { CanRelayout, CreateLayoutRetry } = await LoadGameModule(gameId, 'logic/fieldSettle.ts');
  assert.equal(CanRelayout('ready', 0), true);
  for (const state of ['search', 'complete', 'missed', 'finished', 'stopped']) assert.equal(CanRelayout(state, 0), false);
  assert.equal(CanRelayout('ready', 1), false);
  const clock = FakeClock(); let errors = 0;
  const retry = CreateLayoutRetry(clock, () => { throw new Error('field'); }, () => assert.fail(), () => errors++, () => CanRelayout('ready', 1));
  retry.tryLayout(); assert.equal(errors, 1); assert.equal(clock.pending(), 0);
});

const LoadSettings = () => LoadGameModule(gameId, 'settings.ts');
const LoadScreens = () => LoadGameModule(gameId, 'logic/screens.ts');
const LoadRun = () => LoadGameModule(gameId, 'logic/screenRun.ts');

test('a failed rebuild cannot start the first screen using its previous layout', async () => {
  const { ScreenRun } = await LoadRun();
  let ready, fits = true;
  const run = new ScreenRun({ sessionMs: 1000, screenLimitMs: 0 }, () => {
    if (!fits) throw new Error('field');
    return { target: '6', items: [{ id: 0, target: true }] };
  }, { prepare: callback => { ready = callback; }, change() {}, mark() {}, end() {} }, FakeClock());
  run.prepare(); ready(); assert.ok(run.state.screen);
  fits = false; assert.throws(() => ready(), /field/);
  run.startScreen(); assert.equal(run.state.phase, 'ready'); assert.equal(run.state.screen, null);
});

test('each screen waits for deferred field preparation and cancellation prevents a late start', async () => {
  const { ScreenRun } = await LoadRun();
  const clock = FakeClock();
  let prepare, creates = 0, changes = 0;
  const run = new ScreenRun({ sessionMs: 100, screenLimitMs: 0 }, () => { creates++; return { target: '6', items: [{ id: 0, target: true }] }; },
    { prepare: ready => { prepare = ready; }, change: () => changes++, mark() {}, end() {} }, clock);
  run.prepare(); assert.equal(creates, 0); assert.equal(run.state.screen, null);
  prepare(); assert.equal(creates, 1); run.startScreen(); run.interact(0, 'click'); clock.advance(600);
  assert.equal(creates, 1); assert.equal(run.screens.length, 1);
  prepare(); assert.equal(creates, 2);
  run.prepare(); run.stop(); const before = changes; prepare();
  assert.equal(creates, 2); assert.equal(changes, before);
});
const LoadScore = () => LoadGameModule(gameId, 'logic/saccadeScore.ts');

test('settings offer only the published UI choices and reject invalid or fractional steps', async () => {
  const { defaultSettings: settings, ValidateSettings } = await LoadSettings();
  assert.deepEqual(settings, { practiceMinutes: 15, itemsPerScreen: 40, targetsPerScreen: 6, distractors: 'mixed', symbolSizeDeg: 1.5, screenTimeLimitSec: 60, screenWidthCm: 30 });
  assert.ok(ValidateSettings(settings));
  for (const change of [{ practiceMinutes: 5 }, { practiceMinutes: 30 }, { itemsPerScreen: 60 }, { targetsPerScreen: 8 }, { distractors: 'letters' }, { symbolSizeDeg: 3 }, { screenTimeLimitSec: 0 }, { screenWidthCm: 15.5 }]) assert.ok(ValidateSettings({ ...settings, ...change }));
  for (const change of [{ practiceMinutes: 0 }, { practiceMinutes: 7 }, { practiceMinutes: '5' }, { itemsPerScreen: 25 }, { targetsPerScreen: 2 }, { targetsPerScreen: 40 }, { targetsPerScreen: 6.5 }, { distractors: 'digits' }, { symbolSizeDeg: 1.2 }, { screenTimeLimitSec: 15 }, { screenWidthCm: 30.2 }, { screenWidthCm: Infinity }, { screenWidthCm: NaN }]) assert.equal(ValidateSettings({ ...settings, ...change }), false, JSON.stringify(change));
  assert.equal(ValidateSettings(null), false);
  assert.equal(ValidateSettings({ ...settings, itemsPerScreen: 5, targetsPerScreen: 6 }), false);
});

test('48-degree viewing distance and physical symbol scale use the requested screen width', async () => {
  const { ViewingDistanceCm, SymbolPx } = await LoadSettings();
  assert.equal(ViewingDistanceCm(30), 34);
  assert.equal(ViewingDistanceCm(60), 67);
  assert.equal(SymbolPx(1280, 1.5), 38);
  assert.equal(SymbolPx(360, 1), 16);
});

test('device settings restore only known keys and reject invalid saved choices', async () => {
  const { defaultSettings, ValidateSettings } = await LoadSettings();
  const { RestoreSettings } = await LoadGameModule(gameId, 'runtime/settingsMemory.ts');
  assert.deepEqual(RestoreSettings({ practiceMinutes: 5, distractors: 'letters', ignored: true }, defaultSettings, ValidateSettings),
    { ...defaultSettings, practiceMinutes: 5, distractors: 'letters' });
  assert.equal(RestoreSettings({ targetsPerScreen: 9 }, defaultSettings, ValidateSettings), null);
});

test('seeded screens change the digit and exclude it, I and O from distractors', async () => {
  const { GenerateScreen } = await LoadScreens();
  const { defaultSettings } = await LoadSettings();
  for (const distractors of ['mixed', 'letters']) {
    let previous = null;
    const seen = new Set();
    for (let index = 0; index < 40; index++) {
      const args = [{ ...defaultSettings, distractors }, { width: 1280, height: 720, symbolPx: 24 }, 91 + index, index, previous];
      const screen = GenerateScreen(...args);
      assert.deepEqual(GenerateScreen(...args), screen);
      assert.notEqual(screen.target, previous);
      assert.match(screen.target, /^[0-9]$/);
      assert.equal(screen.items.length, 40);
      assert.equal(screen.items.filter(item => item.target).length, 6);
      for (const item of screen.items) {
        assert.equal(item.target, item.symbol === screen.target);
        if (!item.target) { assert.doesNotMatch(item.symbol, /[IO]/); seen.add(item.symbol); if (distractors === 'letters') assert.match(item.symbol, /^[A-Z]$/); }
      }
      previous = screen.target;
    }
    if (distractors === 'mixed') assert.ok([...seen].some(item => /[0-9]/.test(item)));
  }
});

test('target quadrant extras rotate and distractors spread evenly across quadrants', async () => {
  const { GenerateScreen } = await LoadScreens();
  const { defaultSettings } = await LoadSettings();
  for (let targets = 3; targets <= 8; targets++) {
    const totals = [0, 0, 0, 0];
    for (let index = 0; index < 4; index++) {
      const screen = GenerateScreen({ ...defaultSettings, targetsPerScreen: targets }, { width: 1280, height: 720, symbolPx: 24 }, index + 10, index, null);
      const counts = [0, 0, 0, 0], others = [0, 0, 0, 0];
      screen.items.forEach(item => { (item.target ? counts : others)[item.quadrant]++; if (item.target) totals[item.quadrant]++; });
      assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
      assert.ok(Math.max(...others) - Math.min(...others) <= 1);
      const extras = Array.from({ length: targets % 4 }, (_, extra) => (index + extra) % 4);
      assert.deepEqual(counts, totals.map((_, q) => Math.floor(targets / 4) + Number(extras.includes(q))));
    }
    assert.deepEqual(totals, [targets, targets, targets, targets]);
  }
});

test('positions respect symbol margins, centre exclusion, spacing and 44px hit areas at phone to desktop sizes', async () => {
  const { GenerateScreen } = await LoadScreens();
  const { defaultSettings } = await LoadSettings();
  for (const field of [{ width: 328, height: 580, symbolPx: 16 }, { width: 788, height: 900, symbolPx: 24 }, { width: 1280, height: 620, symbolPx: 38 }]) {
    for (let seed = 1; seed <= 12; seed++) {
      const screen = GenerateScreen(defaultSettings, field, seed, seed, null);
      const margin = Math.max(field.symbolPx, 22);
      screen.items.forEach((item, index) => {
        const x = item.x * field.width, y = item.y * field.height;
        assert.ok(x >= margin && x <= field.width - margin && y >= margin && y <= field.height - margin);
        assert.ok(Math.hypot(x - field.width / 2, y - field.height / 2) >= 3 * field.symbolPx);
        assert.equal(item.quadrant, Number(item.x >= 0.5) + 2 * Number(item.y >= 0.5));
        screen.items.slice(0, index).forEach(other => assert.ok(Math.hypot(x - other.x * field.width, y - other.y * field.height) >= Math.max(2 * field.symbolPx, 44) - 1e-8));
      });
    }
  }
  assert.throws(() => GenerateScreen(defaultSettings, { width: 150, height: 100, symbolPx: 60 }, 1, 0, null), /space/i);
});

test('the symbol layout is centred, so left and right (and top and bottom) cover the same area', async () => {
  const { GenerateScreen } = await LoadScreens();
  const { defaultSettings } = await LoadSettings();
  for (const field of [{ width: 328, height: 580, symbolPx: 16 }, { width: 1280, height: 620, symbolPx: 24 }, { width: 1840, height: 960, symbolPx: 30 }]) {
    const xs = [], ys = [];
    for (let seed = 1; seed <= 60; seed++) {
      for (const item of GenerateScreen({ ...defaultSettings, itemsPerScreen: 60 }, field, seed, seed, null).items) {
        xs.push(item.x * field.width); ys.push(item.y * field.height);
      }
    }
    const jitter = Math.min(3, field.symbolPx * .08);
    assert.ok(Math.abs(Math.min(...xs) - (field.width - Math.max(...xs))) <= 2 * jitter + 1, JSON.stringify(field));
    assert.ok(Math.abs(Math.min(...ys) - (field.height - Math.max(...ys))) <= 2 * jitter + 1, JSON.stringify(field));
  }
});

const MakeScreen = () => ({ target: '6', width: 800, height: 600, symbolPx: 20, symbolSizeDeg: 1.5,
  items: [{ id: 0, symbol: '6', target: true, quadrant: 0, x: .2, y: .2 }, { id: 1, symbol: '6', target: true, quadrant: 1, x: .8, y: .2 }, { id: 2, symbol: 'A', target: false, quadrant: 2, x: .2, y: .8 }] });
const StartRun = async (options = {}) => {
  const { ScreenRun } = await LoadRun();
  const clock = FakeClock(), states = [], ended = [], marked = [];
  const run = new ScreenRun({ sessionMs: 1000, screenLimitMs: 600, ...options }, () => MakeScreen(), {
    change: state => states.push(state), mark: item => marked.push(item), end: screens => ended.push(screens),
  }, clock);
  run.prepare();
  return { run, clock, states, ended, marked };
};

test('mouse hover and any pointer activation mark once; hover of distractors and touch hover do nothing', async () => {
  const { run, clock, marked } = await StartRun();
  clock.advance(5000);
  assert.equal(run.interact(0, 'pointerover', 'mouse'), false);
  run.startScreen(); clock.advance(100);
  assert.equal(run.interact(0, 'pointermove', 'touch'), false);
  assert.equal(run.interact(2, 'pointermove', 'mouse'), false);
  assert.equal(run.interact(0, 'pointerover', 'mouse'), true);
  assert.equal(run.interact(0, 'pointerdown', 'pen', 'a'), false);
  assert.equal(run.interact(0, 'click', 'pen', 'a'), false);
  assert.equal(marked.length, 1);
  run.interact(2, 'pointerdown', 'touch', 'b'); run.interact(2, 'click', 'touch', 'b');
  run.interact(2, 'click', 'mouse', 'c');
  clock.advance(200); run.interact(1, 'pointerdown', 'touch', 'd');
  const screen = run.screens[0];
  assert.equal(screen.falseClicks, 2);
  assert.equal(screen.durationMs, 300);
  assert.deepEqual(screen.finds.map(find => [find.itemId, find.foundMs, find.intervalMs, find.order]), [[0, 100, 100, 1], [1, 300, 200, 2]]);
  assert.equal(run.state.phase, 'complete');
  assert.deepEqual(run.state.missed, []);
});

test('timeout outlines missed targets for 1500ms; complete screens show 600ms feedback', async () => {
  const { run, clock } = await StartRun();
  run.startScreen(); clock.advance(100); run.interact(0, 'click', 'mouse', 'a');
  clock.advance(500);
  assert.equal(run.state.phase, 'missed');
  assert.deepEqual(run.state.missed, [1]);
  assert.equal(run.screens[0].durationMs, 600);
  assert.equal(run.interact(1, 'click', 'mouse'), false);
  clock.advance(1499); assert.equal(run.state.phase, 'missed');
  clock.advance(1); assert.equal(run.state.phase, 'ready');
  run.startScreen(); clock.advance(100); run.interact(0, 'click', 'mouse'); run.interact(1, 'click', 'mouse');
  clock.advance(599); assert.equal(run.state.phase, 'complete');
  clock.advance(1); assert.equal(run.state.phase, 'ready');
  run.stop(); assert.equal(clock.pending(), 0);
});

test('only active search consumes the session, which ends after the current screen', async () => {
  const { run, clock, ended } = await StartRun({ sessionMs: 1000, screenLimitMs: 700 });
  clock.advance(20000); assert.equal(run.remainingMs(), 1000);
  run.startScreen(); clock.advance(700); clock.advance(1500);
  assert.equal(run.remainingMs(), 300);
  clock.advance(10000); assert.equal(run.remainingMs(), 300);
  run.startScreen(); clock.advance(400);
  assert.equal(run.remainingMs(), 0); assert.equal(run.state.phase, 'search');
  assert.equal(ended.length, 0);
  clock.advance(300 + 1500);
  assert.equal(ended.length, 1); assert.equal(ended[0].length, 2);
  assert.equal(run.state.phase, 'finished'); assert.equal(clock.pending(), 0);
});

test('unlimited screens have no timeout; stop cancels timers and never saves', async () => {
  const { run, clock, ended } = await StartRun({ screenLimitMs: 0 });
  run.startScreen(); clock.advance(90000);
  assert.equal(run.state.phase, 'search');
  run.stop(); clock.advance(999999);
  assert.equal(ended.length, 0); assert.equal(clock.pending(), 0);
  assert.equal(run.interact(0, 'click', 'mouse'), false);
});

test('an input after a delayed screen deadline cannot mark another target', async () => {
  const { ScreenRun } = await LoadRun();
  const clock = FakeClock();
  let now = 0;
  const run = new ScreenRun({ sessionMs: 1000, screenLimitMs: 600 }, MakeScreen, { change() {}, mark() {}, end() {} }, { ...clock, now: () => now });
  run.prepare(); run.startScreen(); now = 601;
  assert.equal(run.interact(0, 'pointerover', 'mouse'), false);
  assert.equal(run.state.phase, 'missed'); assert.deepEqual(run.state.missed, [0, 1]);
  run.stop(); assert.equal(clock.pending(), 0);
});

test('summary has exactly 12 numeric/null fields, interval means, completed-screen means and side comparisons', async () => {
  const { SummarizeScreens, BuildRounds } = await LoadScore();
  const first = { ...MakeScreen(), number: 1, durationMs: 600, falseClicks: 2,
    finds: [{ itemId: 0, foundMs: 100, intervalMs: 100, order: 1 }, { itemId: 1, foundMs: 600, intervalMs: 500, order: 2 }] };
  const second = { ...MakeScreen(), number: 2, durationMs: 1000, falseClicks: 0, finds: [{ itemId: 1, foundMs: 400, intervalMs: 400, order: 1 }] };
  assert.deepEqual(SummarizeScreens([first, second]), { screens: 2, targets: 4, found: 3, missed: 1, falseClicks: 2, meanTargetMs: 333.3, meanScreenMs: 600, leftFoundMs: 100, rightFoundMs: 500, leftMissed: 1, rightMissed: 0, searchSeconds: 1.6 });
  const rounds = BuildRounds([first, second]);
  assert.equal(rounds.length, 4);
  assert.deepEqual(Object.keys(rounds[0]), ['screen', 'target', 'side', 'quadrant', 'xDeg', 'yDeg', 'found', 'foundMs', 'intervalMs', 'order', 'screenFalseClicks']);
  assert.deepEqual(rounds[2], { screen: 2, target: 6, side: 0, quadrant: 0, xDeg: -17.4, yDeg: -13.3, found: 0, foundMs: null, intervalMs: null, order: null, screenFalseClicks: 0 });
  assert.ok(rounds.every(row => Object.values(row).every(value => value === null || Number.isFinite(value))));
});

test('empty and all-missed sessions keep unavailable timing values null; bridge accepts real results once', async () => {
  const { SummarizeScreens, BuildRounds } = await LoadScore();
  assert.deepEqual(SummarizeScreens([]), { screens: 0, targets: 0, found: 0, missed: 0, falseClicks: 0, meanTargetMs: null, meanScreenMs: null, leftFoundMs: null, rightFoundMs: null, leftMissed: 0, rightMissed: 0, searchSeconds: 0 });
  const screens = [{ ...MakeScreen(), number: 1, durationMs: 30000, falseClicks: 0, finds: [] }];
  assert.equal(SummarizeScreens(screens).meanScreenMs, null);
  assert.equal(SummarizeScreens(screens).meanTargetMs, null);
  const { defaultSettings } = await LoadSettings();
  assert.ok(AcceptsResult(gameId, defaultSettings, { schema: 'rehab-trainer.game-score/v1', gameId, summary: SummarizeScreens(screens), rounds: BuildRounds(screens) }));
});

test('game owns entry, metadata, UI lifecycle, tutorial on the same inert running view and analysis', async () => {
  const folder = GameRoot(gameId);
  const source = await readFile(resolve(folder, 'ExploratorySaccadeGame.tsx'), 'utf8');
  for (const pattern of [/moduleId: 'vision:exploratory-saccade'/, /SendGameResult\(/, /ValidateSettings\(settings\)/, /requestFullscreen/, /pagehide/, /RetryGameSave/, /<ScoreAnalysis rounds=\{score\.rounds\}/]) assert.match(source, pattern);
  const tutorial = await readFile(resolve(folder, 'rules/ExploratorySaccadeTutorial.tsx'), 'utf8');
  assert.match(tutorial, /StartTour/); assert.match(tutorial, /ViewingDistanceCm/); assert.match(tutorial, /<RunningView/); assert.match(tutorial, /inert/);
  const metadata = JSON.parse(await readFile(resolve(folder, 'public/game.json'), 'utf8'));
  assert.deepEqual([metadata.gameId, metadata.trainer, metadata.category, metadata.preview], [gameId, 'vision', 'vision', 'preview.webp']);
  assert.equal(metadata.copy['zh-TW'].title, '探索掃視練習');
  for (const file of await readdir(folder, { recursive: true })) {
    if (!/\.(tsx?|css)$/.test(file) || /^(dist|node_modules)[\\/]/.test(file)) continue;
    const content = await readFile(resolve(folder, file), 'utf8');
    assert.doesNotMatch(content, /@rehab-trainer\/|localStorage|fetch\(|VISIOcoach|NeuroEyeCoach|\u2014/, file);
  }
  const analysis = await readFile(resolve(folder, 'ScoreAnalysis.tsx'), 'utf8');
  assert.match(analysis, /useState\('foundMs'\)/);
});

test('private bridge validates origin, version and nonce and retains save/exit behavior', () => CheckGameBridge(gameId));
test('browser spec uses vision routing, visible settings and a browser-only clock fixture', async () => {
  const { exploratorySaccadeBrowserSpec: spec } = await import('./exploratory-saccade-r2-browser.mjs');
  const { ValidateSettings } = await LoadSettings();
  assert.equal(spec.trainer, 'vision'); assert.equal(spec.purpose, 'vision');
  assert.equal(spec.phasePrefix, 'saccade');
  assert.match(await readFile(`${GameRoot(gameId)}/ExploratorySaccadeGame.tsx`, 'utf8'), /game-settings-dialog saccade-phase-menu/);
  assert.ok(ValidateSettings(spec.settings)); assert.equal(spec.settings.practiceMinutes, 5);
  assert.equal(typeof spec.beforeStart, 'function'); assert.equal(typeof spec.play, 'function'); assert.equal(typeof spec.verify, 'function');
});
test('browser clock fixture advances real game timers without a product-only setting and restores browser APIs', async () => {
  const { saccadeClockFixture } = await import('./exploratory-saccade-r2-browser.mjs');
  const clock = FakeClock(), performance = { now: clock.now };
  const window = { setTimeout: clock.set, clearTimeout: clock.clear };
  runInNewContext(saccadeClockFixture, { window, performance });
  const observed = [];
  window.setTimeout(() => { observed.push(performance.now()); window.setTimeout(() => observed.push(performance.now()), 1500); }, 30000);
  window.saccadeFixtureClock.advance(30000); assert.deepEqual(observed, [30000]);
  window.saccadeFixtureClock.advance(1500); assert.deepEqual(observed, [30000, 31500]);
  window.saccadeFixtureClock.restore();
  assert.equal(performance.now, clock.now); assert.equal(window.setTimeout, clock.set); assert.equal(window.clearTimeout, clock.clear);
  assert.equal(clock.pending(), 0);
});
test('standard packaging registry assertion', () => CheckGamePackaging(gameId, { version: '1.0.1', component: 'ExploratorySaccadeGame', trainer: 'vision', category: 'vision' }));
test('catalog entry', async () => assert.ok(/id: 'exploratory-saccade'/.test(await readFile(resolve(root, 'apps/rehabtrainerhub/games/catalog.ts'), 'utf8')), 'catalog must register exploratory-saccade'));
test('lockfile workspace', async () => {
  const lockfile = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'));
  assert.equal(lockfile.packages['apps/rehabtrainerhub/games/exploratory-saccade']?.name, '@rehab-trainer/game-exploratory-saccade');
});

test('Hub accepts every setting through its unchanged sensitive-key filter', async () => {
  const { IsBoundedGameScoreRecord } = await import('../apps/rehabtrainerhub/functions/api/records.js');
  const { defaultSettings } = await LoadSettings();
  const input = { appId: 'rehabtrainerhub', runtimeId: 'hub', record: { gameId, moduleId: gameId,
    config: defaultSettings, score: { schema: 'rehab-trainer.game-score/v1', gameId, summary: { screens: 1 }, rounds: [] } } };
  for (const practiceMinutes of [5, 10, 15, 20, 25, 30]) {
    assert.equal(IsBoundedGameScoreRecord({ ...input, record: { ...input.record, config: { ...defaultSettings, practiceMinutes } } }), true);
  }
  for (const key of ['session', 'sessionId', 'sessionMinutes', 'sessionToken', 'userName', 'email', 'secret', 'password', 'credential']) {
    for (const value of [15, 'private']) assert.equal(IsBoundedGameScoreRecord({ ...input, record: { ...input.record, config: { ...defaultSettings, [key]: value } } }), false, key);
  }
});

test('anonymous Hub saving retains all seven confirmed settings and identical retry succeeds', async () => {
  const { CreateRawDataEnvironment } = await import('../apps/rehabtrainerhub/functions/_lib/rawDataTestFixtures.mjs');
  const { onRequestPost } = await import('../apps/rehabtrainerhub/functions/api/records.js');
  const { defaultSettings } = await LoadSettings();
  const fixture = CreateRawDataEnvironment(gameId, ['audio', 'fullscreen', 'keyboard', 'pointer', 'settings-storage', 'touch']);
  try {
    const session = await fixture.session();
    const body = { appId: 'rehabtrainerhub', runtimeId: 'hub', subjectId: session.subjectId,
      officialGameVersion: session.version, runSessionToken: session.token,
      record: { id: session.recordId, gameId, moduleId: gameId, config: defaultSettings,
        score: { schema: 'rehab-trainer.game-score/v1', gameId, summary: { screens: 1 }, rounds: [{ screen: 1, found: 1 }] } } };
    const post = () => onRequestPost({ env: fixture.env, request: new Request('https://trainerhub.cc/api/records', {
      method: 'POST', headers: { Origin: 'https://trainerhub.cc', 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.201' }, body: JSON.stringify(body),
    }) });
    assert.equal((await post()).status, 201);
    const row = fixture.sqlite.prepare('SELECT payload_json,summary_json FROM training_records').get();
    for (const serialized of [row.payload_json, row.summary_json]) assert.deepEqual(JSON.parse(serialized).config, defaultSettings);
    assert.equal((await post()).status, 200);
  } finally { fixture.sqlite.close(); }
});

test('symbols do not reveal targets through tab navigation; Start, Stop and Escape remain available', async () => {
  const source = await readFile(`${GameRoot(gameId)}/RunningView.tsx`, 'utf8');
  assert.match(source, /<button[^>]*tabIndex=\{-1\}[^>]*className="saccade-item"/);
  for (const name of ['saccade-start', 'saccade-stop']) assert.match(source, new RegExp('<button[^>]*className="[^"\\n]*' + name));
  const game = await readFile(`${GameRoot(gameId)}/ExploratorySaccadeGame.tsx`, 'utf8');
  assert.match(game, /type="button" onClick=\{confirmSettings\}/, 'Sandboxed games confirm through a button handler because allow-forms is absent.');
  assert.match(game, /Escape/);
  const settings = await readFile(`${GameRoot(gameId)}/settings.ts`, 'utf8');
  assert.match(settings, /每個畫面的符號數/); assert.match(settings, /每個畫面的目標數/);
  assert.match(settings, /符號大小（視角度數）/); assert.match(settings, /Symbol size \(degrees of visual angle\)/);
  assert.match(game, /Roth 等（2009）；Ivanov 等（2016、2018）/);
  assert.match(game, /Roth et al\. \(2009\); Ivanov et al\. \(2016, 2018\)/);
  const tutorial = await readFile(`${GameRoot(gameId)}/rules/ExploratorySaccadeTutorial.tsx`, 'utf8');
  assert.doesNotMatch(settings + game + tutorial, /每畫|每一畫|這一畫|該畫/);
});
