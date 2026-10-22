import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'connect4';
const LoadLogic = () => LoadGameModule(gameId, 'logic/connect4.ts');
// Rows are written top to bottom, seven columns each; P is the player, A the computer.
const Board = (...rows) => {
  const padded = [...Array(6 - rows.length).fill('.......'), ...rows];
  return padded.flatMap(row => [...row].map(mark => mark === '.' ? null : mark));
};
const never = () => { throw new Error('No random choice expected.'); };

test('Connect 4 keeps the original opponent choices and sound setting', async () => {
  const { defaultSettings, ValidateSettings } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { difficulty: 'medium', soundEnabled: true });
  assert.equal(ValidateSettings(defaultSettings), true);
  for (const change of [{ difficulty: 'easy' }, { difficulty: 'hard' }, { soundEnabled: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ difficulty: 'expert' }, { difficulty: 2 }, { soundEnabled: 'yes' }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
  const { boardRows, boardCols } = await LoadLogic();
  assert.deepEqual([boardRows, boardCols], [6, 7]);
});

test('a disc lands on the lowest empty slot and four in a row counts in every direction', async () => {
  const { DropRow, FindLine } = await LoadLogic();
  assert.equal(DropRow(Board(), 3), 5);
  assert.equal(DropRow(Board('...P...', '...A...'), 3), 3);
  assert.equal(DropRow(Board('...P...', '...A...', '...P...', '...A...', '...P...', '...A...'), 3), null);
  assert.deepEqual(FindLine(Board('PPPP...'), 'P'), [35, 36, 37, 38]);
  assert.deepEqual(FindLine(Board('A......', 'A......', 'A......', 'A......'), 'A'), [14, 21, 28, 35]);
  assert.deepEqual(FindLine(Board('...P...', '..PA...', '.PAA...', 'PAAA...'), 'P'), [17, 23, 29, 35]);
  assert.deepEqual(FindLine(Board('P......', 'AP.....', 'AAP....', 'AAAP...'), 'P'), [14, 22, 30, 38]);
  assert.equal(FindLine(Board('PPP.PPP'), 'P'), null);
});

test('the computer follows the original policy for each opponent setting', async () => {
  const { ChooseComputerColumn } = await LoadLogic();
  // The computer can win in column 3 and the player threatens column 6.
  const both = Board('......P', '......P', 'AAA..PP');
  assert.equal(ChooseComputerColumn(both, 'easy', () => 0), 0, 'Easy plays a random legal column.');
  assert.equal(ChooseComputerColumn(both, 'medium', never), 3);
  assert.equal(ChooseComputerColumn(both, 'hard', never), 3, 'Winning comes before blocking.');
  const threat = Board('P.PP..A');
  assert.equal(ChooseComputerColumn(threat, 'hard', never), 1);
  assert.equal(ChooseComputerColumn(threat, 'medium', () => 0.99), 6, 'Medium does not block.');
  const fullFirst = Board('P......', 'A......', 'P......', 'A......', 'P......', 'A......');
  assert.equal(ChooseComputerColumn(fullFirst, 'easy', () => 0), 1, 'Full columns are skipped.');
});

test('a match counts taps on full columns, ignores taps on the computer turn and records each move', async () => {
  const { Connect4Match } = await LoadLogic();
  const match = new Connect4Match('easy', 1000);
  assert.deepEqual([match.board.length, match.turn], [42, 'player']);
  match.board = Board('...P...', '...A...', '...P...', '...A...', '...P...', '...A...');
  assert.deepEqual(match.play(3, 1500), { accepted: false, index: null, outcome: null });
  assert.deepEqual(match.play(3, 1600), { accepted: false, index: null, outcome: null });
  assert.equal(match.errors, 2);
  assert.deepEqual(match.play(0, 2500), { accepted: true, index: 35, outcome: null });
  assert.equal(match.turn, 'computer');
  assert.deepEqual(match.play(1, 2600), { accepted: false, index: null, outcome: null }, 'The computer turn takes no taps.');
  assert.equal(match.errors, 2);
  assert.deepEqual(match.computerTurn(() => 0, 3500), { index: 28, outcome: null }, 'Easy drops on the first open column.');
  assert.equal(match.turn, 'player');
  assert.deepEqual(match.play(6, 4700), { accepted: true, index: 41, outcome: null });
  assert.deepEqual(match.rows, [
    { move: 1, col: 1, height: 1, thinkMs: 1500, invalidTaps: 2 },
    { move: 2, col: 7, height: 1, thinkMs: 1200, invalidTaps: 0 },
  ]);
  assert.deepEqual([match.moves, match.opponentMoves], [2, 1]);
});

test('a match ends with four in a row for either side or a full board', async () => {
  const { Connect4Match } = await LoadLogic();
  const won = new Connect4Match('easy', 0);
  won.board = Board('PPP.AAA');
  assert.deepEqual(won.play(3, 100), { accepted: true, index: 38, outcome: 'Victory' });
  assert.deepEqual([won.turn, won.outcome, won.line], ['over', 'Victory', [35, 36, 37, 38]]);
  assert.deepEqual(won.play(0, 200), { accepted: false, index: null, outcome: null }, 'A finished match takes no taps.');
  const lost = new Connect4Match('medium', 0);
  lost.board = Board('P.....A', 'P.....A', 'P.....A');
  lost.turn = 'computer';
  assert.deepEqual(lost.computerTurn(never, 100), { index: 20, outcome: 'Defeat' });
  assert.deepEqual(lost.line, [20, 27, 34, 41]);
  const draw = new Connect4Match('hard', 0);
  draw.board = Board('A.PAPPA', 'PPAPPAP', 'PAPPAPP', 'PAAPPAA', 'APAAAPA', 'PAAAPAA');
  assert.deepEqual(draw.play(1, 100), { accepted: true, index: 1, outcome: 'Draw' });
  assert.equal(draw.line, null);
});

test('the summary keeps the original fields and adds the draw flag and the mean move time', async () => {
  const logic = await LoadLogic();
  const match = new logic.Connect4Match('medium', 0);
  match.play(2, 2000);
  match.computerTurn(() => 0, 3000);
  match.play(4, 7000);
  match.outcome = 'Victory';
  assert.deepEqual(logic.SummarizeConnect4(match, 7049), { duration: 7, completed: 1, draw: 0, moves: 2, errors: 0, opponentMoves: 1, meanThinkMs: 3000 });
  const empty = new logic.Connect4Match('hard', 0);
  empty.outcome = 'Draw';
  assert.deepEqual(logic.SummarizeConnect4(empty, 1260), { duration: 1.3, completed: 0, draw: 1, moves: 0, errors: 0, opponentMoves: 0, meanThinkMs: null });
});

test('Connect 4 results save one numeric row per move through the private channel', async () => {
  const logic = await LoadLogic();
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/connect4': logic });
  const match = new logic.Connect4Match('easy', 0);
  match.play(0, 1200);
  match.outcome = 'Defeat';
  const score = BuildGameScore(match, 4000);
  assert.equal(score.gameId, gameId);
  assert.deepEqual(score.rounds, [{ move: 1, col: 1, height: 1, thinkMs: 1200, invalidTaps: 0 }]);
  assert.equal(score.summary.completed, 0);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, { difficulty: 'easy', soundEnabled: true }, score));
});

test('Connect 4 owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'Connect4Game', category: 'higher-cognition', version: '2.0.0' });
});

test('Connect 4 private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
