import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'sliding-puzzle';
const LoadLogic = () => LoadGameModule(gameId, 'logic/slidingPuzzle.ts');

// Plays the solution traced by hand for the easy board scrambled with random() always 0:
//   1 5 2      1 2 3
//   4 8 3  ->  4 5 6
//   _ 7 6      7 8 _
function SolveEasy(match) {
  assert.deepEqual(match.slide(0, 2000), { accepted: false, solved: false }, 'Tile 1 is not beside the blank.');
  return [[7, 2500], [4, 3000], [1, 3200], [2, 3600], [5, 4000], [8, 4100]].map(([index, now]) => match.slide(index, now));
}

test('Sliding Puzzle keeps the original boards, scramble lengths, time limits and sound setting', async () => {
  const { defaultSettings, ValidateSettings } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { difficulty: 'medium', timeLimitSec: 0, soundEnabled: true });
  assert.equal(ValidateSettings(defaultSettings), true);
  for (const change of [{ difficulty: 'easy' }, { difficulty: 'hard' }, { timeLimitSec: 60 }, { timeLimitSec: 180 }, { timeLimitSec: 300 }, { soundEnabled: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ difficulty: 'expert' }, { timeLimitSec: 30 }, { timeLimitSec: '60' }, { soundEnabled: 'yes' }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
  const { slidingConfig } = await LoadLogic();
  assert.deepEqual(slidingConfig, { easy: { size: 3, shuffles: 36 }, medium: { size: 4, shuffles: 72 }, hard: { size: 5, shuffles: 120 } });
});

test('only the tiles directly above, below, left or right of the blank can slide', async () => {
  const { Neighbors, IsSolved } = await LoadLogic();
  assert.deepEqual(Neighbors(4, 3), [1, 7, 3, 5]);
  assert.deepEqual(Neighbors(0, 3), [3, 1]);
  assert.deepEqual(Neighbors(8, 3), [5, 7]);
  assert.equal(IsSolved([1, 2, 3, 4, 5, 6, 7, 8, 0]), true);
  assert.equal(IsSolved([1, 2, 3, 4, 5, 6, 7, 0, 8]), false);
});

test('a puzzle is the original random walk of the blank from the solved board', async () => {
  const { CreateSlidingPuzzle } = await LoadLogic();
  assert.deepEqual(CreateSlidingPuzzle(3, 1, () => 0), [1, 2, 3, 4, 5, 0, 7, 8, 6]);
  assert.deepEqual(CreateSlidingPuzzle(3, 2, () => 0.99), [1, 2, 3, 4, 5, 6, 0, 7, 8], 'The blank never steps straight back.');
  assert.deepEqual(CreateSlidingPuzzle(3, 36, () => 0), [1, 5, 2, 4, 8, 3, 0, 7, 6]);
  assert.deepEqual(CreateSlidingPuzzle(4, 72, () => 0), [5, 1, 7, 3, 9, 2, 11, 4, 13, 6, 15, 8, 10, 0, 14, 12]);
  assert.deepEqual(CreateSlidingPuzzle(3, 0, () => 0), [1, 2, 3, 4, 5, 0, 7, 8, 6], 'A walk that lands on the solved board keeps going.');
});

test('a match counts taps on tiles away from the blank and records each slide', async () => {
  const { SlidingMatch } = await LoadLogic();
  const match = new SlidingMatch('easy', 1000, () => 0);
  assert.deepEqual(match.tiles, [1, 5, 2, 4, 8, 3, 0, 7, 6]);
  assert.deepEqual(match.slide(6, 1500), { accepted: false, solved: false }, 'The blank itself is not a tile.');
  assert.equal(match.errors, 0);
  const results = SolveEasy(match);
  assert.deepEqual(results.at(-1), { accepted: true, solved: true });
  assert.ok(results.slice(0, -1).every(result => result.accepted && !result.solved));
  assert.deepEqual([match.outcome, match.moves, match.errors, match.misplaced], ['Victory', 6, 1, 0]);
  assert.deepEqual(match.slide(5, 4500), { accepted: false, solved: true }, 'A solved board takes no slides.');
  assert.equal(match.errors, 1);
  assert.equal(match.expire(), null, 'The time limit cannot undo a solved board.');
  assert.deepEqual(match.rows, [
    { move: 1, tile: 7, thinkMs: 1500, invalidTaps: 1, misplaced: 5 },
    { move: 2, tile: 8, thinkMs: 500, invalidTaps: 0, misplaced: 4 },
    { move: 3, tile: 5, thinkMs: 200, invalidTaps: 0, misplaced: 3 },
    { move: 4, tile: 2, thinkMs: 400, invalidTaps: 0, misplaced: 2 },
    { move: 5, tile: 3, thinkMs: 400, invalidTaps: 0, misplaced: 1 },
    { move: 6, tile: 6, thinkMs: 100, invalidTaps: 0, misplaced: 0 },
  ]);
});

test('the time limit ends an unsolved board and stops further slides', async () => {
  const { SlidingMatch } = await LoadLogic();
  const timed = new SlidingMatch('medium', 0, () => 0);
  assert.equal(timed.misplaced, 15);
  assert.equal(timed.expire(), 'TimeUp');
  assert.deepEqual(timed.slide(9, 60100), { accepted: false, solved: false });
  assert.deepEqual([timed.outcome, timed.moves, timed.errors], ['TimeUp', 0, 0]);
});

test('the summary keeps the original fields and adds the tiles out of place and the mean move time', async () => {
  const logic = await LoadLogic();
  const solved = new logic.SlidingMatch('easy', 1000, () => 0);
  SolveEasy(solved);
  assert.deepEqual(logic.SummarizeSliding(solved, 3149), { duration: 3.1, completed: 1, moves: 6, errors: 1, boardSize: 3, misplaced: 0, meanThinkMs: 517 });
  const timed = new logic.SlidingMatch('medium', 0, () => 0);
  timed.expire();
  assert.deepEqual(logic.SummarizeSliding(timed, 60000), { duration: 60, completed: 0, moves: 0, errors: 0, boardSize: 4, misplaced: 15, meanThinkMs: null });
});

test('Sliding Puzzle results save one numeric row per slide through the private channel', async () => {
  const logic = await LoadLogic();
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/slidingPuzzle': logic });
  const match = new logic.SlidingMatch('easy', 1000, () => 0);
  SolveEasy(match);
  const score = BuildGameScore(match, 3100);
  assert.equal(score.gameId, gameId);
  assert.equal(score.rounds.length, 6);
  assert.deepEqual(score.rounds[0], { move: 1, tile: 7, thinkMs: 1500, invalidTaps: 1, misplaced: 5 });
  assert.equal(score.summary.completed, 1);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, { difficulty: 'easy', timeLimitSec: 0, soundEnabled: true }, score));
});

test('Sliding Puzzle owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'SlidingPuzzleGame', category: 'higher-cognition', version: '2.0.0' });
});

test('Sliding Puzzle private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
