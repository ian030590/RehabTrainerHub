import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, FakeClock, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'stroop';
const LoadTrials = async () => LoadGameModule(gameId, 'logic/stroopTrials.ts');

test('Stroop keeps the original answer limit and length, and practice can be turned off', async () => {
  const { defaultSettings, ValidateSettings, EstimatedSeconds } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { responseWindowMs: 1500, rounds: 96, practice: true });
  assert.equal(ValidateSettings(defaultSettings), true);
  assert.equal(EstimatedSeconds(defaultSettings), 299);
  assert.equal(EstimatedSeconds({ ...defaultSettings, practice: false }), 237);
  for (const change of [{ responseWindowMs: 500 }, { responseWindowMs: 3000 }, { rounds: 12 }, { rounds: 96 }, { practice: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ responseWindowMs: 400 }, { responseWindowMs: 1550 }, { responseWindowMs: 3100 }, { rounds: 0 }, { rounds: 18 },
    { rounds: 108 }, { rounds: '96' }, { practice: 'yes' }, { responseWindowMs: NaN }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
});

test('every block of twelve matches the original mix: each color word twice in its own ink, each mismatch once', async () => {
  const { CreateStroopTrials, CreateRandom } = await LoadTrials();
  for (const seed of [2, 9, 40]) {
    const trials = CreateStroopTrials(96, CreateRandom(seed));
    assert.equal(trials.length, 96);
    assert.deepEqual(CreateStroopTrials(96, CreateRandom(seed)), trials, 'The same seed repeats the sequence.');
    for (let block = 0; block < 8; block++) {
      const items = trials.slice(block * 12, block * 12 + 12);
      assert.deepEqual(items.map(trial => `${trial.word}-${trial.ink}`).sort(), [
        'blue-blue', 'blue-blue', 'blue-green', 'blue-red', 'green-blue', 'green-green', 'green-green', 'green-red',
        'red-blue', 'red-green', 'red-red', 'red-red']);
      for (const trial of items) assert.equal(trial.congruent, trial.word === trial.ink);
    }
  }
});

test('the session runs practice with a break before the counted rounds, using the chosen answer limit', async () => {
  const { CreateStroopSteps, CreateRandom } = await LoadTrials();
  const steps = CreateStroopSteps({ responseWindowMs: 2000, rounds: 12, practice: true }, CreateRandom(5));
  assert.equal(steps.length, 36);
  assert.deepEqual(steps.map(step => step.trial.practice), [...Array(24).fill(true), ...Array(12).fill(false)]);
  for (const [index, step] of steps.entries()) {
    assert.deepEqual(step.timing, { lead: index === 24 ? [{ state: 'break', ms: 3000 }, { state: 'fixation', ms: 500 }, { state: 'blank', ms: 500 }]
      : [{ state: 'fixation', ms: 500 }, { state: 'blank', ms: 500 }], exposureMs: null, windowMs: 2000, endOnResponse: true, feedbackMs: 500, gapMs: 250 });
  }
  const counted = CreateStroopSteps({ responseWindowMs: 1500, rounds: 24, practice: false }, CreateRandom(5));
  assert.equal(counted.length, 24);
  assert.ok(counted.every(step => !step.trial.practice && step.timing.lead.length === 2));
});

test('the trial timer runs lead screens, ends on an answer, shows feedback and times out a missing answer', async () => {
  const { TrialRun } = await LoadGameModule(gameId, 'logic/trialRun.ts');
  const clock = FakeClock();
  const events = [];
  let finished = null;
  const timing = { lead: [{ state: 'fixation', ms: 500 }, { state: 'blank', ms: 500 }], exposureMs: null, windowMs: 1500, endOnResponse: true, feedbackMs: 500, gapMs: 250 };
  const steps = [{ trial: 'a', timing }, { trial: 'b', timing }];
  const run = new TrialRun(steps.length, index => steps[index], {
    lead: (state, step, index) => events.push(['lead', state, index, clock.now()]),
    show: (step, index) => events.push(['show', step.trial, index, clock.now()]),
    hide: () => events.push(['hide', clock.now()]), signal: () => events.push(['signal', clock.now()]),
    end: (outcome, feedback) => events.push(['end', outcome.response, outcome.rtMs, feedback, clock.now()]),
    clear: () => events.push(['clear', clock.now()]),
  }, clock, outcomes => { finished = outcomes; }, 1000);
  run.start();
  assert.equal(run.respond('red'), false, 'Answers before the word appears are ignored.');
  clock.advance(1000 + 1000 + 420);
  assert.equal(run.respond('red'), true);
  assert.equal(run.respond('blue'), false, 'Only the first answer counts.');
  clock.advance(500 + 250 + 1000 + 1500);
  assert.equal(finished, null);
  clock.advance(500 + 250);
  assert.deepEqual(events, [['lead', 'fixation', 0, 1000], ['lead', 'blank', 0, 1500], ['show', 'a', 0, 2000], ['end', 'red', 420, true, 2420],
    ['clear', 2920], ['lead', 'fixation', 1, 3170], ['lead', 'blank', 1, 3670], ['show', 'b', 1, 4170], ['end', null, null, true, 5670],
    ['clear', 6170]]);
  assert.deepEqual(finished.map(outcome => [outcome.index, outcome.trial, outcome.response, outcome.rtMs]), [[0, 'a', 'red', 420], [1, 'b', null, null]]);
  assert.equal(clock.pending(), 0);
});

test('stopping the trial timer cancels every timer and ignores later answers', async () => {
  const { TrialRun } = await LoadGameModule(gameId, 'logic/trialRun.ts');
  const clock = FakeClock();
  let finished = false;
  const timing = { lead: [{ state: 'fixation', ms: 500 }], exposureMs: null, windowMs: 1500, endOnResponse: true, feedbackMs: 500, gapMs: 250 };
  const run = new TrialRun(1, () => ({ trial: 'a', timing }), { lead() {}, show() {}, hide() {}, signal() {}, end() {}, clear() {} },
    clock, () => { finished = true; }, 1000);
  run.start();
  clock.advance(1700);
  run.stop();
  assert.equal(run.respond('red'), false);
  clock.advance(10000);
  assert.equal(finished, false);
  assert.equal(clock.pending(), 0);
});

test('the summary counts only the counted rounds and compares matching with mismatched words', async () => {
  const { SummarizeStroop } = await LoadGameModule(gameId, 'logic/stroopScore.ts');
  const row = (congruent, correct, rtMs, practice = false) => ({ trial: 0, practice, congruent, word: 0, ink: 0, response: rtMs === null ? null : 0, correct, rtMs });
  const rows = [row(true, true, 300, true), row(false, false, 900, true), row(true, true, 500), row(true, true, 600), row(true, false, 400),
    row(false, true, 700), row(false, true, 800), row(false, false, null)];
  assert.deepEqual(SummarizeStroop(rows), { trials: 6, scored: 6, correct: 4, accuracy: 66.7, meanResponseMs: 600, congruentRtMs: 550,
    incongruentRtMs: 750, interferenceMs: 200, congruentAccuracy: 66.7, incongruentAccuracy: 66.7, misses: 1 });
  assert.deepEqual(SummarizeStroop([row(true, true, 300, true)]), { trials: 0, scored: 0, correct: 0, accuracy: null, meanResponseMs: null,
    congruentRtMs: null, incongruentRtMs: null, interferenceMs: null, congruentAccuracy: null, incongruentAccuracy: null, misses: 0 });
});

test('Stroop rows keep the original columns, include practice items and save through the private channel', async () => {
  const scoreModule = await LoadGameModule(gameId, 'logic/stroopScore.ts');
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/stroopScore': scoreModule });
  const settings = { responseWindowMs: 1500, rounds: 12, practice: true };
  const score = BuildGameScore([{ trial: 1, practice: true, congruent: false, word: 0, ink: 2, response: 2, correct: true, rtMs: 640 },
    { trial: 2, practice: false, congruent: true, word: 1, ink: 1, response: null, correct: false, rtMs: null }], settings);
  assert.deepEqual(score.rounds, [
    { trial: 1, practice: 1, condition: 1, word: 0, color: 2, response: 2, correct: 1, responseMs: 640, setting: 1500 },
    { trial: 2, practice: 0, condition: 0, word: 1, color: 1, response: null, correct: 0, responseMs: null, setting: 1500 }]);
  assert.equal(score.gameId, gameId);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, settings, score));
});

test('Stroop owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'StroopGame', category: 'attention', version: '2.0.1' });
});

test('Stroop private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
