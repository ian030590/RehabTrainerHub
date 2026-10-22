import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, FakeClock, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'flanker';
const LoadTrials = async () => LoadGameModule(gameId, 'logic/flankerTrials.ts');

test('Flanker keeps the original answer limit and length, adds arrows and keeps the letter version', async () => {
  const { defaultSettings, ValidateSettings, EstimatedSeconds } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { responseWindowMs: 1500, rounds: 100, practice: true, stimulus: 'arrows' });
  assert.equal(ValidateSettings(defaultSettings), true);
  assert.equal(EstimatedSeconds(defaultSettings), 296);
  assert.equal(EstimatedSeconds({ ...defaultSettings, rounds: 20, practice: false }), 54);
  for (const change of [{ responseWindowMs: 500 }, { responseWindowMs: 3000 }, { rounds: 20 }, { rounds: 60 }, { practice: false }, { stimulus: 'letters' }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ responseWindowMs: 450 }, { responseWindowMs: 1550 }, { responseWindowMs: 3100 }, { rounds: 10 }, { rounds: 30 },
    { rounds: 120 }, { rounds: '100' }, { practice: 1 }, { stimulus: 'shapes' }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
});

test('every block of four holds both centers with matching and opposing flankers, as in the original', async () => {
  const { CreateFlankerTrials, CreateRandom } = await LoadTrials();
  for (const seed of [3, 11, 77]) {
    const trials = CreateFlankerTrials(100, CreateRandom(seed));
    assert.equal(trials.length, 100);
    assert.deepEqual(CreateFlankerTrials(100, CreateRandom(seed)), trials, 'The same seed repeats the sequence.');
    for (let block = 0; block < 25; block++) {
      assert.deepEqual(trials.slice(block * 4, block * 4 + 4).map(trial => `${trial.target}-${trial.flanker}`).sort(),
        ['left-left', 'left-right', 'right-left', 'right-right']);
    }
    for (const trial of trials) assert.equal(trial.congruent, trial.target === trial.flanker);
  }
});

test('practice comes first with a break, and each item shows feedback without the row', async () => {
  const { CreateFlankerSteps, CreateRandom } = await LoadTrials();
  const steps = CreateFlankerSteps({ responseWindowMs: 1200, rounds: 20, practice: true }, CreateRandom(4));
  assert.equal(steps.length, 32);
  assert.deepEqual(steps.map(step => step.trial.practice), [...Array(12).fill(true), ...Array(20).fill(false)]);
  for (const [index, step] of steps.entries()) {
    assert.deepEqual(step.timing, { lead: index === 12 ? [{ state: 'break', ms: 3000 }, { state: 'fixation', ms: 500 }] : [{ state: 'fixation', ms: 500 }],
      exposureMs: null, windowMs: 1200, endOnResponse: true, feedbackMs: 1000, gapMs: 500 });
  }
  const counted = CreateFlankerSteps({ responseWindowMs: 1500, rounds: 40, practice: false }, CreateRandom(4));
  assert.equal(counted.length, 40);
  assert.ok(counted.every(step => !step.trial.practice && step.timing.lead.length === 1));
});

test('the copied trial timer still ends on an answer and times out a missing one', async () => {
  const { TrialRun } = await LoadGameModule(gameId, 'logic/trialRun.ts');
  const clock = FakeClock();
  const ends = [];
  let finished = null;
  const timing = { lead: [{ state: 'fixation', ms: 500 }], exposureMs: null, windowMs: 1500, endOnResponse: true, feedbackMs: 1000, gapMs: 500 };
  const run = new TrialRun(2, () => ({ trial: 'x', timing }), { lead() {}, show() {}, hide() {}, signal() {},
    end: outcome => ends.push([outcome.response, outcome.rtMs, clock.now()]), clear() {} }, clock, outcomes => { finished = outcomes; }, 1000);
  run.start();
  clock.advance(1500 + 380);
  run.respond('left');
  clock.advance(1000 + 500 + 500 + 1500 + 1000 + 500);
  assert.deepEqual(ends, [['left', 380, 1880], [null, null, 5380]]);
  assert.equal(finished.length, 2);
  assert.equal(clock.pending(), 0);
});

test('the summary counts only counted items and compares matching with opposing flankers', async () => {
  const { SummarizeFlanker } = await LoadGameModule(gameId, 'logic/flankerScore.ts');
  const row = (congruent, correct, rtMs, practice = false) => ({ trial: 0, practice, congruent, target: 0, response: rtMs === null ? null : 0, correct, rtMs });
  const rows = [row(false, false, 900, true), row(true, true, 420), row(true, true, 480), row(false, true, 520), row(false, true, 560),
    row(false, false, 300), row(true, false, null)];
  assert.deepEqual(SummarizeFlanker(rows), { trials: 6, scored: 6, correct: 4, accuracy: 66.7, meanResponseMs: 456, congruentRtMs: 450,
    incongruentRtMs: 540, interferenceMs: 90, congruentAccuracy: 66.7, incongruentAccuracy: 66.7, misses: 1 });
  assert.deepEqual(SummarizeFlanker([]), { trials: 0, scored: 0, correct: 0, accuracy: null, meanResponseMs: null, congruentRtMs: null,
    incongruentRtMs: null, interferenceMs: null, congruentAccuracy: null, incongruentAccuracy: null, misses: 0 });
});

test('Flanker rows keep the original columns, include practice items and save through the private channel', async () => {
  const scoreModule = await LoadGameModule(gameId, 'logic/flankerScore.ts');
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/flankerScore': scoreModule });
  const settings = { responseWindowMs: 1500, rounds: 20, practice: true, stimulus: 'arrows' };
  const score = BuildGameScore([{ trial: 1, practice: true, congruent: false, target: 1, response: 1, correct: true, rtMs: 510 },
    { trial: 2, practice: false, congruent: true, target: 0, response: null, correct: false, rtMs: null }], settings);
  assert.deepEqual(score.rounds, [
    { trial: 1, practice: 1, condition: 1, target: 1, response: 1, correct: 1, responseMs: 510, setting: 1500 },
    { trial: 2, practice: 0, condition: 0, target: 0, response: null, correct: 0, responseMs: null, setting: 1500 }]);
  assert.equal(score.gameId, gameId);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, settings, score));
});

test('Flanker owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'FlankerGame', category: 'attention', version: '2.0.0' });
});

test('Flanker private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
