import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, FakeClock, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'antisaccade';
const LoadTrials = async () => LoadGameModule(gameId, 'logic/antisaccadeTrials.ts', { '../settings': await LoadGameModule(gameId, 'settings.ts') });

test('Antisaccade keeps the original arrow time, counted items and 22 practice items', async () => {
  const { defaultSettings, ValidateSettings, EstimatedSeconds, practiceItems } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { exposureMs: 150, rounds: 90, practice: true });
  assert.equal(practiceItems, 22);
  assert.equal(ValidateSettings(defaultSettings), true);
  // Each item: 0.5 s cross, 0.225 s square, the arrow, then 1 s of mask; practice adds 0.8 s of feedback and a 3 s break.
  assert.equal(EstimatedSeconds(defaultSettings), Math.round((1500 + 112 * 1875 + 22 * 800 + 3000) / 1000));
  assert.equal(EstimatedSeconds({ exposureMs: 300, rounds: 30, practice: false }), Math.round((1500 + 30 * 2025) / 1000));
  for (const change of [{ exposureMs: 50 }, { exposureMs: 75 }, { exposureMs: 300 }, { rounds: 30 }, { rounds: 60 }, { practice: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ exposureMs: 25 }, { exposureMs: 160 }, { exposureMs: 325 }, { rounds: 20 }, { rounds: 45 }, { rounds: 120 }, { rounds: '90' }, { practice: 'yes' }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
});

test('the square and the arrow are always on opposite sides, with sides and directions balanced in blocks of six', async () => {
  const { CreateAntisaccadeTrials, CreateRandom } = await LoadTrials();
  for (const seed of [2, 19, 404]) {
    const trials = CreateAntisaccadeTrials(90, CreateRandom(seed));
    assert.equal(trials.length, 90);
    assert.deepEqual(CreateAntisaccadeTrials(90, CreateRandom(seed)), trials, 'The same seed repeats the sequence.');
    for (const trial of trials) assert.notEqual(trial.cue, trial.side, 'The arrow appears on the side away from the square.');
    for (let block = 0; block < 15; block++) {
      assert.deepEqual(trials.slice(block * 6, block * 6 + 6).map(trial => `${trial.cue}-${trial.arrow}`).sort(),
        ['left-left', 'left-right', 'left-up', 'right-left', 'right-right', 'right-up']);
    }
  }
  assert.equal(CreateAntisaccadeTrials(22, CreateRandom(1), true).every(trial => trial.practice), true);
});

test('each item shows the cross, the square, the arrow and the mask; answers stay open through the mask', async () => {
  const { CreateAntisaccadeSteps, CreateRandom } = await LoadTrials();
  const steps = CreateAntisaccadeSteps({ exposureMs: 200, rounds: 30, practice: true }, CreateRandom(5));
  assert.equal(steps.length, 52);
  assert.deepEqual(steps.map(step => step.trial.practice), [...Array(22).fill(true), ...Array(30).fill(false)]);
  for (const [index, step] of steps.entries()) {
    const lead = [{ state: 'fixation', ms: 500 }, { state: 'cue', ms: 225 }];
    assert.deepEqual(step.timing, { lead: index === 22 ? [{ state: 'break', ms: 3000 }, ...lead] : lead,
      exposureMs: 200, windowMs: 1200, endOnResponse: false, feedbackMs: index < 22 ? 800 : 0, gapMs: 0 });
  }
  const counted = CreateAntisaccadeSteps({ exposureMs: 150, rounds: 60, practice: false }, CreateRandom(5));
  assert.equal(counted.length, 60);
  assert.ok(counted.every(step => !step.trial.practice && step.timing.lead.length === 2));
});

test('an answer during the mask counts from arrow onset and does not cut the item short', async () => {
  const { TrialRun } = await LoadGameModule(gameId, 'logic/trialRun.ts');
  const clock = FakeClock();
  const seen = [];
  const timing = { lead: [{ state: 'fixation', ms: 500 }, { state: 'cue', ms: 225 }], exposureMs: 150, windowMs: 1150, endOnResponse: false, feedbackMs: 0, gapMs: 0 };
  const run = new TrialRun(2, () => ({ trial: 'x', timing }), { lead: state => seen.push(state), show: () => seen.push('arrow'), hide: () => seen.push('mask'), signal() {},
    end: outcome => seen.push([outcome.response, outcome.rtMs, clock.now()]), clear() {} }, clock, () => {}, 1000);
  run.start();
  clock.advance(1000 + 500 + 100);
  assert.equal(run.respond('left'), false, 'A key during the square is ignored.');
  clock.advance(125 + 400);
  assert.equal(run.respond('up'), true);
  assert.equal(run.respond('right'), false, 'Only the first answer counts.');
  clock.advance(750 + 1875);
  assert.deepEqual(seen, ['fixation', 'cue', 'arrow', 'mask', ['up', 400, 2875], 'fixation', 'cue', 'arrow', 'mask', [null, null, 4750]]);
});

test('the summary counts only counted items, and the mean answer time keeps every answered item', async () => {
  const { SummarizeAntisaccade } = await LoadGameModule(gameId, 'logic/antisaccadeScore.ts');
  const row = (correct, rtMs, practice = false) => ({ trial: 0, practice, side: 1, arrow: 1, response: rtMs === null ? null : correct ? 1 : 0, correct, rtMs });
  const rows = [row(false, 700, true), row(true, 400), row(true, 600), row(false, 300), row(false, null), row(true, 500)];
  assert.deepEqual(SummarizeAntisaccade(rows), { trials: 5, scored: 5, correct: 3, accuracy: 60, meanResponseMs: 450, correctResponseMs: 500, wrong: 1, misses: 1 });
  assert.deepEqual(SummarizeAntisaccade([]), { trials: 0, scored: 0, correct: 0, accuracy: null, meanResponseMs: null, correctResponseMs: null, wrong: 0, misses: 0 });
});

test('Antisaccade rows keep the original columns, include practice items and save through the private channel', async () => {
  const scoreModule = await LoadGameModule(gameId, 'logic/antisaccadeScore.ts');
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/antisaccadeScore': scoreModule });
  const settings = { exposureMs: 150, rounds: 30, practice: true };
  const score = BuildGameScore([{ trial: 1, practice: true, side: 0, arrow: 2, response: 2, correct: true, rtMs: 520 },
    { trial: 2, practice: false, side: 1, arrow: 1, response: null, correct: false, rtMs: null }], settings);
  assert.deepEqual(score.rounds, [
    { trial: 1, practice: 1, location: 0, arrow: 2, response: 2, correct: 1, omission: 0, responseMs: 520, setting: 150 },
    { trial: 2, practice: 0, location: 1, arrow: 1, response: null, correct: 0, omission: 1, responseMs: null, setting: 150 }]);
  assert.equal(score.gameId, gameId);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, settings, score));
});

test('Antisaccade owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'AntisaccadeGame', category: 'attention', version: '2.0.0' });
});

test('Antisaccade private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
