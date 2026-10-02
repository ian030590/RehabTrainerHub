import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const logicPath = 'apps/rehabtrainerhub/games/sliding-puzzle/runtime/cognitive/slidingLogic.ts';

async function LoadSlidingLogic() {
  const source = await readFile(logicPath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

test('Sliding Puzzle creates a legal shuffled board at every configured size', async () => {
  const { CreateSlidingState, IsSlidingAutoSuccess } = await LoadSlidingLogic();
  for (const [difficulty, size, shuffles] of [
    ['Beginner', 3, 36], ['Intermediate', 4, 72], ['Advanced', 5, 120],
  ]) {
    let draws = 0;
    const state = CreateSlidingState(difficulty, () => { draws += 1; return 0; });
    assert.equal(state.kind, 'sliding-puzzle');
    assert.deepEqual([state.size, state.tiles.length, state.moves, state.errors], [size, size * size, 0, 0]);
    assert.deepEqual([...state.tiles].sort((a, b) => a - b),
      Array.from({ length: size * size }, (_, index) => index));
    assert.equal(state.tiles[state.blankIndex], 0);
    assert.equal(draws, shuffles, 'scramble must use the configured number of legal moves');
    assert.equal(IsSlidingAutoSuccess(state), false, 'the generated puzzle must need a move');
  }
});

test('Sliding Puzzle moves only an adjacent numbered tile into the blank', async () => {
  const { CreateSlidingState, HandleSlidingTap } = await LoadSlidingLogic();
  const state = CreateSlidingState('Beginner', () => 0);
  const original = [...state.tiles];
  const blank = state.blankIndex;
  const adjacent = [blank - state.size, blank + state.size, blank - 1, blank + 1]
    .find(index => index >= 0 && index < state.tiles.length
      && Math.abs(Math.floor(index / state.size) - Math.floor(blank / state.size))
        + Math.abs(index % state.size - blank % state.size) === 1);
  const endings = [];
  HandleSlidingTap(state, adjacent, result => endings.push(result));
  const expected = [...original];
  [expected[blank], expected[adjacent]] = [expected[adjacent], expected[blank]];
  assert.deepEqual(state.tiles, expected);
  assert.deepEqual([state.blankIndex, state.moves, state.errors], [adjacent, 1, 0]);
  assert.deepEqual(endings, []);
});

test('Sliding Puzzle counts a nonadjacent numbered tile as an error but ignores invalid input and blank', async () => {
  const { CreateSlidingState, HandleSlidingTap } = await LoadSlidingLogic();
  const state = CreateSlidingState('Beginner', () => 0);
  const original = [...state.tiles];
  const endings = [];
  const distant = state.tiles.findIndex((tile, index) => tile !== 0
    && Math.abs(Math.floor(index / state.size) - Math.floor(state.blankIndex / state.size))
      + Math.abs(index % state.size - state.blankIndex % state.size) > 1);
  HandleSlidingTap(state, distant, result => endings.push(result));
  for (const index of [-1, state.tiles.length, NaN, 1.5, state.blankIndex]) {
    HandleSlidingTap(state, index, result => endings.push(result));
  }
  assert.deepEqual(state.tiles, original);
  assert.deepEqual([state.moves, state.errors], [0, 1]);
  assert.deepEqual(endings, []);
});

test('Sliding Puzzle wins on the final move and keeps a monotonic deadline', async () => {
  const { CreateSlidingState, HandleSlidingTap, IsSlidingAutoSuccess, GetSlidingTimedOutcome } = await LoadSlidingLogic();
  const state = CreateSlidingState('Beginner', () => 0);
  state.tiles = [1, 2, 3, 4, 5, 6, 7, 0, 8];
  state.blankIndex = 7;
  const endings = [];
  HandleSlidingTap(state, 8, result => endings.push(result));
  assert.equal(IsSlidingAutoSuccess(state), true);
  assert.deepEqual(endings, ['Victory']);
  assert.equal(GetSlidingTimedOutcome(state, 1000, 61000, 60), 'Victory');
  state.tiles = [1, 2, 3, 4, 5, 6, 7, 0, 8];
  state.blankIndex = 7;
  assert.equal(GetSlidingTimedOutcome(state, 1000, 61000, 0), null);
  assert.equal(GetSlidingTimedOutcome(state, 1000, 60999, 60), null);
  assert.equal(GetSlidingTimedOutcome(state, 1000, 61000, 60), 'Defeat');
});

test('Sliding Puzzle preserves all five Hub score fields', async () => {
  const { CreateSlidingState, BuildSlidingResultData } = await LoadSlidingLogic();
  const state = CreateSlidingState('Intermediate', () => 0);
  state.moves = 6;
  state.errors = 2;
  assert.deepEqual(BuildSlidingResultData(state, 32.4, 'Victory'), {
    Total_Duration_Seconds: 32.4,
    Moves: 6,
    Completed: true,
    Errors: 2,
    Board_Size: 4,
  });
  assert.equal(BuildSlidingResultData(state, 60, 'Defeat').Completed, false);
  const score = JSON.parse(await readFile('apps/rehabtrainerhub/games/sliding-puzzle/score.json', 'utf8'));
  assert.deepEqual(score.summary.map(column => column.sources[0]), [
    'Total_Duration_Seconds', 'Moves', 'Completed', 'Errors', 'Board_Size',
  ]);
});
