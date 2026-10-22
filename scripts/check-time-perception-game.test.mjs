import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, FakeClock, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'time-perception';
const LoadLogic = async () => LoadGameModule(gameId, 'logic/timing.ts');

test('time perception settings mix the three tasks by default and reject values outside each range', async () => {
  const { defaultSettings, ValidateSettings } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { mode: 'mixed', trials: 24 });
  assert.equal(ValidateSettings(defaultSettings), true);
  for (const change of [{ mode: 'reproduce' }, { mode: 'compare' }, { mode: 'estimate' }, { trials: 12 }, { trials: 48 }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ mode: 'guess' }, { trials: 6 }, { trials: 15 }, { trials: 54 }, { trials: '24' }, { trials: NaN }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
});

test('a mixed session runs the three tasks in equal blocks and single-task sessions use one task', async () => {
  const { CreateTimingPlan, CreateRandom, reproduceTargets, estimateTargets } = await LoadLogic();
  const plan = CreateTimingPlan({ mode: 'mixed', trials: 24 }, CreateRandom(5));
  assert.deepEqual(CreateTimingPlan({ mode: 'mixed', trials: 24 }, CreateRandom(5)), plan, 'The same seed repeats the plan.');
  assert.deepEqual(plan.map(trial => trial.task), [...Array(8).fill('reproduce'), ...Array(8).fill('compare'), ...Array(8).fill('estimate')]);
  for (const trial of plan) {
    if (trial.task === 'reproduce') assert.ok(reproduceTargets.includes(trial.targetMs));
    if (trial.task === 'estimate') assert.ok(estimateTargets.includes(trial.targetMs));
    if (trial.task === 'compare') assert.equal(trial.targetMs, 1000);
  }
  const compares = plan.filter(trial => trial.task === 'compare');
  assert.equal(compares.filter(trial => trial.longer).length, 4, 'Half the comparisons are longer than the standard.');
  assert.ok(compares.some(trial => trial.standardFirst) && compares.some(trial => !trial.standardFirst));
  assert.ok(CreateTimingPlan({ mode: 'estimate', trials: 12 }, CreateRandom(1)).every(trial => trial.task === 'estimate'));
});

test('the comparison gap narrows after two right answers in a row and widens after a wrong one', async () => {
  const { Staircase } = await LoadLogic();
  const staircase = new Staircase({ startMs: 400, stepMs: 40, minMs: 40, maxMs: 600 });
  assert.equal(staircase.differenceMs, 400);
  staircase.record(true);
  assert.equal(staircase.differenceMs, 400);
  staircase.record(true);
  assert.equal(staircase.differenceMs, 360);
  staircase.record(false);
  assert.equal(staircase.differenceMs, 400);
  staircase.record(true); staircase.record(true);
  assert.equal(staircase.differenceMs, 360);
  assert.deepEqual(staircase.reversals, [360, 400]);
  assert.equal(staircase.thresholdMs(), 380);
  const floor = new Staircase({ startMs: 60, stepMs: 40, minMs: 40, maxMs: 600 });
  floor.record(true); floor.record(true);
  assert.equal(floor.differenceMs, 40, 'The gap never drops below the minimum.');
});

test('each duration is shown for its planned time and then cleared', async () => {
  const { PresentDuration } = await LoadLogic();
  const clock = FakeClock();
  const events = [];
  PresentDuration(1500, { show: () => events.push(['on', clock.now()]), hide: () => events.push(['off', clock.now()]) }, clock, () => events.push(['done', clock.now()]));
  clock.advance(2000);
  assert.deepEqual(events, [['on', 0], ['off', 1500], ['done', 1500]]);
  const stop = PresentDuration(1000, { show() {}, hide() {} }, clock, () => events.push(['late']));
  stop();
  clock.advance(2000);
  assert.equal(events.length, 3);
  assert.equal(clock.pending(), 0);
});

test('each task is scored on its own terms and the summary keeps them apart', async () => {
  const { ScoreReproduce, ScoreCompare, ScoreEstimate, SummarizeTiming } = await LoadLogic();
  const rows = [
    ScoreReproduce(1, 2000, 2300), ScoreReproduce(2, 1000, 900),
    ScoreCompare(3, 1000, 1200, 'longer'), ScoreCompare(4, 1000, 880, 'longer'),
    ScoreEstimate(5, 3000, 3000), ScoreEstimate(6, 2000, 4000),
  ];
  assert.deepEqual(rows[0], { trial: 1, task: 0, targetMs: 2000, comparisonMs: null, answerMs: 2300, errorMs: 300, correct: true });
  assert.deepEqual(rows[1], { trial: 2, task: 0, targetMs: 1000, comparisonMs: null, answerMs: 900, errorMs: -100, correct: true });
  assert.deepEqual(rows[2], { trial: 3, task: 1, targetMs: 1000, comparisonMs: 1200, answerMs: null, errorMs: null, correct: true });
  assert.deepEqual(rows[3], { trial: 4, task: 1, targetMs: 1000, comparisonMs: 880, answerMs: null, errorMs: null, correct: false });
  assert.deepEqual(rows[5], { trial: 6, task: 2, targetMs: 2000, comparisonMs: null, answerMs: 4000, errorMs: 2000, correct: false });
  assert.deepEqual(SummarizeTiming(rows, 160), { trials: 6, reproduceTrials: 2, reproduceErrorPercent: 12.5, reproduceRatio: 1.03,
    compareTrials: 2, compareAccuracyPercent: 50, compareThresholdMs: 160, estimateTrials: 2, estimateAccuracyPercent: 50, estimateMeanErrorMs: 1000 });
  assert.deepEqual(SummarizeTiming([], null), { trials: 0, reproduceTrials: 0, reproduceErrorPercent: null, reproduceRatio: null,
    compareTrials: 0, compareAccuracyPercent: null, compareThresholdMs: null, estimateTrials: 0, estimateAccuracyPercent: null, estimateMeanErrorMs: null });
});

test('time perception results save bounded numeric rows through the private channel', async () => {
  const logic = await LoadLogic();
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/timing': logic });
  const score = BuildGameScore([logic.ScoreReproduce(1, 2000, 2300), logic.ScoreCompare(2, 1000, 1200, 'shorter')], 200);
  assert.deepEqual(score.rounds, [{ trial: 1, task: 0, targetMs: 2000, comparisonMs: null, answerMs: 2300, errorMs: 300, correct: 1 },
    { trial: 2, task: 1, targetMs: 1000, comparisonMs: 1200, answerMs: null, errorMs: null, correct: 0 }]);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, { mode: 'mixed', trials: 24 }, score));
});

test('time perception owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'TimePerceptionGame', category: 'higher-cognition' });
});

test('time perception private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
