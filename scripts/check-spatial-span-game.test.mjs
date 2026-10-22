import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'spatial-span';
const LoadTrials = async () => LoadGameModule(gameId, 'logic/spatialSpanTrials.ts');

test('Spatial span keeps the original square time, length and 5 by 5 board, with smaller boards and practice as options', async () => {
  const { defaultSettings, ValidateSettings, EstimatedSeconds } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { itemExposureMs: 1000, rounds: 28, boardSize: 5, practice: true });
  assert.equal(ValidateSettings(defaultSettings), true);
  assert.equal(EstimatedSeconds(defaultSettings), 427);
  assert.equal(EstimatedSeconds({ itemExposureMs: 250, rounds: 16, boardSize: 3, practice: false }), 172);
  for (const change of [{ itemExposureMs: 250 }, { itemExposureMs: 2000 }, { rounds: 16 }, { rounds: 20 }, { boardSize: 3 }, { boardSize: 4 }, { practice: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ itemExposureMs: 0 }, { itemExposureMs: 600 }, { itemExposureMs: 2250 }, { rounds: 14 }, { rounds: 27 }, { rounds: 30 },
    { boardSize: 2 }, { boardSize: 6 }, { boardSize: '5' }, { practice: 'true' }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
});

test('the session is two practice sequences, then half the sequences forward and half in reverse', async () => {
  const { CreateSpatialSpanPlan, startLoad } = await LoadTrials();
  assert.equal(startLoad, 3);
  assert.deepEqual(CreateSpatialSpanPlan({ rounds: 28, practice: true }), [
    { kind: 'practice', reverse: false, count: 2 }, { kind: 'forward', reverse: false, count: 14 }, { kind: 'reverse', reverse: true, count: 14 }]);
  assert.deepEqual(CreateSpatialSpanPlan({ rounds: 20, practice: false }), [
    { kind: 'forward', reverse: false, count: 10 }, { kind: 'reverse', reverse: true, count: 10 }]);
});

test('squares come from the whole board and never light the same square twice in a row', async () => {
  const { CreateCells, CreateRandom } = await LoadTrials();
  for (const boardSize of [3, 4, 5]) {
    const seen = new Set();
    for (const seed of [1, 2, 3, 5, 8, 13, 21, 34, 55]) {
      const random = CreateRandom(seed);
      for (const count of [3, 7, 12]) {
        const cells = CreateCells(count, boardSize, random);
        assert.equal(cells.length, count);
        cells.forEach((cell, index) => {
          assert.ok(Number.isInteger(cell) && cell >= 1 && cell <= boardSize ** 2, `${boardSize}: ${cell}`);
          if (index) assert.notEqual(cell, cells[index - 1]);
          seen.add(cell);
        });
      }
    }
    assert.equal(seen.size, boardSize ** 2);
  }
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

test('each sequence shows its length for 1 s, a 1 s pause, the empty board for 1 s, then one square after another', async () => {
  const { CreateSquareSchedule, IsRecallCorrect } = await LoadTrials();
  assert.deepEqual(CreateSquareSchedule([7, 19, 3], 1000), {
    events: [{ at: 0, state: 'count' }, { at: 1000, state: 'blank' }, { at: 2000, state: 'grid' },
      { at: 3000, state: 'square', cell: 7 }, { at: 4000, state: 'square', cell: 19 }, { at: 5000, state: 'square', cell: 3 }],
    answerAt: 6000,
  });
  assert.equal(IsRecallCorrect([7, 19, 3], [7, 19, 3], false), true);
  assert.equal(IsRecallCorrect([7, 19, 3], [3, 19, 7], true), true);
  assert.equal(IsRecallCorrect([7, 19, 3], [3, 19, 7], false), false);
  assert.equal(IsRecallCorrect([7, 19, 3], [7, 19, 3, 3], false), false);
});

test('the summary keeps the original fields and adds the longest correct length and accuracy per direction', async () => {
  const trials = await LoadTrials();
  const { SummarizeSpatialSpan } = await LoadGameModule(gameId, 'logic/spatialSpanScore.ts', { './spatialSpanTrials': trials });
  const row = (reverse, sequence, response, rtMs, practice = false) => ({ trial: 0, practice, reverse, load: sequence.length, sequence, response, rtMs });
  const rows = [row(false, [1, 2, 3], [1, 2, 3], 2000, true), row(false, [4, 8, 2], [4, 8, 2], 3000), row(false, [5, 9, 1, 6], [5, 9, 6, 1], 4000),
    row(false, [7, 3, 8, 2], [7, 3, 8, 2], 5000), row(true, [9, 5, 1], [1, 5, 9], 3000), row(true, [2, 6, 9, 4], [2, 6, 9, 4], 6000)];
  assert.deepEqual(SummarizeSpatialSpan(rows), { trials: 5, scored: 5, correct: 3, accuracy: 60, meanResponseMs: 4200,
    forwardSpan: 4, reverseSpan: 3, forwardAccuracy: 66.7, reverseAccuracy: 50 });
  assert.deepEqual(SummarizeSpatialSpan([]), { trials: 0, scored: 0, correct: 0, accuracy: null, meanResponseMs: null,
    forwardSpan: null, reverseSpan: null, forwardAccuracy: null, reverseAccuracy: null });
});

test('Spatial span rows keep the original columns, add the board size and practice, and save through the private channel', async () => {
  const trials = await LoadTrials();
  const scoreModule = await LoadGameModule(gameId, 'logic/spatialSpanScore.ts', { './spatialSpanTrials': trials });
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/spatialSpanScore': scoreModule });
  const settings = { itemExposureMs: 750, rounds: 16, boardSize: 4, practice: true };
  const score = BuildGameScore([
    { trial: 1, practice: true, reverse: false, load: 3, sequence: [1, 6, 11], response: [1, 6, 11], rtMs: 2500 },
    { trial: 2, practice: false, reverse: true, load: 4, sequence: [2, 16, 9, 4], response: [4], rtMs: 1800 }], settings);
  assert.deepEqual(score.rounds, [
    { trial: 1, practice: 1, reverse: 0, load: 3, entered: 3, correct: 1, responseMs: 2500, setting: 750, board: 4 },
    { trial: 2, practice: 0, reverse: 1, load: 4, entered: 1, correct: 0, responseMs: 1800, setting: 750, board: 4 }]);
  assert.equal(score.gameId, gameId);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, settings, score));
});

test('Spatial span owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'SpatialSpanRecall', category: 'memory', version: '2.0.0' });
});

test('Spatial span private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
