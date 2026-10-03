import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const logicPath = 'apps/rehabtrainerhub/games/dots-and-boxes/runtime/cognitive/dotsAndBoxesLogic.ts';

async function LoadDotsAndBoxesLogic() {
  const source = await readFile(logicPath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

test('difficulty selects four, five, or six dots per side with empty edges and boxes', async () => {
  const { CreateDotsAndBoxesState } = await LoadDotsAndBoxesLogic();
  for (const [difficulty, size] of [['easy', 4], ['medium', 5], ['hard', 6]]) {
    const state = CreateDotsAndBoxesState(difficulty);
    assert.deepEqual([state.kind, state.size], ['dots-and-boxes', size]);
    assert.deepEqual([state.hLines.length, state.vLines.length, state.boxes.length],
      [size * (size - 1), size * (size - 1), (size - 1) ** 2]);
    assert.ok([...state.hLines, ...state.vLines, ...state.boxes].every(owner => owner === null));
    assert.deepEqual([state.moves, state.aiMoves, state.errors, state.playerScore, state.aiScore, state.aiMoveAt],
      [0, 0, 0, 0, 0, null]);
  }
});

test('valid player edge starts a one-second AI wait; taps during that wait do nothing', async () => {
  const { CreateDotsAndBoxesState, HandleDotsAndBoxesTap, UpdateDotsAndBoxesTimedState } = await LoadDotsAndBoxesLogic();
  const state = CreateDotsAndBoxesState('easy');
  const endings = [];
  HandleDotsAndBoxesTap(state, 0, 2, result => endings.push(result));
  assert.deepEqual([state.hLines[0], state.moves, state.aiMoveAt], ['P', 1, 3]);
  HandleDotsAndBoxesTap(state, 1, 2.5, result => endings.push(result));
  assert.deepEqual([state.hLines[1], state.moves, state.errors], [null, 1, 0]);
  UpdateDotsAndBoxesTimedState(state, 2.999, result => endings.push(result), () => 0);
  assert.deepEqual([state.aiMoves, state.aiMoveAt], [0, 3]);
  UpdateDotsAndBoxesTimedState(state, 3, result => endings.push(result), () => 0);
  assert.deepEqual([state.hLines[1], state.aiMoves, state.aiMoveAt, endings], ['A', 1, null, []]);
});

test('drawn edges and invalid indices count errors without adding moves', async () => {
  const { CreateDotsAndBoxesState, HandleDotsAndBoxesTap } = await LoadDotsAndBoxesLogic();
  const state = CreateDotsAndBoxesState('easy');
  state.hLines[0] = 'A';
  for (const index of [-1, 0, 12, 1299, 1312]) {
    HandleDotsAndBoxesTap(state, index, 1, () => assert.fail('invalid edge cannot finish'));
  }
  assert.deepEqual([state.errors, state.moves, state.aiMoveAt], [5, 0, null]);
  assert.deepEqual(state.hLines[0], 'A');
});

test('closing one or two adjacent boxes awards every box and keeps the player turn', async () => {
  const { CreateDotsAndBoxesState, HandleDotsAndBoxesTap } = await LoadDotsAndBoxesLogic();
  const one = CreateDotsAndBoxesState('easy');
  one.hLines[0] = one.hLines[3] = one.vLines[0] = 'P';
  HandleDotsAndBoxesTap(one, 1301, 8, () => assert.fail('board is not full'));
  assert.deepEqual([one.vLines[1], one.boxes[0], one.playerScore, one.moves, one.aiMoveAt],
    ['P', 'P', 1, 1, null]);

  const two = CreateDotsAndBoxesState('easy');
  for (const index of [0, 1, 3, 4]) two.hLines[index] = 'P';
  two.vLines[0] = two.vLines[2] = 'P';
  HandleDotsAndBoxesTap(two, 1301, 8, () => assert.fail('board is not full'));
  assert.deepEqual([two.boxes[0], two.boxes[1], two.playerScore, two.moves, two.aiMoveAt],
    ['P', 'P', 2, 1, null]);
});

test('AI prefers a closing edge and keeps its turn after claiming a box', async () => {
  const { CreateDotsAndBoxesState, ChooseDotsAndBoxesAiMove, UpdateDotsAndBoxesTimedState } = await LoadDotsAndBoxesLogic();
  const state = CreateDotsAndBoxesState('easy');
  state.hLines[0] = state.hLines[3] = state.vLines[0] = 'P';
  const before = [state.hLines.slice(), state.vLines.slice(), state.boxes.slice()];
  assert.equal(ChooseDotsAndBoxesAiMove(state, () => 0), 1301);
  assert.deepEqual([state.hLines, state.vLines, state.boxes], before, 'lookahead must not draw an edge');
  state.aiMoveAt = 5;
  UpdateDotsAndBoxesTimedState(state, 5, () => assert.fail('board is not full'), () => 0);
  assert.deepEqual([state.vLines[1], state.boxes[0], state.aiScore, state.aiMoves, state.aiMoveAt],
    ['A', 'A', 1, 1, 6]);
  UpdateDotsAndBoxesTimedState(state, 5.999, () => assert.fail('board is not full'), () => 0);
  assert.equal(state.aiMoves, 1);
  UpdateDotsAndBoxesTimedState(state, 6, () => assert.fail('board is not full'), () => 0);
  assert.deepEqual([state.aiMoves, state.aiMoveAt], [2, null]);
});

test('AI random fallback chooses only undrawn edges', async () => {
  const { CreateDotsAndBoxesState, ChooseDotsAndBoxesAiMove } = await LoadDotsAndBoxesLogic();
  const state = CreateDotsAndBoxesState('easy');
  state.hLines.fill('P');
  assert.equal(ChooseDotsAndBoxesAiMove(state, () => 0), 1300);
  state.vLines.fill('A');
  assert.equal(ChooseDotsAndBoxesAiMove(state, () => 0), null);
});

test('last edge ends immediately with victory, defeat, or draw based on box count', async () => {
  const { CreateDotsAndBoxesState, HandleDotsAndBoxesTap } = await LoadDotsAndBoxesLogic();
  for (const [difficulty, playerBefore, opponentBefore, expected] of [
    ['easy', 8, 0, 'Victory'],
    ['easy', 0, 8, 'Defeat'],
    ['medium', 7, 8, 'Draw'],
  ]) {
    const state = CreateDotsAndBoxesState(difficulty);
    state.hLines.fill('P');
    state.vLines.fill('A');
    state.hLines[0] = null;
    state.boxes.fill('A');
    state.boxes[0] = null;
    for (let index = 1; index <= playerBefore; index += 1) state.boxes[index] = 'P';
    state.playerScore = playerBefore;
    state.aiScore = opponentBefore;
    const endings = [];
    HandleDotsAndBoxesTap(state, 0, 7, result => endings.push(result));
    assert.deepEqual([endings, state.playerScore, state.aiScore, state.moves, state.aiMoveAt],
      [[expected], playerBefore + 1, opponentBefore, 1, null]);
  }
});

test('result data preserves all eight declared Hub score fields', async () => {
  const { CreateDotsAndBoxesState, BuildDotsAndBoxesResultData } = await LoadDotsAndBoxesLogic();
  const state = CreateDotsAndBoxesState('medium');
  Object.assign(state, { moves: 10, aiMoves: 8, errors: 2, playerScore: 3, aiScore: 1 });
  assert.deepEqual(BuildDotsAndBoxesResultData(state, 19.4, 'Victory'), {
    Total_Duration_Seconds: 19.4,
    Moves: 10,
    Completed: true,
    Errors: 2,
    Opponent_Moves: 8,
    Player_Boxes: 3,
    Opponent_Boxes: 1,
    Board_Size: 5,
  });
  assert.equal(BuildDotsAndBoxesResultData(state, 20, 'Defeat').Completed, false);
  assert.equal(BuildDotsAndBoxesResultData(state, 20, 'Draw').Completed, false);
  const score = JSON.parse(await readFile('apps/rehabtrainerhub/games/dots-and-boxes/score.json', 'utf8'));
  const sources = [
    'Total_Duration_Seconds', 'Moves', 'Completed', 'Errors',
    'Opponent_Moves', 'Player_Boxes', 'Opponent_Boxes', 'Board_Size',
  ];
  assert.deepEqual(score.columns.map(column => column.sources[0]), sources);
  assert.deepEqual(score.summary.map(column => column.sources[0]), sources);
});

test('settings and rules describe edges, box scoring, and the actual audio cue', async () => {
  const settings = JSON.parse(await readFile('apps/rehabtrainerhub/games/dots-and-boxes/settings.json', 'utf8'));
  const description = settings.sections[0].description.en;
  assert.match(description, /line|edge|box/i);
  assert.doesNotMatch(description, /scramble|random puzzle|time limit/i);
  assert.match(settings.sections[0].fields[0].description.en, /dot|box|grid/i);
  assert.match(settings.sections[0].fields[1].description.en, /game ends|result/i);
  const rules = await readFile('apps/rehabtrainerhub/games/dots-and-boxes/runtime/components/rules/BrainTrainingRulesPanel.tsx', 'utf8');
  assert.doesNotMatch(rules, /successes/i);
  assert.match(rules, /box|boxes/i);
});
