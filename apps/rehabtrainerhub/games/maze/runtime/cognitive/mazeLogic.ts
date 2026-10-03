export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameResult = 'Victory' | 'Defeat';
export type Direction = 'up' | 'right' | 'down' | 'left';
export type MazeCell = { top: boolean; right: boolean; bottom: boolean; left: boolean };

export interface MazeState {
  kind: 'maze';
  size: number;
  cells: MazeCell[];
  current: number;
  end: number;
  moves: number;
  errors: number;
  ended: boolean;
}

const lastSignatureByDifficulty: Partial<Record<Difficulty, string>> = {};
const directions: Direction[] = ['up', 'right', 'down', 'left'];
const opposite: Record<Direction, Direction> = {
  up: 'down', right: 'left', down: 'up', left: 'right',
};
const wallByDirection = { up: 'top', right: 'right', down: 'bottom', left: 'left' } as const;

export function CreateMazeState(difficulty: Difficulty, random = Math.random): MazeState {
  const size = difficulty === 'easy' ? 8 : difficulty === 'hard' ? 12 : 10;
  let state: MazeState;
  let signature: string;
  for (let attempt = 0; ; attempt += 1) {
    state = CreateRandomMaze(size, random);
    signature = `${state.current}:${state.end}:${state.cells.map(cell =>
      directions.map(direction => Number(cell[wallByDirection[direction]])).join('')).join('')}`;
    if (signature !== lastSignatureByDifficulty[difficulty] || attempt >= 4) break;
  }
  lastSignatureByDifficulty[difficulty] = signature;
  return state;
}

function CreateRandomMaze(size: number, random: () => number): MazeState {
  const start = Math.floor(random() * size * size);
  const cells = Array.from({ length: size * size }, () =>
    ({ top: true, right: true, bottom: true, left: true }));
  const visited = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const current = stack.at(-1)!;
    const choices = Neighbors(current, size).filter(({ index }) => !visited.has(index));
    if (!choices.length) { stack.pop(); continue; }
    const { index, direction } = choices[Math.floor(random() * choices.length)];
    cells[current][wallByDirection[direction]] = false;
    cells[index][wallByDirection[opposite[direction]]] = false;
    visited.add(index);
    stack.push(index);
  }
  const queue = [start];
  const seen = new Set(queue);
  let farthest = start;
  for (const current of queue) {
    farthest = current;
    for (const { index, direction } of Neighbors(current, size)) {
      if (cells[current][wallByDirection[direction]] || seen.has(index)) continue;
      seen.add(index);
      queue.push(index);
    }
  }
  return { kind: 'maze', size, cells, current: start, end: farthest,
    moves: 0, errors: 0, ended: false };
}

function Neighbors(index: number, size: number): Array<{ index: number; direction: Direction }> {
  const row = Math.floor(index / size);
  const col = index % size;
  return [
    row > 0 ? { index: index - size, direction: 'up' as const } : null,
    col < size - 1 ? { index: index + 1, direction: 'right' as const } : null,
    row < size - 1 ? { index: index + size, direction: 'down' as const } : null,
    col > 0 ? { index: index - 1, direction: 'left' as const } : null,
  ].filter((value): value is { index: number; direction: Direction } => value !== null);
}

export function HandleMazeTap(state: MazeState, index: number,
  finishGame: (result: GameResult) => void): void {
  if (state.ended) return;
  const passage = Neighbors(state.current, state.size).find(neighbor => neighbor.index === index);
  if (!passage || state.cells[state.current][wallByDirection[passage.direction]]) {
    state.errors += 1;
    return;
  }
  state.current = index;
  state.moves += 1;
  if (state.current === state.end) { state.ended = true; finishGame('Victory'); }
}

export function MoveMazeDirection(state: MazeState, direction: string,
  finishGame: (result: GameResult) => void): boolean {
  if (!directions.includes(direction as Direction)) return false;
  const neighbor = Neighbors(state.current, state.size).find(item => item.direction === direction);
  HandleMazeTap(state, neighbor?.index ?? -1, finishGame);
  return true;
}

export function UpdateMazeTimedState(state: MazeState, elapsed: number, limit: number,
  finishGame: (result: GameResult) => void): void {
  if (state.ended || limit <= 0 || elapsed < limit) return;
  state.ended = true;
  finishGame(state.current === state.end ? 'Victory' : 'Defeat');
}

export function BuildMazeResultData(state: MazeState, duration: number, result: GameResult) {
  return { Total_Duration_Seconds: duration, Moves: state.moves,
    Completed: result === 'Victory', Errors: state.errors, Board_Size: state.size };
}
