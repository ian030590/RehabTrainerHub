import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, FakeClock, LoadGameModule, GameRoot } from './brain-r2-game-checks.mjs';

const gameId = 'conjunction-search';
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

test('only trial one lead or target allows a silent block layout change', async () => {
  const { CanRelayout } = await LoadGameModule(gameId, 'logic/fieldSettle.ts');
  for (const state of ['lead', 'target']) assert.equal(CanRelayout(state, 0), true);
  for (const state of ['feedback', 'gap', 'ready']) assert.equal(CanRelayout(state, 0), false);
  for (const state of ['lead', 'target', 'feedback', 'gap']) assert.equal(CanRelayout(state, 1), false);
});

const LoadLevels = () => LoadGameModule(gameId, 'logic/levels.ts');
const LoadTrials = async () => LoadGameModule(gameId, 'logic/searchTrials.ts', { './levels': await LoadLevels(), './layout': await LoadGameModule(gameId, 'logic/layout.ts') });
const LoadScore = async () => LoadGameModule(gameId, 'score.ts', { './logic/levels': await LoadLevels(), './logic/searchScore': await LoadGameModule(gameId, 'logic/searchScore.ts') });

test('search settings use the published defaults and reject wrong types, off-step and out-of-range values', async () => {
  const { defaultSettings, ValidateSettings, SymbolPx, ViewingDistanceCm, EstimatedSeconds } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { level: 1, timeLimitMs: 1500, trialsPerBlock: 200, symbolSizeDeg: 1.4, screenWidthCm: 30 });
  assert.ok(ValidateSettings(defaultSettings));
  for (const level of [1, 2, 3, 4]) for (const timeLimitMs of [1500, 2000, 0]) for (const trialsPerBlock of [20, 50, 100, 200]) {
    assert.ok(ValidateSettings({ ...defaultSettings, level, timeLimitMs, trialsPerBlock }));
  }
  for (const symbolSizeDeg of [1.4, 1.5, 1.6, 1.7, 1.8, 1.4 + .1 + .1]) assert.ok(ValidateSettings({ ...defaultSettings, symbolSizeDeg }));
  for (const screenWidthCm of [15, 15.5, 80]) assert.ok(ValidateSettings({ ...defaultSettings, screenWidthCm }));
  for (const change of [{ level: 0 }, { level: 5 }, { level: 1.5 }, { level: '1' }, { timeLimitMs: 1000 }, { timeLimitMs: '1500' },
    { trialsPerBlock: 21 }, { trialsPerBlock: 0 }, { symbolSizeDeg: 1.45 }, { symbolSizeDeg: 1.3 }, { symbolSizeDeg: 1.9 },
    { symbolSizeDeg: '1.4' }, { screenWidthCm: 30.25 }, { screenWidthCm: 14.5 }, { screenWidthCm: 80.5 }, { screenWidthCm: NaN }, { screenWidthCm: Infinity }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
  for (const key of Object.keys(defaultSettings)) for (const value of [null, true, {}, undefined]) assert.equal(ValidateSettings({ ...defaultSettings, [key]: value }), false);
  assert.equal(ViewingDistanceCm(30), 41);
  assert.equal(SymbolPx(1920, 1.4), Math.round(1920 * Math.tan(.7 * Math.PI / 180) / Math.tan(20 * Math.PI / 180)));
  assert.equal(SymbolPx(360, 1.4), 16);
  assert.equal(SymbolPx(1440, 1.8), 62);
  assert.equal(EstimatedSeconds({ ...defaultSettings, trialsPerBlock: 20 }), 168);
  assert.equal(EstimatedSeconds({ ...defaultSettings, timeLimitMs: 0 }), null);
});

test('four data-only levels match the specified global levels, glyphs and next game', async () => {
  const { levels, gameDefinition, glyphs } = await LoadLevels();
  assert.deepEqual(levels.map(level => [level.globalLevel, level.target, level.distractors, level.added]), [
    [9, { glyph: 'X', tone: 'green' }, [{ glyph: 'X', tone: 'blue' }, { glyph: 'R', tone: 'green' }], false],
    [10, { glyph: 'b', tone: 'green' }, [{ glyph: 'b', tone: 'blue' }, { glyph: 'p', tone: 'green' }], false],
    [11, { glyph: 'T', tone: 'green' }, [{ glyph: 'T', tone: 'blue' }, { glyph: 'upsideDownT', tone: 'green' }], false],
    [12, { glyph: 'd', tone: 'green' }, [{ glyph: 'd', tone: 'blue' }, { glyph: 'b', tone: 'green' }], true],
  ]);
  assert.equal(gameDefinition.id, gameId);
  assert.equal(gameDefinition.next, null);
  assert.equal(gameDefinition.title.zh, '視覺搜尋：顏色與字形');
  for (const glyph of ['X', 'R', 'b', 'p', 'T', 'upsideDownT', 'd']) assert.equal(typeof glyphs[glyph].path, 'string');
  for (const language of ['zh', 'en']) {
    const source = await readFile(`${GameRoot(gameId)}/i18n/${language}.ts`, 'utf8');
    assert.match(source, /gameDefinition\.title/, 'Runtime translations read their type-specific title from the level data.');
  }
});

test('seeded blocks have exact counts, balanced target quadrants and valid spaced positions', async () => {
  const { CreateSearchBlocks, CreateRandom } = await LoadTrials();
  const field = { width: 1000, height: 650, symbolPx: 36, circleRadius: 36 };
  for (const trialsPerBlock of [20, 50, 100, 200]) for (const level of [1, 2, 3, 4]) {
    const settings = { level, trialsPerBlock, timeLimitMs: 1500 };
    const blocks = CreateSearchBlocks(settings, CreateRandom(47), field);
    assert.deepEqual(blocks, CreateSearchBlocks(settings, CreateRandom(47), field));
    assert.deepEqual(blocks.map(block => block[0].setSize), [8, 16, 24]);
    for (const [blockIndex, block] of blocks.entries()) {
      assert.equal(block.length, trialsPerBlock);
      const present = block.filter(trial => trial.present);
      assert.equal(present.length, trialsPerBlock / 2);
      const quadrants = [0, 1, 2, 3].map(q => present.filter(trial => trial.targetQuadrant === q).length);
      assert.ok(Math.max(...quadrants) - Math.min(...quadrants) <= 1);
      assert.ok(Math.abs(quadrants[0] + quadrants[2] - quadrants[1] - quadrants[3]) <= 1);
      for (const trial of block) {
        assert.equal(trial.block, blockIndex + 1);
        assert.equal(trial.items.length, trial.setSize);
        assert.equal(trial.items.filter(item => item.target).length, Number(trial.present));
        assert.equal(trial.targetQuadrant === null, !trial.present);
        for (const q of [0, 1, 2, 3]) assert.equal(trial.items.filter(item => item.quadrant === q).length, trial.setSize / 4);
        for (const [i, item] of trial.items.entries()) {
          assert.equal(item.quadrant, (item.x >= .5 ? 1 : 0) + (item.y >= .5 ? 2 : 0));
          assert.ok(item.x * field.width >= field.symbolPx && (1 - item.x) * field.width >= field.symbolPx);
          assert.ok(item.y * field.height >= field.symbolPx && (1 - item.y) * field.height >= field.symbolPx);
          assert.ok(Math.hypot((item.x - .5) * field.width, (item.y - .5) * field.height) >= field.circleRadius + field.symbolPx);
          for (const other of trial.items.slice(i + 1)) assert.ok(Math.hypot((item.x - other.x) * field.width, (item.y - other.y) * field.height) >= 1.8 * field.symbolPx - 1e-8);
        }
        const target = trial.items.find(item => item.target);
        if (target) assert.equal(target.quadrant, trial.targetQuadrant);
      }
    }
  }
  assert.notDeepEqual(CreateSearchBlocks({ level: 1, trialsPerBlock: 20 }, CreateRandom(1), field), CreateSearchBlocks({ level: 1, trialsPerBlock: 20 }, CreateRandom(2), field));
});

test('fallback grid keeps all spacing constraints on a phone and refuses physically impossible fields', async () => {
  const { LayoutItems } = await LoadGameModule(gameId, 'logic/layout.ts');
  const field = { width: 328, height: 300, symbolPx: 16, circleRadius: 20 };
  const positions = LayoutItems(24, field, () => .5);
  assert.equal(positions.length, 24);
  for (const q of [0, 1, 2, 3]) assert.equal(positions.filter(item => item.quadrant === q).length, 6);
  for (const [i, item] of positions.entries()) {
    assert.ok(item.x * field.width >= 16 && item.x * field.width <= 312);
    assert.ok(item.y * field.height >= 16 && item.y * field.height <= 284);
    assert.ok(Math.hypot((item.x - .5) * 328, (item.y - .5) * 300) >= 36);
    for (const other of positions.slice(i + 1)) assert.ok(Math.hypot((item.x - other.x) * 328, (item.y - other.y) * 300) >= 28.8 - 1e-8);
  }
  assert.throws(() => LayoutItems(24, { width: 80, height: 80, symbolPx: 32, circleRadius: 32 }, () => .5), /field/i);
});

test('narrow fullscreen fields keep their edge grid cells when random placement needs a fallback', async () => {
  const { CreateSearchBlocks, CreateRandom } = await LoadTrials();
  for (const field of [{ width: 768, height: 432 }, { width: 720, height: 420 }, { width: 720, height: 317 }, { width: 358, height: 620 }]) {
    for (let seed = 0; seed < 20; seed++) {
      const blocks = CreateSearchBlocks({ level: 1, trialsPerBlock: 20 }, CreateRandom(seed), { ...field, symbolPx: 43, circleRadius: 53.75 });
      for (const trial of blocks.flat()) {
        assert.equal(trial.items.length, trial.setSize);
        for (const [i, item] of trial.items.entries()) {
          assert.ok(Math.hypot((item.x - .5) * field.width, (item.y - .5) * field.height) >= 96.75);
          for (const other of trial.items.slice(i + 1)) assert.ok(Math.hypot((item.x - other.x) * field.width, (item.y - other.y) * field.height) >= 77.4 - 1e-8);
        }
      }
    }
  }
});

for (const limit of [1500, 2000, 0]) test(`trial clock: 500 ms lead, ${limit || 'unlimited'} ms window, 500 ms feedback and 300 ms gap`, async () => {
  const { SearchTiming } = await LoadTrials();
  const timing = SearchTiming(limit);
  assert.deepEqual(timing, { lead: [{ state: 'lead', ms: 500 }], exposureMs: null, windowMs: limit || null, endOnResponse: true, feedbackMs: 500, gapMs: 300 });
  const { TrialRun } = await LoadGameModule(gameId, 'logic/trialRun.ts');
  const clock = FakeClock(), events = [];
  let finished;
  const run = new TrialRun(2, () => ({ trial: 'target', timing }), {
    lead: () => events.push(['lead', clock.now()]), show: () => events.push(['show', clock.now()]), hide() {}, signal() {},
    end: outcome => events.push(['end', clock.now(), outcome.response, outcome.rtMs]), clear: () => events.push(['clear', clock.now()]),
  }, clock, outcomes => { finished = outcomes; }, 0);
  run.start(); clock.advance(499); assert.equal(run.respond('1'), false);
  clock.advance(1); clock.advance(200); assert.equal(run.respond('1'), true); assert.equal(run.respond('0'), false);
  clock.advance(499); assert.equal(events.at(-1)[0], 'end'); clock.advance(1); assert.deepEqual(events.at(-1), ['clear', 1200]);
  clock.advance(300); assert.deepEqual(events.at(-1), ['lead', 1500]); clock.advance(500);
  if (limit) { clock.advance(limit - 1); assert.equal(events.at(-1)[0], 'show'); clock.advance(1); }
  else { clock.advance(100000); assert.equal(finished, undefined); assert.equal(run.respond('0'), true); }
  const end = events.at(-1);
  assert.deepEqual(end.slice(2), limit ? [null, null] : ['0', 100000]);
  clock.advance(800); assert.equal(finished.length, 2); assert.equal(clock.pending(), 0);
  const stopped = new TrialRun(1, () => ({ trial: 'target', timing }), { lead() {}, show() {}, hide() {}, signal() {}, end() {}, clear() {} }, clock, () => assert.fail('Stopped runs never finish'), 0);
  stopped.start(); stopped.stop(); clock.advance(10000); assert.equal(stopped.respond('1'), false); assert.equal(clock.pending(), 0);
});

test('85.0 is the block boundary; two of three blocks pass, including timeout errors', async () => {
  const { BlockStatistics, SummarizeSearch } = await LoadGameModule(gameId, 'logic/searchScore.ts');
  const rows = [8, 16, 24].flatMap((setSize, b) => Array.from({ length: 20 }, (_, i) => ({ trial: b * 20 + i + 1, block: b + 1, setSize,
    present: i % 2, targetSide: i % 2 ? 0 : null, targetQuadrant: i % 2 ? 0 : null, response: i < (b === 2 ? 16 : 17) ? i % 2 : null,
    correct: Number(i < (b === 2 ? 16 : 17)), rtMs: i < (b === 2 ? 16 : 17) ? 400 : null, timeLimitMs: 1500 })));
  assert.deepEqual([8, 16, 24].map(size => { const b = BlockStatistics(rows.filter(row => row.setSize === size)); return [b.accuracy, b.passed, b.timeouts]; }), [[85, true, 3], [85, true, 3], [80, false, 4]]);
  assert.equal(SummarizeSearch(rows, 1).passed, 1); assert.equal(SummarizeSearch(rows, 1).blocksPassed, 2);
  const failed = rows.map(row => row.block === 2 && row.trial === 21 ? { ...row, correct: 0 } : row);
  assert.equal(SummarizeSearch(failed, 1).passed, 0);
});

test('all 12 summary keys, side means, correct-only RTs, null cases, least-squares slope and numeric rounds', async () => {
  const { SummarizeSearch } = await LoadGameModule(gameId, 'logic/searchScore.ts');
  const row = (setSize, present, rtMs, correct = 1, targetSide = 0) => ({ trial: 1, block: setSize / 8, setSize, present,
    targetSide: present ? targetSide : null, targetQuadrant: present ? targetSide : null, response: rtMs === null ? null : present, correct, rtMs, timeLimitMs: 1500 });
  const rows = [row(8, 1, 400), row(8, 0, 600), row(16, 1, 500, 1, 1), row(16, 0, 800), row(24, 1, 800), row(24, 1, 100, 0), row(24, 0, null, 0)];
  assert.deepEqual(SummarizeSearch(rows, 4), { level: 4, passed: 1, blocksPassed: 2, accuracy8: 100, accuracy16: 100, accuracy24: 33.3,
    accuracy: 71.4, presentRtMs: 566.7, absentRtMs: 700, slopeMsPerItem: 25, leftRtMs: 600, rightRtMs: 500 });
  assert.deepEqual(SummarizeSearch([], 1), { level: 1, passed: 0, blocksPassed: 0, accuracy8: null, accuracy16: null, accuracy24: null,
    accuracy: null, presentRtMs: null, absentRtMs: null, slopeMsPerItem: null, leftRtMs: null, rightRtMs: null });
  assert.equal(SummarizeSearch([row(8, 1, 400)], 1).slopeMsPerItem, null);
  const { BuildGameScore, ToRow } = await LoadScore();
  const timeout = ToRow({ index: 2, trial: { block: 2, setSize: 16, present: true, targetQuadrant: 3 }, response: null, rtMs: null }, 1500, 20);
  assert.deepEqual(timeout, { trial: 23, block: 2, setSize: 16, present: 1, targetSide: 1, targetQuadrant: 3, response: null, correct: 0, rtMs: null, timeLimitMs: 1500 });
  const settings = { level: 4, timeLimitMs: 1500, trialsPerBlock: 20, symbolSizeDeg: 1.4, screenWidthCm: 30 };
  const score = BuildGameScore([...rows, timeout], settings);
  assert.equal(score.summary.level, 12); assert.equal(score.gameId, gameId); assert.equal(Object.keys(score.summary).length, 12);
  assert.deepEqual(score.rounds, [...rows, timeout]);
  assert.ok(score.rounds.every(round => Object.keys(round).length === 10 && Object.values(round).every(value => value === null || Number.isFinite(value))));
  assert.ok(AcceptsResult(gameId, settings, score));
});

test('automatic next settings preserve size/count/distance in every pass and retry branch', async () => {
  const { NextSettings, defaultSettings } = await LoadGameModule(gameId, 'settings.ts');
  for (const level of [1, 2, 3, 4]) for (const timeLimitMs of [1500, 2000, 0]) for (const passed of [true, false]) {
    const settings = { ...defaultSettings, level, timeLimitMs, trialsPerBlock: 50, symbolSizeDeg: 1.8, screenWidthCm: 42.5 };
    assert.deepEqual(NextSettings(settings, passed), { ...settings, level: passed ? Math.min(4, level + 1) : level,
      timeLimitMs: passed ? 1500 : timeLimitMs === 1500 ? 2000 : 0 });
    assert.equal(settings.level, level); assert.equal(settings.timeLimitMs, timeLimitMs);
  }
});

test('result progression follows sending the confirmed config; source includes rest, glyphs and vision lifecycle', async () => {
  const source = await readFile(`${GameRoot(gameId)}/ConjunctionSearchGame.tsx`, 'utf8');
  assert.match(source, /moduleId: `vision:\$\{gameDefinition.id\}`/);
  assert.match(source, /SendGameResult\(\{ \.\.\.settings \}, score.summary, score.rounds\);\s*SaveGameSettings\(NextSettings\(settings, Boolean\(score.summary.passed\)\)\)/);
  assert.match(source, /search-rest/); assert.match(source, /PlaySuccessSound/); assert.match(source, /PlayFailureSound/);
});

test('conjunction-search packaging is self contained and registered as vision', async () => {
  const { gameDefinition } = await LoadLevels();
  await CheckGamePackaging(gameId, { version: '1.0.1', component: 'ConjunctionSearchGame', trainer: 'vision', category: 'vision', title: gameDefinition.title.zh });
});

test('private bridge verifies parent, identity and version and restores language and settings', async () => {
  await CheckGameBridge(gameId);
});


test('catalogue and runtime descriptions match the reviewed copy and centre circle', async () => {
  const { gameDefinition } = await LoadLevels();
  const metadata = JSON.parse(await readFile(`${GameRoot(gameId)}/public/game.json`, 'utf8'));
  assert.deepEqual(gameDefinition.description, { zh: '判斷散布的字母中有沒有中央圓圈裡的綠色目標字，其他字與目標同色或同形。十二級視覺搜尋的第 9 到 12 級。', en: 'Decide whether the green letter shown in the centre circle is among the scattered letters. The others share its colour or its shape. Levels 9 to 12 of 12.' });
  assert.equal(metadata.copy['zh-TW'].description, gameDefinition.description.zh);
  assert.equal(metadata.copy.en.description, gameDefinition.description.en);
  const source = await readFile(`${GameRoot(gameId)}/${gameId === 'popout-search' ? 'PopoutSearch' : gameId === 'complex-search' ? 'ComplexSearch' : 'ConjunctionSearch'}Game.tsx`, 'utf8');
  assert.match(source, /search-target-circle/);
});

test('browser spec routes vision and verifies global level 9', async () => {
  const { brainGameSpecs } = await import('./brain-r2-browser.mjs');
  const spec = brainGameSpecs[gameId];
  assert.equal(spec.trainer, 'vision'); assert.equal(spec.purpose, 'vision');
  assert.equal(spec.settings.level, 1); assert.equal(spec.rows, 60);
  assert.equal(typeof spec.play, 'function'); assert.equal(typeof spec.verify, 'function');
});

test('derived glyphs use the exact base path and geometric transforms', async () => {
  const { glyphs, levels } = await LoadLevels();
  for (const [derived, base, transform] of [['upsideDownT', 'T', 'rotate(180 50 50)'], ['p', 'b', 'translate(0 100) scale(1 -1)'], ['d', 'b', 'translate(100 0) scale(-1 1)']]) {
    assert.equal(glyphs[derived].path, glyphs[base].path); assert.equal(glyphs[derived].transform, transform);
  }
  const source = await readFile(`${GameRoot(gameId)}/Glyph.tsx`, 'utf8');
  assert.match(source, /transform=\{glyph.transform\}/);
  assert.ok(levels.every(level => level.target.tone === 'green'));
  const css = await readFile(`${GameRoot(gameId)}/game.css`, 'utf8');
  assert.match(css, /--search-green: #17613b/); assert.match(css, /--search-blue: #1558a6/);
});

test('tutorial shows both distractor types and explains that colour and shape must match', async () => {
  const tutorial = await readFile(`${GameRoot(gameId)}/rules/ConjunctionSearchTutorial.tsx`, 'utf8');
  assert.match(tutorial, /level.distractors\[i % level.distractors.length\]/);
  const steps = await readFile(`${GameRoot(gameId)}/rules/tutorialSteps.ts`, 'utf8');
  assert.match(steps, /green target/); assert.match(steps, /綠色目標/);
});

test('two distractor types balance in every quadrant and across every block', async () => {
  const { levels } = await LoadLevels();
  const { CreateSearchBlocks, CreateRandom } = await LoadTrials();
  for (const level of [1, 2, 3, 4]) for (const trialsPerBlock of [20, 50, 100, 200]) {
    const definition = levels[level - 1];
    const blocks = CreateSearchBlocks({ level, trialsPerBlock }, CreateRandom(29), { width: 1000, height: 650, symbolPx: 36, circleRadius: 36 });
    for (const block of blocks) {
      const total = [0, 0];
      let replacement = 0;
      for (const trial of block) {
        for (const q of [0, 1, 2, 3]) {
          const counts = [0, 0];
          for (const item of trial.items.filter(item => item.quadrant === q)) {
            if (item.target) { assert.deepEqual({ glyph: item.glyph, tone: item.tone }, definition.target); continue; }
            const kind = definition.distractors.findIndex(d => d.glyph === item.glyph && d.tone === item.tone);
            assert.notEqual(kind, -1); counts[kind]++; total[kind]++;
          }
          const expected = [trial.setSize / 8, trial.setSize / 8];
          if (q === trial.targetQuadrant) expected[replacement % 2]--;
          assert.deepEqual(counts, expected);
        }
        if (trial.present) replacement++;
      }
      assert.ok(Math.abs(total[0] - total[1]) <= 1);
    }
  }
});
