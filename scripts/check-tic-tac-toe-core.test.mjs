import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const logicPath = 'apps/rehabtrainerhub/games/tic-tac-toe/runtime/cognitive/ticTacToeLogic.ts';

async function LoadTicTacToeLogic() {
  const source = await readFile(logicPath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

test('Tic Tac Toe keeps its three board sizes and winning line lengths', async () => {
  const { CreateTicTacToeState } = await LoadTicTacToeLogic();
  for (const [difficulty, size, winLength] of [
    ['Beginner', 3, 3], ['Intermediate', 4, 3], ['Advanced', 5, 4],
  ]) {
    const state = CreateTicTacToeState(difficulty);
    assert.deepEqual([state.kind, state.size, state.winLength], ['tic-tac-toe', size, winLength]);
    assert.equal(state.board.length, size * size);
    assert.ok(state.board.every(mark => mark === null));
    assert.deepEqual([state.aiMoveAt, state.moves, state.aiMoves, state.errors], [null, 0, 0, 0]);
  }
});

test('X moves first; O waits one second; occupied cells count errors while waiting and invalid positions are ignored', async () => {
  const { CreateTicTacToeState, HandleTicTacToeTap, UpdateTicTacToeTimedState } = await LoadTicTacToeLogic();
  const state = CreateTicTacToeState('Beginner');
  const endings = [];
  const finish = result => endings.push(result);
  HandleTicTacToeTap(state, 0, 10, finish);
  assert.deepEqual([state.board[0], state.moves, state.aiMoveAt], ['X', 1, 11]);
  HandleTicTacToeTap(state, 1, 10.1, finish);
  HandleTicTacToeTap(state, 0, 10.2, finish);
  assert.deepEqual([state.board[1], state.moves, state.errors], [null, 1, 0]);
  UpdateTicTacToeTimedState(state, 10.999, finish, () => 0);
  assert.equal(state.aiMoves, 0);
  UpdateTicTacToeTimedState(state, 11, finish, () => 0);
  assert.deepEqual([state.board[4], state.aiMoves, state.aiMoveAt], ['O', 1, null]);
  HandleTicTacToeTap(state, 0, 11.1, finish);
  for (const index of [-1, state.board.length, Number.NaN, 1.5]) {
    HandleTicTacToeTap(state, index, 11.2, finish);
  }
  assert.deepEqual([state.moves, state.errors, state.board.length, endings], [1, 1, 9, []]);
  assert.equal(Object.hasOwn(state.board, '-1'), false);
});

test('O chooses its own win, then blocks X, then center, then a random empty cell', async () => {
  const { CreateTicTacToeState, ChooseTicTacToeMove } = await LoadTicTacToeLogic();
  const state = CreateTicTacToeState('Beginner');
  state.board = ['O', 'O', null, 'X', 'X', null, null, null, null];
  assert.equal(ChooseTicTacToeMove(state, () => 0.99), 2, 'winning takes precedence over blocking');
  state.board = ['X', 'X', null, null, 'O', null, null, null, null];
  assert.equal(ChooseTicTacToeMove(state, () => 0.99), 2, 'blocking takes precedence over random');
  state.board = Array(9).fill(null);
  assert.equal(ChooseTicTacToeMove(state, () => 0.99), 4, 'center takes precedence over random');
  state.board = ['O', null, null, null, 'X', null, null, null, null];
  const before = [...state.board];
  assert.equal(ChooseTicTacToeMove(state, () => 0.99), 8);
  assert.deepEqual(state.board, before, 'lookahead must not change the real board');
  state.board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
  assert.equal(ChooseTicTacToeMove(state, () => 0), null);
});

test('X win, O win and a full drawn board finish with their original outcomes', async () => {
  const { CreateTicTacToeState, HandleTicTacToeTap, UpdateTicTacToeTimedState, IsTicTacToeAutoSuccess } = await LoadTicTacToeLogic();
  const xWin = CreateTicTacToeState('Beginner');
  xWin.board[0] = 'X';
  xWin.board[1] = 'X';
  const xEndings = [];
  HandleTicTacToeTap(xWin, 2, 3, result => xEndings.push(result));
  assert.deepEqual([xWin.moves, xWin.aiMoveAt, IsTicTacToeAutoSuccess(xWin), xEndings], [1, null, true, ['Victory']]);

  const oWin = CreateTicTacToeState('Beginner');
  oWin.board[0] = 'O';
  oWin.board[1] = 'O';
  oWin.board[3] = 'X';
  oWin.aiMoveAt = 2;
  const oEndings = [];
  UpdateTicTacToeTimedState(oWin, 2, result => oEndings.push(result), () => 0);
  assert.deepEqual([oWin.board[2], oWin.aiMoves, oWin.aiMoveAt, oEndings], ['O', 1, null, ['Defeat']]);

  const draw = CreateTicTacToeState('Beginner');
  draw.board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', null];
  const drawEndings = [];
  HandleTicTacToeTap(draw, 8, 4, result => drawEndings.push(result));
  assert.deepEqual([draw.board[8], draw.moves, draw.aiMoveAt, drawEndings], ['X', 1, null, ['Draw']]);

  const diagonal = CreateTicTacToeState('Advanced');
  for (const index of [3, 7, 11, 15]) diagonal.board[index] = 'X';
  assert.equal(IsTicTacToeAutoSuccess(diagonal), true, 'five-cell boards need a four-mark descending diagonal');
  diagonal.board[15] = null;
  assert.equal(IsTicTacToeAutoSuccess(diagonal), false);
});

test('Tic Tac Toe keeps the six numeric Hub score fields', async () => {
  const { CreateTicTacToeState, BuildTicTacToeResultData } = await LoadTicTacToeLogic();
  const state = CreateTicTacToeState('Advanced');
  state.moves = 7;
  state.aiMoves = 6;
  state.errors = 2;
  assert.deepEqual(BuildTicTacToeResultData(state, 23.4, 'Victory'), {
    Total_Duration_Seconds: 23.4,
    Moves: 7,
    Completed: true,
    Errors: 2,
    Opponent_Moves: 6,
    Board_Size: 5,
  });
  assert.equal(BuildTicTacToeResultData(state, 60, 'Defeat').Completed, false);
  assert.equal(BuildTicTacToeResultData(state, 60, 'Draw').Completed, false);
  const score = JSON.parse(await readFile('apps/rehabtrainerhub/games/tic-tac-toe/score.json', 'utf8'));
  const sources = ['Total_Duration_Seconds', 'Moves', 'Completed', 'Errors', 'Opponent_Moves', 'Board_Size'];
  assert.deepEqual(score.columns.map(column => column.sources[0]), sources);
  assert.deepEqual(score.summary.map(column => column.sources[0]), sources);
});

test('Tic Tac Toe abort and return share a synchronous cancellation path before requesting settings', async () => {
  const source = await readFile('apps/rehabtrainerhub/games/tic-tac-toe/runtime/cognitive/ReferenceCognitiveGame.tsx', 'utf8');
  const cancel = source.match(/function CancelGame\(\)\s*\{([\s\S]*?)\n  \}/)?.[1];
  assert.ok(cancel, 'a single CancelGame path must own cancellation');
  const request = cancel.indexOf('RequestHubTrainingConfiguration()');
  assert.ok(request >= 0, 'cancellation returns to Hub settings');
  for (const stop of ["ChangePhase('rules')", 'stateRef.current = null', 'ClearAiTimer()']) {
    const position = cancel.indexOf(stop);
    assert.ok(position >= 0 && position < request, `${stop} must happen before the settings request`);
  }
  assert.equal([...source.matchAll(/RequestHubTrainingConfiguration\(\)/g)].length, 1,
    'no exit or abort path may bypass CancelGame');
  assert.match(source, /onAbort:\s*(?:CancelGame|\(\)\s*=>\s*\{?\s*CancelGame\(\))/, 'abort uses CancelGame');
  assert.match(source, /onBack=\{(?:CancelGame|\(\)\s*=>\s*CancelGame\(\))\}/, 'rules back uses CancelGame');
  assert.match(source, /onClick=\{(?:CancelGame|\(\)\s*=>\s*CancelGame\(\))\}/, 'playing return uses CancelGame');
});

test('Tic Tac Toe settings and rules describe the actual opponent game', async () => {
  const settings = JSON.parse(await readFile('apps/rehabtrainerhub/games/tic-tac-toe/settings.json', 'utf8'));
  const description = settings.sections[0].description.en;
  assert.match(description, /computer|opponent/i);
  assert.doesNotMatch(description, /scramble|random puzzle/i);
  const rules = await readFile('apps/rehabtrainerhub/games/tic-tac-toe/runtime/components/rules/BrainTrainingRulesPanel.tsx', 'utf8');
  assert.doesNotMatch(rules, /successes/i, 'results describe moves rather than nonexistent successes');
});

test('Tic Tac Toe has one playable game implementation', () => {
  assert.equal(existsSync('apps/rehabtrainerhub/games/tic-tac-toe/runtime/cognitive/languageNeutralGames.ts'), false);
});
