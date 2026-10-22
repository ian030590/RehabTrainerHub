import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, FakeClock, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'attentional-blink';
const LoadLogic = async () => LoadGameModule(gameId, 'logic/blink.ts');

test('attentional blink settings keep lags balanced and reject values outside each range', async () => {
  const { defaultSettings, ValidateSettings, EstimatedSeconds } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { trials: 36, itemMs: 100 });
  assert.equal(ValidateSettings(defaultSettings), true);
  assert.equal(EstimatedSeconds(defaultSettings), 238);
  for (const change of [{ trials: 24 }, { trials: 72 }, { itemMs: 80 }, { itemMs: 150 }]) assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true);
  for (const change of [{ trials: 12 }, { trials: 30 }, { trials: 84 }, { itemMs: 70 }, { itemMs: 95 }, { itemMs: 160 }, { trials: '36' }, { itemMs: NaN }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
});

test('each trial hides two different digits in a stream of letters at one of six lags, equally often', async () => {
  const { CreateBlinkTrials, CreateRandom, lags, streamLength } = await LoadLogic();
  assert.deepEqual(lags, [1, 2, 3, 4, 6, 8]);
  for (const seed of [1, 4, 77]) {
    const trials = CreateBlinkTrials(36, CreateRandom(seed));
    assert.deepEqual(CreateBlinkTrials(36, CreateRandom(seed)), trials, 'The same seed repeats the trials.');
    assert.equal(trials.length, 36);
    for (const lag of lags) assert.equal(trials.filter(trial => trial.lag === lag).length, 6);
    for (const trial of trials) {
      assert.equal(trial.items.length, streamLength);
      assert.ok(trial.t1Index >= 4 && trial.t1Index <= 7);
      assert.equal(trial.items[trial.t1Index], String(trial.t1));
      assert.equal(trial.items[trial.t1Index + trial.lag], String(trial.t2));
      assert.notEqual(trial.t1, trial.t2);
      assert.ok(trial.t1 >= 2 && trial.t1 <= 9 && trial.t2 >= 2 && trial.t2 <= 9);
      const digits = trial.items.filter(item => /\d/.test(item));
      assert.equal(digits.length, 2, 'Only the two targets are digits.');
      assert.ok(trial.items.every(item => /^[2-9]$/.test(item) || /^[ACDEFHJKLMNPRTUVWXY]$/.test(item)), 'Letters that look like digits are left out.');
      for (let index = 1; index < trial.items.length; index++) assert.notEqual(trial.items[index], trial.items[index - 1]);
    }
  }
});

test('the stream shows each item at its planned time without drift, then blanks and hands over to the answers', async () => {
  const { PlayStream } = await LoadLogic();
  const clock = FakeClock();
  const events = [];
  let ended = 0;
  PlayStream(['A', '7', 'C'], 100, { show: (item, index) => events.push([item, index, clock.now()]), blank: () => events.push(['blank', clock.now()]) },
    clock, () => { ended++; });
  clock.advance(350);
  assert.deepEqual(events, [['A', 0, 0], ['7', 1, 100], ['C', 2, 200], ['blank', 300]]);
  assert.equal(ended, 1);
  assert.equal(clock.pending(), 0);
});

test('stopping the stream cancels its timers', async () => {
  const { PlayStream } = await LoadLogic();
  const clock = FakeClock();
  let ended = 0;
  const stop = PlayStream(['A', 'B', 'C'], 100, { show() {}, blank() {} }, clock, () => { ended++; });
  clock.advance(150);
  stop();
  clock.advance(1000);
  assert.equal(ended, 0);
  assert.equal(clock.pending(), 0);
});

test('answers score each digit and the summary reports second-digit accuracy when the first was right', async () => {
  const { ScoreBlinkTrial, SummarizeBlink } = await LoadLogic();
  const trial = (lag, t1, t2) => ({ lag, t1, t2, t1Index: 5, items: [] });
  const rows = [
    ScoreBlinkTrial(trial(2, 3, 7), 1, 3, 4),
    ScoreBlinkTrial(trial(2, 5, 8), 2, 5, 8),
    ScoreBlinkTrial(trial(8, 4, 6), 3, 4, 6),
    ScoreBlinkTrial(trial(8, 9, 2), 4, 9, 2),
    ScoreBlinkTrial(trial(1, 6, 3), 5, 2, 3),
  ];
  assert.deepEqual(rows[0], { trial: 1, lag: 2, t1Position: 6, t1: 3, t2: 7, t1Response: 3, t2Response: 4, t1Correct: true, t2Correct: false });
  assert.deepEqual(SummarizeBlink(rows), { trials: 5, t1AccuracyPercent: 80, t2GivenT1Percent: 75, lag1Percent: null, lag2Percent: 50, lag3Percent: null,
    lag4Percent: null, lag6Percent: null, lag8Percent: 100, blinkDepthPercent: 50 });
  assert.deepEqual(SummarizeBlink([]), { trials: 0, t1AccuracyPercent: null, t2GivenT1Percent: null, lag1Percent: null, lag2Percent: null, lag3Percent: null,
    lag4Percent: null, lag6Percent: null, lag8Percent: null, blinkDepthPercent: null });
});

test('attentional blink results save bounded numeric rows through the private channel', async () => {
  const logic = await LoadLogic();
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/blink': logic });
  const score = BuildGameScore([{ trial: 1, lag: 3, t1Position: 6, t1: 3, t2: 7, t1Response: 3, t2Response: 7, t1Correct: true, t2Correct: true }]);
  assert.deepEqual(score.rounds, [{ trial: 1, lag: 3, t1Position: 6, t1: 3, t2: 7, t1Response: 3, t2Response: 7, t1Correct: 1, t2Correct: 1 }]);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, { trials: 36, itemMs: 100 }, score));
});

test('attentional blink owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'AttentionalBlinkGame', category: 'attention' });
});

test('attentional blink private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
