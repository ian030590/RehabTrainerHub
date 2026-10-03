import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function LoadHexLogic() {
  const source = await readFile('apps/rehabtrainerhub/games/hex/runtime/cognitive/hexLogic.ts', 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

test('difficulty selects 5, 7, or 9 cells per side and starts an empty board', async () => {
  const { CreateHexState } = await LoadHexLogic();
  for (const [difficulty, size] of [['easy', 5], ['medium', 7], ['hard', 9]]) {
    const state = CreateHexState(difficulty);
    assert.deepEqual([state.kind, state.size, state.board.length], ['hex', size, size * size]);
    assert.ok(state.board.every(value => value === 0));
    assert.deepEqual([state.aiMoveAt, state.moves, state.aiMoves, state.errors], [null, 0, 0, 0]);
  }
});

test('player connects top to bottom using six-sided neighbors, not square diagonals', async () => {
  const { CreateHexState, HasHexPath } = await LoadHexLogic();
  const state = CreateHexState('easy');
  for (const index of [0, 6, 12, 18, 24]) state.board[index] = 1;
  assert.equal(HasHexPath(state, 1), false, 'down-right square diagonals are not Hex neighbors');
  state.board.fill(0);
  for (const index of [4, 8, 12, 16, 20]) state.board[index] = 1;
  assert.equal(HasHexPath(state, 1), true);
});

test('computer connects left to right using six-sided neighbors', async () => {
  const { CreateHexState, HasHexPath } = await LoadHexLogic();
  const state = CreateHexState('easy');
  for (const index of [5, 6, 7, 8, 9]) state.board[index] = 2;
  assert.equal(HasHexPath(state, 2), true);
  state.board[7] = 0;
  assert.equal(HasHexPath(state, 2), false);
});

test('a valid tap schedules one-second computer turn; taps during wait do nothing', async () => {
  const { CreateHexState, HandleHexTap, UpdateHexTimedState } = await LoadHexLogic();
  const state = CreateHexState('easy');
  const endings = [];
  HandleHexTap(state, 0, 2, result => endings.push(result));
  assert.deepEqual([state.board[0], state.moves, state.aiMoveAt], [1, 1, 3]);
  HandleHexTap(state, 1, 2.5, result => endings.push(result));
  assert.deepEqual([state.board[1], state.moves, state.errors], [0, 1, 0]);
  UpdateHexTimedState(state, 2.999, result => endings.push(result));
  assert.equal(state.aiMoves, 0);
  UpdateHexTimedState(state, 3, result => endings.push(result));
  assert.deepEqual([state.aiMoves, state.aiMoveAt, endings], [1, null, []]);
});

test('occupied or out-of-range cells count an error only on the player turn', async () => {
  const { CreateHexState, HandleHexTap } = await LoadHexLogic();
  const state = CreateHexState('easy');
  state.board[0] = 2;
  for (const index of [-1, 0, 25, 999]) HandleHexTap(state, index, 1, () => assert.fail('invalid tap finished'));
  assert.deepEqual([state.errors, state.moves, state.board[0]], [4, 0, 2]);
});

test('player victory ends immediately without scheduling a computer response', async () => {
  const { CreateHexState, HandleHexTap } = await LoadHexLogic();
  const state = CreateHexState('easy');
  for (const index of [4, 8, 12, 16]) state.board[index] = 1;
  const endings = [];
  HandleHexTap(state, 20, 7, result => endings.push(result));
  assert.deepEqual([endings, state.moves, state.aiMoveAt], [['Victory'], 1, null]);
});

test('computer wins immediately, blocks an immediate player win, then prefers center', async () => {
  const { CreateHexState, ChooseHexMove, UpdateHexTimedState } = await LoadHexLogic();
  const winning = CreateHexState('easy');
  winning.board[5] = winning.board[6] = winning.board[7] = winning.board[8] = 2;
  assert.equal(ChooseHexMove(winning), 4);
  assert.equal(winning.board[4], 0, 'lookahead does not claim a cell');
  winning.aiMoveAt = 1;
  const endings = [];
  UpdateHexTimedState(winning, 1, result => endings.push(result));
  assert.deepEqual([winning.board[4], winning.aiMoves, endings], [2, 1, ['Defeat']]);

  const blocking = CreateHexState('easy');
  for (const index of [4, 8, 12, 16]) blocking.board[index] = 1;
  assert.equal(ChooseHexMove(blocking), 20);
  const opening = CreateHexState('easy');
  assert.equal(ChooseHexMove(opening), 12);
});

test('result retains every declared Hub score source', async () => {
  const { CreateHexState, BuildHexResultData } = await LoadHexLogic();
  const state = CreateHexState('medium');
  Object.assign(state, { moves: 8, aiMoves: 7, errors: 2 });
  assert.deepEqual(BuildHexResultData(state, 14.2, 'Victory'), {
    Total_Duration_Seconds: 14.2, Moves: 8, Completed: true,
    Errors: 2, Opponent_Moves: 7, Board_Size: 7,
  });
  assert.equal(BuildHexResultData(state, 15, 'Defeat').Completed, false);
  const score = JSON.parse(await readFile('apps/rehabtrainerhub/games/hex/score.json', 'utf8'));
  const keys = ['Total_Duration_Seconds', 'Moves', 'Completed', 'Errors', 'Opponent_Moves', 'Board_Size'];
  assert.deepEqual(score.columns.map(column => column.sources[0]), keys);
  assert.deepEqual(score.summary.map(column => column.sources[0]), keys);
  for (const boardSize of [score.columns, score.summary].map(rows => rows.find(row => row.key === 'boardSize'))) {
    assert.equal(boardSize.label.en, 'Board side cells');
    assert.equal(boardSize.label.zh, '棋盤每邊格數');
  }
});

test('settings and rules describe Hex orientation and omit nonexistent time limit', async () => {
  const root = 'apps/rehabtrainerhub/games/hex';
  const settings = JSON.parse(await readFile(`${root}/settings.json`, 'utf8'));
  assert.match(settings.sections[0].description.en, /connect.*top.*bottom.*left.*right/i);
  assert.doesNotMatch(settings.sections[0].description.en, /time limit|scramble|random puzzle/i);
  const rules = await readFile(`${root}/runtime/components/rules/BrainTrainingRulesPanel.tsx`, 'utf8');
  assert.match(rules, /blue and connect top to bottom/);
  assert.match(rules, /red and connects left to right/);
});
