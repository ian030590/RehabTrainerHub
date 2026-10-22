export type Mark = 'X' | 'O';
export type Cell = Mark | null;
export type Outcome = 'Victory' | 'Defeat' | 'Draw';
export type Turn = 'player' | 'computer' | 'over';
export interface MoveRow { move: number; row: number; col: number; thinkMs: number; invalidTaps: number }

// The original three boards: side length and how many marks in a row win.
export const boardSpecs = {
  easy: { size: 3, winLength: 3 },
  medium: { size: 4, winLength: 3 },
  hard: { size: 5, winLength: 4 },
} as const;

export function CreateRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function FindLine(board: Cell[], size: number, winLength: number, mark: Mark): number[] | null {
  const directions = [[1, 0], [0, 1], [1, 1], [-1, 1]] as const;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (board[row * size + col] !== mark) continue;
      for (const [dx, dy] of directions) {
        const line = [row * size + col];
        for (let step = 1; step < winLength; step++) {
          const nextRow = row + dy * step;
          const nextCol = col + dx * step;
          if (nextRow < 0 || nextRow >= size || nextCol < 0 || nextCol >= size || board[nextRow * size + nextCol] !== mark) break;
          line.push(nextRow * size + nextCol);
        }
        if (line.length >= winLength) return line;
      }
    }
  }
  return null;
}

// The original computer: complete its own line, block the player, take index floor(cells / 2), else a random empty cell.
export function ChooseComputerMove(board: Cell[], size: number, winLength: number, random: () => number): number | null {
  const empty = board.flatMap((mark, index) => mark ? [] : [index]);
  if (!empty.length) return null;
  const completes = (mark: Mark) => empty.find(index => {
    const trial = [...board];
    trial[index] = mark;
    return FindLine(trial, size, winLength, mark) !== null;
  });
  return completes('O') ?? completes('X') ?? empty.find(index => index === Math.floor(board.length / 2))
    ?? empty[Math.min(empty.length - 1, Math.floor(random() * empty.length))];
}

export class TicTacToeMatch {
  readonly size: number;
  readonly winLength: number;
  board: Cell[];
  turn: Turn = 'player';
  outcome: Outcome | null = null;
  line: number[] | null = null;
  moves = 0;
  opponentMoves = 0;
  errors = 0;
  rows: MoveRow[] = [];
  private turnStartedAt: number;
  private invalidThisTurn = 0;

  constructor(difficulty: keyof typeof boardSpecs, startedAt: number) {
    ({ size: this.size, winLength: this.winLength } = boardSpecs[difficulty]);
    this.board = Array.from({ length: this.size * this.size }, () => null);
    this.turnStartedAt = startedAt;
  }

  play(index: number, now: number): { accepted: boolean; outcome: Outcome | null } {
    if (this.turn !== 'player' || index < 0 || index >= this.board.length) return { accepted: false, outcome: null };
    if (this.board[index]) {
      this.errors++;
      this.invalidThisTurn++;
      return { accepted: false, outcome: null };
    }
    this.board[index] = 'X';
    this.moves++;
    this.rows.push({ move: this.moves, row: Math.floor(index / this.size) + 1, col: index % this.size + 1,
      thinkMs: Math.max(0, Math.round(now - this.turnStartedAt)), invalidTaps: this.invalidThisTurn });
    this.invalidThisTurn = 0;
    this.line = FindLine(this.board, this.size, this.winLength, 'X');
    if (this.line) return { accepted: true, outcome: this.end('Victory') };
    if (this.board.every(Boolean)) return { accepted: true, outcome: this.end('Draw') };
    this.turn = 'computer';
    return { accepted: true, outcome: null };
  }

  computerTurn(random: () => number, now: number): { index: number | null; outcome: Outcome | null } {
    if (this.turn !== 'computer') return { index: null, outcome: null };
    const index = ChooseComputerMove(this.board, this.size, this.winLength, random);
    if (index !== null) {
      this.board[index] = 'O';
      this.opponentMoves++;
    }
    this.line = FindLine(this.board, this.size, this.winLength, 'O');
    if (this.line) return { index, outcome: this.end('Defeat') };
    if (this.board.every(Boolean)) return { index, outcome: this.end('Draw') };
    this.turn = 'player';
    this.turnStartedAt = now;
    return { index, outcome: null };
  }

  private end(outcome: Outcome) {
    this.turn = 'over';
    this.outcome = outcome;
    return outcome;
  }
}

export function SummarizeTicTacToe(match: TicTacToeMatch, durationMs: number) {
  const times = match.rows.map(row => row.thinkMs);
  return {
    duration: Math.round(durationMs / 100) / 10,
    completed: match.outcome === 'Victory' ? 1 : 0,
    draw: match.outcome === 'Draw' ? 1 : 0,
    moves: match.moves,
    errors: match.errors,
    opponentMoves: match.opponentMoves,
    boardSize: match.size,
    winLength: match.winLength,
    meanThinkMs: times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : null,
  };
}
