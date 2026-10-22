import type { Difficulty } from '../settings';

export type Outcome = 'Victory' | 'TimeUp';
export interface PressRow { move: number; row: number; col: number; thinkMs: number; lightsOn: number }

// Board side and the number of random presses used to scramble an all-dark board.
export const lightsConfig = {
  easy: { size: 3, shuffles: 8 },
  medium: { size: 4, shuffles: 14 },
  hard: { size: 5, shuffles: 24 },
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

export function Toggle(lights: boolean[], size: number, index: number) {
  const row = Math.floor(index / size), col = index % size;
  for (const [r, c] of [[row, col], [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]) {
    if (r >= 0 && r < size && c >= 0 && c < size) lights[r * size + c] = !lights[r * size + c];
  }
}

// Scrambling with real presses keeps every puzzle solvable.
export function CreateLightsPuzzle(size: number, shuffles: number, random: () => number) {
  const lights = Array<boolean>(size * size).fill(false);
  for (let press = 0; press < shuffles; press++) {
    const row = Math.floor(random() * size), col = Math.floor(random() * size);
    Toggle(lights, size, row * size + col);
  }
  if (!lights.includes(true)) {
    const center = Math.floor(size / 2);
    Toggle(lights, size, center * size + center);
  }
  return lights;
}

export class LightsMatch {
  size: number;
  lights: boolean[];
  moves = 0;
  outcome: Outcome | null = null;
  rows: PressRow[] = [];
  private lastPressAt: number;

  constructor(difficulty: Difficulty, startedAt: number, random: () => number) {
    const config = lightsConfig[difficulty];
    this.size = config.size;
    this.lights = CreateLightsPuzzle(config.size, config.shuffles, random);
    this.lastPressAt = startedAt;
  }

  get lightsLeft() { return this.lights.filter(Boolean).length; }

  press(index: number, now: number) {
    if (this.outcome || index < 0 || index >= this.lights.length) return { accepted: false, lightsOn: this.lightsLeft, solved: this.outcome === 'Victory' };
    Toggle(this.lights, this.size, index);
    this.moves++;
    const lightsOn = this.lightsLeft;
    this.rows.push({ move: this.moves, row: Math.floor(index / this.size) + 1, col: index % this.size + 1, thinkMs: Math.max(0, Math.round(now - this.lastPressAt)), lightsOn });
    this.lastPressAt = now;
    if (lightsOn === 0) this.outcome = 'Victory';
    return { accepted: true, lightsOn, solved: lightsOn === 0 };
  }

  expire(): Outcome | null {
    if (this.outcome) return null;
    this.outcome = 'TimeUp';
    return this.outcome;
  }
}

export function SummarizeLights(match: LightsMatch, durationMs: number) {
  const times = match.rows.map(row => row.thinkMs);
  return {
    duration: Math.round(durationMs / 100) / 10,
    completed: match.outcome === 'Victory' ? 1 : 0,
    moves: match.moves,
    boardSize: match.size,
    lightsLeft: match.lightsLeft,
    meanThinkMs: times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : null,
  };
}
