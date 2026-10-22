import type { Difficulty } from '../settings';

export type Mark = 'P' | 'A';
export type Slot = Mark | null;
export type Outcome = 'Victory' | 'Defeat' | 'Draw';
export type Turn = 'player' | 'computer' | 'over';
export interface MoveRow { move: number; col: number; height: number; thinkMs: number; invalidTaps: number }

export const boardRows = 6;
export const boardCols = 7;
const winLength = 4;

export function CreateRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// Board index is row * 7 + col with row 0 at the top, so a disc lands on the highest empty row number.
export function DropRow(board: Slot[], col: number): number | null {
  for (let row = boardRows - 1; row >= 0; row--) if (!board[row * boardCols + col]) return row;
  return null;
}

export function FindLine(board: Slot[], mark: Mark): number[] | null {
  const directions = [[1, 0], [0, 1], [1, 1], [-1, 1]] as const;
  for (let row = 0; row < boardRows; row++) {
    for (let col = 0; col < boardCols; col++) {
      if (board[row * boardCols + col] !== mark) continue;
      for (const [dx, dy] of directions) {
        const line = [row * boardCols + col];
        for (let step = 1; step < winLength; step++) {
          const nextRow = row + dy * step;
          const nextCol = col + dx * step;
          if (nextRow < 0 || nextRow >= boardRows || nextCol < 0 || nextCol >= boardCols || board[nextRow * boardCols + nextCol] !== mark) break;
          line.push(nextRow * boardCols + nextCol);
        }
        if (line.length >= winLength) return line;
      }
    }
  }
  return null;
}

// The original opponents: easy plays any open column, medium wins when it can, hard also blocks the player.
export function ChooseComputerColumn(board: Slot[], difficulty: Difficulty, random: () => number): number | null {
  const open = Array.from({ length: boardCols }, (_, col) => col).filter(col => !board[col]);
  if (!open.length) return null;
  const completes = (mark: Mark) => open.find(col => {
    const trial = [...board];
    trial[(DropRow(trial, col) ?? 0) * boardCols + col] = mark;
    return FindLine(trial, mark) !== null;
  });
  return (difficulty !== 'easy' ? completes('A') : undefined) ?? (difficulty === 'hard' ? completes('P') : undefined)
    ?? open[Math.min(open.length - 1, Math.floor(random() * open.length))];
}

export class Connect4Match {
  readonly difficulty: Difficulty;
  board: Slot[] = Array.from({ length: boardRows * boardCols }, () => null);
  turn: Turn = 'player';
  outcome: Outcome | null = null;
  line: number[] | null = null;
  moves = 0;
  opponentMoves = 0;
  errors = 0;
  rows: MoveRow[] = [];
  private turnStartedAt: number;
  private invalidThisTurn = 0;

  constructor(difficulty: Difficulty, startedAt: number) {
    this.difficulty = difficulty;
    this.turnStartedAt = startedAt;
  }

  play(col: number, now: number): { accepted: boolean; index: number | null; outcome: Outcome | null } {
    if (this.turn !== 'player' || col < 0 || col >= boardCols) return { accepted: false, index: null, outcome: null };
    const row = DropRow(this.board, col);
    if (row === null) {
      this.errors++;
      this.invalidThisTurn++;
      return { accepted: false, index: null, outcome: null };
    }
    const index = row * boardCols + col;
    this.board[index] = 'P';
    this.moves++;
    this.rows.push({ move: this.moves, col: col + 1, height: boardRows - row,
      thinkMs: Math.max(0, Math.round(now - this.turnStartedAt)), invalidTaps: this.invalidThisTurn });
    this.invalidThisTurn = 0;
    this.line = FindLine(this.board, 'P');
    if (this.line) return { accepted: true, index, outcome: this.end('Victory') };
    if (this.board.every(Boolean)) return { accepted: true, index, outcome: this.end('Draw') };
    this.turn = 'computer';
    return { accepted: true, index, outcome: null };
  }

  computerTurn(random: () => number, now: number): { index: number | null; outcome: Outcome | null } {
    if (this.turn !== 'computer') return { index: null, outcome: null };
    const col = ChooseComputerColumn(this.board, this.difficulty, random);
    const row = col === null ? null : DropRow(this.board, col);
    const index = col === null || row === null ? null : row * boardCols + col;
    if (index !== null) {
      this.board[index] = 'A';
      this.opponentMoves++;
    }
    this.line = FindLine(this.board, 'A');
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

export function SummarizeConnect4(match: Connect4Match, durationMs: number) {
  const times = match.rows.map(row => row.thinkMs);
  return {
    duration: Math.round(durationMs / 100) / 10,
    completed: match.outcome === 'Victory' ? 1 : 0,
    draw: match.outcome === 'Draw' ? 1 : 0,
    moves: match.moves,
    errors: match.errors,
    opponentMoves: match.opponentMoves,
    meanThinkMs: times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : null,
  };
}
