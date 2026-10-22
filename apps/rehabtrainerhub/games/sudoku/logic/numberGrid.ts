import type { Difficulty } from '../settings';

export type PuzzleKind = 'latin-square' | 'magic-square' | 'sudoku';
export type Outcome = 'Victory' | 'TimeUp';
export interface ChangeRow { move: number; row: number; col: number; value: number; thinkMs: number; blanksLeft: number }

// Each level is a different rule, not a harder version of the same one.
export const gridConfig = {
  easy: { kind: 'latin-square', size: 4, blanks: 6 },
  medium: { kind: 'magic-square', size: 3, blanks: 6 },
  hard: { kind: 'sudoku', size: 9, blanks: 50 },
} as const satisfies Record<Difficulty, { kind: PuzzleKind; size: number; blanks: number }>;
const kindCodes: Record<PuzzleKind, number> = { 'latin-square': 0, 'magic-square': 1, sudoku: 2 };
const magicSum = 15;

const sudokuAnswer = [
  5, 3, 4, 6, 7, 8, 9, 1, 2,
  6, 7, 2, 1, 9, 5, 3, 4, 8,
  1, 9, 8, 3, 4, 2, 5, 6, 7,
  8, 5, 9, 7, 6, 1, 4, 2, 3,
  4, 2, 6, 8, 5, 3, 7, 9, 1,
  7, 1, 3, 9, 2, 4, 8, 5, 6,
  9, 6, 1, 5, 3, 7, 2, 8, 4,
  2, 8, 7, 4, 1, 9, 6, 3, 5,
  3, 4, 5, 2, 8, 6, 1, 7, 9,
];

export function CreateRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function Shuffle<T>(items: T[], random: () => number) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

function Answer(kind: PuzzleKind, size: number) {
  if (kind === 'sudoku') return [...sudokuAnswer];
  if (kind === 'magic-square') return [8, 1, 6, 3, 5, 7, 4, 9, 2];
  return Array.from({ length: size * size }, (_, index) => (Math.floor(index / size) + index) % size + 1);
}

// The original answer grid with randomly chosen cells blanked; 0 is a blank.
export function CreateNumberGrid(difficulty: Difficulty, random: () => number) {
  const { kind, size, blanks } = gridConfig[difficulty];
  const values = Answer(kind, size);
  for (const index of Shuffle([...values.keys()], random).slice(0, blanks)) values[index] = 0;
  return { kind: kind as PuzzleKind, size, maxValue: kind === 'magic-square' ? size * size : size, values, givens: values.map(Boolean) };
}

const AllDistinct = (group: number[], maxValue: number) => new Set(group).size === group.length && group.every(value => value >= 1 && value <= maxValue);

// A full board passes when it follows its rule, whichever correct filling the player found.
export function IsValidGrid(kind: PuzzleKind, size: number, values: number[]) {
  if (values.includes(0)) return false;
  const rows = Array.from({ length: size }, (_, row) => values.slice(row * size, row * size + size));
  const cols = Array.from({ length: size }, (_, col) => rows.map(row => row[col]));
  if (kind === 'magic-square') {
    const diagonals = [rows.map((row, index) => row[index]), rows.map((row, index) => row[size - 1 - index])];
    return AllDistinct(values, size * size) && [...rows, ...cols, ...diagonals].every(line => line.reduce((sum, value) => sum + value, 0) === magicSum);
  }
  const groups = [...rows, ...cols];
  if (kind === 'sudoku') {
    for (let box = 0; box < size; box++) {
      const [top, left] = [Math.floor(box / 3) * 3, (box % 3) * 3];
      groups.push(rows.slice(top, top + 3).flatMap(row => row.slice(left, left + 3)));
    }
  }
  return groups.every(group => AllDistinct(group, size));
}

export class NumberGridMatch {
  kind: PuzzleKind;
  size: number;
  maxValue: number;
  values: number[];
  givens: boolean[];
  initialBlanks: number;
  moves = 0;
  errors = 0;
  outcome: Outcome | null = null;
  rows: ChangeRow[] = [];
  private lastMoveAt: number;

  constructor(difficulty: Difficulty, startedAt: number, random: () => number) {
    ({ kind: this.kind, size: this.size, maxValue: this.maxValue, values: this.values, givens: this.givens } = CreateNumberGrid(difficulty, random));
    this.initialBlanks = this.blanksLeft;
    this.lastMoveAt = startedAt;
  }

  get blanksLeft() { return this.values.filter(value => value === 0).length; }

  // A tap steps the cell through 1, 2, 3... and back to blank, as in the original game.
  cycle(index: number, now: number) {
    return this.set(index, this.values[index] >= this.maxValue ? 0 : this.values[index] + 1, now);
  }

  set(index: number, value: number, now: number) {
    const unchanged = { accepted: false, solved: this.outcome === 'Victory', fullWrong: false };
    if (this.outcome || this.givens[index] !== false || !Number.isInteger(value) || value < 0 || value > this.maxValue || this.values[index] === value) return unchanged;
    this.values[index] = value;
    this.moves++;
    this.rows.push({ move: this.moves, row: Math.floor(index / this.size) + 1, col: index % this.size + 1, value,
      thinkMs: Math.max(0, Math.round(now - this.lastMoveAt)), blanksLeft: this.blanksLeft });
    this.lastMoveAt = now;
    if (IsValidGrid(this.kind, this.size, this.values)) {
      this.outcome = 'Victory';
      return { accepted: true, solved: true, fullWrong: false };
    }
    // A full board that breaks the rule is counted each time a change leaves it that way.
    const fullWrong = this.blanksLeft === 0;
    if (fullWrong) this.errors++;
    return { accepted: true, solved: false, fullWrong };
  }

  expire(): Outcome | null {
    if (this.outcome) return null;
    this.outcome = 'TimeUp';
    return this.outcome;
  }
}

export function SummarizeNumberGrid(match: NumberGridMatch, durationMs: number) {
  const times = match.rows.map(row => row.thinkMs);
  return {
    duration: Math.round(durationMs / 100) / 10,
    completed: match.outcome === 'Victory' ? 1 : 0,
    moves: match.moves,
    errors: match.errors,
    boardSize: match.size,
    puzzleKind: kindCodes[match.kind],
    initialBlanks: match.initialBlanks,
    blanksLeft: match.blanksLeft,
    meanThinkMs: times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : null,
  };
}
