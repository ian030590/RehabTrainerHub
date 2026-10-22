import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'schulte-grid';

test('Schulte settings default to a 5 by 5 grid and reject values outside each range', async () => {
  const { defaultSettings, ValidateSettings } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { gridSize: 5, rounds: 3, order: 'ascending', markFound: true });
  assert.equal(ValidateSettings(defaultSettings), true);
  for (const change of [{ gridSize: 3 }, { gridSize: 7 }, { rounds: 1 }, { rounds: 10 }, { order: 'descending' }, { markFound: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ gridSize: 2 }, { gridSize: 8 }, { gridSize: 4.5 }, { rounds: 0 }, { rounds: 11 }, { order: 'random' },
    { markFound: 1 }, { gridSize: '5' }, { rounds: NaN }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
});

test('each grid holds every number from 1 to N squared once, in a seeded random order', async () => {
  const { CreateSchulteGrid, CreateRandom } = await LoadGameModule(gameId, 'logic/schulteGrid.ts');
  for (const size of [3, 5, 7]) {
    const grid = CreateSchulteGrid(size, CreateRandom(size));
    assert.equal(grid.length, size * size);
    assert.deepEqual([...grid].sort((a, b) => a - b), Array.from({ length: size * size }, (_, index) => index + 1));
    assert.deepEqual(CreateSchulteGrid(size, CreateRandom(size)), grid);
  }
  assert.notDeepEqual(CreateSchulteGrid(5, CreateRandom(1)), Array.from({ length: 25 }, (_, index) => index + 1), 'The numbers are shuffled.');
});

test('a round accepts numbers in order, counts wrong taps and ignores numbers already found', async () => {
  const { SchulteRound } = await LoadGameModule(gameId, 'logic/schulteGrid.ts');
  const round = new SchulteRound(3, 'ascending', 1000);
  assert.equal(round.next, 1);
  assert.deepEqual(round.tap(1, 1400), { correct: true, done: false });
  assert.deepEqual(round.tap(3, 1500), { correct: false, done: false });
  assert.deepEqual(round.tap(1, 1550), { correct: false, done: false, ignored: true }, 'A found number is not an error.');
  assert.equal(round.errors, 1);
  for (const [value, at] of [[2, 1800], [3, 2000], [4, 2300], [5, 2500], [6, 2700], [7, 3000], [8, 3200]]) round.tap(value, at);
  assert.equal(round.next, 9);
  assert.deepEqual(round.tap(9, 3600), { correct: true, done: true });
  assert.deepEqual(round.tap(9, 3700), { correct: false, done: true, ignored: true }, 'A finished round takes no more taps.');
  assert.deepEqual(round.result(), { timeMs: 2600, errors: 1, meanStepMs: 289 });
  assert.ok(round.found.has(5));
  const descending = new SchulteRound(3, 'descending', 0);
  assert.equal(descending.next, 9);
  assert.equal(descending.tap(1, 100).correct, false);
  assert.equal(descending.tap(9, 200).correct, true);
  assert.equal(descending.next, 8);
});

test('the summary reports total, mean and best round times with errors', async () => {
  const { SummarizeSchulte } = await LoadGameModule(gameId, 'logic/schulteGrid.ts');
  const rows = [{ round: 1, gridSize: 5, timeMs: 30000, errors: 2, meanStepMs: 1200 }, { round: 2, gridSize: 5, timeMs: 24000, errors: 0, meanStepMs: 960 },
    { round: 3, gridSize: 5, timeMs: 27000, errors: 1, meanStepMs: 1080 }];
  assert.deepEqual(SummarizeSchulte(rows, 3), { roundsPlanned: 3, roundsCompleted: 3, gridSize: 5, totalTimeMs: 81000, meanRoundMs: 27000,
    bestRoundMs: 24000, totalErrors: 3, meanStepMs: 1080 });
  assert.deepEqual(SummarizeSchulte([], 3), { roundsPlanned: 3, roundsCompleted: 0, gridSize: null, totalTimeMs: 0, meanRoundMs: null,
    bestRoundMs: null, totalErrors: 0, meanStepMs: null });
});

test('Schulte results save bounded numeric rows through the private channel', async () => {
  const logic = await LoadGameModule(gameId, 'logic/schulteGrid.ts');
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/schulteGrid': logic });
  const score = BuildGameScore([{ round: 1, gridSize: 4, timeMs: 15000, errors: 1, meanStepMs: 940 }], 2);
  assert.equal(score.gameId, gameId);
  assert.deepEqual(score.rounds, [{ round: 1, gridSize: 4, timeMs: 15000, errors: 1, meanStepMs: 940 }]);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, { gridSize: 4, rounds: 2, order: 'ascending', markFound: true }, score));
});

test('Schulte grid owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'SchulteGridGame', category: 'attention' });
});

test('Schulte grid private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
