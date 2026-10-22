import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'keep-track';
const LoadLogic = () => LoadGameModule(gameId, 'logic/keepTrack.ts');

test('Keep Track keeps the original word time and nine counted blocks, and practice can be turned off', async () => {
  const { defaultSettings, ValidateSettings, EstimatedSeconds } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { itemExposureMs: 1500, rounds: 9, practice: true });
  assert.equal(ValidateSettings(defaultSettings), true);
  // Each block: about 3 s to read the targets, 0.5 s pause, 15 words, about 2 s per answer; practice adds one load-3 block and its feedback.
  assert.equal(EstimatedSeconds(defaultSettings), Math.round((1500 + 10 * (3000 + 500 + 15 * 1500) + (3 + 36) * 2000 + 3000) / 1000));
  assert.equal(EstimatedSeconds({ itemExposureMs: 500, rounds: 3, practice: false }), Math.round((1500 + 3 * (3000 + 500 + 15 * 500) + 12 * 2000) / 1000));
  for (const change of [{ itemExposureMs: 500 }, { itemExposureMs: 2200 }, { itemExposureMs: 3000 }, { rounds: 3 }, { rounds: 6 }, { practice: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ itemExposureMs: 400 }, { itemExposureMs: 1550 }, { itemExposureMs: 3100 }, { rounds: 0 }, { rounds: 4 }, { rounds: 12 },
    { rounds: '9' }, { practice: 1 }, { itemExposureMs: Infinity }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
});

test('the six original categories keep their five words, each with one clear label per language', async () => {
  const { categories, exemplars, categoryLabels, wordLabels } = await LoadLogic();
  assert.deepEqual(categories, ['animals', 'colors', 'countries', 'distances', 'metals', 'relatives']);
  assert.deepEqual(exemplars, {
    animals: ['fish', 'bird', 'snake', 'cow', 'whale'], colors: ['red', 'yellow', 'green', 'blue', 'brown'],
    countries: ['china', 'us', 'england', 'india', 'brazil'], distances: ['mile', 'kilometer', 'meter', 'foot', 'inch'],
    metals: ['iron', 'titanium', 'aluminum', 'lead', 'brass'], relatives: ['mother', 'father', 'brother', 'sister', 'aunt'] });
  for (const language of ['zh', 'en']) {
    assert.equal(new Set(categories.map(category => categoryLabels[category][language])).size, 6, language);
    const labels = categories.flatMap(category => exemplars[category].map(word => wordLabels[word][language]));
    assert.equal(new Set(labels).size, 30, `${language}: every word reads differently`);
  }
});

test('blocks: one practice block of 3 targets, then counted blocks split evenly across 3, 4 and 5 targets', async () => {
  const { CreateKeepTrackBlocks, CreateRandom, categories, exemplars } = await LoadLogic();
  for (const seed of [3, 41, 977]) {
    const blocks = CreateKeepTrackBlocks({ rounds: 9, practice: true }, CreateRandom(seed));
    assert.deepEqual(CreateKeepTrackBlocks({ rounds: 9, practice: true }, CreateRandom(seed)), blocks, 'The same seed repeats the session.');
    assert.equal(blocks.length, 10);
    assert.deepEqual([blocks[0].practice, blocks[0].load], [true, 3]);
    const counted = blocks.slice(1);
    assert.ok(counted.every(block => !block.practice));
    // Blocks of one size run together, as in the original order.
    const order = [counted[0].load, counted[3].load, counted[6].load];
    assert.deepEqual([...order].sort(), [3, 4, 5]);
    assert.deepEqual(counted.map(block => block.load), order.flatMap(load => [load, load, load]));
    for (const block of blocks) {
      assert.equal(block.targets.length, block.load);
      assert.equal(new Set(block.targets).size, block.load);
      assert.ok(block.targets.every(category => categories.includes(category)));
      assert.equal(block.words.length, 15);
      assert.equal(new Set(block.words.map(item => item.word)).size, 15, 'No word repeats within a block.');
      assert.ok(block.words.every(item => exemplars[item.category].includes(item.word)));
      assert.deepEqual(categories.map(category => block.words.filter(item => item.category === category).length).sort(), [2, 2, 2, 3, 3, 3]);
    }
  }
  const short = CreateKeepTrackBlocks({ rounds: 3, practice: false }, CreateRandom(8));
  assert.deepEqual(short.map(block => block.load).sort(), [3, 4, 5]);
  assert.ok(short.every(block => !block.practice));
});

test('the answer is the last word shown from each target category, and only a full set counts as correct', async () => {
  const { LastWords, ScoreAnswer } = await LoadLogic();
  const block = { practice: false, load: 3, targets: ['colors', 'animals', 'relatives'], words: [
    { category: 'animals', word: 'cow' }, { category: 'colors', word: 'red' }, { category: 'metals', word: 'iron' }, { category: 'relatives', word: 'aunt' },
    { category: 'animals', word: 'bird' }, { category: 'countries', word: 'china' }, { category: 'colors', word: 'blue' }, { category: 'metals', word: 'lead' }] };
  assert.deepEqual(LastWords(block), { colors: 'blue', animals: 'bird', relatives: 'aunt' });
  assert.deepEqual(ScoreAnswer(block, { colors: 'blue', animals: 'bird', relatives: 'aunt' }), { correctItems: 3, requiredItems: 3, correct: true });
  assert.deepEqual(ScoreAnswer(block, { colors: 'red', animals: 'bird', relatives: 'aunt' }), { correctItems: 2, requiredItems: 3, correct: false });
  assert.deepEqual(ScoreAnswer(block, { animals: 'bird' }), { correctItems: 1, requiredItems: 3, correct: false });
});

test('words follow a 0.5 s pause back to back, each for the set time, then the answer opens', async () => {
  const { CreateWordSchedule } = await LoadLogic();
  const { events, answerAt } = CreateWordSchedule(3, 1500);
  assert.deepEqual(events, [{ at: 0, index: null }, { at: 500, index: 0 }, { at: 2000, index: 1 }, { at: 3500, index: 2 }]);
  assert.equal(answerAt, 5000);
  assert.equal(CreateWordSchedule(15, 700).answerAt, 500 + 15 * 700);
});

test('the summary counts only counted blocks and reports whole-block and per-word accuracy', async () => {
  const { SummarizeKeepTrack } = await LoadGameModule(gameId, 'logic/keepTrackScore.ts');
  const row = (load, correctItems, rtMs, practice = false) => ({ trial: 0, practice, load, correctItems, requiredItems: load, rtMs });
  assert.deepEqual(SummarizeKeepTrack([row(3, 1, 9000, true), row(3, 3, 6000), row(4, 3, 8000), row(5, 5, 10000), row(4, 4, 7000)]), {
    trials: 4, scored: 4, correct: 3, accuracy: 75, meanResponseMs: 7750, correctItems: 15, requiredItems: 16, itemAccuracy: 93.8 });
  assert.deepEqual(SummarizeKeepTrack([]), { trials: 0, scored: 0, correct: 0, accuracy: null, meanResponseMs: null, correctItems: 0, requiredItems: 0, itemAccuracy: null });
});

test('Keep Track rows keep the original columns, include the practice block and save through the private channel', async () => {
  const scoreModule = await LoadGameModule(gameId, 'logic/keepTrackScore.ts');
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/keepTrackScore': scoreModule });
  const settings = { itemExposureMs: 1500, rounds: 3, practice: true };
  const score = BuildGameScore([{ trial: 1, practice: true, load: 3, correctItems: 2, requiredItems: 3, rtMs: 8123 },
    { trial: 2, practice: false, load: 5, correctItems: 5, requiredItems: 5, rtMs: 11000 }], settings);
  assert.deepEqual(score.rounds, [
    { trial: 1, practice: 1, correct: 0, responseMs: 8123, setting: 1500, load: 3, correctItems: 2, requiredItems: 3 },
    { trial: 2, practice: 0, correct: 1, responseMs: 11000, setting: 1500, load: 5, correctItems: 5, requiredItems: 5 }]);
  assert.equal(score.gameId, gameId);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, settings, score));
});

test('Keep Track owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'KeepTrackRecall', category: 'memory', version: '2.0.0' });
});

test('Keep Track private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
