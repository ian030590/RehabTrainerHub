import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'digit-span';
const LoadTrials = async () => LoadGameModule(gameId, 'logic/digitSpanTrials.ts');

test('Digit span keeps the original digit time and length, and practice can be turned off', async () => {
  const { defaultSettings, ValidateSettings, EstimatedSeconds } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { itemExposureMs: 800, rounds: 28, practice: true });
  assert.equal(ValidateSettings(defaultSettings), true);
  assert.equal(EstimatedSeconds(defaultSettings), 397);
  assert.equal(EstimatedSeconds({ itemExposureMs: 200, rounds: 16, practice: false }), 168);
  for (const change of [{ itemExposureMs: 200 }, { itemExposureMs: 1600 }, { rounds: 16 }, { rounds: 22 }, { practice: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ itemExposureMs: 100 }, { itemExposureMs: 850 }, { itemExposureMs: 1700 }, { rounds: 14 }, { rounds: 17 }, { rounds: 30 },
    { rounds: '28' }, { practice: 1 }, { itemExposureMs: Infinity }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
});

test('the session is two practice sequences, then half the sequences forward and half in reverse', async () => {
  const { CreateDigitSpanPlan, startLoad } = await LoadTrials();
  assert.equal(startLoad, 3);
  assert.deepEqual(CreateDigitSpanPlan({ rounds: 28, practice: true }), [
    { kind: 'practice', reverse: false, count: 2 }, { kind: 'forward', reverse: false, count: 14 }, { kind: 'reverse', reverse: true, count: 14 }]);
  assert.deepEqual(CreateDigitSpanPlan({ rounds: 16, practice: false }), [
    { kind: 'forward', reverse: false, count: 8 }, { kind: 'reverse', reverse: true, count: 8 }]);
});

test('digits run 1 to 9 and each differs from the one before by more than 2, as in the original', async () => {
  const { CreateDigits, CreateRandom } = await LoadTrials();
  const seen = new Set();
  for (const seed of [1, 2, 3, 5, 8, 13, 21, 34]) {
    const random = CreateRandom(seed);
    for (const count of [3, 6, 12]) {
      const digits = CreateDigits(count, random);
      assert.equal(digits.length, count);
      digits.forEach((digit, index) => {
        assert.ok(Number.isInteger(digit) && digit >= 1 && digit <= 9);
        assert.ok(Math.abs(digit - (index ? digits[index - 1] : 0)) > 2, `${digits}`);
        if (index) seen.add(digit);
      });
    }
  }
  assert.equal(seen.size, 9);
});

test('length goes up after a correct answer and down after every second error, never below 1', async () => {
  const { NextLevel } = await LoadTrials();
  let level = { load: 3, errors: 0 };
  const loads = [];
  for (const correct of [true, false, true, false, false, false, true]) {
    level = NextLevel(level, correct);
    loads.push([level.load, level.errors]);
  }
  assert.deepEqual(loads, [[4, 0], [4, 1], [5, 1], [4, 0], [4, 1], [3, 0], [4, 0]]);
  assert.deepEqual(NextLevel(NextLevel({ load: 1, errors: 0 }, false), false), { load: 1, errors: 0 });
});

test('each sequence shows its length for 1 s, a 1 s blank, then each digit for the set time with 200 ms between', async () => {
  const { CreateDigitSchedule, IsRecallCorrect } = await LoadTrials();
  assert.deepEqual(CreateDigitSchedule([4, 8, 2], 800), {
    events: [{ at: 0, state: 'count' }, { at: 1000, state: 'blank' }, { at: 2000, state: 'digit', digit: 4 }, { at: 2800, state: 'blank' },
      { at: 3000, state: 'digit', digit: 8 }, { at: 3800, state: 'blank' }, { at: 4000, state: 'digit', digit: 2 }, { at: 4800, state: 'blank' }],
    answerAt: 5000,
  });
  assert.equal(IsRecallCorrect([4, 8, 2], [4, 8, 2], false), true);
  assert.equal(IsRecallCorrect([4, 8, 2], [2, 8, 4], false), false);
  assert.equal(IsRecallCorrect([4, 8, 2], [2, 8, 4], true), true);
  assert.equal(IsRecallCorrect([4, 8, 2], [2, 8], true), false);
});

test('the summary keeps the original fields and adds the longest correct length and accuracy per direction', async () => {
  const trials = await LoadTrials();
  const { SummarizeDigitSpan } = await LoadGameModule(gameId, 'logic/digitSpanScore.ts', { './digitSpanTrials': trials });
  const row = (reverse, sequence, response, rtMs, practice = false) => ({ trial: 0, practice, reverse, load: sequence.length, sequence, response, rtMs });
  const rows = [row(false, [3, 7, 1], [3, 7, 1], 2000, true), row(false, [4, 8, 2], [4, 8, 2], 3000), row(false, [5, 9, 1, 6], [5, 9, 6, 1], 4000),
    row(false, [7, 3, 8, 2], [7, 3, 8, 2], 5000), row(true, [9, 5, 1], [1, 5, 9], 3000), row(true, [2, 6, 9, 4], [2, 6, 9, 4], 6000)];
  assert.deepEqual(SummarizeDigitSpan(rows), { trials: 5, scored: 5, correct: 3, accuracy: 60, meanResponseMs: 4200,
    forwardSpan: 4, reverseSpan: 3, forwardAccuracy: 66.7, reverseAccuracy: 50 });
  assert.deepEqual(SummarizeDigitSpan([]), { trials: 0, scored: 0, correct: 0, accuracy: null, meanResponseMs: null,
    forwardSpan: null, reverseSpan: null, forwardAccuracy: null, reverseAccuracy: null });
});

test('Digit span rows keep the original columns, include practice and save through the private channel', async () => {
  const trials = await LoadTrials();
  const scoreModule = await LoadGameModule(gameId, 'logic/digitSpanScore.ts', { './digitSpanTrials': trials });
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/digitSpanScore': scoreModule });
  const settings = { itemExposureMs: 800, rounds: 16, practice: true };
  const score = BuildGameScore([
    { trial: 1, practice: true, reverse: false, load: 3, sequence: [3, 7, 1], response: [3, 7, 1], rtMs: 2100 },
    { trial: 2, practice: false, reverse: true, load: 4, sequence: [2, 6, 9, 4], response: [4, 9], rtMs: 3400 }], settings);
  assert.deepEqual(score.rounds, [
    { trial: 1, practice: 1, reverse: 0, load: 3, entered: 3, correct: 1, responseMs: 2100, setting: 800 },
    { trial: 2, practice: 0, reverse: 1, load: 4, entered: 2, correct: 0, responseMs: 3400, setting: 800 }]);
  assert.equal(score.gameId, gameId);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, settings, score));
});

test('Digit span owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'DigitSpanRecall', category: 'memory', version: '2.0.1' });
});

test('Digit span private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
