import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'tower-of-london';
const LoadTower = async () => LoadGameModule(gameId, 'logic/towerOfLondon.ts');

test('Tower of London keeps the original time per problem, and practice can be turned off', async () => {
  const { defaultSettings, ValidateSettings, EstimatedSeconds } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { problemLimitMs: 20000, practice: true });
  assert.equal(ValidateSettings(defaultSettings), true);
  assert.equal(EstimatedSeconds(defaultSettings), 293);
  assert.equal(EstimatedSeconds({ problemLimitMs: 10000, practice: false }), 150);
  for (const change of [{ problemLimitMs: 10000 }, { problemLimitMs: 60000 }, { problemLimitMs: 35000 }, { practice: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ problemLimitMs: 5000 }, { problemLimitMs: 12000 }, { problemLimitMs: 65000 }, { problemLimitMs: '20000' }, { practice: null }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
});

test('the 12 original problems and the practice problem keep their targets, and each listed minimum is the true shortest solution', async () => {
  const { capacities, startBoard, practiceProblem, problems, MinimumMoves, CreateTowerProblems } = await LoadTower();
  assert.deepEqual(capacities, [3, 2, 1]);
  assert.deepEqual(startBoard, [[1, 2], [3], []]);
  assert.deepEqual(problems.map(problem => problem.target), [
    [[], [3, 1], [2]], [[1], [2], [3]], [[1, 3], [2], []], [[1], [2, 3], []], [[2, 1], [3], []], [[3], [2, 1], []],
    [[2, 3], [], [1]], [[], [2, 3], [1]], [[2, 1, 3], [], []], [[2, 3, 1], [], []], [[3, 1], [2], []], [[3], [2], [1]]]);
  assert.deepEqual(problems.map(problem => problem.minimumMoves), [2, 2, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5]);
  assert.deepEqual(practiceProblem, { target: [[1], [3, 2], []], minimumMoves: 1 });
  for (const problem of [practiceProblem, ...problems]) {
    assert.deepEqual(problem.target.flat().sort(), [1, 2, 3]);
    problem.target.forEach((peg, index) => assert.ok(peg.length <= capacities[index]));
    assert.equal(MinimumMoves(startBoard, problem.target), problem.minimumMoves, JSON.stringify(problem.target));
  }
  const withPractice = CreateTowerProblems({ problemLimitMs: 20000, practice: true });
  assert.deepEqual(withPractice.map(item => [item.practice, item.index]), [[true, null], ...problems.map((_, index) => [false, index])]);
  assert.deepEqual(CreateTowerProblems({ problemLimitMs: 20000, practice: false }).map(item => item.index), problems.map((_, index) => index));
});

test('a peg click picks up the top ball or places the held ball where there is room, and a move counts at pickup', async () => {
  const { startBoard, PegClick, Matches, practiceProblem } = await LoadTower();
  let state = { board: startBoard, held: null, moves: 0 };
  state = PegClick(state, 2);
  assert.deepEqual(state, { board: [[1, 2], [3], []], held: null, moves: 0 }, 'An empty peg gives nothing.');
  state = PegClick(state, 0);
  assert.deepEqual(state, { board: [[1], [3], []], held: 2, moves: 1 });
  assert.deepEqual(startBoard, [[1, 2], [3], []], 'The start layout is never changed.');
  state = PegClick(state, 2);
  assert.deepEqual(state, { board: [[1], [3], [2]], held: null, moves: 1 });
  state = PegClick(PegClick(state, 2), 2);
  assert.deepEqual(state, { board: [[1], [3], [2]], held: null, moves: 2 }, 'Putting a ball back still counts as a move.');
  state = PegClick(PegClick(state, 0), 2);
  assert.deepEqual(state, { board: [[], [3], [2]], held: 1, moves: 3 }, 'A full peg takes nothing.');
  state = PegClick(PegClick(PegClick(state, 0), 2), 1);
  assert.deepEqual(state, { board: [[1], [3, 2], []], held: null, moves: 4 });
  assert.equal(Matches(state.board, practiceProblem.target), true);
  assert.equal(Matches([[1], [2, 3], []], practiceProblem.target), false);
});

test('the summary keeps the original fields and adds fewest-move solutions, extra moves, solving time, planning time and time-outs', async () => {
  const { SummarizeTower } = await LoadGameModule(gameId, 'logic/towerScore.ts');
  const row = (solved, moves, minimumMoves, problemMs, firstMoveMs, practice = false) =>
    ({ trial: 0, practice, problem: practice ? null : 0, solved, moves, minimumMoves, problemMs, firstMoveMs });
  const rows = [row(true, 1, 1, 3000, 1500, true), row(true, 2, 2, 5000, 2000), row(true, 5, 3, 9000, 3000), row(false, 6, 4, 20000, 1000), row(true, 4, 4, 7000, 4000)];
  assert.deepEqual(SummarizeTower(rows), { trials: 4, scored: 4, correct: 3, accuracy: 75, perfect: 2, extraMoves: 2, meanSolveMs: 7000, planningMs: 2500, timeouts: 1 });
  assert.deepEqual(SummarizeTower([row(false, 0, 2, 20000, null)]),
    { trials: 1, scored: 1, correct: 0, accuracy: 0, perfect: 0, extraMoves: 0, meanSolveMs: null, planningMs: null, timeouts: 1 });
  assert.deepEqual(SummarizeTower([]), { trials: 0, scored: 0, correct: 0, accuracy: null, perfect: 0, extraMoves: 0, meanSolveMs: null, planningMs: null, timeouts: 0 });
});

test('Tower of London rows keep the original columns, add the first-move time and save through the private channel', async () => {
  const scoreModule = await LoadGameModule(gameId, 'logic/towerScore.ts');
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/towerScore': scoreModule });
  const settings = { problemLimitMs: 20000, practice: true };
  const score = BuildGameScore([
    { trial: 1, practice: true, problem: null, solved: true, moves: 1, minimumMoves: 1, problemMs: 4200, firstMoveMs: 1800 },
    { trial: 2, practice: false, problem: 4, solved: false, moves: 7, minimumMoves: 4, problemMs: 20000, firstMoveMs: 2600 }], settings);
  assert.deepEqual(score.rounds, [
    { trial: 1, practice: 1, problem: null, correct: 1, problemMs: 4200, moves: 1, minimumMoves: 1, firstMoveMs: 1800, setting: 20000 },
    { trial: 2, practice: 0, problem: 4, correct: 0, problemMs: 20000, moves: 7, minimumMoves: 4, firstMoveMs: 2600, setting: 20000 }]);
  assert.equal(score.gameId, gameId);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, settings, score));
});

test('Tower of London owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'TowerPlanning', category: 'higher-cognition', version: '2.0.1' });
});

test('Tower of London private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
