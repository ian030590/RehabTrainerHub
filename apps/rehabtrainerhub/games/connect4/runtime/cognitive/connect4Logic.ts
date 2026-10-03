export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameResult = 'Victory' | 'Defeat' | 'Draw';
export type Disc = 'P' | 'A' | null;

export interface Connect4State {
  kind: 'connect4';
  rows: 6;
  cols: 7;
  board: Disc[];
  drops: Array<{ index: number; mark: 'P' | 'A'; startedAt: number }>;
  winningLine: number[];
  pendingResult: { result: GameResult; finishAt: number } | null;
  aiMoveAt: number | null;
  moves: number;
  aiMoves: number;
  errors: number;
}

export function CreateConnect4State(): Connect4State {
  return {
    kind: 'connect4', rows: 6, cols: 7, board: Array(42).fill(null),
    drops: [], winningLine: [], pendingResult: null, aiMoveAt: null,
    moves: 0, aiMoves: 0, errors: 0,
  };
}

function DropDisc(board: Disc[], col: number, mark: 'P' | 'A') {
  for (let row = 5; row >= 0; row -= 1) {
    const index = row * 7 + col;
    if (board[index] === null) {
      board[index] = mark;
      return index;
    }
  }
  return null;
}

export function FindConnect4Line(board: Disc[], mark: 'P' | 'A'): number[] | null {
  for (let row = 0; row < 6; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      if (board[row * 7 + col] !== mark) continue;
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
        const line = [row * 7 + col];
        for (let step = 1; step < 4; step += 1) {
          const nextRow = row + dy * step;
          const nextCol = col + dx * step;
          if (nextRow < 0 || nextRow >= 6 || nextCol < 0 || nextCol >= 7
            || board[nextRow * 7 + nextCol] !== mark) break;
          line.push(nextRow * 7 + nextCol);
        }
        if (line.length === 4) return line;
      }
    }
  }
  return null;
}

export function HandleConnect4Tap(state: Connect4State, col: number, elapsed: number, finishGame: (result: GameResult) => void) {
  if (!Number.isInteger(col) || col < 0 || col >= 7 || state.drops.length || state.pendingResult || state.aiMoveAt !== null) return;
  const index = DropDisc(state.board, col, 'P');
  if (index === null) {
    state.errors += 1;
    return;
  }
  state.drops.push({ index, mark: 'P', startedAt: elapsed });
  state.moves += 1;
  const winningLine = FindConnect4Line(state.board, 'P');
  if (winningLine) {
    state.winningLine = winningLine;
    state.pendingResult = { result: 'Victory', finishAt: elapsed + 1.8 };
  } else if (state.board.every(Boolean)) finishGame('Draw');
  else state.aiMoveAt = elapsed + 1;
}

export function ChooseConnect4Move(state: Connect4State, difficulty: Difficulty, random = Math.random): number | null {
  const available = Array.from({ length: 7 }, (_, col) => col).filter(col => state.board[col] === null);
  const winningColumn = (mark: 'P' | 'A') => available.find(col => {
    const board = [...state.board];
    DropDisc(board, col, mark);
    return FindConnect4Line(board, mark) !== null;
  });
  return (difficulty !== 'easy' ? winningColumn('A') : null)
    ?? (difficulty === 'hard' ? winningColumn('P') : null)
    ?? available[Math.floor(random() * available.length)] ?? null;
}

export function UpdateConnect4TimedState(state: Connect4State, elapsed: number, difficulty: Difficulty, finishGame: (result: GameResult) => void, random = Math.random) {
  state.drops = state.drops.filter(drop => elapsed - drop.startedAt < 0.45 - 1e-9);
  if (state.aiMoveAt !== null && elapsed >= state.aiMoveAt) {
    state.aiMoveAt = null;
    const col = ChooseConnect4Move(state, difficulty, random);
    if (col !== null) {
      const index = DropDisc(state.board, col, 'A');
      if (index !== null) {
        state.drops.push({ index, mark: 'A', startedAt: elapsed });
        state.aiMoves += 1;
      }
    }
    const winningLine = FindConnect4Line(state.board, 'A');
    if (winningLine) {
      state.winningLine = winningLine;
      state.pendingResult = { result: 'Defeat', finishAt: elapsed + 1.8 };
    } else if (state.board.every(Boolean)) finishGame('Draw');
  }
  if (state.pendingResult && elapsed >= state.pendingResult.finishAt) {
    const result = state.pendingResult.result;
    state.pendingResult = null;
    finishGame(result);
  }
}

export function BuildConnect4ResultData(state: Connect4State, durationSeconds: number, result: GameResult) {
  return {
    Total_Duration_Seconds: durationSeconds,
    Moves: state.moves,
    Completed: result === 'Victory',
    Errors: state.errors,
    Opponent_Moves: state.aiMoves,
  };
}
