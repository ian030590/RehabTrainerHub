export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type GameResult = 'Victory' | 'Defeat' | 'Draw';
export type Mark = 'X' | 'O' | null;

export interface TicTacToeState {
  kind: 'tic-tac-toe';
  size: number;
  winLength: number;
  board: Mark[];
  aiMoveAt: number | null;
  moves: number;
  aiMoves: number;
  errors: number;
}

export function CreateTicTacToeState(difficulty: Difficulty): TicTacToeState {
  const size = difficulty === 'Beginner' ? 3 : difficulty === 'Intermediate' ? 4 : 5;
  return {
    kind: 'tic-tac-toe', size, winLength: size === 5 ? 4 : 3,
    board: Array(size * size).fill(null), aiMoveAt: null,
    moves: 0, aiMoves: 0, errors: 0,
  };
}

function HasWinningLine(state: TicTacToeState, mark: 'X' | 'O') {
  for (let row = 0; row < state.size; row += 1) {
    for (let col = 0; col < state.size; col += 1) {
      if (state.board[row * state.size + col] !== mark) continue;
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
        let step = 1;
        for (; step < state.winLength; step += 1) {
          const nextRow = row + dy * step;
          const nextCol = col + dx * step;
          if (nextRow < 0 || nextRow >= state.size || nextCol < 0 || nextCol >= state.size
            || state.board[nextRow * state.size + nextCol] !== mark) break;
        }
        if (step === state.winLength) return true;
      }
    }
  }
  return false;
}

export function IsTicTacToeAutoSuccess(state: TicTacToeState) {
  return HasWinningLine(state, 'X');
}

export function HandleTicTacToeTap(state: TicTacToeState, index: number, elapsedSeconds: number, finishGame: (result: GameResult) => void) {
  if (!Number.isInteger(index) || index < 0 || index >= state.board.length || state.aiMoveAt !== null) return;
  if (state.board[index]) {
    state.errors += 1;
    return;
  }
  state.board[index] = 'X';
  state.moves += 1;
  if (IsTicTacToeAutoSuccess(state)) finishGame('Victory');
  else if (state.board.every(Boolean)) finishGame('Draw');
  else state.aiMoveAt = elapsedSeconds + 1;
}

export function ChooseTicTacToeMove(state: TicTacToeState, random = Math.random): number | null {
  const empty = state.board.map((mark, index) => mark ? null : index).filter((index): index is number => index !== null);
  const winningMove = (mark: 'X' | 'O') => empty.find(index => {
    state.board[index] = mark;
    const wins = HasWinningLine(state, mark);
    state.board[index] = null;
    return wins;
  });
  return winningMove('O') ?? winningMove('X')
    ?? empty.find(index => index === Math.floor(state.board.length / 2))
    ?? empty[Math.floor(random() * empty.length)] ?? null;
}

export function UpdateTicTacToeTimedState(state: TicTacToeState, elapsedSeconds: number, finishGame: (result: GameResult) => void, random = Math.random) {
  if (state.aiMoveAt === null || elapsedSeconds < state.aiMoveAt) return;
  state.aiMoveAt = null;
  const move = ChooseTicTacToeMove(state, random);
  if (move === null) return;
  state.board[move] = 'O';
  state.aiMoves += 1;
  if (HasWinningLine(state, 'O')) finishGame('Defeat');
  else if (state.board.every(Boolean)) finishGame('Draw');
}

export function BuildTicTacToeResultData(state: TicTacToeState, durationSeconds: number, result: GameResult) {
  return {
    Total_Duration_Seconds: durationSeconds,
    Moves: state.moves,
    Completed: result === 'Victory',
    Errors: state.errors,
    Opponent_Moves: state.aiMoves,
    Board_Size: state.size,
  };
}
