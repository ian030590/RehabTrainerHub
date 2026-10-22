import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'maze';
const LoadLogic = () => LoadGameModule(gameId, 'logic/maze.ts');
const Walls = cells => cells.map(cell => `${cell.top ? 'T' : ''}${cell.right ? 'R' : ''}${cell.bottom ? 'B' : ''}${cell.left ? 'L' : ''}`);
const Sequence = (...values) => { let index = 0; return () => values[index++ % values.length]; };

// With random() always 0 the 3 x 3 maze is one winding path: 0 1 2 / 5 / 8 7 4 / 3 / 6, from the top-left to the bottom-left.
function WalkToGoal(match, from) {
  return ['right', 'down', 'down', 'left', 'up', 'left', 'down'].map((direction, step) => match.move(direction, from + step * 100));
}

test('Maze keeps the original board sizes, time limits and sound setting', async () => {
  const { defaultSettings, ValidateSettings } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { difficulty: 'medium', timeLimitSec: 0, soundEnabled: true });
  assert.equal(ValidateSettings(defaultSettings), true);
  for (const change of [{ difficulty: 'easy' }, { difficulty: 'hard' }, { timeLimitSec: 60 }, { timeLimitSec: 180 }, { timeLimitSec: 300 }, { soundEnabled: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ difficulty: 'expert' }, { timeLimitSec: 30 }, { timeLimitSec: '60' }, { soundEnabled: 'yes' }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
  const { mazeSizes } = await LoadLogic();
  assert.deepEqual(mazeSizes, { easy: 8, medium: 10, hard: 12 });
});

test('a maze is the original depth-first carve from a random start, with the goal at the farthest cell', async () => {
  const { CreateMaze } = await LoadLogic();
  const maze = CreateMaze(3, () => 0);
  assert.deepEqual([maze.size, maze.start, maze.end], [3, 0, 6]);
  assert.deepEqual(Walls(maze.cells), ['TBL', 'TB', 'TR', 'TL', 'TR', 'RL', 'RBL', 'BL', 'RB']);
});

test('a new maze differs from the one just played', async () => {
  const { CreateMaze, MazeSignature } = await LoadLogic();
  const first = CreateMaze(3, () => 0);
  // The first nine values rebuild the same maze, so it is drawn again from the next value.
  const next = CreateMaze(3, Sequence(...Array(9).fill(0), 0.5), MazeSignature(first));
  assert.equal(next.start, 4);
  assert.notEqual(MazeSignature(next), MazeSignature(first));
});

test('moves through walls, off the board or to cells that do not touch yours are counted', async () => {
  const { CreateMaze, MazeMatch } = await LoadLogic();
  const match = new MazeMatch(CreateMaze(3, () => 0), 1000);
  assert.equal(match.shortestPath, 8);
  assert.deepEqual(match.tap(0, 1200), { accepted: false, reached: false }, 'A tap on your own cell does nothing.');
  assert.equal(match.errors, 0);
  assert.deepEqual(match.move('down', 1500), { accepted: false, reached: false }, 'A wall blocks the way down.');
  assert.deepEqual(match.move('up', 1550), { accepted: false, reached: false }, 'The edge of the board blocks the way up.');
  assert.deepEqual(match.tap(4, 1600), { accepted: false, reached: false }, 'A diagonal cell does not touch yours.');
  assert.equal(match.errors, 3);
  assert.deepEqual(match.move('right', 2000), { accepted: true, reached: false });
  assert.deepEqual(match.tap(2, 2300), { accepted: true, reached: false });
  assert.deepEqual(match.tap(1, 2600), { accepted: true, reached: false }, 'You can walk back the way you came.');
  const steps = WalkToGoal(match, 2700);
  assert.deepEqual(steps.at(-1), { accepted: true, reached: true });
  assert.ok(steps.slice(0, -1).every(step => step.accepted && !step.reached));
  assert.deepEqual([match.outcome, match.current, match.moves, match.errors, match.distanceLeft], ['Victory', 6, 10, 3, 0]);
  assert.deepEqual(match.move('up', 3500), { accepted: false, reached: true }, 'The run ends at the goal.');
  assert.equal(match.errors, 3);
  assert.equal(match.expire(), null);
  assert.deepEqual(match.rows.slice(0, 4), [
    { move: 1, row: 1, col: 2, thinkMs: 1000, invalidTaps: 3, distanceLeft: 7 },
    { move: 2, row: 1, col: 3, thinkMs: 300, invalidTaps: 0, distanceLeft: 6 },
    { move: 3, row: 1, col: 2, thinkMs: 300, invalidTaps: 0, distanceLeft: 7 },
    { move: 4, row: 1, col: 3, thinkMs: 100, invalidTaps: 0, distanceLeft: 6 },
  ]);
  assert.deepEqual(match.rows.at(-1), { move: 10, row: 3, col: 1, thinkMs: 100, invalidTaps: 0, distanceLeft: 0 });
});

test('the time limit ends the run away from the goal and stops further moves', async () => {
  const { CreateMaze, MazeMatch } = await LoadLogic();
  const timed = new MazeMatch(CreateMaze(3, () => 0), 0);
  timed.move('right', 500);
  assert.equal(timed.expire(), 'TimeUp');
  assert.deepEqual(timed.move('right', 60100), { accepted: false, reached: false });
  assert.deepEqual([timed.outcome, timed.moves, timed.errors, timed.distanceLeft], ['TimeUp', 1, 0, 7]);
});

test('the summary keeps the original fields and adds the shortest route, the distance left and the mean move time', async () => {
  const logic = await LoadLogic();
  const solved = new logic.MazeMatch(logic.CreateMaze(3, () => 0), 1000);
  solved.move('down', 1500);
  solved.move('right', 2000);
  WalkToGoal(solved, 2100);
  assert.deepEqual(logic.SummarizeMaze(solved, 2649), { duration: 2.6, completed: 1, moves: 8, errors: 1, boardSize: 3, shortestPath: 8, distanceLeft: 0, meanThinkMs: 213 });
  const timed = new logic.MazeMatch(logic.CreateMaze(3, () => 0), 0);
  timed.expire();
  assert.deepEqual(logic.SummarizeMaze(timed, 60000), { duration: 60, completed: 0, moves: 0, errors: 0, boardSize: 3, shortestPath: 8, distanceLeft: 8, meanThinkMs: null });
});

test('Maze results save one numeric row per step through the private channel', async () => {
  const logic = await LoadLogic();
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/maze': logic });
  const match = new logic.MazeMatch(logic.CreateMaze(3, () => 0), 0);
  match.move('right', 800);
  const score = BuildGameScore(match, 800);
  assert.equal(score.gameId, gameId);
  assert.deepEqual(score.rounds, [{ move: 1, row: 1, col: 2, thinkMs: 800, invalidTaps: 0, distanceLeft: 7 }]);
  assert.equal(score.summary.completed, 0);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, { difficulty: 'easy', timeLimitSec: 0, soundEnabled: true }, score));
});

test('Maze owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'MazeGame', category: 'higher-cognition', version: '2.0.0' });
});

test('Maze private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});
