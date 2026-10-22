import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'hex';
const LoadLogic = () => LoadGameModule(gameId, 'logic/hex.ts');
// Rows are written top to bottom; P is the player (top to bottom), A the computer (left to right).
const Board = (...rows) => rows.join('').split('').map(mark => mark === '.' ? null : mark);

test('Hex keeps the original board sizes and sound setting', async () => {
  const { defaultSettings, ValidateSettings } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { difficulty: 'medium', soundEnabled: true });
  assert.equal(ValidateSettings(defaultSettings), true);
  for (const change of [{ difficulty: 'easy' }, { difficulty: 'hard' }, { soundEnabled: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ difficulty: 'expert' }, { difficulty: 7 }, { soundEnabled: 'yes' }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
  const { boardSizes } = await LoadLogic();
  assert.deepEqual(boardSizes, { easy: 5, medium: 7, hard: 9 });
});

test('a chain of touching cells joins the player edges top to bottom and the computer edges left to right', async () => {
  const { FindPath, Neighbors } = await LoadLogic();
  assert.deepEqual(Neighbors(12, 5).sort((a, b) => a - b), [7, 8, 11, 13, 16, 17]);
  assert.deepEqual(Neighbors(0, 5).sort((a, b) => a - b), [1, 5]);
  assert.deepEqual(FindPath(Board('..P..', '..P..', '..P..', '..P..', '..P..'), 5, 'P'), [2, 7, 12, 17, 22]);
  assert.deepEqual(FindPath(Board('....P', '...P.', '..P..', '.P...', 'P....'), 5, 'P'), [4, 8, 12, 16, 20]);
  assert.equal(FindPath(Board('P....', '.P...', '..P..', '...P.', '....P'), 5, 'P'), null, 'Down-right cells do not touch.');
  assert.deepEqual(FindPath(Board('.....', '.....', 'AAAAA', '.....', '.....'), 5, 'A'), [10, 11, 12, 13, 14]);
  assert.equal(FindPath(Board('..P..', '..P..', '..P..', '..P..', '..P..'), 5, 'A'), null);
});

test('the computer wins when it can, blocks next, then takes the empty cell nearest the center', async () => {
  const { ChooseComputerCell } = await LoadLogic();
  assert.equal(ChooseComputerCell(Board('.....', '....P', 'AAAA.', '.....', '.....'), 5), 14);
  assert.equal(ChooseComputerCell(Board('..P..', '..P..', '..P..', '..P..', '.....'), 5), 21, 'The first blocking cell in board order.');
  assert.equal(ChooseComputerCell(Board('.....', '.....', '.....', '.....', '.....'), 5), 12);
  assert.equal(ChooseComputerCell(Board('.....', '.....', '..P..', '.....', '.....'), 5), 7, 'Ties go to the lowest index.');
});

test('a match counts taps on filled cells, ignores taps on the computer turn and records each move', async () => {
  const { HexMatch } = await LoadLogic();
  const match = new HexMatch('easy', 1000);
  assert.deepEqual([match.size, match.board.length, match.turn], [5, 25, 'player']);
  assert.deepEqual(match.play(12, 2500), { accepted: true, outcome: null });
  assert.equal(match.turn, 'computer');
  assert.deepEqual(match.play(0, 2600), { accepted: false, outcome: null }, 'The computer turn takes no taps.');
  assert.deepEqual(match.computerTurn(3500), { index: 7, outcome: null });
  assert.deepEqual(match.play(7, 3900), { accepted: false, outcome: null });
  assert.deepEqual(match.play(12, 4000), { accepted: false, outcome: null });
  assert.equal(match.errors, 2);
  assert.deepEqual(match.play(17, 5100), { accepted: true, outcome: null });
  assert.deepEqual(match.rows, [
    { move: 1, row: 3, col: 3, thinkMs: 1500, invalidTaps: 0 },
    { move: 2, row: 4, col: 3, thinkMs: 1600, invalidTaps: 2 },
  ]);
  assert.deepEqual([match.moves, match.opponentMoves], [2, 1]);
});

test('a match ends when either side joins its edges, and shows that chain', async () => {
  const { HexMatch } = await LoadLogic();
  const won = new HexMatch('easy', 0);
  won.board = Board('..P..', '..P..', '..P..', '..P..', 'AA.A.');
  assert.deepEqual(won.play(22, 100), { accepted: true, outcome: 'Victory' });
  assert.deepEqual([won.turn, won.outcome, won.path], ['over', 'Victory', [2, 7, 12, 17, 22]]);
  assert.deepEqual(won.play(0, 200), { accepted: false, outcome: null }, 'A finished match takes no taps.');
  const lost = new HexMatch('easy', 0);
  lost.board = Board('P....', '.P..P', 'AAAA.', '.P...', 'P....');
  lost.turn = 'computer';
  assert.deepEqual(lost.computerTurn(100), { index: 14, outcome: 'Defeat' });
  assert.deepEqual(lost.path, [10, 11, 12, 13, 14]);
});

test('the summary keeps the original fields and adds the mean move time', async () => {
  const logic = await LoadLogic();
  const match = new logic.HexMatch('medium', 0);
  match.play(0, 2000);
  match.computerTurn(3000);
  match.play(1, 7000);
  match.outcome = 'Victory';
  assert.deepEqual(logic.SummarizeHex(match, 7049), { duration: 7, completed: 1, moves: 2, errors: 0, opponentMoves: 1, boardSize: 7, meanThinkMs: 3000 });
  const empty = new logic.HexMatch('hard', 0);
  empty.outcome = 'Defeat';
  assert.deepEqual(logic.SummarizeHex(empty, 1260), { duration: 1.3, completed: 0, moves: 0, errors: 0, opponentMoves: 0, boardSize: 9, meanThinkMs: null });
});

test('Hex results save one numeric row per move through the private channel', async () => {
  const logic = await LoadLogic();
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/hex': logic });
  const match = new logic.HexMatch('easy', 0);
  match.play(0, 1200);
  match.outcome = 'Defeat';
  const score = BuildGameScore(match, 4000);
  assert.equal(score.gameId, gameId);
  assert.deepEqual(score.rounds, [{ move: 1, row: 1, col: 1, thinkMs: 1200, invalidTaps: 0 }]);
  assert.equal(score.summary.completed, 0);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, { difficulty: 'easy', soundEnabled: true }, score));
});

test('Hex owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'HexGame', category: 'higher-cognition', version: '2.0.0' });
});

test('Hex private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
