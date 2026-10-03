import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const logicPath = 'apps/rehabtrainerhub/games/sudoku/runtime/cognitive/numberGridLogic.ts';

async function LoadNumberGridLogic() {
  const source = await readFile(logicPath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

test('Sudoku entry creates each actual rule, board and blank count', async () => {
  const { CreateNumberGridState, IsNumberGridSolved } = await LoadNumberGridLogic();
  for (const [difficulty, kind, size, blanks] of [
    ['Beginner', 'latin-square', 4, 6],
    ['Intermediate', 'magic-square', 3, 6],
    ['Advanced', 'sudoku', 9, 50],
  ]) {
    const state = CreateNumberGridState(difficulty, () => 0);
    assert.deepEqual([state.kind, state.size, state.values.length, state.solution.length],
      [kind, size, size * size, size * size]);
    assert.deepEqual([state.givens.length, state.givens.filter(given => !given).length],
      [size * size, blanks]);
    assert.deepEqual([state.moves, state.errors, IsNumberGridSolved(state)], [0, 0, false]);
    state.values.forEach((value, index) => assert.equal(value, state.givens[index] ? state.solution[index] : 0));
    if (kind === 'latin-square') {
      assert.deepEqual(state.givens.flatMap((given, index) => given ? [] : [index]), [1, 2, 3, 4, 5, 6]);
      assert.deepEqual([1, 2, 3, 4, 5, 6].map(index => state.solution[index]), [2, 3, 4, 2, 3, 4]);
    }
    if (kind !== 'magic-square') {
      for (let row = 0; row < size; row += 1) {
        const values = state.solution.slice(row * size, (row + 1) * size);
        assert.deepEqual([...values].sort((a, b) => a - b),
          Array.from({ length: size }, (_, index) => index + 1));
        const column = Array.from({ length: size }, (_, index) => state.solution[index * size + row]);
        assert.deepEqual(column.sort((a, b) => a - b),
          Array.from({ length: size }, (_, index) => index + 1));
      }
    }
    if (kind === 'magic-square') {
      const solution = state.solution;
      assert.deepEqual([...solution].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
      for (let row = 0; row < 3; row += 1) {
        assert.equal(solution[row * 3] + solution[row * 3 + 1] + solution[row * 3 + 2], 15);
      }
      for (let index = 0; index < 3; index += 1) {
        assert.equal(solution[index] + solution[index + 3] + solution[index + 6], 15);
      }
      assert.equal(solution[0] + solution[4] + solution[8], 15);
      assert.equal(solution[2] + solution[4] + solution[6], 15);
    }
    if (kind === 'sudoku') {
      for (let boxRow = 0; boxRow < 3; boxRow += 1) {
        for (let boxCol = 0; boxCol < 3; boxCol += 1) {
          const box = Array.from({ length: 9 }, (_, index) =>
            state.solution[(boxRow * 3 + Math.floor(index / 3)) * 9 + boxCol * 3 + index % 3]);
          assert.deepEqual(box.sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
        }
      }
    }
  }
});

test('Number-grid tap ignores givens and invalid positions, then cycles an editable cell', async () => {
  const { CreateNumberGridState, HandleNumberGridTap } = await LoadNumberGridLogic();
  for (const difficulty of ['Beginner', 'Intermediate', 'Advanced']) {
    const state = CreateNumberGridState(difficulty, () => 0);
    const original = [...state.values];
    const given = state.givens.indexOf(true);
    const editable = state.givens.indexOf(false);
    const endings = [];
    for (const index of [given, -1, state.values.length, NaN, 1.5]) {
      HandleNumberGridTap(state, index, result => endings.push(result));
    }
    assert.deepEqual(state.values, original);
    assert.deepEqual([state.moves, state.errors, endings.length], [0, 0, 0]);
    const max = state.kind === 'magic-square' ? 9 : state.size;
    for (let value = 1; value <= max; value += 1) {
      HandleNumberGridTap(state, editable, result => endings.push(result));
      assert.equal(state.values[editable], value);
    }
    HandleNumberGridTap(state, editable, result => endings.push(result));
    assert.deepEqual([state.values[editable], state.moves, state.errors, endings.length], [0, max + 1, 0, 0]);
  }
});

test('Number-grid errors count only complete incorrect boards and exact solution wins', async () => {
  const { CreateNumberGridState, HandleNumberGridTap, IsNumberGridSolved } = await LoadNumberGridLogic();
  const state = CreateNumberGridState('Beginner', () => 0);
  const editable = state.givens.findIndex((given, index) => !given && state.solution[index] < state.size);
  assert.ok(editable >= 0);
  state.values = [...state.solution];
  const endings = [];
  HandleNumberGridTap(state, editable, result => endings.push(result));
  assert.deepEqual([state.errors, state.moves, IsNumberGridSolved(state)], [1, 1, false]);
  state.values[editable] = state.solution[editable] - 1;
  HandleNumberGridTap(state, editable, result => endings.push(result));
  assert.deepEqual([state.errors, state.moves, IsNumberGridSolved(state)], [1, 2, true]);
  assert.deepEqual(endings, ['Victory']);
});

test('Number-grid deadline honors unlimited time and completed boards', async () => {
  const { CreateNumberGridState, GetNumberGridTimedOutcome } = await LoadNumberGridLogic();
  const state = CreateNumberGridState('Beginner', () => 0);
  assert.equal(GetNumberGridTimedOutcome(state, 1000, 61000, 0), null);
  assert.equal(GetNumberGridTimedOutcome(state, 1000, 60999, 60), null);
  assert.equal(GetNumberGridTimedOutcome(state, 1000, 61000, 60), 'Defeat');
  state.values = [...state.solution];
  assert.equal(GetNumberGridTimedOutcome(state, 1000, 61000, 60), 'Victory');
});

test('Number-grid result retains all seven Hub score fields', async () => {
  const { CreateNumberGridState, BuildNumberGridResultData } = await LoadNumberGridLogic();
  for (const [difficulty, kindNumber, size, blanks] of [
    ['Beginner', 0, 4, 6], ['Intermediate', 1, 3, 6], ['Advanced', 2, 9, 50],
  ]) {
    const state = CreateNumberGridState(difficulty, () => 0);
    state.moves = 17;
    state.errors = 2;
    assert.deepEqual(BuildNumberGridResultData(state, 32.4, 'Victory'), {
      Total_Duration_Seconds: 32.4,
      Moves: 17,
      Completed: true,
      Errors: 2,
      Board_Size: size,
      Puzzle_Kind: kindNumber,
      Initial_Blanks: blanks,
    });
    assert.equal(BuildNumberGridResultData(state, 60, 'Defeat').Completed, false);
  }
  const score = JSON.parse(await readFile('apps/rehabtrainerhub/games/sudoku/score.json', 'utf8'));
  assert.deepEqual(score.summary.map(column => column.sources[0]), [
    'Total_Duration_Seconds', 'Moves', 'Completed', 'Errors', 'Board_Size', 'Puzzle_Kind', 'Initial_Blanks',
  ]);
});
