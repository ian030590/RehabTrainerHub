import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'tic-tac-toe';
const LoadLogic = () => LoadGameModule(gameId, 'logic/ticTacToe.ts');
const Board = text => [...text].map(mark => mark === '.' ? null : mark);

test('Tic Tac Toe keeps the original board choices and sound setting', async () => {
  const { defaultSettings, ValidateSettings } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { difficulty: 'medium', soundEnabled: true });
  assert.equal(ValidateSettings(defaultSettings), true);
  for (const change of [{ difficulty: 'easy' }, { difficulty: 'hard' }, { soundEnabled: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ difficulty: 'expert' }, { difficulty: 1 }, { soundEnabled: 'yes' }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
  const { boardSpecs } = await LoadLogic();
  assert.deepEqual(boardSpecs, { easy: { size: 3, winLength: 3 }, medium: { size: 4, winLength: 3 }, hard: { size: 5, winLength: 4 } });
});

test('a line counts across rows, columns and both diagonals and returns its cells', async () => {
  const { FindLine } = await LoadLogic();
  assert.deepEqual(FindLine(Board('XXX......'), 3, 3, 'X'), [0, 1, 2]);
  assert.deepEqual(FindLine(Board('O..O..O..'), 3, 3, 'O'), [0, 3, 6]);
  assert.deepEqual(FindLine(Board('.X....X....X....'), 4, 3, 'X'), [1, 6, 11]);
  assert.deepEqual(FindLine(Board('...X..X..X......'), 4, 3, 'X'), [3, 6, 9]);
  assert.equal(FindLine(Board('XX.X.....'), 3, 3, 'X'), null);
  assert.equal(FindLine(Board('XXX..'.padEnd(25, '.')), 5, 4, 'X'), null, 'Hard boards need four in a row.');
  assert.deepEqual(FindLine(Board('XXXX.'.padEnd(25, '.')), 5, 4, 'X'), [0, 1, 2, 3]);
});

test('the computer wins when it can, blocks next, then takes the original middle index, then a random cell', async () => {
  const { ChooseComputerMove } = await LoadLogic();
  const never = () => { throw new Error('No random choice expected.'); };
  assert.equal(ChooseComputerMove(Board('OO.XX....'), 3, 3, never), 2, 'Win before blocking.');
  assert.equal(ChooseComputerMove(Board('XX..O....'), 3, 3, never), 2, 'Block the player line.');
  assert.equal(ChooseComputerMove(Board('X........'), 3, 3, never), 4);
  assert.equal(ChooseComputerMove(Board('X'.padEnd(16, '.')), 4, 3, never), 8, 'The original rule takes index floor(cells / 2).');
  assert.equal(ChooseComputerMove(Board('X...O....'), 3, 3, () => 0), 1);
  assert.equal(ChooseComputerMove(Board('X...O....'), 3, 3, () => 0.99), 8);
  assert.equal(ChooseComputerMove(Board('XOXXOOOXX'), 3, 3, never), null);
});

test('a match counts taps on filled cells, ignores taps on the computer turn and records each move', async () => {
  const { TicTacToeMatch } = await LoadLogic();
  const match = new TicTacToeMatch('easy', 1000);
  assert.deepEqual([match.size, match.winLength, match.turn], [3, 3, 'player']);
  assert.deepEqual(match.play(0, 2500), { accepted: true, outcome: null });
  assert.equal(match.turn, 'computer');
  assert.deepEqual(match.play(1, 2600), { accepted: false, outcome: null }, 'The computer turn takes no taps.');
  assert.deepEqual(match.computerTurn(() => 0, 3500), { index: 4, outcome: null });
  assert.equal(match.turn, 'player');
  assert.deepEqual(match.play(4, 3900), { accepted: false, outcome: null });
  assert.deepEqual(match.play(0, 4000), { accepted: false, outcome: null });
  assert.equal(match.errors, 2);
  assert.deepEqual(match.play(1, 5100), { accepted: true, outcome: null });
  assert.deepEqual(match.computerTurn(() => 0, 6100), { index: 2, outcome: null }, 'The computer blocks the top row.');
  assert.deepEqual(match.rows, [
    { move: 1, row: 1, col: 1, thinkMs: 1500, invalidTaps: 0 },
    { move: 2, row: 1, col: 2, thinkMs: 1600, invalidTaps: 2 },
  ]);
  assert.deepEqual([match.moves, match.opponentMoves], [2, 2]);
});

test('a match ends with a win, a computer line or a full board', async () => {
  const { TicTacToeMatch } = await LoadLogic();
  const won = new TicTacToeMatch('easy', 0);
  won.board = Board('XX.OO....');
  assert.deepEqual(won.play(2, 100), { accepted: true, outcome: 'Victory' });
  assert.deepEqual([won.turn, won.outcome, won.line], ['over', 'Victory', [0, 1, 2]]);
  assert.deepEqual(won.play(5, 200), { accepted: false, outcome: null }, 'A finished match takes no taps.');
  const lost = new TicTacToeMatch('easy', 0);
  lost.board = Board('OO.XX...X');
  lost.turn = 'computer';
  assert.deepEqual(lost.computerTurn(() => 0, 100), { index: 2, outcome: 'Defeat' });
  assert.deepEqual(lost.line, [0, 1, 2]);
  const draw = new TicTacToeMatch('easy', 0);
  draw.board = Board('XOXXOOO.X');
  assert.deepEqual(draw.play(7, 100), { accepted: true, outcome: 'Draw' });
  assert.equal(draw.line, null);
});

test('the summary keeps the original fields and adds the draw flag, the line length and the mean move time', async () => {
  const logic = await LoadLogic();
  const match = new logic.TicTacToeMatch('medium', 0);
  match.play(5, 2000);
  match.computerTurn(() => 0, 3000);
  match.play(6, 7000);
  match.outcome = 'Victory';
  assert.deepEqual(logic.SummarizeTicTacToe(match, 7049), { duration: 7, completed: 1, draw: 0, moves: 2, errors: 0, opponentMoves: 1,
    boardSize: 4, winLength: 3, meanThinkMs: 3000 });
  const empty = new logic.TicTacToeMatch('hard', 0);
  empty.outcome = 'Draw';
  assert.deepEqual(logic.SummarizeTicTacToe(empty, 1260), { duration: 1.3, completed: 0, draw: 1, moves: 0, errors: 0, opponentMoves: 0,
    boardSize: 5, winLength: 4, meanThinkMs: null });
});

test('Tic Tac Toe results save one numeric row per move through the private channel', async () => {
  const logic = await LoadLogic();
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/ticTacToe': logic });
  const match = new logic.TicTacToeMatch('easy', 0);
  match.play(0, 1200);
  match.outcome = 'Defeat';
  const score = BuildGameScore(match, 4000);
  assert.equal(score.gameId, gameId);
  assert.deepEqual(score.rounds, [{ move: 1, row: 1, col: 1, thinkMs: 1200, invalidTaps: 0 }]);
  assert.equal(score.summary.completed, 0);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, { difficulty: 'easy', soundEnabled: true }, score));
});

test('Tic Tac Toe owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'TicTacToeGame', category: 'higher-cognition', version: '2.0.0' });
});

test('Tic Tac Toe private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
