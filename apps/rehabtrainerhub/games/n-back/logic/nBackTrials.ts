import type { TrialStep } from './trialRun';

export type Answer = 'same' | 'different';
export interface NBackTrial { letter: string; match: boolean; load: number; practice: boolean }
export interface NBackSegment { kind: 'practice' | 'block'; block: number; load: number; trials: NBackTrial[] }

export const letters = 'bBdDgGtTvV';
export const blockLength = 50;
export const practiceLength = 25;
export const windowMs = 2000;

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

function Shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

const Pick = <T>(items: readonly T[] | string, random: () => number) => items[Math.floor(random() * items.length)] as T;
const AnyCase = (letter: string, random: () => number) => random() < .5 ? letter.toLowerCase() : letter.toUpperCase();

// One in five letters is a match. For load 0 a match is "t" in either case; otherwise it repeats the letter
// from `load` places back, ignoring case, and every other letter differs from that one.
export function CreateLetters(load: number, count: number, practice: boolean, random: () => number): NBackTrial[] {
  const candidates = Array.from({ length: count }, (_, index) => index).filter(index => index >= load);
  const matches = new Set(Shuffle(candidates, random).slice(0, Math.round(count / 5)));
  const trials: NBackTrial[] = [];
  for (let index = 0; index < count; index++) {
    const match = matches.has(index);
    let letter: string;
    if (load === 0) letter = match ? AnyCase('t', random) : AnyCase(Pick('bdgv', random), random);
    else if (match) letter = AnyCase(trials[index - load].letter, random);
    else {
      const avoid = index >= load ? trials[index - load].letter.toLowerCase() : '';
      letter = AnyCase(Pick([...'bdgtv'].filter(item => item !== avoid), random), random);
    }
    trials.push({ letter, match, load, practice });
  }
  return trials;
}

// Practice is 1-back. The 0-back block comes first or last, and each delay (1, 2, 3, in shuffled order) runs two blocks.
// Shorter sessions keep the first blocks of that order.
export function CreateNBackPlan(settings: { rounds: number; practice: boolean }, random: () => number): NBackSegment[] {
  const segments: NBackSegment[] = [];
  if (settings.practice) segments.push({ kind: 'practice', block: 0, load: 1, trials: CreateLetters(1, practiceLength, true, random) });
  const delays = Shuffle([1, 2, 3], random).flatMap(load => [load, load]);
  const loads = random() < .5 ? [0, ...delays] : [...delays, 0];
  loads.slice(0, settings.rounds / blockLength).forEach((load, index) => {
    segments.push({ kind: 'block', block: index + 1, load, trials: CreateLetters(load, blockLength, false, random) });
  });
  return segments;
}

// A short blank between letters makes a repeated letter visible as a new item.
export function CreateNBackStep(trial: NBackTrial, settings: { exposureMs: number }): TrialStep<NBackTrial> {
  return { trial, timing: { lead: [], exposureMs: settings.exposureMs, windowMs, endOnResponse: true, feedbackMs: trial.practice ? 500 : 0, gapMs: trial.practice ? 500 : 250 } };
}
