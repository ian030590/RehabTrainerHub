import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'divided-attention';
const LoadLogic = async () => LoadGameModule(gameId, 'logic/divided.ts');

test('divided attention settings default to two minutes and reject values outside each range', async () => {
  const { defaultSettings, ValidateSettings } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { durationSec: 120, speed: 'medium', mathLevel: 'easy' });
  assert.equal(ValidateSettings(defaultSettings), true);
  for (const change of [{ durationSec: 60 }, { durationSec: 240 }, { speed: 'slow' }, { speed: 'fast' }, { mathLevel: 'harder' }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ durationSec: 30 }, { durationSec: 75 }, { durationSec: 270 }, { speed: 'turbo' }, { mathLevel: 'hard' }, { durationSec: '120' }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
});

test('the moving dot follows a smooth, repeatable path that stays inside the field', async () => {
  const { CreatePath } = await LoadLogic();
  const slow = CreatePath(7, 'slow'), fast = CreatePath(7, 'fast');
  assert.deepEqual(CreatePath(7, 'slow').at(12.5), slow.at(12.5), 'The same seed repeats the path.');
  let slowDistance = 0, fastDistance = 0;
  for (let time = 0; time < 60; time += .016) {
    for (const path of [slow, fast]) {
      const point = path.at(time);
      assert.ok(point.x >= .08 && point.x <= .92 && point.y >= .08 && point.y <= .92, JSON.stringify(point));
    }
    const [a, b] = [slow.at(time), slow.at(time + .016)];
    const [c, d] = [fast.at(time), fast.at(time + .016)];
    assert.ok(Math.hypot(b.x - a.x, b.y - a.y) < .02, 'No jumps between frames.');
    slowDistance += Math.hypot(b.x - a.x, b.y - a.y);
    fastDistance += Math.hypot(d.x - c.x, d.y - c.y);
  }
  assert.ok(fastDistance > slowDistance * 1.5, 'The fast setting covers clearly more ground.');
});

test('sums have one right answer among three different options and never go below zero', async () => {
  const { CreateProblem, CreateRandom } = await LoadLogic();
  const random = CreateRandom(11);
  for (let index = 0; index < 200; index++) {
    for (const level of ['easy', 'harder']) {
      const problem = CreateProblem(level, random);
      const value = problem.operation === '+' ? problem.a + problem.b : problem.operation === '-' ? problem.a - problem.b : problem.a * problem.b;
      assert.equal(problem.answer, value);
      assert.ok(value >= 0);
      assert.equal(problem.options.length, 3);
      assert.equal(new Set(problem.options).size, 3);
      assert.ok(problem.options.includes(value) && problem.options.every(option => option >= 0));
      if (level === 'easy') assert.ok(problem.a <= 9 && problem.b <= 9 && problem.operation !== '×');
    }
  }
  const harder = Array.from({ length: 100 }, () => CreateProblem('harder', random));
  assert.ok(harder.some(problem => problem.operation === '×') && harder.some(problem => problem.a >= 10));
});

test('tracking samples split time on the dot into stretches with and without a sum showing', async () => {
  const { TrackingLog } = await LoadLogic();
  const log = new TrackingLog();
  for (let index = 0; index < 10; index++) log.add(index < 8, false);
  for (let index = 0; index < 10; index++) log.add(index < 5, true);
  assert.deepEqual(log.percentages(), { overall: 65, alone: 80, duringMath: 50 });
  assert.deepEqual(new TrackingLog().percentages(), { overall: null, alone: null, duringMath: null });
  const window = log.window();
  log.add(true, true); log.add(false, true);
  assert.equal(log.percentSince(window), 50);
});

test('the summary sets sum accuracy beside how well the dot was followed', async () => {
  const { ScoreProblem, SummarizeDivided } = await LoadLogic();
  const problem = { a: 3, b: 4, operation: '+', answer: 7, options: [6, 7, 8] };
  const rows = [ScoreProblem(1, problem, 7, 1200, 60), ScoreProblem(2, problem, 8, 1800, 40), ScoreProblem(3, problem, null, null, 30)];
  assert.deepEqual(rows[0], { problem: 1, a: 3, b: 4, operation: 0, answer: 7, chosen: 7, correct: true, rtMs: 1200, trackingPercent: 60 });
  assert.deepEqual(rows[2], { problem: 3, a: 3, b: 4, operation: 0, answer: 7, chosen: null, correct: false, rtMs: null, trackingPercent: 30 });
  assert.deepEqual(SummarizeDivided(rows, { overall: 70, alone: 80, duringMath: 50 }, 120), { durationSec: 120, trackingPercent: 70,
    trackingAlonePercent: 80, trackingDuringMathPercent: 50, trackingCostPercent: 30, problems: 3, correct: 1, accuracyPercent: 33.3, missed: 1, meanRtMs: 1500 });
  assert.deepEqual(SummarizeDivided([], { overall: null, alone: null, duringMath: null }, 60), { durationSec: 60, trackingPercent: null,
    trackingAlonePercent: null, trackingDuringMathPercent: null, trackingCostPercent: null, problems: 0, correct: 0, accuracyPercent: null, missed: 0, meanRtMs: null });
});

test('divided attention results save bounded numeric rows through the private channel', async () => {
  const logic = await LoadLogic();
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/divided': logic });
  const problem = { a: 12, b: 3, operation: '×', answer: 36, options: [33, 36, 39] };
  const score = BuildGameScore([logic.ScoreProblem(1, problem, 36, 2100, 75)], { overall: 72, alone: 75, duringMath: 70 }, 120);
  assert.deepEqual(score.rounds, [{ problem: 1, a: 12, b: 3, operation: 2, answer: 36, chosen: 36, correct: 1, rtMs: 2100, trackingPercent: 75 }]);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, { durationSec: 120, speed: 'medium', mathLevel: 'easy' }, score));
});

test('divided attention owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'DividedAttentionGame', category: 'attention', version: '1.0.1' });
});

test('divided attention private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
