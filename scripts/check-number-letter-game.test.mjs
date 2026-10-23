import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'number-letter';
const LoadTrials = async () => LoadGameModule(gameId, 'logic/numberLetterTrials.ts');
const clockwise = ['topleft', 'topright', 'bottomright', 'bottomleft'];

function CheckPairs(trials) {
  for (const trial of trials) {
    assert.ok('GKMRAEIU'.includes(trial.letter) && trial.letter.length === 1, trial.letter);
    assert.ok([2, 3, 4, 5, 6, 7, 8, 9].includes(trial.number), String(trial.number));
  }
}

function CheckRotation(trials) {
  trials.forEach((trial, index) => {
    if (index) assert.equal(clockwise.indexOf(trial.position), (clockwise.indexOf(trials[index - 1].position) + 1) % 4, 'Positions turn clockwise.');
    const top = trial.position.startsWith('top');
    assert.equal(trial.switched, index ? top !== trials[index - 1].position.startsWith('top') : null);
  });
}

test('Number-letter keeps the original deadline and length, and practice can be turned off', async () => {
  const { defaultSettings, ValidateSettings, EstimatedSeconds } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { responseWindowMs: 0, rounds: 192, practice: true });
  assert.equal(ValidateSettings(defaultSettings), true);
  assert.equal(EstimatedSeconds(defaultSettings), 355);
  assert.equal(EstimatedSeconds({ responseWindowMs: 5000, rounds: 96, practice: false }), 499);
  for (const change of [{ responseWindowMs: 250 }, { responseWindowMs: 5000 }, { rounds: 96 }, { rounds: 160 }, { practice: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ responseWindowMs: -250 }, { responseWindowMs: 300 }, { responseWindowMs: 5250 }, { rounds: 64 }, { rounds: 100 }, { rounds: 224 },
    { rounds: '192' }, { practice: 'yes' }, { responseWindowMs: NaN }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
});

test('the order is practice, 32 number items on top, 32 letter items below, then the rest turning clockwise', async () => {
  const { CreateNumberLetterPlan, CreateRandom, CorrectAnswer } = await LoadTrials();
  const starts = new Set(), sides = new Set();
  for (const seed of [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233]) {
    const plan = CreateNumberLetterPlan({ responseWindowMs: 0, rounds: 192, practice: true }, CreateRandom(seed));
    assert.deepEqual(CreateNumberLetterPlan({ responseWindowMs: 0, rounds: 192, practice: true }, CreateRandom(seed)), plan, 'The same seed repeats the session.');
    assert.deepEqual(plan.map(segment => [segment.kind, segment.condition, segment.trials.length]),
      [['practice', 2, 12], ['number', 0, 32], ['letter', 1, 32], ['mixed', 2, 128]]);
    const [practice, number, letter, mixed] = plan;
    for (const segment of plan) {
      CheckPairs(segment.trials);
      assert.ok(segment.trials.every(trial => trial.practice === (segment.kind === 'practice') && trial.condition === segment.condition));
    }
    assert.ok(number.trials.every(trial => ['topleft', 'topright'].includes(trial.position) && trial.switched === null));
    assert.ok(letter.trials.every(trial => ['bottomleft', 'bottomright'].includes(trial.position) && trial.switched === null));
    number.trials.forEach(trial => sides.add(trial.position));
    CheckRotation(practice.trials);
    CheckRotation(mixed.trials);
    starts.add(mixed.trials[0].position);
  }
  assert.equal(starts.size, 4, 'The rotation starts at a random quadrant.');
  assert.equal(sides.size, 2);
  assert.equal(CorrectAnswer({ letter: 'A', number: 7, position: 'topleft' }), 'z', 'Top half: odd number is Z.');
  assert.equal(CorrectAnswer({ letter: 'G', number: 4, position: 'topright' }), 'm', 'Top half: even number is M.');
  assert.equal(CorrectAnswer({ letter: 'K', number: 4, position: 'bottomleft' }), 'z', 'Bottom half: consonant is Z.');
  assert.equal(CorrectAnswer({ letter: 'U', number: 3, position: 'bottomright' }), 'm', 'Bottom half: vowel is M.');
  const short = CreateNumberLetterPlan({ responseWindowMs: 0, rounds: 96, practice: false }, CreateRandom(3));
  assert.deepEqual(short.map(segment => [segment.kind, segment.trials.length]), [['number', 32], ['letter', 32], ['mixed', 32]]);
});

test('a pair stays until answered or the deadline, with a 150 ms blank grid between pairs', async () => {
  const { CreateNumberLetterStep } = await LoadTrials();
  const trial = practice => ({ letter: 'G', number: 9, position: 'topright', condition: 2, practice, switched: null });
  assert.deepEqual(CreateNumberLetterStep(trial(false), { responseWindowMs: 0 }).timing,
    { lead: [], exposureMs: null, windowMs: null, endOnResponse: true, feedbackMs: 0, gapMs: 150 });
  assert.deepEqual(CreateNumberLetterStep(trial(true), { responseWindowMs: 2500 }).timing,
    { lead: [], exposureMs: null, windowMs: 2500, endOnResponse: true, feedbackMs: 1000, gapMs: 150 });
});

test('the summary keeps the original fields and adds single, mixed and switch results', async () => {
  const { SummarizeNumberLetter } = await LoadGameModule(gameId, 'logic/numberLetterScore.ts', { './numberLetterTrials': await LoadTrials() });
  const row = (condition, position, switched, number, response, rtMs, practice = false) =>
    ({ trial: 0, practice, letter: 'G', number, position, condition, switched, response, rtMs });
  const rows = [row(2, 'topleft', null, 3, 'z', 200, true), row(0, 'topleft', null, 3, 'z', 500), row(0, 'topright', null, 4, 'z', 900),
    row(1, 'bottomleft', null, 4, 'z', 700), row(2, 'topleft', null, 5, 'z', 800), row(2, 'topright', false, 6, 'm', 600),
    row(2, 'bottomright', true, 6, 'z', 1000), row(2, 'bottomleft', false, 6, null, null)];
  assert.deepEqual(SummarizeNumberLetter(rows), { trials: 7, scored: 7, correct: 5, accuracy: 71.4, meanResponseMs: 750, misses: 1,
    singleAccuracy: 66.7, mixedAccuracy: 75, singleMeanMs: 600, switchMeanMs: 1000, repeatMeanMs: 600, switchCostMs: 400 });
  assert.deepEqual(SummarizeNumberLetter([]), { trials: 0, scored: 0, correct: 0, accuracy: null, meanResponseMs: null, misses: 0,
    singleAccuracy: null, mixedAccuracy: null, singleMeanMs: null, switchMeanMs: null, repeatMeanMs: null, switchCostMs: null });
});

test('Number-letter rows keep the original columns, include practice and save through the private channel', async () => {
  const trials = await LoadTrials();
  const scoreModule = await LoadGameModule(gameId, 'logic/numberLetterScore.ts', { './numberLetterTrials': trials });
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/numberLetterScore': scoreModule });
  const settings = { responseWindowMs: 0, rounds: 96, practice: true };
  const score = BuildGameScore([
    { trial: 1, practice: true, letter: 'E', number: 8, position: 'bottomright', condition: 2, switched: null, response: 'm', rtMs: 910 },
    { trial: 2, practice: false, letter: 'R', number: 7, position: 'topleft', condition: 0, switched: null, response: null, rtMs: null }], settings);
  assert.deepEqual(score.rounds, [
    { trial: 1, practice: 1, condition: 2, top: 0, switched: null, letter: 5, number: 8, response: 1, correct: 1, responseMs: 910, setting: 0 },
    { trial: 2, practice: 0, condition: 0, top: 1, switched: null, letter: 3, number: 7, response: null, correct: 0, responseMs: null, setting: 0 }]);
  assert.equal(score.gameId, gameId);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, settings, score));
});

test('Number-letter owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'NumberLetterSwitch', category: 'higher-cognition', version: '2.0.1' });
});

test('Number-letter private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
