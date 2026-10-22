export type Outcome = 'Victory' | 'TimeUp';
export type Direction = 'up' | 'down' | 'left' | 'right';
export interface MazeCell { top: boolean; right: boolean; bottom: boolean; left: boolean }
export interface Maze { size: number; cells: MazeCell[]; start: number; end: number }
export interface StepRow { move: number; row: number; col: number; thinkMs: number; invalidTaps: number; distanceLeft: number }

// Cells per side.
export const mazeSizes = { easy: 8, medium: 10, hard: 12 } as const;

export function CreateRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const steps: Record<Direction, { dr: number; dc: number; wall: keyof MazeCell; opposite: keyof MazeCell }> = {
  up: { dr: -1, dc: 0, wall: 'top', opposite: 'bottom' },
  right: { dr: 0, dc: 1, wall: 'right', opposite: 'left' },
  down: { dr: 1, dc: 0, wall: 'bottom', opposite: 'top' },
  left: { dr: 0, dc: -1, wall: 'left', opposite: 'right' },
};
// Carving and searching try the neighbors in this order, as the original game did.
const order: Direction[] = ['up', 'right', 'down', 'left'];

function Step(index: number, size: number, direction: Direction) {
  const { dr, dc } = steps[direction];
  const row = Math.floor(index / size) + dr, col = index % size + dc;
  return row >= 0 && row < size && col >= 0 && col < size ? row * size + col : null;
}

export function OpenDirections(cells: MazeCell[], size: number, index: number) {
  return order.filter(direction => !cells[index][steps[direction].wall] && Step(index, size, direction) !== null);
}

// Breadth-first search along open passages: the distance to every cell and the order cells were reached.
function Search(cells: MazeCell[], size: number, from: number) {
  const distance = Array<number>(size * size).fill(-1);
  distance[from] = 0;
  const reached = [from];
  for (let head = 0; head < reached.length; head++) {
    const index = reached[head];
    for (const direction of OpenDirections(cells, size, index)) {
      const next = Step(index, size, direction)!;
      if (distance[next] !== -1) continue;
      distance[next] = distance[index] + 1;
      reached.push(next);
    }
  }
  return { distance, reached };
}

export function MazeSignature(maze: Maze) {
  return `${maze.start}:${maze.end}:${maze.cells.map(cell => `${+cell.top}${+cell.right}${+cell.bottom}${+cell.left}`).join('')}`;
}

// Depth-first carving from a random start; the goal is the cell farthest from the start.
function CarveMaze(size: number, random: () => number): Maze {
  const start = Math.floor(random() * size * size);
  const cells: MazeCell[] = Array.from({ length: size * size }, () => ({ top: true, right: true, bottom: true, left: true }));
  const visited = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const current = stack[stack.length - 1];
    const options = order.flatMap(direction => {
      const next = Step(current, size, direction);
      return next === null || visited.has(next) ? [] : [{ direction, next }];
    });
    if (!options.length) { stack.pop(); continue; }
    const { direction, next } = options[Math.floor(random() * options.length)];
    cells[current][steps[direction].wall] = false;
    cells[next][steps[direction].opposite] = false;
    visited.add(next);
    stack.push(next);
  }
  const { distance, reached } = Search(cells, size, start);
  // The first cell reached at the greatest distance wins ties, as in the original search.
  const end = reached.reduce((farthest, index) => distance[index] > distance[farthest] ? index : farthest, start);
  return { size, cells, start, end };
}

// A new maze is drawn again (up to four times) when it repeats the one just played.
export function CreateMaze(size: number, random: () => number, avoidSignature?: string) {
  let maze = CarveMaze(size, random);
  for (let attempt = 0; attempt < 4 && avoidSignature && MazeSignature(maze) === avoidSignature; attempt++) maze = CarveMaze(size, random);
  return maze;
}

export class MazeMatch {
  size: number;
  cells: MazeCell[];
  start: number;
  end: number;
  current: number;
  moves = 0;
  errors = 0;
  outcome: Outcome | null = null;
  rows: StepRow[] = [];
  readonly shortestPath: number;
  private toGoal: number[];
  private lastMoveAt: number;
  private invalidThisMove = 0;

  constructor(maze: Maze, startedAt: number) {
    ({ size: this.size, cells: this.cells, start: this.start, end: this.end } = maze);
    this.current = maze.start;
    this.toGoal = Search(maze.cells, maze.size, maze.end).distance;
    this.shortestPath = this.toGoal[maze.start];
    this.lastMoveAt = startedAt;
  }

  get distanceLeft() { return this.toGoal[this.current]; }

  private miss() {
    this.errors++;
    this.invalidThisMove++;
    return { accepted: false, reached: false };
  }

  move(direction: Direction, now: number) {
    if (this.outcome) return { accepted: false, reached: this.outcome === 'Victory' };
    const next = Step(this.current, this.size, direction);
    if (next === null || this.cells[this.current][steps[direction].wall]) return this.miss();
    this.current = next;
    this.moves++;
    this.rows.push({ move: this.moves, row: Math.floor(next / this.size) + 1, col: next % this.size + 1,
      thinkMs: Math.max(0, Math.round(now - this.lastMoveAt)), invalidTaps: this.invalidThisMove, distanceLeft: this.distanceLeft });
    this.lastMoveAt = now;
    this.invalidThisMove = 0;
    const reached = next === this.end;
    if (reached) this.outcome = 'Victory';
    return { accepted: true, reached };
  }

  // A tap on a cell that touches yours moves there; a tap on your own cell does nothing.
  tap(index: number, now: number) {
    if (this.outcome) return { accepted: false, reached: this.outcome === 'Victory' };
    if (index === this.current) return { accepted: false, reached: false };
    const direction = order.find(candidate => Step(this.current, this.size, candidate) === index);
    return direction ? this.move(direction, now) : this.miss();
  }

  expire(): Outcome | null {
    if (this.outcome) return null;
    this.outcome = 'TimeUp';
    return this.outcome;
  }
}

export function SummarizeMaze(match: MazeMatch, durationMs: number) {
  const times = match.rows.map(row => row.thinkMs);
  return {
    duration: Math.round(durationMs / 100) / 10,
    completed: match.outcome === 'Victory' ? 1 : 0,
    moves: match.moves,
    errors: match.errors,
    boardSize: match.size,
    shortestPath: match.shortestPath,
    distanceLeft: match.distanceLeft,
    meanThinkMs: times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : null,
  };
}
