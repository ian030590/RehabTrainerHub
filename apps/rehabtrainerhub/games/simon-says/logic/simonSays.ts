import type { Difficulty } from '../settings';

export type Outcome = 'Victory' | 'Defeat';
export type TapResult = 'step' | 'sequence' | 'wrong';
export interface TrialRow { trial: number; length: number; correct: 0 | 1; correctTaps: number; recallMs: number }

// The sequence length that wins the game.
export const targetLengths = { easy: 5, medium: 7, hard: 9 } as const;
export const livesOptions = [1, 3, 5];
// Playback: a pause before the first pad, then each pad lights for lightMs with gapMs between pads.
export const timing = { leadInMs: 350, lightMs: 360, gapMs: 140 } as const;

export function CreateRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export class SimonMatch {
  sequence: number[];
  targetLength: number;
  lives: number;
  maxLives: number;
  status: 'showing' | 'input' | 'over' = 'showing';
  outcome: Outcome | null = null;
  inputIndex = 0;
  trials: TrialRow[] = [];
  private inputStartedAt = 0;
  private random: () => number;

  constructor(difficulty: Difficulty, lives: number, random: () => number) {
    this.random = random;
    this.sequence = [this.nextPad()];
    this.targetLength = targetLengths[difficulty];
    this.lives = this.maxLives = lives;
  }

  private nextPad() { return Math.floor(this.random() * 4); }

  beginInput(now: number) {
    if (this.status !== 'showing') return;
    this.status = 'input';
    this.inputIndex = 0;
    this.inputStartedAt = now;
  }

  tap(pad: number, now: number): { accepted: boolean; result: TapResult | null; outcome: Outcome | null } {
    if (this.status !== 'input' || !Number.isInteger(pad) || pad < 0 || pad > 3) return { accepted: false, result: null, outcome: this.outcome };
    const record = (correct: 0 | 1) => this.trials.push({ trial: this.trials.length + 1, length: this.sequence.length, correct,
      correctTaps: this.inputIndex, recallMs: Math.max(0, Math.round(now - this.inputStartedAt)) });
    if (this.sequence[this.inputIndex] !== pad) {
      record(0);
      this.lives--;
      this.status = this.lives > 0 ? 'showing' : 'over';
      if (!this.lives) this.outcome = 'Defeat';
      return { accepted: true, result: 'wrong', outcome: this.outcome };
    }
    this.inputIndex++;
    if (this.inputIndex < this.sequence.length) return { accepted: true, result: 'step', outcome: null };
    record(1);
    if (this.sequence.length >= this.targetLength) {
      this.status = 'over';
      this.outcome = 'Victory';
    } else {
      this.sequence.push(this.nextPad());
      this.status = 'showing';
    }
    return { accepted: true, result: 'sequence', outcome: this.outcome };
  }
}

export function SummarizeSimon(match: SimonMatch, durationMs: number) {
  const correct = match.trials.filter(trial => trial.correct);
  return {
    duration: Math.round(durationMs / 100) / 10,
    completed: match.outcome === 'Victory' ? 1 : 0,
    trials: match.trials.length,
    correctTrials: correct.length,
    remainingLives: match.lives,
    maxLives: match.maxLives,
    longestCorrect: Math.max(0, ...correct.map(trial => trial.length)),
    targetLength: match.targetLength,
  };
}
