import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'sudoku';
const LoadLogic = () => LoadGameModule(gameId, 'logic/numberGrid.ts');
const sudokuSolution = [
  5, 3, 4, 6, 7, 8, 9, 1, 2,
  6, 7, 2, 1, 9, 5, 3, 4, 8,
  1, 9, 8, 3, 4, 2, 5, 6, 7,
  8, 5, 9, 7, 6, 1, 4, 2, 3,
  4, 2, 6, 8, 5, 3, 7, 9, 1,
  7, 1, 3, 9, 2, 4, 8, 5, 6,
  9, 6, 1, 5, 3, 7, 2, 8, 4,
  2, 8, 7, 4, 1, 9, 6, 3, 5,
  3, 4, 5, 2, 8, 6, 1, 7, 9,
];

// With random() always 0 the easy board keeps rows 3 and 4 and the two 1s:
//   1 _ _ _
//   _ _ _ 1
//   3 4 1 2
//   4 1 2 3
function PlayEasy(match) {
  return [
    match.cycle(1, 1500), match.cycle(1, 1700), match.set(2, 3, 2000), match.set(2, 3, 2050), match.set(3, 4, 2100),
    match.set(4, 2, 2200), match.set(5, 4, 2300), match.set(6, 3, 2400), match.set(5, 3, 2500), match.set(6, 4, 2600),
  ];
}

test('Sudoku keeps the three original rule sets, blank counts, time limits and sound setting', async () => {
  const { defaultSettings, ValidateSettings } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { difficulty: 'medium', timeLimitSec: 0, soundEnabled: true });
  assert.equal(ValidateSettings(defaultSettings), true);
  for (const change of [{ difficulty: 'easy' }, { difficulty: 'hard' }, { timeLimitSec: 60 }, { timeLimitSec: 180 }, { timeLimitSec: 300 }, { soundEnabled: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ difficulty: 'expert' }, { timeLimitSec: 30 }, { timeLimitSec: '60' }, { soundEnabled: 'yes' }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
  const { gridConfig } = await LoadLogic();
  assert.deepEqual(gridConfig, {
    easy: { kind: 'latin-square', size: 4, blanks: 6 },
    medium: { kind: 'magic-square', size: 3, blanks: 6 },
    hard: { kind: 'sudoku', size: 9, blanks: 50 },
  });
});

test('each board uses its rule, its original answer grid and its blank count', async () => {
  const { CreateNumberGrid } = await LoadLogic();
  const easy = CreateNumberGrid('easy', () => 0);
  assert.deepEqual([easy.kind, easy.size, easy.maxValue], ['latin-square', 4, 4]);
  assert.deepEqual(easy.values, [1, 0, 0, 0, 0, 0, 0, 1, 3, 4, 1, 2, 4, 1, 2, 3]);
  const medium = CreateNumberGrid('medium', () => 0);
  assert.deepEqual([medium.kind, medium.size, medium.maxValue], ['magic-square', 3, 9]);
  assert.deepEqual(medium.values, [8, 0, 0, 0, 0, 0, 0, 9, 2]);
  const hard = CreateNumberGrid('hard', () => 0);
  assert.deepEqual([hard.kind, hard.size, hard.maxValue], ['sudoku', 9, 9]);
  assert.equal(hard.givens.filter(given => !given).length, 50);
  assert.deepEqual(hard.values, sudokuSolution.map((value, index) => index === 0 || index > 50 ? value : 0));
  for (const grid of [easy, medium, hard]) assert.deepEqual(grid.givens, grid.values.map(Boolean));
});

test('a full board is checked against its rule, so any correct filling counts', async () => {
  const { IsValidGrid } = await LoadLogic();
  assert.equal(IsValidGrid('latin-square', 4, [1, 2, 3, 4, 2, 3, 4, 1, 3, 4, 1, 2, 4, 1, 2, 3]), true);
  assert.equal(IsValidGrid('latin-square', 4, [1, 2, 3, 4, 2, 1, 4, 3, 3, 4, 1, 2, 4, 3, 2, 1]), true, 'Another Latin square is still correct.');
  assert.equal(IsValidGrid('latin-square', 4, [1, 2, 3, 4, 2, 3, 4, 1, 3, 4, 1, 2, 4, 1, 3, 2]), false);
  assert.equal(IsValidGrid('magic-square', 3, [8, 1, 6, 3, 5, 7, 4, 9, 2]), true);
  assert.equal(IsValidGrid('magic-square', 3, [8, 1, 6, 3, 5, 7, 4, 2, 9]), false);
  assert.equal(IsValidGrid('magic-square', 3, [5, 5, 5, 5, 5, 5, 5, 5, 5]), false, 'Each of 1 to 9 is used once.');
  assert.equal(IsValidGrid('sudoku', 9, sudokuSolution), true);
  const rowsSwapped = [...sudokuSolution.slice(0, 9), ...sudokuSolution.slice(18, 27), ...sudokuSolution.slice(9, 18), ...sudokuSolution.slice(27)];
  assert.equal(IsValidGrid('sudoku', 9, rowsSwapped), true, 'Swapping two rows inside a band is still a valid sudoku.');
  const cellsSwapped = [...sudokuSolution];
  [cellsSwapped[9], cellsSwapped[10]] = [cellsSwapped[10], cellsSwapped[9]];
  assert.equal(IsValidGrid('sudoku', 9, cellsSwapped), false);
  assert.equal(IsValidGrid('sudoku', 9, sudokuSolution.map((value, index) => index ? value : 0)), false, 'A board with a blank is not finished.');
});

test('a match cycles or sets values, counts full boards that break the rule and ends when solved', async () => {
  const { NumberGridMatch } = await LoadLogic();
  const match = new NumberGridMatch('easy', 1000, () => 0);
  assert.deepEqual(match.cycle(0, 1200), { accepted: false, solved: false, fullWrong: false }, 'Given numbers cannot change.');
  const results = PlayEasy(match);
  assert.deepEqual(results[3], { accepted: false, solved: false, fullWrong: false }, 'Setting the same number again is not a move.');
  assert.deepEqual(results[7], { accepted: true, solved: false, fullWrong: true });
  assert.deepEqual(results[8], { accepted: true, solved: false, fullWrong: true });
  assert.deepEqual(results.at(-1), { accepted: true, solved: true, fullWrong: false });
  assert.deepEqual([match.outcome, match.moves, match.errors, match.blanksLeft], ['Victory', 9, 2, 0]);
  assert.deepEqual(match.set(6, 1, 2700), { accepted: false, solved: true, fullWrong: false }, 'A solved board takes no changes.');
  assert.equal(match.expire(), null);
  assert.deepEqual(match.rows, [
    { move: 1, row: 1, col: 2, value: 1, thinkMs: 500, blanksLeft: 5 },
    { move: 2, row: 1, col: 2, value: 2, thinkMs: 200, blanksLeft: 5 },
    { move: 3, row: 1, col: 3, value: 3, thinkMs: 300, blanksLeft: 4 },
    { move: 4, row: 1, col: 4, value: 4, thinkMs: 100, blanksLeft: 3 },
    { move: 5, row: 2, col: 1, value: 2, thinkMs: 100, blanksLeft: 2 },
    { move: 6, row: 2, col: 2, value: 4, thinkMs: 100, blanksLeft: 1 },
    { move: 7, row: 2, col: 3, value: 3, thinkMs: 100, blanksLeft: 0 },
    { move: 8, row: 2, col: 2, value: 3, thinkMs: 100, blanksLeft: 0 },
    { move: 9, row: 2, col: 3, value: 4, thinkMs: 100, blanksLeft: 0 },
  ]);
});

test('a tap past the largest number clears the cell, and 0 clears it from the keyboard', async () => {
  const { NumberGridMatch } = await LoadLogic();
  const match = new NumberGridMatch('medium', 0, () => 0);
  match.set(1, 9, 100);
  assert.equal(match.blanksLeft, 5);
  match.cycle(1, 200);
  assert.deepEqual([match.values[1], match.blanksLeft], [0, 6]);
  match.set(2, 6, 300);
  match.set(2, 0, 400);
  assert.deepEqual([match.values[2], match.blanksLeft, match.moves], [0, 6, 4]);
});

test('the hard board accepts a correct sudoku that differs from the stored answer', async () => {
  const { NumberGridMatch } = await LoadLogic();
  const match = new NumberGridMatch('hard', 0, () => 0);
  const answer = [...sudokuSolution.slice(0, 9), ...sudokuSolution.slice(18, 27), ...sudokuSolution.slice(9, 18), ...sudokuSolution.slice(27)];
  const blanks = match.givens.flatMap((given, index) => given ? [] : [index]);
  const results = blanks.map((index, step) => match.set(index, answer[index], 100 + step));
  assert.deepEqual(results.at(-1), { accepted: true, solved: true, fullWrong: false });
  assert.deepEqual([match.outcome, match.errors], ['Victory', 0]);
});

test('the time limit ends an unfinished board and stops further changes', async () => {
  const { NumberGridMatch } = await LoadLogic();
  const timed = new NumberGridMatch('medium', 0, () => 0);
  timed.set(1, 1, 500);
  assert.equal(timed.expire(), 'TimeUp');
  assert.deepEqual(timed.cycle(2, 60100), { accepted: false, solved: false, fullWrong: false });
  assert.deepEqual([timed.outcome, timed.moves, timed.blanksLeft], ['TimeUp', 1, 5]);
});

test('the summary keeps the original fields and adds the blanks left and the mean move time', async () => {
  const logic = await LoadLogic();
  const solved = new logic.NumberGridMatch('easy', 1000, () => 0);
  PlayEasy(solved);
  assert.deepEqual(logic.SummarizeNumberGrid(solved, 1649), { duration: 1.6, completed: 1, moves: 9, errors: 2, boardSize: 4, puzzleKind: 0, initialBlanks: 6, blanksLeft: 0, meanThinkMs: 178 });
  const timed = new logic.NumberGridMatch('medium', 0, () => 0);
  timed.set(1, 1, 500);
  timed.expire();
  assert.deepEqual(logic.SummarizeNumberGrid(timed, 60000), { duration: 60, completed: 0, moves: 1, errors: 0, boardSize: 3, puzzleKind: 1, initialBlanks: 6, blanksLeft: 5, meanThinkMs: 500 });
  const hard = new logic.NumberGridMatch('hard', 0, () => 0);
  assert.deepEqual([logic.SummarizeNumberGrid(hard, 0).puzzleKind, logic.SummarizeNumberGrid(hard, 0).meanThinkMs], [2, null]);
});

test('Sudoku results save one numeric row per change through the private channel', async () => {
  const logic = await LoadLogic();
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/numberGrid': logic });
  const match = new logic.NumberGridMatch('medium', 0, () => 0);
  match.set(1, 1, 700);
  const score = BuildGameScore(match, 700);
  assert.equal(score.gameId, gameId);
  assert.deepEqual(score.rounds, [{ move: 1, row: 1, col: 2, value: 1, thinkMs: 700, blanksLeft: 5 }]);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, { difficulty: 'medium', timeLimitSec: 0, soundEnabled: true }, score));
});

test('number entries stay silent until the board is solved', async () => {
  const source = await readFile(new URL('../apps/rehabtrainerhub/games/sudoku/SudokuGame.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /PlaySuccessSound/, 'Only the solved board plays a success sound, through the end sound.');
  assert.match(source, /PlayGameEndSound\(/);
});

test('Sudoku owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'SudokuGame', category: 'higher-cognition', version: '2.0.0' });
});

test('Sudoku private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
