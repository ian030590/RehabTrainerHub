import type { Difficulty } from '../settings';

export type Outcome = 'Victory' | 'TimeUp';
export interface Card { value: string; faceUp: boolean; matched: boolean }
export interface TurnRow { move: number; thinkMs: number; matched: 0 | 1; matchedPairs: number }
export type FlipResult = 'first' | 'match' | 'mismatch';

export const memoryConfig = {
  easy: { rows: 3, cols: 4, pairs: 6 },
  medium: { rows: 4, cols: 4, pairs: 8 },
  hard: { rows: 4, cols: 5, pairs: 10 },
} as const;
export const cardValues = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
// A wrong pair stays face up this long before both cards turn back.
export const mismatchHoldMs = 750;

export function CreateRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function Shuffle<T>(items: readonly T[], random: () => number) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function CreateDeck(pairs: number, random: () => number) {
  const values = Shuffle(cardValues, random).slice(0, pairs);
  return Shuffle([...values, ...values], random);
}

export class PairsMatch {
  rows: number;
  cols: number;
  pairs: number;
  cards: Card[];
  open: number[] = [];
  matchedPairs = 0;
  moves = 0;
  errors = 0;
  outcome: Outcome | null = null;
  turns: TurnRow[] = [];
  private readyAt: number;

  constructor(difficulty: Difficulty, startedAt: number, random: () => number) {
    const config = memoryConfig[difficulty];
    this.rows = config.rows;
    this.cols = config.cols;
    this.pairs = config.pairs;
    this.cards = CreateDeck(config.pairs, random).map(value => ({ value, faceUp: false, matched: false }));
    this.readyAt = startedAt;
  }

  // True while a wrong pair is showing and waiting to turn back.
  get waiting() { return this.open.length === 2; }

  flip(index: number, now: number): { accepted: boolean; result: FlipResult | null; solved: boolean } {
    const card = this.cards[index];
    if (this.outcome || this.waiting || !card || card.faceUp) return { accepted: false, result: null, solved: this.outcome === 'Victory' };
    card.faceUp = true;
    this.open.push(index);
    if (this.open.length === 1) return { accepted: true, result: 'first', solved: false };
    this.moves++;
    const [first, second] = this.open.map(at => this.cards[at]);
    const matched = first.value === second.value;
    const thinkMs = Math.max(0, Math.round(now - this.readyAt));
    if (matched) {
      first.matched = second.matched = true;
      this.matchedPairs++;
      this.open = [];
      this.readyAt = now;
    } else this.errors++;
    this.turns.push({ move: this.moves, thinkMs, matched: matched ? 1 : 0, matchedPairs: this.matchedPairs });
    if (this.matchedPairs === this.pairs) this.outcome = 'Victory';
    return { accepted: true, result: matched ? 'match' : 'mismatch', solved: this.outcome === 'Victory' };
  }

  hideMismatch(now: number) {
    if (!this.waiting) return false;
    for (const index of this.open) this.cards[index].faceUp = false;
    this.open = [];
    this.readyAt = now;
    return true;
  }

  expire(): Outcome | null {
    if (this.outcome) return null;
    this.outcome = 'TimeUp';
    return this.outcome;
  }
}

export function SummarizeMemory(match: PairsMatch, durationMs: number) {
  const times = match.turns.map(turn => turn.thinkMs);
  return {
    duration: Math.round(durationMs / 100) / 10,
    completed: match.outcome === 'Victory' ? 1 : 0,
    moves: match.moves,
    errors: match.errors,
    matchedPairs: match.matchedPairs,
    pairs: match.pairs,
    meanThinkMs: times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : null,
  };
}
