import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'plus-minus';
const LoadLogic = () => LoadGameModule(gameId, 'logic/plusMinus.ts');

test('Plus-Minus keeps 30 numbers per list and the copy practice, which can be turned off', async () => {
  const { defaultSettings, ValidateSettings, EstimatedSeconds } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { itemsPerList: 30, practice: true });
  assert.equal(ValidateSettings(defaultSettings), true);
  // Each list: about 4 s to read its rule and about 3 s per number; practice copies 15 numbers at about 2.5 s each with a short check mark.
  assert.equal(EstimatedSeconds(defaultSettings), Math.round((1500 + 4000 + 15 * (2500 + 600) + 3 * (4000 + 30 * 3000)) / 1000));
  assert.equal(EstimatedSeconds({ itemsPerList: 6, practice: false }), Math.round((1500 + 3 * (4000 + 6 * 3000)) / 1000));
  for (const change of [{ itemsPerList: 6 }, { itemsPerList: 18 }, { practice: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ itemsPerList: 0 }, { itemsPerList: 5 }, { itemsPerList: 20 }, { itemsPerList: 36 }, { itemsPerList: '30' }, { practice: 0 }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
});

test('lists draw different two-digit numbers in the original order: copy, add 3, subtract 3, then alternate', async () => {
  const { CreatePlusMinusItems, CreateRandom } = await LoadLogic();
  for (const seed of [4, 44, 444]) {
    const items = CreatePlusMinusItems({ itemsPerList: 30, practice: true }, CreateRandom(seed));
    assert.deepEqual(CreatePlusMinusItems({ itemsPerList: 30, practice: true }, CreateRandom(seed)), items, 'The same seed repeats the session.');
    assert.deepEqual(items.map(item => item.condition), [...Array(15).fill(-1), ...Array(30).fill(0), ...Array(30).fill(1), ...Array(30).fill(2)]);
    assert.ok(items.every(item => Number.isInteger(item.number) && item.number >= 10 && item.number <= 99));
    const counted = items.filter(item => item.condition >= 0);
    assert.equal(new Set(counted.map(item => item.number)).size, 90, 'Counted lists never repeat a number.');
    assert.equal(new Set(items.filter(item => item.condition === -1).map(item => item.number)).size, 15);
    for (const condition of [-1, 0, 1, 2]) {
      assert.deepEqual(items.filter(item => item.condition === condition).map(item => item.question), Array.from({ length: condition === -1 ? 15 : 30 }, (_, index) => index + 1));
    }
  }
  const short = CreatePlusMinusItems({ itemsPerList: 6, practice: false }, CreateRandom(1));
  assert.deepEqual(short.map(item => item.condition), [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2]);
});

test('answers: copy, add 3, subtract 3, and alternate starting with add, as in the original 27, 13, 40 example', async () => {
  const { ExpectedAnswer } = await LoadLogic();
  assert.equal(ExpectedAnswer({ condition: -1, question: 4, number: 58 }), 58);
  assert.equal(ExpectedAnswer({ condition: 0, question: 9, number: 99 }), 102);
  assert.equal(ExpectedAnswer({ condition: 1, question: 2, number: 10 }), 7);
  assert.deepEqual([27, 13, 40].map((number, index) => ExpectedAnswer({ condition: 2, question: index + 1, number })), [30, 10, 43]);
});

test('the summary leaves out practice and reports the extra time per number when alternating', async () => {
  const { SummarizePlusMinus } = await LoadGameModule(gameId, 'logic/plusMinusScore.ts');
  const row = (condition, correct, rtMs) => ({ trial: 0, question: 1, practice: condition === -1, condition, number: 20, response: 23, correct, rtMs });
  const rows = [row(-1, false, 5000), row(0, true, 1000), row(0, true, 1400), row(1, false, 1600), row(1, true, 1800), row(2, true, 2500), row(2, true, 2900)];
  assert.deepEqual(SummarizePlusMinus(rows), { trials: 6, scored: 6, correct: 5, accuracy: 83.3, meanResponseMs: 1867,
    addMs: 1200, subtractMs: 1700, alternateMs: 2700, switchCostMs: 1250 });
  assert.deepEqual(SummarizePlusMinus([]), { trials: 0, scored: 0, correct: 0, accuracy: null, meanResponseMs: null, addMs: null, subtractMs: null, alternateMs: null, switchCostMs: null });
});

test('Plus-Minus rows keep the original columns, add the number and answer, and save through the private channel', async () => {
  const scoreModule = await LoadGameModule(gameId, 'logic/plusMinusScore.ts');
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/plusMinusScore': scoreModule });
  const settings = { itemsPerList: 6, practice: true };
  const score = BuildGameScore([{ trial: 1, question: 1, practice: true, condition: -1, number: 41, response: 41, correct: true, rtMs: 1900 },
    { trial: 2, question: 1, practice: false, condition: 2, number: 27, response: 24, correct: false, rtMs: 2300 }], settings);
  assert.deepEqual(score.rounds, [
    { trial: 1, question: 1, practice: 1, setting: 6, condition: -1, correct: 1, responseMs: 1900, number: 41, response: 41 },
    { trial: 2, question: 1, practice: 0, setting: 6, condition: 2, correct: 0, responseMs: 2300, number: 27, response: 24 }]);
  assert.equal(score.gameId, gameId);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, settings, score));
});

test('Plus-Minus owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'PlusMinusSwitch', category: 'higher-cognition', version: '2.0.0' });
});

test('Plus-Minus private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
