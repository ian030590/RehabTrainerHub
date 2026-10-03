export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameResult = 'Victory' | 'Defeat' | 'Draw';

export interface HexState {
  kind: 'hex';
  size: number;
  board: number[];
  aiMoveAt: number | null;
  moves: number;
  aiMoves: number;
  errors: number;
}

export function CreateHexState(difficulty: Difficulty): HexState {
  const size = difficulty === 'easy' ? 5 : difficulty === 'hard' ? 9 : 7;
  return { kind: 'hex', size, board: Array(size * size).fill(0), aiMoveAt: null,
    moves: 0, aiMoves: 0, errors: 0 };
}

export function HandleHexTap(state: HexState, index: number, elapsed: number,
  finishGame: (result: GameResult) => void): void {
  if (state.aiMoveAt !== null) return;
  if (!Number.isInteger(index) || index < 0 || index >= state.board.length || state.board[index] !== 0) {
    state.errors += 1;
    return;
  }
  state.board[index] = 1;
  state.moves += 1;
  if (HasHexPath(state, 1)) finishGame('Victory');
  else if (state.board.every(Boolean)) finishGame('Draw');
  else state.aiMoveAt = elapsed + 1;
}

export function UpdateHexTimedState(state: HexState, elapsed: number,
  finishGame: (result: GameResult) => void): void {
  if (state.aiMoveAt === null || elapsed < state.aiMoveAt) return;
  state.aiMoveAt = null;
  const move = ChooseHexMove(state);
  if (move === null) return;
  state.board[move] = 2;
  state.aiMoves += 1;
  if (HasHexPath(state, 2)) finishGame('Defeat');
  else if (state.board.every(Boolean)) finishGame('Draw');
}

export function ChooseHexMove(state: HexState): number | null {
  const empty = state.board.map((value, index) => value === 0 ? index : null)
    .filter((index): index is number => index !== null);
  for (const player of [2, 1] as const) {
    for (const index of empty) {
      state.board[index] = player;
      const completesPath = HasHexPath(state, player);
      state.board[index] = 0;
      if (completesPath) return index;
    }
  }
  const center = (state.size - 1) / 2;
  return empty.sort((a, b) => {
    const distance = (index: number) => Math.abs(Math.floor(index / state.size) - center)
      + Math.abs(index % state.size - center);
    return distance(a) - distance(b);
  })[0] ?? null;
}

export function HasHexPath(state: HexState, player: 1 | 2): boolean {
  const queue: number[] = [];
  const seen = new Set<number>();
  for (let index = 0; index < state.size; index += 1) {
    const start = player === 1 ? index : index * state.size;
    if (state.board[start] === player) { queue.push(start); seen.add(start); }
  }
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head];
    const row = Math.floor(index / state.size);
    const col = index % state.size;
    if (player === 1 ? row === state.size - 1 : col === state.size - 1) return true;
    for (const [nextRow, nextCol] of [
      [row - 1, col], [row - 1, col + 1], [row, col - 1],
      [row, col + 1], [row + 1, col - 1], [row + 1, col],
    ]) {
      if (nextRow < 0 || nextRow >= state.size || nextCol < 0 || nextCol >= state.size) continue;
      const next = nextRow * state.size + nextCol;
      if (state.board[next] === player && !seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return false;
}

export function BuildHexResultData(state: HexState, duration: number, result: GameResult) {
  return { Total_Duration_Seconds: duration, Moves: state.moves, Completed: result === 'Victory',
    Errors: state.errors, Opponent_Moves: state.aiMoves, Board_Size: state.size };
}
