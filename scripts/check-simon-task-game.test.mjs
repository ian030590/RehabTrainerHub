import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, FakeClock, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'simon-task';

test('Simon settings keep balanced defaults and reject values outside each range', async () => {
  const { defaultSettings, ValidateSettings, EstimatedSeconds } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { trials: 80, responseMs: 2000, itiMs: 800 });
  assert.equal(ValidateSettings(defaultSettings), true);
  assert.equal(EstimatedSeconds(defaultSettings), 120);
  for (const change of [{ trials: 40 }, { trials: 160 }, { responseMs: 1000 }, { responseMs: 3000 }, { itiMs: 500 }, { itiMs: 1500 }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ trials: 20 }, { trials: 50 }, { trials: 180 }, { responseMs: 900 }, { responseMs: 1100 }, { responseMs: 3250 },
    { itiMs: 400 }, { itiMs: 850 }, { itiMs: 1600 }, { trials: '80' }, { itiMs: NaN }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
});

test('every block of four shows each shape on each side once, so side never predicts the answer', async () => {
  const { CreateSimonTrials, CreateRandom } = await LoadGameModule(gameId, 'logic/simonTrials.ts');
  for (const seed of [1, 8, 31]) {
    const trials = CreateSimonTrials(80, CreateRandom(seed));
    assert.equal(trials.length, 80);
    assert.deepEqual(CreateSimonTrials(80, CreateRandom(seed)), trials, 'The same seed repeats the sequence.');
    for (let block = 0; block < 20; block++) {
      assert.deepEqual(trials.slice(block * 4, block * 4 + 4).map(trial => `${trial.shape}-${trial.side}`).sort(),
        ['circle-left', 'circle-right', 'square-left', 'square-right']);
    }
    for (const trial of trials) {
      assert.equal(trial.answer, trial.shape === 'circle' ? 'left' : 'right', 'The shape alone sets the answer.');
      assert.equal(trial.congruent, trial.side === trial.answer);
    }
  }
});

test('a response ends the shape early, the gap follows, and a missing response times out', async () => {
  const { SimonRun } = await LoadGameModule(gameId, 'logic/simonRun.ts');
  const clock = FakeClock();
  const events = [];
  let finished = null;
  const trials = [{ shape: 'circle', side: 'right', answer: 'left', congruent: false }, { shape: 'square', side: 'right', answer: 'right', congruent: true },
    { shape: 'square', side: 'left', answer: 'right', congruent: false }];
  const run = new SimonRun(trials, { responseMs: 2000, itiMs: 800, leadInMs: 1000 },
    { show: (trial, index) => events.push(['show', trial.shape, index, clock.now()]), clear: row => events.push(['clear', row.trial, row.correct, clock.now()]) },
    clock, rows => { finished = rows; });
  run.start();
  run.respond('left');
  clock.advance(1000 + 450);
  run.respond('left');
  run.respond('right');
  clock.advance(800 + 2000);
  clock.advance(800 + 300);
  run.respond('left');
  assert.equal(finished, null);
  clock.advance(800);
  assert.deepEqual(events, [['show', 'circle', 0, 1000], ['clear', 1, true, 1450], ['show', 'square', 1, 2250], ['clear', 2, false, 4250],
    ['show', 'square', 2, 5050], ['clear', 3, false, 5350]]);
  assert.deepEqual(finished, [
    { trial: 1, shape: 0, side: 1, congruent: false, response: 0, correct: true, rtMs: 450 },
    { trial: 2, shape: 1, side: 1, congruent: true, response: null, correct: false, rtMs: null },
    { trial: 3, shape: 1, side: 0, congruent: false, response: 0, correct: false, rtMs: 300 },
  ]);
  assert.equal(clock.pending(), 0);
});

test('stopping the run cancels every timer and ignores later responses', async () => {
  const { SimonRun } = await LoadGameModule(gameId, 'logic/simonRun.ts');
  const clock = FakeClock();
  let finished = false;
  const run = new SimonRun([{ shape: 'circle', side: 'left', answer: 'left', congruent: true }], { responseMs: 2000, itiMs: 800, leadInMs: 1000 },
    { show() {}, clear() {} }, clock, () => { finished = true; });
  run.start();
  clock.advance(1200);
  run.stop();
  run.respond('left');
  clock.advance(10000);
  assert.equal(finished, false);
  assert.equal(clock.pending(), 0);
});

test('the summary compares correct response times on matching and opposite sides', async () => {
  const { SummarizeSimon } = await LoadGameModule(gameId, 'logic/simonScore.ts');
  const row = (congruent, correct, rtMs, response = 0) => ({ trial: 0, shape: 0, side: 0, congruent, response, correct, rtMs });
  const rows = [row(true, true, 400), row(true, true, 500), row(true, false, 300), row(false, true, 560), row(false, true, 640),
    row(false, false, 450), row(false, false, null, null)];
  assert.deepEqual(SummarizeSimon(rows), { trials: 7, correct: 4, accuracyPercent: 57.1, misses: 1, congruentRtMs: 450, incongruentRtMs: 600,
    simonEffectMs: 150, congruentAccuracyPercent: 66.7, incongruentAccuracyPercent: 50, meanRtMs: 525, rtSdMs: 101 });
  assert.deepEqual(SummarizeSimon([]), { trials: 0, correct: 0, accuracyPercent: null, misses: 0, congruentRtMs: null, incongruentRtMs: null,
    simonEffectMs: null, congruentAccuracyPercent: null, incongruentAccuracyPercent: null, meanRtMs: null, rtSdMs: null });
});

test('Simon results save bounded numeric rows through the private channel', async () => {
  const scoreModule = await LoadGameModule(gameId, 'logic/simonScore.ts');
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/simonScore': scoreModule });
  const score = BuildGameScore([{ trial: 1, shape: 0, side: 1, congruent: false, response: 0, correct: true, rtMs: 450 },
    { trial: 2, shape: 1, side: 1, congruent: true, response: null, correct: false, rtMs: null }]);
  assert.deepEqual(score.rounds, [{ trial: 1, shape: 0, side: 1, congruent: 0, response: 0, correct: 1, rtMs: 450 },
    { trial: 2, shape: 1, side: 1, congruent: 1, response: null, correct: 0, rtMs: null }]);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, { trials: 80, responseMs: 2000, itiMs: 800 }, score));
});

test('Simon owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'SimonTaskGame', category: 'attention', version: '1.0.1' });
});

test('Simon private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
