import type { Difficulty } from '../settings';

export type Mark = 'P' | 'A';
export type Cell = Mark | null;
export type Outcome = 'Victory' | 'Defeat' | 'Draw';
export type Turn = 'player' | 'computer' | 'over';
export interface MoveRow { move: number; row: number; col: number; thinkMs: number; invalidTaps: number }

export const boardSizes = { easy: 5, medium: 7, hard: 9 } as const;

// Each row sits half a cell to the right of the one above, so a cell touches six others.
export function Neighbors(index: number, size: number): number[] {
  const row = Math.floor(index / size);
  const col = index % size;
  return [[row - 1, col], [row - 1, col + 1], [row, col - 1], [row, col + 1], [row + 1, col - 1], [row + 1, col]]
    .filter(([r, c]) => r >= 0 && r < size && c >= 0 && c < size)
    .map(([r, c]) => r * size + c);
}

// The player joins the top and bottom rows; the computer joins the left and right columns.
export function FindPath(board: Cell[], size: number, mark: Mark): number[] | null {
  const parent = new Map<number, number | null>();
  const queue: number[] = [];
  for (let step = 0; step < size; step++) {
    const index = mark === 'P' ? step : step * size;
    if (board[index] === mark) { parent.set(index, null); queue.push(index); }
  }
  while (queue.length) {
    const index = queue.shift()!;
    if (mark === 'P' ? Math.floor(index / size) === size - 1 : index % size === size - 1) {
      const path: number[] = [];
      for (let at: number | null = index; at !== null; at = parent.get(at) ?? null) path.unshift(at);
      return path;
    }
    for (const next of Neighbors(index, size)) {
      if (board[next] !== mark || parent.has(next)) continue;
      parent.set(next, index);
      queue.push(next);
    }
  }
  return null;
}

// The original computer: complete its own chain, block the player's, else the empty cell nearest the center.
export function ChooseComputerCell(board: Cell[], size: number): number | null {
  const empty = board.flatMap((mark, index) => mark ? [] : [index]);
  if (!empty.length) return null;
  const completes = (mark: Mark) => empty.find(index => {
    const trial = [...board];
    trial[index] = mark;
    return FindPath(trial, size, mark) !== null;
  });
  const center = (size - 1) / 2;
  const distance = (index: number) => Math.abs(Math.floor(index / size) - center) + Math.abs(index % size - center);
  return completes('A') ?? completes('P') ?? [...empty].sort((a, b) => distance(a) - distance(b))[0];
}

export class HexMatch {
  readonly size: number;
  board: Cell[];
  turn: Turn = 'player';
  outcome: Outcome | null = null;
  path: number[] | null = null;
  moves = 0;
  opponentMoves = 0;
  errors = 0;
  rows: MoveRow[] = [];
  private turnStartedAt: number;
  private invalidThisTurn = 0;

  constructor(difficulty: Difficulty, startedAt: number) {
    this.size = boardSizes[difficulty];
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
    this.board[index] = 'P';
    this.moves++;
    this.rows.push({ move: this.moves, row: Math.floor(index / this.size) + 1, col: index % this.size + 1,
      thinkMs: Math.max(0, Math.round(now - this.turnStartedAt)), invalidTaps: this.invalidThisTurn });
    this.invalidThisTurn = 0;
    this.path = FindPath(this.board, this.size, 'P');
    if (this.path) return { accepted: true, outcome: this.end('Victory') };
    if (this.board.every(Boolean)) return { accepted: true, outcome: this.end('Draw') };
    this.turn = 'computer';
    return { accepted: true, outcome: null };
  }

  computerTurn(now: number): { index: number | null; outcome: Outcome | null } {
    if (this.turn !== 'computer') return { index: null, outcome: null };
    const index = ChooseComputerCell(this.board, this.size);
    if (index !== null) {
      this.board[index] = 'A';
      this.opponentMoves++;
    }
    this.path = FindPath(this.board, this.size, 'A');
    if (this.path) return { index, outcome: this.end('Defeat') };
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

export function SummarizeHex(match: HexMatch, durationMs: number) {
  const times = match.rows.map(row => row.thinkMs);
  return {
    duration: Math.round(durationMs / 100) / 10,
    completed: match.outcome === 'Victory' ? 1 : 0,
    moves: match.moves,
    errors: match.errors,
    opponentMoves: match.opponentMoves,
    boardSize: match.size,
    meanThinkMs: times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : null,
  };
}
