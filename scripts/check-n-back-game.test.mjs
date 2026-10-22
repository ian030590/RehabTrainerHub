import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'n-back';
const LoadTrials = async () => LoadGameModule(gameId, 'logic/nBackTrials.ts');
const Lower = letter => letter.toLowerCase();

function CheckMatches(trials, load) {
  trials.forEach((trial, index) => {
    assert.ok('bBdDgGtTvV'.includes(trial.letter), trial.letter);
    const expected = load === 0 ? Lower(trial.letter) === 't' : index >= load && Lower(trial.letter) === Lower(trials[index - load].letter);
    assert.equal(trial.match, expected, `load ${load} item ${index}`);
  });
}

test('N-back keeps the original exposure and length, and practice can be turned off', async () => {
  const { defaultSettings, ValidateSettings, EstimatedSeconds } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { exposureMs: 500, rounds: 350, practice: true });
  assert.equal(ValidateSettings(defaultSettings), true);
  assert.equal(EstimatedSeconds(defaultSettings), 875);
  assert.equal(EstimatedSeconds({ exposureMs: 100, rounds: 50, practice: false }), 114);
  for (const change of [{ exposureMs: 100 }, { exposureMs: 1000 }, { rounds: 50 }, { rounds: 200 }, { practice: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ exposureMs: 0 }, { exposureMs: 550 }, { exposureMs: 1100 }, { rounds: 25 }, { rounds: 75 }, { rounds: 400 },
    { rounds: '350' }, { practice: 0 }, { exposureMs: NaN }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
});

test('practice is 1-back; blocks run 0-back first or last and two blocks of each delay in a shuffled order, with 20% matches', async () => {
  const { CreateNBackPlan, CreateRandom } = await LoadTrials();
  const controlPlaces = new Set(), orders = new Set();
  for (const seed of [1, 3, 8, 21, 55, 89]) {
    const plan = CreateNBackPlan({ exposureMs: 500, rounds: 350, practice: true }, CreateRandom(seed));
    assert.deepEqual(CreateNBackPlan({ exposureMs: 500, rounds: 350, practice: true }, CreateRandom(seed)), plan, 'The same seed repeats the session.');
    const [practice, ...blocks] = plan;
    assert.deepEqual([practice.kind, practice.load, practice.trials.length], ['practice', 1, 25]);
    assert.equal(practice.trials.filter(trial => trial.match).length, 5);
    assert.ok(practice.trials.every(trial => trial.practice && trial.load === 1));
    CheckMatches(practice.trials, 1);
    assert.equal(blocks.length, 7);
    const loads = blocks.map(block => block.load);
    assert.deepEqual([...loads].sort(), [0, 1, 1, 2, 2, 3, 3]);
    assert.ok(loads[0] === 0 || loads[6] === 0, 'The 0-back block comes first or last.');
    controlPlaces.add(loads[0] === 0 ? 'first' : 'last');
    const delays = loads.filter(load => load > 0);
    for (let index = 0; index < 6; index += 2) assert.equal(delays[index], delays[index + 1], 'Each delay runs two blocks in a row.');
    orders.add(delays.filter((_, index) => index % 2 === 0).join(''));
    for (const [index, block] of blocks.entries()) {
      assert.deepEqual([block.kind, block.block, block.trials.length], ['block', index + 1, 50]);
      assert.equal(block.trials.filter(trial => trial.match).length, 10, 'One in five letters is a match.');
      assert.ok(block.trials.every(trial => !trial.practice && trial.load === block.load));
      CheckMatches(block.trials, block.load);
    }
  }
  assert.deepEqual([...controlPlaces].sort(), ['first', 'last']);
  assert.ok(orders.size >= 3, 'The delay order is shuffled.');
  const short = CreateNBackPlan({ exposureMs: 500, rounds: 100, practice: false }, CreateRandom(4));
  assert.deepEqual(short.map(segment => [segment.kind, segment.block]), [['block', 1], ['block', 2]]);
});

test('a letter shows for the exposure time, the answer window is 2 s and a short blank separates letters', async () => {
  const { CreateNBackStep } = await LoadTrials();
  const settings = { exposureMs: 300, rounds: 50, practice: true };
  const trial = practice => ({ letter: 'b', match: false, load: 1, practice });
  assert.deepEqual(CreateNBackStep(trial(false), settings).timing, { lead: [], exposureMs: 300, windowMs: 2000, endOnResponse: true, feedbackMs: 0, gapMs: 250 });
  assert.deepEqual(CreateNBackStep(trial(true), settings).timing, { lead: [], exposureMs: 300, windowMs: 2000, endOnResponse: true, feedbackMs: 500, gapMs: 500 });
});

test('the summary keeps the original fields and adds hit, false-alarm and per-delay accuracy', async () => {
  const { SummarizeNBack } = await LoadGameModule(gameId, 'logic/nBackScore.ts');
  const row = (load, match, response, rtMs, practice = false) => ({ trial: 0, practice, load, letter: 'b', match, response, rtMs });
  const rows = [row(1, true, 'same', 300, true), row(0, true, 'same', 400), row(0, false, 'different', 500), row(1, true, 'different', 600),
    row(1, false, 'same', 700), row(2, true, 'same', 800), row(3, false, null, null)];
  assert.deepEqual(SummarizeNBack(rows), { trials: 6, scored: 6, correct: 3, accuracy: 50, meanResponseMs: 600, misses: 1, hitRate: 66.7, falseAlarmRate: 33.3,
    load0Accuracy: 100, load1Accuracy: 0, load2Accuracy: 100, load3Accuracy: 0 });
  assert.deepEqual(SummarizeNBack([]), { trials: 0, scored: 0, correct: 0, accuracy: null, meanResponseMs: null, misses: 0, hitRate: null, falseAlarmRate: null,
    load0Accuracy: null, load1Accuracy: null, load2Accuracy: null, load3Accuracy: null });
});

test('N-back rows keep the original columns, include practice and save through the private channel', async () => {
  const scoreModule = await LoadGameModule(gameId, 'logic/nBackScore.ts');
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/nBackScore': scoreModule });
  const settings = { exposureMs: 500, rounds: 50, practice: true };
  const score = BuildGameScore([
    { trial: 1, practice: true, load: 1, letter: 'G', match: true, response: 'same', rtMs: 640 },
    { trial: 2, practice: false, load: 2, letter: 'v', match: false, response: null, rtMs: null }], settings);
  assert.deepEqual(score.rounds, [
    { trial: 1, practice: 1, load: 1, letter: 5, match: 1, response: 0, correct: 1, responseMs: 640, setting: 500 },
    { trial: 2, practice: 0, load: 2, letter: 8, match: 0, response: null, correct: 0, responseMs: null, setting: 500 }]);
  assert.equal(score.gameId, gameId);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, settings, score));
});

test('N-back owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'NBackLetters', category: 'memory', version: '2.0.0' });
});

test('N-back private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
