import type { Difficulty } from '../settings';

export type Outcome = 'Victory' | 'TimeUp';
export interface SlideRow { move: number; tile: number; thinkMs: number; invalidTaps: number; misplaced: number }

// Board side and the number of random blank steps used to scramble the solved board.
export const slidingConfig = {
  easy: { size: 3, shuffles: 36 },
  medium: { size: 4, shuffles: 72 },
  hard: { size: 5, shuffles: 120 },
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

// Cells directly above, below, left and right, in that order.
export function Neighbors(index: number, size: number) {
  const row = Math.floor(index / size), col = index % size;
  return [row > 0 ? index - size : null, row < size - 1 ? index + size : null, col > 0 ? index - 1 : null, col < size - 1 ? index + 1 : null]
    .filter((value): value is number => value !== null);
}

// 0 is the blank; the solved board reads 1, 2, 3... with the blank last.
export function IsSolved(tiles: number[]) {
  return tiles.every((tile, index) => tile === (index + 1) % tiles.length);
}

// Walking the blank from the solved board keeps every puzzle solvable.
export function CreateSlidingPuzzle(size: number, shuffles: number, random: () => number) {
  const total = size * size;
  const tiles = Array.from({ length: total }, (_, index) => (index + 1) % total);
  let blank = total - 1, lastBlank = -1;
  for (let step = 0; step < shuffles || IsSolved(tiles); step++) {
    const options = Neighbors(blank, size).filter(index => index !== lastBlank);
    const next = options[Math.floor(random() * options.length)];
    [tiles[blank], tiles[next]] = [tiles[next], tiles[blank]];
    lastBlank = blank;
    blank = next;
  }
  return tiles;
}

export class SlidingMatch {
  size: number;
  tiles: number[];
  moves = 0;
  errors = 0;
  outcome: Outcome | null = null;
  rows: SlideRow[] = [];
  private lastMoveAt: number;
  private invalidThisMove = 0;

  constructor(difficulty: Difficulty, startedAt: number, random: () => number) {
    const config = slidingConfig[difficulty];
    this.size = config.size;
    this.tiles = CreateSlidingPuzzle(config.size, config.shuffles, random);
    this.lastMoveAt = startedAt;
  }

  get blank() { return this.tiles.indexOf(0); }
  get misplaced() { return this.tiles.filter((tile, index) => tile !== 0 && tile !== index + 1).length; }

  slide(index: number, now: number) {
    if (this.outcome) return { accepted: false, solved: this.outcome === 'Victory' };
    const blank = this.blank;
    if (index === blank || index < 0 || index >= this.tiles.length) return { accepted: false, solved: false };
    if (!Neighbors(blank, this.size).includes(index)) {
      this.errors++;
      this.invalidThisMove++;
      return { accepted: false, solved: false };
    }
    const tile = this.tiles[index];
    [this.tiles[blank], this.tiles[index]] = [tile, 0];
    this.moves++;
    this.rows.push({ move: this.moves, tile, thinkMs: Math.max(0, Math.round(now - this.lastMoveAt)), invalidTaps: this.invalidThisMove, misplaced: this.misplaced });
    this.lastMoveAt = now;
    this.invalidThisMove = 0;
    const solved = IsSolved(this.tiles);
    if (solved) this.outcome = 'Victory';
    return { accepted: true, solved };
  }

  expire(): Outcome | null {
    if (this.outcome) return null;
    this.outcome = 'TimeUp';
    return this.outcome;
  }
}

export function SummarizeSliding(match: SlidingMatch, durationMs: number) {
  const times = match.rows.map(row => row.thinkMs);
  return {
    duration: Math.round(durationMs / 100) / 10,
    completed: match.outcome === 'Victory' ? 1 : 0,
    moves: match.moves,
    errors: match.errors,
    boardSize: match.size,
    misplaced: match.misplaced,
    meanThinkMs: times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : null,
  };
}
