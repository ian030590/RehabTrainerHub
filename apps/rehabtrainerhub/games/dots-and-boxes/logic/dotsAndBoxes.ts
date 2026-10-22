import type { Difficulty } from '../settings';

export type Owner = 'P' | 'A';
export type Outcome = 'Victory' | 'Defeat' | 'Draw';
export type Turn = 'player' | 'computer' | 'over';
export interface MoveRow { move: number; thinkMs: number; invalidTaps: number; boxes: number }
export interface DotsBoard { size: number; hLines: (Owner | null)[]; vLines: (Owner | null)[]; boxes: (Owner | null)[] }

// Dots per side; a board of n dots has (n - 1) x (n - 1) boxes.
export const boardDots = { easy: 4, medium: 5, hard: 6 } as const;

export function CreateRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// Line ids: h<row * (n - 1) + col> joins two dots in a row, v<row * n + col> joins two dots in a column.
export function LineIds(size: number): string[] {
  return [...Array.from({ length: size * (size - 1) }, (_, index) => `h${index}`), ...Array.from({ length: (size - 1) * size }, (_, index) => `v${index}`)];
}

function ParseLine(board: DotsBoard, line: string): { horizontal: boolean; index: number } | null {
  const horizontal = line[0] === 'h';
  const index = Number(line.slice(1));
  const list = horizontal ? board.hLines : line[0] === 'v' ? board.vLines : null;
  return list && Number.isInteger(index) && index >= 0 && index < list.length ? { horizontal, index } : null;
}

function IsDrawn(board: DotsBoard, line: string) {
  const parsed = ParseLine(board, line);
  return Boolean(parsed && (parsed.horizontal ? board.hLines : board.vLines)[parsed.index]);
}

// The boxes above and below a horizontal line, or left and right of a vertical one.
export function BoxesBeside(size: number, line: string): number[] {
  const boxes = size - 1;
  const index = Number(line.slice(1));
  const [row, col] = line[0] === 'h' ? [Math.floor(index / boxes), index % boxes] : [Math.floor(index / size), index % size];
  const sides = line[0] === 'h' ? [[row - 1, col], [row, col]] : [[row, col - 1], [row, col]];
  return sides.filter(([r, c]) => r >= 0 && c >= 0 && r < boxes && c < boxes).map(([r, c]) => r * boxes + c);
}

function BoxClosed(board: DotsBoard, box: number) {
  const boxes = board.size - 1;
  const row = Math.floor(box / boxes), col = box % boxes;
  return Boolean(board.hLines[row * boxes + col] && board.hLines[(row + 1) * boxes + col]
    && board.vLines[row * board.size + col] && board.vLines[row * board.size + col + 1]);
}

function ClosesBox(board: DotsBoard, line: string) {
  const parsed = ParseLine(board, line)!;
  const list = parsed.horizontal ? board.hLines : board.vLines;
  list[parsed.index] = 'P';
  const closes = BoxesBeside(board.size, line).some(box => !board.boxes[box] && BoxClosed(board, box));
  list[parsed.index] = null;
  return closes;
}

// The original computer: close a box when one line does it, otherwise any open line at random.
export function ChooseComputerLine(board: DotsBoard, random: () => number): string | null {
  const open = LineIds(board.size).filter(line => !IsDrawn(board, line));
  if (!open.length) return null;
  return open.find(line => ClosesBox(board, line)) ?? open[Math.min(open.length - 1, Math.floor(random() * open.length))];
}

export class DotsMatch implements DotsBoard {
  readonly size: number;
  hLines: (Owner | null)[];
  vLines: (Owner | null)[];
  boxes: (Owner | null)[];
  turn: Turn = 'player';
  outcome: Outcome | null = null;
  moves = 0;
  opponentMoves = 0;
  errors = 0;
  playerBoxes = 0;
  opponentBoxes = 0;
  rows: MoveRow[] = [];
  private turnStartedAt: number;
  private invalidThisTurn = 0;

  constructor(difficulty: Difficulty, startedAt: number) {
    this.size = boardDots[difficulty];
    this.hLines = Array.from({ length: this.size * (this.size - 1) }, () => null);
    this.vLines = Array.from({ length: (this.size - 1) * this.size }, () => null);
    this.boxes = Array.from({ length: (this.size - 1) ** 2 }, () => null);
    this.turnStartedAt = startedAt;
  }

  play(line: string, now: number): { accepted: boolean; claimed: number; outcome: Outcome | null } {
    if (this.turn !== 'player' || !ParseLine(this, line)) return { accepted: false, claimed: 0, outcome: null };
    if (IsDrawn(this, line)) {
      this.errors++;
      this.invalidThisTurn++;
      return { accepted: false, claimed: 0, outcome: null };
    }
    const claimed = this.draw(line, 'P');
    this.moves++;
    this.rows.push({ move: this.moves, thinkMs: Math.max(0, Math.round(now - this.turnStartedAt)), invalidTaps: this.invalidThisTurn, boxes: claimed });
    this.invalidThisTurn = 0;
    this.turnStartedAt = now;
    if (this.full()) return { accepted: true, claimed, outcome: this.end() };
    if (!claimed) this.turn = 'computer';
    return { accepted: true, claimed, outcome: null };
  }

  computerTurn(random: () => number, now: number): { line: string | null; claimed: number; outcome: Outcome | null } {
    if (this.turn !== 'computer') return { line: null, claimed: 0, outcome: null };
    const line = ChooseComputerLine(this, random);
    if (line === null) return { line: null, claimed: 0, outcome: this.end() };
    const claimed = this.draw(line, 'A');
    this.opponentMoves++;
    if (this.full()) return { line, claimed, outcome: this.end() };
    if (!claimed) {
      this.turn = 'player';
      this.turnStartedAt = now;
    }
    return { line, claimed, outcome: null };
  }

  private draw(line: string, owner: Owner) {
    const parsed = ParseLine(this, line)!;
    (parsed.horizontal ? this.hLines : this.vLines)[parsed.index] = owner;
    let claimed = 0;
    for (const box of BoxesBeside(this.size, line)) {
      if (this.boxes[box] || !BoxClosed(this, box)) continue;
      this.boxes[box] = owner;
      claimed++;
    }
    if (owner === 'P') this.playerBoxes += claimed;
    else this.opponentBoxes += claimed;
    return claimed;
  }

  private full() {
    return this.hLines.every(Boolean) && this.vLines.every(Boolean);
  }

  private end() {
    this.turn = 'over';
    this.outcome = this.playerBoxes > this.opponentBoxes ? 'Victory' : this.playerBoxes === this.opponentBoxes ? 'Draw' : 'Defeat';
    return this.outcome;
  }
}

export function SummarizeDots(match: DotsMatch, durationMs: number) {
  const times = match.rows.map(row => row.thinkMs);
  return {
    duration: Math.round(durationMs / 100) / 10,
    completed: match.outcome === 'Victory' ? 1 : 0,
    draw: match.outcome === 'Draw' ? 1 : 0,
    moves: match.moves,
    errors: match.errors,
    opponentMoves: match.opponentMoves,
    playerBoxes: match.playerBoxes,
    opponentBoxes: match.opponentBoxes,
    boardSize: match.size,
    meanThinkMs: times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : null,
  };
}
