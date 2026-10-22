import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, FakeClock, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'attention-network-task';
const LoadTrials = async () => LoadGameModule(gameId, 'logic/antTrials.ts');
const Count = (items, test) => items.filter(test).length;
const Key = trial => [trial.location, trial.cue, trial.condition, trial.target].join('/');

test('ANT keeps the original window and length, and practice can be turned off', async () => {
  const { defaultSettings, ValidateSettings, EstimatedSeconds } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { responseWindowMs: 1700, rounds: 144, practice: true });
  assert.equal(ValidateSettings(defaultSettings), true);
  assert.equal(EstimatedSeconds(defaultSettings), 594);
  assert.equal(EstimatedSeconds({ responseWindowMs: 500, rounds: 48, practice: false }), 170);
  for (const change of [{ responseWindowMs: 500 }, { responseWindowMs: 1800 }, { rounds: 48 }, { rounds: 96 }, { practice: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ responseWindowMs: 400 }, { responseWindowMs: 1750 }, { responseWindowMs: 1900 }, { rounds: 0 }, { rounds: 72 }, { rounds: 192 },
    { rounds: '144' }, { practice: 'yes' }, { responseWindowMs: Infinity }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
});

test('each block holds every cue, position, flanker type and direction once; practice keeps the original mix', async () => {
  const { CreateAntPlan, CreateRandom } = await LoadTrials();
  for (const seed of [4, 12, 77]) {
    const plan = CreateAntPlan({ responseWindowMs: 1700, rounds: 144, practice: true }, CreateRandom(seed));
    assert.deepEqual(CreateAntPlan({ responseWindowMs: 1700, rounds: 144, practice: true }, CreateRandom(seed)), plan, 'The same seed repeats the session.');
    assert.deepEqual(plan.map(segment => [segment.kind, segment.block, segment.trials.length]), [['practice', 0, 24], ['block', 1, 48], ['block', 2, 48], ['block', 3, 48]]);
    const practice = plan[0].trials;
    assert.ok(practice.every(trial => trial.practice));
    assert.deepEqual(['nocue', 'center', 'double', 'spatial'].map(cue => Count(practice, trial => trial.cue === cue)), [6, 6, 6, 6]);
    assert.deepEqual([Count(practice, trial => trial.location === 'up'), Count(practice, trial => trial.target === 'left')], [15, 15]);
    assert.equal(Count(practice, trial => trial.cue === 'nocue' && trial.location === 'down'), 0, 'Practice no-cue rows are all above.');
    assert.equal(Count(practice, trial => trial.cue === 'double' && trial.location === 'up'), 0, 'Practice double-cue rows are all below.');
    for (const block of plan.slice(1)) {
      assert.ok(block.trials.every(trial => !trial.practice));
      assert.equal(new Set(block.trials.map(Key)).size, 48, 'Every combination appears once per block.');
    }
  }
  const short = CreateAntPlan({ responseWindowMs: 1700, rounds: 48, practice: false }, CreateRandom(2));
  assert.deepEqual(short.map(segment => [segment.kind, segment.block]), [['block', 1]]);
});

test('each item has a random 400 to 1599 ms fixation, a 100 ms cue and a 400 ms fixation, padded to 3.5 s', async () => {
  const { CreateAntStep, CreateRandom } = await LoadTrials();
  const random = CreateRandom(5);
  const settings = { responseWindowMs: 1200, rounds: 48, practice: true };
  const gaps = new Set();
  for (const practice of [true, false]) {
    for (let index = 0; index < 200; index++) {
      const step = CreateAntStep({ cue: 'spatial', location: 'up', condition: 'neutral', target: 'left', practice }, settings, random);
      const [first, cue, second] = step.timing.lead;
      assert.equal(first.state, 'fixation');
      assert.ok(Number.isInteger(first.ms) && first.ms >= 400 && first.ms < 1600, `fixation ${first.ms}`);
      gaps.add(Math.floor((first.ms - 400) / 300));
      assert.deepEqual([cue, second], [{ state: 'cue', ms: 100 }, { state: 'fixation', ms: 400 }]);
      assert.deepEqual({ ...step.timing, lead: undefined }, { lead: undefined, exposureMs: 1200, windowMs: 1200, endOnResponse: true,
        feedbackMs: practice ? 1000 : 0, gapMs: 0, trialMs: 3500 });
    }
  }
  assert.deepEqual([...gaps].sort(), [0, 1, 2, 3], 'The first fixation spreads across its range.');
});

test('an answered item still lasts 3.5 s from its first fixation', async () => {
  const { TrialRun } = await LoadGameModule(gameId, 'logic/trialRun.ts');
  const clock = FakeClock();
  const shows = [];
  const timing = { lead: [{ state: 'fixation', ms: 700 }, { state: 'cue', ms: 100 }, { state: 'fixation', ms: 400 }], exposureMs: 1700, windowMs: 1700,
    endOnResponse: true, feedbackMs: 0, gapMs: 0, trialMs: 3500 };
  const run = new TrialRun(2, () => ({ trial: 'item', timing }), {
    lead() {}, show: () => shows.push(clock.now()), hide() {}, signal() {}, end() {}, clear() {},
  }, clock, () => {}, 1000);
  run.start();
  clock.advance(1000 + 1200 + 450);
  assert.equal(run.respond('left'), true);
  clock.advance(3500);
  assert.deepEqual(shows, [2200, 5700]);
});

test('the summary keeps the original fields and adds alerting, orienting and conflict differences from correct items', async () => {
  const { SummarizeAnt } = await LoadGameModule(gameId, 'logic/antScore.ts');
  const row = (cue, condition, response, rtMs, practice = false) => ({ trial: 0, practice, cue, location: 'up', condition, target: 'left', response, rtMs });
  const rows = [row('nocue', 'congruent', 'left', 900, true), row('nocue', 'congruent', 'left', 600), row('double', 'congruent', 'left', 520),
    row('center', 'incongruent', 'left', 640), row('spatial', 'neutral', 'left', 500), row('spatial', 'incongruent', 'right', 700), row('double', 'neutral', null, null)];
  assert.deepEqual(SummarizeAnt(rows), { trials: 6, scored: 6, correct: 4, accuracy: 66.7, meanResponseMs: 592, misses: 1, meanCorrectRtMs: 565,
    alertingMs: 80, orientingMs: 140, conflictMs: 80 });
  assert.deepEqual(SummarizeAnt([]), { trials: 0, scored: 0, correct: 0, accuracy: null, meanResponseMs: null, misses: 0, meanCorrectRtMs: null,
    alertingMs: null, orientingMs: null, conflictMs: null });
});

test('ANT rows keep the original columns, include practice and save through the private channel', async () => {
  const scoreModule = await LoadGameModule(gameId, 'logic/antScore.ts');
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/antScore': scoreModule });
  const settings = { responseWindowMs: 1700, rounds: 48, practice: true };
  const score = BuildGameScore([
    { trial: 1, practice: true, cue: 'spatial', location: 'down', condition: 'incongruent', target: 'right', response: 'right', rtMs: 610 },
    { trial: 2, practice: false, cue: 'nocue', location: 'up', condition: 'neutral', target: 'left', response: null, rtMs: null }], settings);
  assert.deepEqual(score.rounds, [
    { trial: 1, practice: 1, cue: 3, location: 1, condition: 2, target: 1, response: 1, correct: 1, responseMs: 610, setting: 1700 },
    { trial: 2, practice: 0, cue: 0, location: 0, condition: 0, target: 0, response: null, correct: 0, responseMs: null, setting: 1700 }]);
  assert.equal(score.gameId, gameId);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, settings, score));
});

test('ANT owns its runtime, catalogue entry and results without Hub dependencies, with compliant copy', async () => {
  await CheckGamePackaging(gameId, { component: 'AttentionNetworkGame', category: 'attention', version: '2.0.0' });
});

test('ANT private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
