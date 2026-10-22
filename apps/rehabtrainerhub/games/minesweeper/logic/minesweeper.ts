import type { BoardSize, Difficulty } from '../settings';

export type Outcome = 'Victory' | 'Defeat';
export interface Cell { mine: boolean; open: boolean; flagged: boolean; adjacent: number }
// action: 1 open, 2 flag, 3 remove a flag.
export interface ActionRow { move: number; action: 1 | 2 | 3; row: number; col: number; thinkMs: number; opened: number; safeLeft: number }

export const mineDensity = { easy: 0.1, medium: 0.16, hard: 0.24 } as const satisfies Record<Difficulty, number>;
export const boardSizes = { small: 6, medium: 16, large: 20 } as const satisfies Record<BoardSize, number>;
export const zoomRange = { min: 0.5, max: 3, step: 0.25 };

export function ClampZoom(value: number) {
  return Math.round(Math.min(zoomRange.max, Math.max(zoomRange.min, value)) * 100) / 100;
}

// The 3 x 3 area around the first opened cell stays free, so the mine count leaves room for it.
export function CalculateMineCount(rows: number, cols: number, density: number) {
  const cells = rows * cols;
  return Math.min(Math.max(Math.round(cells * density), 1), Math.max(1, cells - 9));
}

export function CreateRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export class MineField {
  readonly size: number;
  readonly mineCount: number;
  readonly cells: Cell[];
  readonly rows: ActionRow[] = [];
  minesPlaced = false;
  outcome: Outcome | null = null;
  explodedIndex: number | null = null;
  moves = 0;
  private lastActionAt: number;

  constructor(difficulty: Difficulty, boardSize: BoardSize, private readonly random: () => number, startedAt: number) {
    this.size = boardSizes[boardSize];
    this.mineCount = CalculateMineCount(this.size, this.size, mineDensity[difficulty]);
    this.cells = Array.from({ length: this.size * this.size }, () => ({ mine: false, open: false, flagged: false, adjacent: 0 }));
    this.lastActionAt = startedAt;
  }

  get flags() { return this.cells.filter(cell => cell.flagged).length; }
  get safeCells() { return this.cells.length - this.mineCount; }
  get safeLeft() { return this.safeCells - this.cells.filter(cell => cell.open && !cell.mine).length; }

  neighbors(index: number) {
    const row = Math.floor(index / this.size), col = index % this.size, found: number[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const y = row + dy, x = col + dx;
      if ((dx || dy) && y >= 0 && y < this.size && x >= 0 && x < this.size) found.push(y * this.size + x);
    }
    return found;
  }

  // Mines are laid after the first open, away from that cell and its neighbors, as in the original game.
  private placeMines(safeIndex: number) {
    const keepClear = new Set([safeIndex, ...this.neighbors(safeIndex)]);
    const candidates = this.cells.map((_, index) => index).filter(index => !keepClear.has(index));
    for (let index = candidates.length - 1; index > 0; index--) {
      const swap = Math.floor(this.random() * (index + 1));
      [candidates[index], candidates[swap]] = [candidates[swap], candidates[index]];
    }
    for (const index of candidates.slice(0, this.mineCount)) this.cells[index].mine = true;
    this.cells.forEach((cell, index) => { cell.adjacent = this.neighbors(index).filter(next => this.cells[next].mine).length; });
    this.minesPlaced = true;
  }

  private record(action: ActionRow['action'], index: number, opened: number, now: number) {
    this.moves++;
    this.rows.push({ move: this.moves, action, row: Math.floor(index / this.size) + 1, col: index % this.size + 1,
      thinkMs: Math.max(0, Math.round(now - this.lastActionAt)), opened, safeLeft: this.safeLeft });
    this.lastActionAt = now;
  }

  open(index: number, now: number) {
    const target = this.cells[index];
    if (this.outcome || !target || target.open || target.flagged) return { accepted: false, result: null, opened: 0, solved: false };
    if (!this.minesPlaced) this.placeMines(index);
    if (target.mine) {
      this.outcome = 'Defeat';
      this.explodedIndex = index;
      for (const cell of this.cells) if (cell.mine) cell.open = true;
      this.record(1, index, 0, now);
      return { accepted: true, result: 'mine' as const, opened: 0, solved: false };
    }
    // An empty cell opens its neighbors in turn; flags stop the spread.
    let opened = 0;
    const queue = [index];
    while (queue.length) {
      const next = queue.shift() as number;
      const cell = this.cells[next];
      if (cell.open || cell.flagged || cell.mine) continue;
      cell.open = true;
      opened++;
      if (cell.adjacent === 0) queue.push(...this.neighbors(next).filter(near => !this.cells[near].open));
    }
    const solved = this.safeLeft === 0;
    if (solved) this.outcome = 'Victory';
    this.record(1, index, opened, now);
    return { accepted: true, result: 'safe' as const, opened, solved };
  }

  toggleFlag(index: number, now: number) {
    const target = this.cells[index];
    if (this.outcome || !target || target.open) return { accepted: false, flagged: false };
    target.flagged = !target.flagged;
    this.record(target.flagged ? 2 : 3, index, 0, now);
    return { accepted: true, flagged: target.flagged };
  }
}

export function SummarizeMines(field: MineField, durationMs: number) {
  const times = field.rows.map(row => row.thinkMs);
  return {
    duration: Math.round(durationMs / 100) / 10,
    completed: field.outcome === 'Victory' ? 1 : 0,
    rows: field.size,
    columns: field.size,
    mines: field.mineCount,
    safeCells: field.safeCells,
    revealedSafe: field.safeCells - field.safeLeft,
    correctFlags: field.cells.filter(cell => cell.mine && cell.flagged).length,
    incorrectFlags: field.cells.filter(cell => !cell.mine && cell.flagged).length,
    moves: field.moves,
    meanThinkMs: times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : null,
  };
}
