import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const logicPath = 'apps/rehabtrainerhub/games/lights-out/runtime/cognitive/lightsLogic.ts';

async function LoadLightsLogic() {
  const source = await readFile(logicPath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

test('Lights Out creates a playable board at each configured difficulty', async () => {
  const { CreateLightsState, IsLightsAutoSuccess } = await LoadLightsLogic();
  for (const [difficulty, size] of [['Beginner', 3], ['Intermediate', 4], ['Advanced', 5]]) {
    const state = CreateLightsState(difficulty, () => 0);
    assert.equal(state.kind, 'lights-out');
    assert.equal(state.size, size);
    assert.equal(state.moves, 0);
    assert.equal(state.lights.length, size);
    assert.ok(state.lights.every(row => row.length === size && row.every(light => typeof light === 'boolean')));
    assert.equal(IsLightsAutoSuccess(state), false, 'even cancelling scramble moves must leave a playable puzzle');
  }
});

test('Lights Out toggles the chosen cell and orthogonal neighbors, then wins when all lights are off', async () => {
  const { CreateLightsState, HandleLightsTap, IsLightsAutoSuccess } = await LoadLightsLogic();
  const state = CreateLightsState('Beginner', () => 0);
  const original = state.lights.map(row => [...row]);
  const endings = [];
  HandleLightsTap(state, 4, result => endings.push(result));
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const affected = Math.abs(row - 1) + Math.abs(col - 1) <= 1;
      assert.equal(state.lights[row][col], affected ? !original[row][col] : original[row][col]);
    }
  }
  assert.equal(state.moves, 1);
  assert.equal(IsLightsAutoSuccess(state), true);
  assert.deepEqual(endings, ['Victory']);
});

test('Lights Out corner tap changes only its three adjacent cells', async () => {
  const { CreateLightsState, HandleLightsTap } = await LoadLightsLogic();
  const state = CreateLightsState('Beginner', () => 0);
  const before = state.lights.map(row => [...row]);
  HandleLightsTap(state, 0, () => {});
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const affected = (row === 0 && col === 0) || (row === 0 && col === 1) || (row === 1 && col === 0);
      assert.equal(state.lights[row][col], affected ? !before[row][col] : before[row][col]);
    }
  }
  assert.equal(state.moves, 1);
});

test('Lights Out ignores invalid cell indices without changing the board or score', async () => {
  const { CreateLightsState, HandleLightsTap } = await LoadLightsLogic();
  const state = CreateLightsState('Intermediate', () => 0.2);
  const before = state.lights.map(row => [...row]);
  const endings = [];
  for (const index of [-1, 16, NaN, 1.5]) HandleLightsTap(state, index, result => endings.push(result));
  assert.deepEqual(state.lights, before);
  assert.equal(state.moves, 0);
  assert.deepEqual(endings, []);
});

test('Lights Out keeps an absolute deadline and the existing Hub score fields', async () => {
  const { CreateLightsState, GetLightsTimedOutcome, BuildLightsResultData } = await LoadLightsLogic();
  const state = CreateLightsState('Beginner', () => 0);
  assert.equal(GetLightsTimedOutcome(state, 1000, 61000, 0), null, 'zero means no limit');
  assert.equal(GetLightsTimedOutcome(state, 1000, 60999, 60), null);
  assert.equal(GetLightsTimedOutcome(state, 1000, 61000, 60), 'Defeat');
  state.lights = state.lights.map(row => row.map(() => false));
  assert.equal(GetLightsTimedOutcome(state, 1000, 61000, 60), 'Victory', 'success at the deadline wins');
  state.moves = 7;
  assert.deepEqual(BuildLightsResultData(state, 32.4, 'Victory'), {
    Total_Duration_Seconds: 32.4,
    Moves: 7,
    Completed: true,
    Board_Size: 3,
  });
  assert.deepEqual(BuildLightsResultData(state, 60, 'Defeat'), {
    Total_Duration_Seconds: 60,
    Moves: 7,
    Completed: false,
    Board_Size: 3,
  });
  const score = JSON.parse(await readFile('apps/rehabtrainerhub/games/lights-out/score.json', 'utf8'));
  assert.deepEqual(score.summary.map(column => column.sources[0]), [
    'Total_Duration_Seconds', 'Moves', 'Completed', 'Board_Size',
  ]);
});
