import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'letter-memory';
const LoadLogic = () => LoadGameModule(gameId, 'logic/letterMemory.ts');

test('Letter Memory keeps the original letter time and 12 counted sequences, and practice can be turned off', async () => {
  const { defaultSettings, ValidateSettings, EstimatedSeconds } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { itemExposureMs: 2000, rounds: 12, practice: true });
  assert.equal(ValidateSettings(defaultSettings), true);
  // Each sequence: about 2 s to press start, 0.5 s pause, 8 letters on average, about 6 s to answer; practice adds 5 and 7 letters with 2 s feedback each.
  assert.equal(EstimatedSeconds(defaultSettings), Math.round((1500 + 12 * (2000 + 500 + 8 * 2000 + 6000) + 2 * (2000 + 500 + 6000 + 2000) + 12 * 2000) / 1000));
  assert.equal(EstimatedSeconds({ itemExposureMs: 500, rounds: 3, practice: false }), Math.round((1500 + 3 * (2000 + 500 + 8 * 500 + 6000)) / 1000));
  for (const change of [{ itemExposureMs: 500 }, { itemExposureMs: 1300 }, { itemExposureMs: 3000 }, { rounds: 3 }, { rounds: 9 }, { practice: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ itemExposureMs: 400 }, { itemExposureMs: 2050 }, { itemExposureMs: 3100 }, { rounds: 0 }, { rounds: 4 }, { rounds: 15 },
    { rounds: '12' }, { practice: 'no' }, { itemExposureMs: NaN }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
});

test('practice runs 5 then 7 letters; counted sequences use 5, 7, 9 and 11 letters evenly, in shuffled order', async () => {
  const { CreateLetterMemoryBlocks, CreateRandom, letters } = await LoadLogic();
  assert.equal(letters, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  for (const seed of [6, 60, 600]) {
    const blocks = CreateLetterMemoryBlocks({ rounds: 12, practice: true }, CreateRandom(seed));
    assert.deepEqual(CreateLetterMemoryBlocks({ rounds: 12, practice: true }, CreateRandom(seed)), blocks, 'The same seed repeats the session.');
    assert.deepEqual(blocks.slice(0, 2).map(block => [block.practice, block.letters.length]), [[true, 5], [true, 7]]);
    const counted = blocks.slice(2);
    assert.equal(counted.length, 12);
    assert.ok(counted.every(block => !block.practice));
    for (let cycle = 0; cycle < 3; cycle++) {
      assert.deepEqual(counted.slice(cycle * 4, cycle * 4 + 4).map(block => block.letters.length).sort((a, b) => a - b), [5, 7, 9, 11]);
    }
    for (const block of blocks) {
      assert.ok(block.letters.every(letter => letters.includes(letter)));
      assert.ok(block.letters.every((letter, index) => index === 0 || letter !== block.letters[index - 1]), 'A letter never shows twice in a row.');
    }
  }
  const short = CreateLetterMemoryBlocks({ rounds: 3, practice: false }, CreateRandom(9));
  assert.equal(short.length, 3);
  assert.equal(new Set(short.map(block => block.letters.length)).size, 3, 'A short session still mixes lengths.');
});

test('the answer is the last four letters, scored by position, and only all four in order counts as correct', async () => {
  const { ExpectedLetters, ScoreLetters } = await LoadLogic();
  const sequence = ['F', 'J', 'K', 'N', 'F', 'L'];
  assert.deepEqual(ExpectedLetters(sequence), ['K', 'N', 'F', 'L']);
  assert.deepEqual(ScoreLetters(sequence, ['K', 'N', 'F', 'L']), { correctItems: 4, requiredItems: 4, correct: true });
  assert.deepEqual(ScoreLetters(sequence, ['K', 'F', 'N', 'L']), { correctItems: 2, requiredItems: 4, correct: false });
  assert.deepEqual(ScoreLetters(sequence, ['N', 'F', 'L', 'K']), { correctItems: 0, requiredItems: 4, correct: false });
});

test('letters follow a 0.5 s pause back to back, each for the set time, then the keypad opens', async () => {
  const { CreateLetterSchedule } = await LoadLogic();
  const { events, answerAt } = CreateLetterSchedule(3, 2000);
  assert.deepEqual(events, [{ at: 0, index: null }, { at: 500, index: 0 }, { at: 2500, index: 1 }, { at: 4500, index: 2 }]);
  assert.equal(answerAt, 6500);
});

test('the summary counts only counted sequences and reports whole-answer and per-letter accuracy', async () => {
  const { SummarizeLetterMemory } = await LoadGameModule(gameId, 'logic/letterMemoryScore.ts');
  const row = (correctItems, rtMs, practice = false) => ({ trial: 0, practice, length: 7, correctItems, requiredItems: 4, rtMs });
  assert.deepEqual(SummarizeLetterMemory([row(1, 9000, true), row(4, 5000), row(2, 7000), row(4, 6000)]), {
    trials: 3, scored: 3, correct: 2, accuracy: 66.7, meanResponseMs: 6000, correctItems: 10, requiredItems: 12, itemAccuracy: 83.3 });
  assert.deepEqual(SummarizeLetterMemory([]), { trials: 0, scored: 0, correct: 0, accuracy: null, meanResponseMs: null, correctItems: 0, requiredItems: 0, itemAccuracy: null });
});

test('Letter Memory rows keep the original columns, include practice and save through the private channel', async () => {
  const scoreModule = await LoadGameModule(gameId, 'logic/letterMemoryScore.ts');
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/letterMemoryScore': scoreModule });
  const settings = { itemExposureMs: 2000, rounds: 3, practice: true };
  const score = BuildGameScore([{ trial: 1, practice: true, length: 5, correctItems: 3, requiredItems: 4, rtMs: 6400 },
    { trial: 2, practice: false, length: 11, correctItems: 4, requiredItems: 4, rtMs: 5100 }], settings);
  assert.deepEqual(score.rounds, [
    { trial: 1, practice: 1, correct: 0, responseMs: 6400, setting: 2000, load: 5, correctItems: 3, requiredItems: 4 },
    { trial: 2, practice: 0, correct: 1, responseMs: 5100, setting: 2000, load: 11, correctItems: 4, requiredItems: 4 }]);
  assert.equal(score.gameId, gameId);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, settings, score));
});

test('Letter Memory owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'LetterMemoryRecall', category: 'memory', version: '2.0.0' });
});

test('Letter Memory private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
