import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, FakeClock, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'stop-signal';
const LoadTrials = async () => LoadGameModule(gameId, 'logic/stopSignalTrials.ts');
const Count = (items, test) => items.filter(test).length;

test('Stop-signal keeps the original window and length, and practice and the key guide are options', async () => {
  const { defaultSettings, ValidateSettings, EstimatedSeconds } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { responseWindowMs: 1850, rounds: 600, practice: true, keyGuide: false });
  assert.equal(ValidateSettings(defaultSettings), true);
  assert.equal(EstimatedSeconds(defaultSettings), 1530);
  assert.equal(EstimatedSeconds({ responseWindowMs: 1000, rounds: 100, practice: false, keyGuide: false }), 153);
  for (const change of [{ responseWindowMs: 1000 }, { responseWindowMs: 3000 }, { rounds: 100 }, { rounds: 300 }, { practice: false }, { keyGuide: true }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ responseWindowMs: 950 }, { responseWindowMs: 1825 }, { responseWindowMs: 3050 }, { rounds: 0 }, { rounds: 150 }, { rounds: 700 },
    { rounds: '600' }, { practice: 1 }, { keyGuide: 'yes' }, { responseWindowMs: NaN }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
});

test('two shapes belong to each key, and the session runs practice then blocks of fifty in two stop-frequency conditions', async () => {
  const { CreateStopSignalPlan, CreateRandom } = await LoadTrials();
  const firstConditions = new Set();
  for (const seed of [2, 9, 31, 64]) {
    const plan = CreateStopSignalPlan({ responseWindowMs: 1850, rounds: 600, practice: true, keyGuide: false }, CreateRandom(seed));
    assert.deepEqual(CreateStopSignalPlan({ responseWindowMs: 1850, rounds: 600, practice: true, keyGuide: false }, CreateRandom(seed)), plan,
      'The same seed repeats the session.');
    assert.equal(plan.keyMap.length, 4);
    assert.deepEqual([Count(plan.keyMap, side => side === 'left'), Count(plan.keyMap, side => side === 'right')], [2, 2]);
    assert.deepEqual(plan.segments.map(segment => segment.kind), ['practice-go', 'practice-stop', ...Array(12).fill('block')]);
    const [practiceGo, practiceStop, ...blocks] = plan.segments;
    assert.equal(practiceGo.trials.length, 12);
    assert.equal(Count(practiceGo.trials, trial => trial.stop), 0);
    assert.equal(practiceStop.trials.length, 20);
    assert.equal(Count(practiceStop.trials, trial => trial.stop), 6);
    for (const shape of [0, 1, 2, 3]) {
      assert.equal(Count(practiceGo.trials, trial => trial.shape === shape), 3);
      assert.equal(Count(practiceStop.trials, trial => trial.shape === shape), 5);
    }
    assert.ok([...practiceGo.trials, ...practiceStop.trials].every(trial => trial.practice && trial.condition === null));
    firstConditions.add(blocks[0].condition);
    for (const [index, block] of blocks.entries()) {
      assert.equal(block.block, index + 1);
      assert.equal(block.condition, index < 6 ? blocks[0].condition : blocks[0].condition === 'high' ? 'low' : 'high');
      assert.equal(block.trials.length, 50);
      assert.equal(Count(block.trials, trial => trial.stop), block.condition === 'high' ? 20 : 10);
      for (const shape of [0, 1, 2, 3]) assert.ok([12, 13].includes(Count(block.trials, trial => trial.shape === shape)));
      assert.ok(block.trials.every(trial => !trial.practice && trial.condition === block.condition && trial.target === plan.keyMap[trial.shape]));
    }
  }
  assert.deepEqual([...firstConditions].sort(), ['high', 'low'], 'Either condition can come first.');
  const short = CreateStopSignalPlan({ responseWindowMs: 1850, rounds: 100, practice: false, keyGuide: false }, CreateRandom(3));
  assert.deepEqual(short.segments.map(segment => [segment.kind, segment.block]), [['block', 1], ['block', 2]]);
  assert.equal(short.segments[1].condition, short.segments[0].condition, 'Shorter sessions stop in the original order.');
});

test('the stop delay climbs after a successful stop and drops after a missed one, inside 0 to 850 ms', async () => {
  const { NextStopDelay, initialStopDelayMs } = await LoadTrials();
  assert.equal(initialStopDelayMs, 250);
  assert.equal(NextStopDelay(250, true), 300);
  assert.equal(NextStopDelay(250, false), 200);
  assert.equal(NextStopDelay(850, true), 850);
  assert.equal(NextStopDelay(0, false), 0);
});

test('each item has a fixation, an 850 ms shape and the full window; practice stops use a fixed 250 ms delay', async () => {
  const { CreateStopSignalStep } = await LoadTrials();
  const settings = { responseWindowMs: 1600, rounds: 100, practice: true, keyGuide: false };
  const trial = (stop, practice) => ({ shape: 0, target: 'left', stop, practice, condition: practice ? null : 'high' });
  const base = { lead: [{ state: 'fixation', ms: 500 }], exposureMs: 850, windowMs: 1600, endOnResponse: false, gapMs: 0, signalDurationMs: 500 };
  assert.deepEqual(CreateStopSignalStep(trial(false, false), 400, settings).timing, { ...base, feedbackMs: 0, signalMs: null });
  assert.deepEqual(CreateStopSignalStep(trial(true, false), 400, settings).timing, { ...base, feedbackMs: 0, signalMs: 400 });
  assert.deepEqual(CreateStopSignalStep(trial(true, true), 400, settings).timing, { ...base, feedbackMs: 750, signalMs: 250 });
  assert.deepEqual(CreateStopSignalStep(trial(false, true), 400, settings).timing, { ...base, feedbackMs: 750, signalMs: null });
});

test('the stop signal shows at its delay for 500 ms, and a press does not end the item early', async () => {
  const { TrialRun } = await LoadGameModule(gameId, 'logic/trialRun.ts');
  const clock = FakeClock();
  const events = [];
  let finished = null;
  const timing = { lead: [{ state: 'fixation', ms: 500 }], exposureMs: 850, windowMs: 1850, endOnResponse: false, feedbackMs: 0, gapMs: 0, signalMs: 300, signalDurationMs: 500 };
  const run = new TrialRun(1, () => ({ trial: 'stop', timing }), {
    lead: state => events.push([state, clock.now()]), show: () => events.push(['show', clock.now()]), hide: () => events.push(['hide', clock.now()]),
    signal: () => events.push(['signal', clock.now()]), signalOff: () => events.push(['signal-off', clock.now()]),
    end: outcome => events.push(['end', outcome.response, outcome.rtMs, outcome.signalled, clock.now()]), clear: () => events.push(['clear', clock.now()]),
  }, clock, outcomes => { finished = outcomes; }, 1000);
  run.start();
  clock.advance(1500 + 200);
  assert.equal(run.respond('left'), true);
  clock.advance(3000);
  assert.deepEqual(events, [['fixation', 1000], ['show', 1500], ['signal', 1800], ['signal-off', 2300], ['hide', 2350], ['end', 'left', 200, true, 3350], ['clear', 3350]]);
  assert.equal(finished.length, 1);
  assert.equal(clock.pending(), 0);
});

test('block feedback follows the original reminders for slow, missed, wrong and stop-balance problems', async () => {
  const { BlockFeedback } = await LoadGameModule(gameId, 'logic/stopSignalScore.ts');
  const go = (rtMs, correct = true) => ({ trial: 0, practice: false, shape: 0, target: 'left', response: rtMs === null ? null : correct ? 'left' : 'right', rtMs, stop: false, stopDelayMs: null, condition: 'low' });
  const stop = responded => ({ trial: 0, practice: false, shape: 0, target: 'left', response: responded ? 'left' : null, rtMs: responded ? 400 : null, stop: true, stopDelayMs: 250, condition: 'low' });
  const good = [...Array(9).fill(0).map((_, index) => go(400 + index * 10)), stop(true), stop(false)];
  assert.deepEqual(BlockFeedback(good, []), { medianGoRtMs: 440, goAccuracy: 100, stopSuccess: 50, tips: [] });
  const slow = [...Array(8).fill(0).map(() => go(1200)), go(1300, false), go(null), stop(false), stop(false), stop(false), stop(false)];
  assert.deepEqual(BlockFeedback(slow, []), { medianGoRtMs: 1200, goAccuracy: 80, stopSuccess: 100, tips: ['slow', 'missed', 'stop-less'] });
  assert.deepEqual(BlockFeedback([go(500, false), go(500), stop(true), stop(true), stop(true), stop(false)], []).tips, ['accuracy', 'stop-more']);
  assert.deepEqual(BlockFeedback(good, [40, 40]).tips, ['stop-more'], 'The running stop average across blocks also counts.');
  assert.deepEqual(BlockFeedback([go(400), go(410)], []), { medianGoRtMs: 405, goAccuracy: 100, stopSuccess: null, tips: [] });
});

test('the summary counts counted items only and estimates the stop time by the integration method', async () => {
  const { SummarizeStopSignal } = await LoadGameModule(gameId, 'logic/stopSignalScore.ts');
  const row = (target, response, rtMs, stop = false, stopDelayMs = null, practice = false) => ({ trial: 0, practice, shape: 0, target, response, rtMs, stop, stopDelayMs,
    condition: practice ? null : 'high' });
  const rows = [row('left', 'right', 200, false, null, true), row('right', 'right', 300), row('left', 'left', 400), row('right', 'left', 500), row('left', 'left', 600),
    row('right', null, null), row('left', null, null, true, 200), row('right', 'right', 350, true, 250)];
  assert.deepEqual(SummarizeStopSignal(rows), { trials: 7, scored: 7, correct: 4, accuracy: 57.1, meanResponseMs: 430, goTrials: 5, stopTrials: 2,
    omissionErrors: 1, stopSuccessRate: 50, meanGoRtMs: 433, meanStopDelayMs: 225, ssrtMs: 275 });
  const empty = SummarizeStopSignal([]);
  assert.deepEqual(empty, { trials: 0, scored: 0, correct: 0, accuracy: null, meanResponseMs: null, goTrials: 0, stopTrials: 0, omissionErrors: 0,
    stopSuccessRate: null, meanGoRtMs: null, meanStopDelayMs: null, ssrtMs: null });
  assert.equal(SummarizeStopSignal([row('left', 'left', 400), row('left', null, null, true, 250)]).ssrtMs, null, 'No estimate when every stop succeeded.');
});

test('Stop-signal rows keep the original columns, include practice and save through the private channel', async () => {
  const scoreModule = await LoadGameModule(gameId, 'logic/stopSignalScore.ts');
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/stopSignalScore': scoreModule });
  const settings = { responseWindowMs: 1850, rounds: 100, practice: true, keyGuide: false };
  const score = BuildGameScore([
    { trial: 1, practice: true, shape: 2, target: 'right', response: 'right', rtMs: 450, stop: false, stopDelayMs: null, condition: null },
    { trial: 2, practice: false, shape: 1, target: 'left', response: 'left', rtMs: 520, stop: true, stopDelayMs: 300, condition: 'high' },
    { trial: 3, practice: false, shape: 0, target: 'left', response: null, rtMs: null, stop: false, stopDelayMs: null, condition: 'low' }], settings);
  assert.deepEqual(score.rounds, [
    { trial: 1, practice: 1, shape: 2, target: 1, response: 1, correct: 1, responseMs: 450, stop: 0, stopDelayMs: null, condition: null, omission: 0, setting: 1850 },
    { trial: 2, practice: 0, shape: 1, target: 0, response: 0, correct: 0, responseMs: 520, stop: 1, stopDelayMs: 300, condition: 1, omission: 0, setting: 1850 },
    { trial: 3, practice: 0, shape: 0, target: 0, response: null, correct: 0, responseMs: null, stop: 0, stopDelayMs: null, condition: 0, omission: 1, setting: 1850 }]);
  assert.equal(score.gameId, gameId);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, settings, score));
});

test('Stop-signal owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'StopSignalGame', category: 'attention', version: '2.0.1' });
});

test('Stop-signal private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
