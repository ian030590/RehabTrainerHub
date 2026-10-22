import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'dots-and-boxes';
const LoadLogic = () => LoadGameModule(gameId, 'logic/dotsAndBoxes.ts');
const never = () => { throw new Error('No random choice expected.'); };
// Draws the listed lines (h<index> or v<index>) without claiming anything.
function Draw(match, ...lines) {
  for (const line of lines) (line[0] === 'h' ? match.hLines : match.vLines)[Number(line.slice(1))] = 'P';
}
// Fills every line except the listed ones and hands out every box except those touching them.
function FillAllBut(match, missing, owners) {
  match.hLines = match.hLines.map((_, index) => missing.includes(`h${index}`) ? null : 'P');
  match.vLines = match.vLines.map((_, index) => missing.includes(`v${index}`) ? null : 'A');
  match.boxes = owners.map(owner => owner === '.' ? null : owner);
  match.playerBoxes = match.boxes.filter(owner => owner === 'P').length;
  match.opponentBoxes = match.boxes.filter(owner => owner === 'A').length;
}

test('Dots and Boxes keeps the original board sizes and sound setting', async () => {
  const { defaultSettings, ValidateSettings } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { difficulty: 'medium', soundEnabled: true });
  assert.equal(ValidateSettings(defaultSettings), true);
  for (const change of [{ difficulty: 'easy' }, { difficulty: 'hard' }, { soundEnabled: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ difficulty: 'expert' }, { difficulty: 4 }, { soundEnabled: 'yes' }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
  const { boardDots, DotsMatch } = await LoadLogic();
  assert.deepEqual(boardDots, { easy: 4, medium: 5, hard: 6 });
  const match = new DotsMatch('easy', 0);
  assert.deepEqual([match.size, match.hLines.length, match.vLines.length, match.boxes.length], [4, 12, 12, 9]);
});

test('the fourth side of a box claims it and the same player draws again', async () => {
  const { DotsMatch } = await LoadLogic();
  const match = new DotsMatch('easy', 1000);
  Draw(match, 'h0', 'h3', 'v0');
  assert.deepEqual(match.play('v1', 2000), { accepted: true, claimed: 1, outcome: null });
  assert.deepEqual([match.boxes[0], match.playerBoxes, match.turn], ['P', 1, 'player']);
  const double = new DotsMatch('easy', 0);
  Draw(double, 'h0', 'h3', 'v0', 'h1', 'h4', 'v2');
  assert.deepEqual(double.play('v1', 100), { accepted: true, claimed: 2, outcome: null }, 'A shared side can close two boxes.');
  assert.deepEqual(double.boxes.slice(0, 2), ['P', 'P']);
  const open = new DotsMatch('easy', 0);
  assert.deepEqual(open.play('h0', 100), { accepted: true, claimed: 0, outcome: null });
  assert.equal(open.turn, 'computer');
});

test('the computer closes a box when it can, otherwise draws a random open line', async () => {
  const { ChooseComputerLine, DotsMatch } = await LoadLogic();
  const match = new DotsMatch('easy', 0);
  Draw(match, 'h1', 'h4', 'v2', 'h0', 'h3');
  assert.equal(ChooseComputerLine(match, never), 'v1', 'v1 closes box 1, before v0 which closes nothing yet.');
  const empty = new DotsMatch('easy', 0);
  assert.equal(ChooseComputerLine(empty, () => 0), 'h0');
  assert.equal(ChooseComputerLine(empty, () => 0.99), 'v11');
});

test('a match counts taps on drawn lines, ignores taps on the computer turn and records each move', async () => {
  const { DotsMatch } = await LoadLogic();
  const match = new DotsMatch('easy', 1000);
  Draw(match, 'h0', 'h3', 'v0');
  assert.deepEqual(match.play('h0', 1500), { accepted: false, claimed: 0, outcome: null });
  assert.equal(match.errors, 1);
  assert.deepEqual(match.play('v1', 2500), { accepted: true, claimed: 1, outcome: null });
  assert.deepEqual(match.play('h11', 3100), { accepted: true, claimed: 0, outcome: null });
  assert.deepEqual(match.play('h10', 3200), { accepted: false, claimed: 0, outcome: null }, 'The computer turn takes no taps.');
  assert.equal(match.errors, 1);
  match.hLines[2] = 'A';
  match.hLines[5] = 'A';
  match.vLines[2] = 'A';
  assert.deepEqual(match.computerTurn(never, 4000), { line: 'v3', claimed: 1, outcome: null }, 'v3 closes box 2.');
  assert.equal(match.turn, 'computer', 'A closed box gives the computer another line.');
  assert.deepEqual(match.computerTurn(() => 0, 5000), { line: 'h1', claimed: 0, outcome: null });
  assert.equal(match.turn, 'player');
  assert.deepEqual(match.play('v11', 5800), { accepted: true, claimed: 0, outcome: null });
  assert.deepEqual(match.rows, [
    { move: 1, thinkMs: 1500, invalidTaps: 1, boxes: 1 },
    { move: 2, thinkMs: 600, invalidTaps: 0, boxes: 0 },
    { move: 3, thinkMs: 800, invalidTaps: 0, boxes: 0 },
  ]);
  assert.deepEqual([match.moves, match.opponentMoves, match.playerBoxes, match.opponentBoxes], [3, 2, 1, 1]);
});

test('a full board ends the match and the side with more boxes wins', async () => {
  const { DotsMatch } = await LoadLogic();
  const won = new DotsMatch('easy', 0);
  FillAllBut(won, ['v0'], ['.', 'P', 'P', 'P', 'P', 'A', 'A', 'A', 'A']);
  assert.deepEqual(won.play('v0', 100), { accepted: true, claimed: 1, outcome: 'Victory' });
  assert.deepEqual([won.turn, won.playerBoxes, won.opponentBoxes], ['over', 5, 4]);
  assert.deepEqual(won.play('h0', 200), { accepted: false, claimed: 0, outcome: null }, 'A finished match takes no taps.');
  const draw = new DotsMatch('medium', 0);
  FillAllBut(draw, ['v0'], ['.', ...'PPPPPPPAAAAAAAA']);
  assert.deepEqual(draw.play('v0', 100), { accepted: true, claimed: 1, outcome: 'Draw' });
  const lost = new DotsMatch('easy', 0);
  FillAllBut(lost, ['v0'], ['.', 'P', 'P', 'P', 'P', 'A', 'A', 'A', 'A']);
  lost.turn = 'computer';
  assert.deepEqual(lost.computerTurn(never, 100), { line: 'v0', claimed: 1, outcome: 'Defeat' });
});

test('the summary keeps the original fields and adds the draw flag, the board and the mean move time', async () => {
  const logic = await LoadLogic();
  const match = new logic.DotsMatch('medium', 0);
  match.play('h0', 2000);
  match.computerTurn(() => 0.99, 3000);
  match.play('h1', 7000);
  match.outcome = 'Victory';
  assert.deepEqual(logic.SummarizeDots(match, 7049), { duration: 7, completed: 1, draw: 0, moves: 2, errors: 0, opponentMoves: 1,
    playerBoxes: 0, opponentBoxes: 0, boardSize: 5, meanThinkMs: 3000 });
  const empty = new logic.DotsMatch('hard', 0);
  empty.outcome = 'Draw';
  assert.deepEqual(logic.SummarizeDots(empty, 1260), { duration: 1.3, completed: 0, draw: 1, moves: 0, errors: 0, opponentMoves: 0,
    playerBoxes: 0, opponentBoxes: 0, boardSize: 6, meanThinkMs: null });
});

test('Dots and Boxes results save one numeric row per line through the private channel', async () => {
  const logic = await LoadLogic();
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/dotsAndBoxes': logic });
  const match = new logic.DotsMatch('easy', 0);
  match.play('h0', 1200);
  match.outcome = 'Defeat';
  const score = BuildGameScore(match, 4000);
  assert.equal(score.gameId, gameId);
  assert.deepEqual(score.rounds, [{ move: 1, thinkMs: 1200, invalidTaps: 0, boxes: 0 }]);
  assert.equal(score.summary.completed, 0);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, { difficulty: 'easy', soundEnabled: true }, score));
});

test('Dots and Boxes owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'DotsAndBoxesGame', category: 'higher-cognition', version: '2.0.0' });
});

test('Dots and Boxes private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
