import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const logicPath = 'apps/rehabtrainerhub/games/connect4/runtime/cognitive/connect4Logic.ts';

async function LoadConnect4Logic() {
  const source = await readFile(logicPath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

test('Connect4 starts with a fixed empty six by seven board', async () => {
  const { CreateConnect4State } = await LoadConnect4Logic();
  const state = CreateConnect4State();
  assert.deepEqual([state.kind, state.rows, state.cols, state.board.length], ['connect4', 6, 7, 42]);
  assert.ok(state.board.every(mark => mark === null));
  assert.deepEqual([state.drops, state.winningLine, state.pendingResult, state.aiMoveAt], [[], [], null, null]);
  assert.deepEqual([state.moves, state.aiMoves, state.errors], [0, 0, 0]);
});

test('player discs fall to the lowest space; animation and the one-second AI turn block repeated taps', async () => {
  const { CreateConnect4State, HandleConnect4Tap, UpdateConnect4TimedState } = await LoadConnect4Logic();
  const state = CreateConnect4State();
  const endings = [];
  const finish = result => endings.push(result);
  HandleConnect4Tap(state, 2, 10, finish);
  assert.deepEqual([state.board[37], state.moves, state.aiMoveAt], ['P', 1, 11]);
  assert.deepEqual(state.drops, [{ index: 37, mark: 'P', startedAt: 10 }]);

  HandleConnect4Tap(state, 2, 10.1, finish);
  UpdateConnect4TimedState(state, 10.449, 'easy', finish, () => 0);
  assert.deepEqual([state.moves, state.aiMoves, state.drops.length], [1, 0, 1]);
  UpdateConnect4TimedState(state, 10.45, 'easy', finish, () => 0);
  HandleConnect4Tap(state, 2, 10.5, finish);
  UpdateConnect4TimedState(state, 10.999, 'easy', finish, () => 0);
  assert.deepEqual([state.moves, state.aiMoves, state.aiMoveAt], [1, 0, 11]);

  UpdateConnect4TimedState(state, 11, 'easy', finish, () => 0);
  assert.deepEqual([state.board[35], state.aiMoves, state.aiMoveAt], ['A', 1, null]);
  HandleConnect4Tap(state, 2, 11.2, finish);
  assert.equal(state.moves, 1, 'the AI drop animation still blocks input');
  UpdateConnect4TimedState(state, 11.45, 'easy', finish, () => 0);
  HandleConnect4Tap(state, 2, 11.45, finish);
  assert.deepEqual([state.board[30], state.moves, state.errors, endings], ['P', 2, 0, []]);
});

test('a full column counts one error without adding a move or starting an AI turn', async () => {
  const { CreateConnect4State, HandleConnect4Tap } = await LoadConnect4Logic();
  const state = CreateConnect4State();
  for (let row = 0; row < 6; row += 1) state.board[row * 7 + 6] = 'A';
  const before = [...state.board];
  HandleConnect4Tap(state, 6, 3, () => assert.fail('full-column tap cannot end the game'));
  assert.deepEqual([state.board, state.moves, state.errors, state.aiMoveAt], [before, 0, 1, null]);
});

test('easy picks a random legal column, medium wins first, and hard wins before blocking', async () => {
  const { CreateConnect4State, ChooseConnect4Move } = await LoadConnect4Logic();
  const state = CreateConnect4State();
  for (const row of [3, 4, 5]) {
    state.board[row * 7 + 2] = 'P';
    state.board[row * 7 + 3] = 'A';
  }
  const before = [...state.board];
  assert.equal(ChooseConnect4Move(state, 'easy', () => 0), 0);
  assert.equal(ChooseConnect4Move(state, 'medium', () => 0), 3);
  assert.equal(ChooseConnect4Move(state, 'hard', () => 0), 3, 'own win takes precedence over blocking');
  assert.deepEqual(state.board, before, 'AI lookahead cannot alter the live board');

  for (const row of [3, 4, 5]) state.board[row * 7 + 3] = null;
  assert.equal(ChooseConnect4Move(state, 'medium', () => 0), 0);
  assert.equal(ChooseConnect4Move(state, 'hard', () => 0), 2);
  const fullFirst = CreateConnect4State();
  for (let row = 0; row < 6; row += 1) fullFirst.board[row * 7] = 'P';
  assert.equal(ChooseConnect4Move(fullFirst, 'easy', () => 0), 1, 'random choice must skip full columns');
  state.board.fill('P');
  assert.equal(ChooseConnect4Move(state, 'hard', () => 0), null);
});

test('four directions win, while a full board without a line is a draw', async () => {
  const { CreateConnect4State, FindConnect4Line, HandleConnect4Tap, UpdateConnect4TimedState } = await LoadConnect4Logic();
  for (const indices of [[35, 36, 37, 38], [14, 21, 28, 35], [0, 8, 16, 24], [3, 9, 15, 21]]) {
    const board = Array(42).fill(null);
    for (const index of indices) board[index] = 'P';
    assert.deepEqual(new Set(FindConnect4Line(board, 'P')), new Set(indices));
    assert.equal(FindConnect4Line(board, 'A'), null);
  }

  const win = CreateConnect4State();
  for (const col of [0, 1, 2]) win.board[35 + col] = 'P';
  const endings = [];
  HandleConnect4Tap(win, 3, 10, result => endings.push(result));
  assert.deepEqual([win.moves, win.aiMoveAt, win.pendingResult, endings], [1, null, { result: 'Victory', finishAt: 11.8 }, []]);
  UpdateConnect4TimedState(win, 11.799, 'easy', result => endings.push(result), () => 0);
  assert.deepEqual(endings, []);
  UpdateConnect4TimedState(win, 11.8, 'easy', result => endings.push(result), () => 0);
  assert.deepEqual(endings, ['Victory']);

  const loss = CreateConnect4State();
  for (const row of [3, 4, 5]) loss.board[row * 7 + 4] = 'A';
  loss.aiMoveAt = 5;
  UpdateConnect4TimedState(loss, 5, 'medium', result => endings.push(result), () => 0);
  assert.deepEqual([loss.board[18], loss.aiMoves, loss.pendingResult], ['A', 1, { result: 'Defeat', finishAt: 6.8 }]);

  const draw = CreateConnect4State();
  draw.board = ['PAPAPAP', 'APAPAPA', 'PAPAPAP', 'PAPAPAP', 'PAPAPAP', 'APAPAPA'].join('').split('');
  draw.board[0] = null;
  assert.equal(FindConnect4Line(draw.board, 'P'), null);
  assert.equal(FindConnect4Line(draw.board, 'A'), null);
  const drawEndings = [];
  HandleConnect4Tap(draw, 0, 4, result => drawEndings.push(result));
  assert.deepEqual([draw.board[0], draw.moves, draw.aiMoveAt, drawEndings], ['P', 1, null, ['Draw']]);
});

test('Connect4 preserves the five declared Hub score fields', async () => {
  const { CreateConnect4State, BuildConnect4ResultData } = await LoadConnect4Logic();
  const state = CreateConnect4State();
  state.moves = 7;
  state.aiMoves = 6;
  state.errors = 2;
  assert.deepEqual(BuildConnect4ResultData(state, 23.4, 'Victory'), {
    Total_Duration_Seconds: 23.4,
    Moves: 7,
    Completed: true,
    Errors: 2,
    Opponent_Moves: 6,
  });
  assert.equal(BuildConnect4ResultData(state, 60, 'Defeat').Completed, false);
  assert.equal(BuildConnect4ResultData(state, 60, 'Draw').Completed, false);
  const score = JSON.parse(await readFile('apps/rehabtrainerhub/games/connect4/score.json', 'utf8'));
  const sources = ['Total_Duration_Seconds', 'Moves', 'Completed', 'Errors', 'Opponent_Moves'];
  assert.deepEqual(score.columns.map(column => column.sources[0]), sources);
  assert.deepEqual(score.summary.map(column => column.sources[0]), sources);
});

test('Connect4 settings and rules describe the actual column and opponent task', async () => {
  const settings = JSON.parse(await readFile('apps/rehabtrainerhub/games/connect4/settings.json', 'utf8'));
  const description = settings.sections[0].description.en;
  assert.match(description, /column|disc|computer/i);
  assert.doesNotMatch(description, /scramble|random puzzle|time limit/i);
  assert.match(settings.sections[0].fields[0].description.en, /computer|opponent/i);
  assert.equal(settings.sections[0].fields[1].description.en, 'Play an audio cue when the game ends.');
  const rules = await readFile('apps/rehabtrainerhub/games/connect4/runtime/components/rules/BrainTrainingRulesPanel.tsx', 'utf8');
  assert.doesNotMatch(rules, /successes/i);
});
