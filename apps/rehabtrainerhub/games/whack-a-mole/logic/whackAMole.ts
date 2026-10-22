import type { Difficulty } from '../settings';

export type TapOutcome = 'hit' | 'wrong';
// Outcome codes kept from the original records: 1 hit, 2 ducked before a tap, 3 another hole tapped.
export interface TargetRow { trial: number; outcome: 1 | 2 | 3; responseMs: number | null; targetIndex: number; tappedIndex: number | null }

// Board side, how long a mole stays up, and the random gap before the next one.
export const whackConfig = {
  easy: { gridSize: 3, targetMs: 1100, minDelayMs: 350, maxDelayMs: 900 },
  medium: { gridSize: 3, targetMs: 850, minDelayMs: 250, maxDelayMs: 720 },
  hard: { gridSize: 4, targetMs: 720, minDelayMs: 180, maxDelayMs: 580 },
} as const;
export const firstTargetMs = 600;

export function CreateRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export class WhackMatch {
  gridSize: number;
  targetMs: number;
  active: number | null = null;
  shown = 0;
  hits = 0;
  misses = 0;
  taps = 0;
  expired = 0;
  wrongTaps = 0;
  rows: TargetRow[] = [];
  private onsetAt = 0;
  private config: (typeof whackConfig)[Difficulty];
  private random: () => number;

  constructor(difficulty: Difficulty, random: () => number) {
    this.config = whackConfig[difficulty];
    this.gridSize = this.config.gridSize;
    this.targetMs = this.config.targetMs;
    this.random = random;
  }

  nextDelay() {
    return Math.round(this.config.minDelayMs + this.random() * (this.config.maxDelayMs - this.config.minDelayMs));
  }

  show(now: number) {
    if (this.active !== null) return null;
    this.active = Math.floor(this.random() * this.gridSize * this.gridSize);
    this.onsetAt = now;
    this.shown++;
    return this.active;
  }

  // Moves the onset to when the mole is actually in the page.
  stampOnset(now: number) {
    if (this.active !== null) this.onsetAt = now;
  }

  private record(outcome: 1 | 2 | 3, now: number, tappedIndex: number | null) {
    this.rows.push({ trial: this.rows.length + 1, outcome, responseMs: outcome === 1 ? Math.max(0, Math.round(now - this.onsetAt)) : null,
      targetIndex: this.active as number, tappedIndex });
    this.active = null;
  }

  tap(index: number, now: number): { accepted: boolean; outcome: TapOutcome | null } {
    if (this.active === null || !Number.isInteger(index) || index < 0 || index >= this.gridSize * this.gridSize) return { accepted: false, outcome: null };
    this.taps++;
    if (index === this.active) {
      this.hits++;
      this.record(1, now, index);
      return { accepted: true, outcome: 'hit' };
    }
    this.misses++;
    this.wrongTaps++;
    this.record(3, now, index);
    return { accepted: true, outcome: 'wrong' };
  }

  expire(now: number) {
    if (this.active === null) return false;
    this.misses++;
    this.expired++;
    this.record(2, now, null);
    return true;
  }
}

export function SummarizeWhack(match: WhackMatch, durationMs: number) {
  const times = match.rows.flatMap(row => row.responseMs === null ? [] : [row.responseMs]);
  return {
    duration: Math.round(durationMs / 100) / 10,
    hits: match.hits,
    misses: match.misses,
    taps: match.taps,
    meanMs: times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : null,
    bestMs: times.length ? Math.min(...times) : null,
    expired: match.expired,
    wrongTaps: match.wrongTaps,
  };
}
