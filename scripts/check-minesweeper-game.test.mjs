import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, GameRoot, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'minesweeper';
const LoadLogic = () => LoadGameModule(gameId, 'logic/minesweeper.ts');
const Neighbors = (field, index) => {
  const row = Math.floor(index / field.size), col = index % field.size, found = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const y = row + dy, x = col + dx;
    if ((dx || dy) && y >= 0 && y < field.size && x >= 0 && x < field.size) found.push(y * field.size + x);
  }
  return found;
};

test('Minesweeper keeps the original densities, board sizes, mine counts, zoom range and sound setting', async () => {
  const { defaultSettings, ValidateSettings } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { difficulty: 'medium', boardSize: 'medium', soundEnabled: true });
  assert.equal(ValidateSettings(defaultSettings), true);
  for (const change of [{ difficulty: 'easy' }, { difficulty: 'hard' }, { boardSize: 'small' }, { boardSize: 'large' }, { soundEnabled: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ difficulty: 'expert' }, { boardSize: '9x9' }, { boardSize: 'custom' }, { soundEnabled: 'yes' }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
  const { mineDensity, boardSizes, CalculateMineCount, zoomRange, ClampZoom } = await LoadLogic();
  assert.deepEqual(mineDensity, { easy: 0.1, medium: 0.16, hard: 0.24 });
  assert.deepEqual(boardSizes, { small: 6, medium: 16, large: 20 }, 'The 9x9, 16x30, 80x80 and custom boards stay retired.');
  assert.deepEqual(['easy', 'medium', 'hard'].map(level => CalculateMineCount(6, 6, mineDensity[level])), [4, 6, 9]);
  assert.deepEqual(['easy', 'medium', 'hard'].map(level => CalculateMineCount(16, 16, mineDensity[level])), [26, 41, 61]);
  assert.deepEqual(['easy', 'medium', 'hard'].map(level => CalculateMineCount(20, 20, mineDensity[level])), [40, 64, 96]);
  assert.deepEqual(zoomRange, { min: 0.5, max: 3, step: 0.25 });
  assert.deepEqual([ClampZoom(0.2), ClampZoom(1.234), ClampZoom(9)], [0.5, 1.23, 3]);
});

test('the first opened cell and its neighbors are never mines, and empty areas open together', async () => {
  const { CreateRandom, MineField } = await LoadLogic();
  for (const seed of [1, 7, 20261023]) {
    const field = new MineField('hard', 'small', CreateRandom(seed), 0);
    assert.deepEqual([field.size, field.mineCount, field.minesPlaced], [6, 9, false]);
    const first = 14;
    const result = field.open(first, 1000);
    assert.equal(result.accepted, true);
    assert.equal(result.result, 'safe');
    assert.equal(field.cells.filter(cell => cell.mine).length, 9);
    for (const index of [first, ...Neighbors(field, first)]) assert.equal(field.cells[index].mine, false, `seed ${seed}: cell ${index} is safe`);
    field.cells.forEach((cell, index) => {
      if (!cell.mine) assert.equal(cell.adjacent, Neighbors(field, index).filter(next => field.cells[next].mine).length);
      if (cell.open) assert.equal(cell.mine, false);
      if (cell.open && cell.adjacent === 0) for (const next of Neighbors(field, index)) assert.equal(field.cells[next].open, true, 'An empty cell opens its neighbors.');
    });
    assert.equal(result.opened, field.cells.filter(cell => cell.open).length);
    assert.equal(field.open(first, 1100).accepted, false, 'An open cell cannot be opened again.');
  }
});

test('flags block opening, are skipped by empty areas, and cannot sit on open cells', async () => {
  const { CreateRandom, MineField } = await LoadLogic();
  const field = new MineField('easy', 'medium', CreateRandom(3), 0);
  assert.deepEqual(field.toggleFlag(0, 500), { accepted: true, flagged: true });
  assert.equal(field.open(0, 600).accepted, false, 'A flagged cell does not open.');
  field.open(8 * 16 + 8, 1000);
  assert.equal(field.cells[0].open, false, 'An opening area stops at a flag.');
  const opened = field.cells.findIndex(cell => cell.open);
  assert.deepEqual(field.toggleFlag(opened, 1200), { accepted: false, flagged: false });
  assert.deepEqual(field.toggleFlag(0, 1300), { accepted: true, flagged: false });
  assert.deepEqual([field.flags, field.moves], [0, 3]);
});

test('opening a mine ends the game and shows every mine; opening every safe cell wins', async () => {
  const { CreateRandom, MineField } = await LoadLogic();
  const lost = new MineField('medium', 'small', CreateRandom(11), 0);
  lost.open(0, 100);
  const mine = lost.cells.findIndex(cell => cell.mine);
  assert.deepEqual(lost.open(mine, 200), { accepted: true, result: 'mine', opened: 0, solved: false });
  assert.deepEqual([lost.outcome, lost.explodedIndex], ['Defeat', mine]);
  assert.ok(lost.cells.every(cell => !cell.mine || cell.open), 'Every mine is shown.');
  assert.equal(lost.open(lost.cells.findIndex(cell => !cell.open), 300).accepted, false);
  assert.equal(lost.toggleFlag(lost.cells.findIndex(cell => !cell.open), 300).accepted, false);

  const won = new MineField('medium', 'small', CreateRandom(11), 0);
  won.open(0, 100);
  let last = null;
  won.cells.forEach((cell, index) => { if (!cell.mine && !cell.open) last = won.open(index, 200 + index); });
  assert.equal(last.solved, true);
  assert.equal(won.outcome, 'Victory');
});

test('each action is a numeric row, and the summary keeps the original fields', async () => {
  const logic = await LoadLogic();
  const field = new logic.MineField('easy', 'small', logic.CreateRandom(5), 0);
  field.toggleFlag(35, 1000);
  field.open(0, 2500);
  const covered = field.cells.findIndex(cell => !cell.open && !cell.flagged && !cell.mine);
  field.open(covered, 4000);
  const safeCells = 36 - 4;
  assert.deepEqual(field.rows[0], { move: 1, action: 2, row: 6, col: 6, thinkMs: 1000, opened: 0, safeLeft: safeCells });
  assert.deepEqual(field.rows.slice(1).map(row => [row.move, row.action, row.thinkMs]), [[2, 1, 1500], [3, 1, 1500]]);
  assert.equal(field.rows[2].row, Math.floor(covered / 6) + 1);
  assert.equal(field.rows.at(-1).safeLeft, safeCells - field.cells.filter(cell => cell.open).length);
  const summary = logic.SummarizeMines(field, 4049);
  assert.deepEqual(summary, {
    duration: 4, completed: field.outcome === 'Victory' ? 1 : 0, rows: 6, columns: 6, mines: 4, safeCells,
    revealedSafe: field.cells.filter(cell => cell.open && !cell.mine).length,
    correctFlags: field.cells[35].mine ? 1 : 0, incorrectFlags: field.cells[35].mine ? 0 : 1, moves: 3, meanThinkMs: 1333,
  });
  assert.ok(Object.keys(summary).length <= 12);
});

test('Minesweeper results save through the private channel', async () => {
  const logic = await LoadLogic();
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/minesweeper': logic });
  const field = new logic.MineField('easy', 'small', logic.CreateRandom(9), 0);
  field.open(0, 1200);
  const score = BuildGameScore(field, 5000);
  assert.equal(score.gameId, gameId);
  assert.deepEqual(Object.keys(score.rounds[0]), ['move', 'action', 'row', 'col', 'thinkMs', 'opened', 'safeLeft']);
  assert.ok(AcceptsResult(gameId, { difficulty: 'easy', boardSize: 'small', soundEnabled: true }, score));
});

test('safe cells chime, a mine buzzes, and the board zooms by buttons, wheel and pinch', async () => {
  const source = await readFile(resolve(GameRoot(gameId), 'MinesweeperGame.tsx'), 'utf8');
  assert.match(source, /result === 'safe'[^\n]*PlaySuccessSound\(\)/);
  assert.match(source, /result === 'mine'[^\n]*PlayFailureSound\(\)/);
  assert.match(source, /addEventListener\('wheel'[^\n]*passive: false/, 'The wheel zooms instead of scrolling the page.');
  assert.match(source, /addEventListener\('touchmove'/, 'Two fingers pinch to zoom.');
  assert.match(source, /onContextMenu=/, 'A right click places a flag.');
});

test('Minesweeper owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'MinesweeperGame', category: 'higher-cognition', version: '2.0.0' });
});

test('Minesweeper private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
