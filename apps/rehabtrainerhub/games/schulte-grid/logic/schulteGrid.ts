import type { SchulteOrder } from '../settings';

export interface SchulteRow { round: number; gridSize: number; timeMs: number; errors: number; meanStepMs: number }
export interface SchulteTap { correct: boolean; done: boolean; ignored?: boolean }

export function CreateRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function CreateSchulteGrid(size: number, random: () => number): number[] {
  const numbers = Array.from({ length: size * size }, (_, index) => index + 1);
  for (let index = numbers.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [numbers[index], numbers[swap]] = [numbers[swap], numbers[index]];
  }
  return numbers;
}

// One grid: numbers must be found in order; taps on numbers already found are ignored.
export class SchulteRound {
  readonly found = new Set<number>();
  errors = 0;
  next: number;
  private finishedAt: number | null = null;
  private readonly cells: number;

  constructor(size: number, private order: SchulteOrder, readonly startedAt: number) {
    this.cells = size * size;
    this.next = order === 'ascending' ? 1 : this.cells;
  }

  get done() { return this.finishedAt !== null; }

  tap(value: number, now: number): SchulteTap {
    if (this.done || this.found.has(value)) return { correct: false, done: this.done, ignored: true };
    if (value !== this.next) { this.errors++; return { correct: false, done: false }; }
    this.found.add(value);
    this.next += this.order === 'ascending' ? 1 : -1;
    if (this.found.size === this.cells) this.finishedAt = now;
    return { correct: true, done: this.done };
  }

  result() {
    const timeMs = Math.round((this.finishedAt ?? this.startedAt) - this.startedAt);
    return { timeMs, errors: this.errors, meanStepMs: Math.round(timeMs / this.cells) };
  }
}

export function SummarizeSchulte(rows: SchulteRow[], roundsPlanned: number) {
  const times = rows.map(row => row.timeMs);
  const totalTimeMs = times.reduce((sum, value) => sum + value, 0);
  const cells = rows.reduce((sum, row) => sum + row.gridSize * row.gridSize, 0);
  return {
    roundsPlanned, roundsCompleted: rows.length, gridSize: rows[0]?.gridSize ?? null, totalTimeMs,
    meanRoundMs: rows.length ? Math.round(totalTimeMs / rows.length) : null,
    bestRoundMs: rows.length ? Math.min(...times) : null,
    totalErrors: rows.reduce((sum, row) => sum + row.errors, 0),
    meanStepMs: cells ? Math.round(totalTimeMs / cells) : null,
  };
}
