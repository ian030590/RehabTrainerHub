import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function LoadMazeLogic() {
  const source = await readFile('apps/rehabtrainerhub/games/maze/runtime/cognitive/mazeLogic.ts', 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

function OpenNeighbors(state, index) {
  const { size, cells } = state;
  const cell = cells[index];
  const row = Math.floor(index / size);
  const col = index % size;
  return [
    !cell.top && row > 0 ? index - size : null,
    !cell.right && col < size - 1 ? index + 1 : null,
    !cell.bottom && row < size - 1 ? index + size : null,
    !cell.left && col > 0 ? index - 1 : null,
  ].filter(value => value !== null);
}

test('each difficulty generates a connected 8, 10, or 12-square maze with reciprocal walls', async () => {
  const { CreateMazeState } = await LoadMazeLogic();
  for (const [difficulty, size] of [['easy', 8], ['medium', 10], ['hard', 12]]) {
    const state = CreateMazeState(difficulty, () => 0.3);
    assert.deepEqual([state.kind, state.size, state.cells.length], ['maze', size, size * size]);
    assert.deepEqual([state.moves, state.errors], [0, 0]);
    assert.ok(state.current >= 0 && state.current < size * size);
    assert.ok(state.end >= 0 && state.end < size * size && state.end !== state.current);
    const visited = new Set([state.current]);
    const queue = [state.current];
    let degreeSum = 0;
    for (const index of queue) {
      const neighbors = OpenNeighbors(state, index);
      degreeSum += neighbors.length;
      for (const next of neighbors) {
        assert.ok(OpenNeighbors(state, next).includes(index), 'passages open from both sides');
        if (!visited.has(next)) { visited.add(next); queue.push(next); }
      }
    }
    assert.equal(visited.size, size * size, 'every square is reachable');
    assert.equal(degreeSum / 2, size * size - 1, 'randomized depth-first maze is a spanning tree');
  }
});

test('goal is a farthest reachable square from the randomized start', async () => {
  const { CreateMazeState } = await LoadMazeLogic();
  const state = CreateMazeState('easy', () => 0.73);
  const distance = new Map([[state.current, 0]]);
  const queue = [state.current];
  for (const index of queue) for (const next of OpenNeighbors(state, index)) {
    if (!distance.has(next)) { distance.set(next, distance.get(index) + 1); queue.push(next); }
  }
  assert.equal(distance.get(state.end), Math.max(...distance.values()));
});

test('tapping an adjacent open square moves; wall, distant, and invalid taps count errors', async () => {
  const { CreateMazeState, HandleMazeTap } = await LoadMazeLogic();
  const state = CreateMazeState('easy', () => 0.25);
  const start = state.current;
  const open = OpenNeighbors(state, start)[0];
  const endings = [];
  HandleMazeTap(state, open, result => endings.push(result));
  assert.deepEqual([state.current, state.moves, state.errors], [open, 1, 0]);
  const blocked = [open - state.size, open + 1, open + state.size, open - 1]
    .find(index => index >= 0 && index < state.cells.length
      && Math.abs(Math.floor(index / state.size) - Math.floor(open / state.size))
        + Math.abs(index % state.size - open % state.size) === 1
      && !OpenNeighbors(state, open).includes(index));
  if (blocked !== undefined) HandleMazeTap(state, blocked, result => endings.push(result));
  HandleMazeTap(state, -1, result => endings.push(result));
  HandleMazeTap(state, state.cells.length, result => endings.push(result));
  HandleMazeTap(state, state.current, result => endings.push(result));
  assert.deepEqual([state.current, state.moves, state.errors, endings],
    [open, 1, blocked === undefined ? 3 : 4, []]);
});

test('direction controls and arrow keys follow the same passage rules', async () => {
  const { CreateMazeState, MoveMazeDirection } = await LoadMazeLogic();
  const state = CreateMazeState('easy', () => 0.4);
  const start = state.current;
  const open = OpenNeighbors(state, start)[0];
  const direction = open === start - state.size ? 'up' : open === start + 1 ? 'right'
    : open === start + state.size ? 'down' : 'left';
  assert.equal(MoveMazeDirection(state, direction, () => {}), true);
  assert.deepEqual([state.current, state.moves], [open, 1]);
  assert.equal(MoveMazeDirection(state, 'not-a-direction', () => {}), false);
  assert.deepEqual([state.current, state.moves, state.errors], [open, 1, 0]);
});

test('entering the goal wins once; the monotonic deadline defeats incomplete play', async () => {
  const { CreateMazeState, HandleMazeTap, UpdateMazeTimedState } = await LoadMazeLogic();
  const state = CreateMazeState('easy', () => 0.4);
  const beforeGoal = OpenNeighbors(state, state.end)[0];
  state.current = beforeGoal;
  const endings = [];
  HandleMazeTap(state, state.end, result => endings.push(result));
  HandleMazeTap(state, beforeGoal, result => endings.push(result));
  assert.deepEqual([endings, state.moves], [['Victory'], 1]);

  const timed = CreateMazeState('easy', () => 0.4);
  const timeout = [];
  UpdateMazeTimedState(timed, 1000, 0, result => timeout.push(result));
  UpdateMazeTimedState(timed, 59.9, 60, result => timeout.push(result));
  assert.deepEqual(timeout, []);
  UpdateMazeTimedState(timed, 60, 60, result => timeout.push(result));
  UpdateMazeTimedState(timed, 61, 60, result => timeout.push(result));
  assert.deepEqual(timeout, ['Defeat']);
});

test('result retains all five declared Hub score sources', async () => {
  const { CreateMazeState, BuildMazeResultData } = await LoadMazeLogic();
  const state = CreateMazeState('medium', () => 0.5);
  Object.assign(state, { moves: 15, errors: 2 });
  assert.deepEqual(BuildMazeResultData(state, 34.5, 'Victory'), {
    Total_Duration_Seconds: 34.5, Moves: 15, Completed: true, Errors: 2, Board_Size: 10,
  });
  assert.equal(BuildMazeResultData(state, 60, 'Defeat').Completed, false);
  const score = JSON.parse(await readFile('apps/rehabtrainerhub/games/maze/score.json', 'utf8'));
  const keys = ['Total_Duration_Seconds', 'Moves', 'Completed', 'Errors', 'Board_Size'];
  assert.deepEqual(score.columns.map(column => column.sources[0]), keys);
  assert.deepEqual(score.summary.map(column => column.sources[0]), keys);
  for (const boardSize of [score.columns, score.summary].map(rows => rows.find(row => row.key === 'boardSize'))) {
    assert.equal(boardSize.label.en, 'Maze side cells');
    assert.equal(boardSize.label.zh, '迷宮每邊格數');
  }
});

test('settings and rules explain actual movement and time limits', async () => {
  const root = 'apps/rehabtrainerhub/games/maze';
  const settings = JSON.parse(await readFile(`${root}/settings.json`, 'utf8'));
  assert.match(settings.sections[0].description.en, /maze.*start.*goal/i);
  assert.doesNotMatch(settings.sections[0].description.en, /scramble|opponent/i);
  const rules = await readFile(`${root}/runtime/components/rules/BrainTrainingRulesPanel.tsx`, 'utf8');
  assert.match(rules, /adjacent open cell/);
  assert.match(rules, /arrow keys/);
  assert.match(rules, /time limit/);
  assert.match(rules, /moves.*errors/);
});
