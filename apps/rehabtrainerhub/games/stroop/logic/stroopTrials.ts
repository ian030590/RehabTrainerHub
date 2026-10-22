import type { TrialStep, TrialTiming } from './trialRun';

export type InkColor = 'red' | 'green' | 'blue';
export interface StroopTrial { word: InkColor; ink: InkColor; congruent: boolean; practice: boolean }

export const inkColors: InkColor[] = ['red', 'green', 'blue'];
export const practiceTrials = 24;
export const breakMs = 3000;

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

// The original block of twelve: each word twice in its own ink, and each mismatched word and ink once.
const block: [InkColor, InkColor][] = inkColors.flatMap(word => inkColors.flatMap(ink => word === ink ? [[word, ink], [word, ink]] : [[word, ink]]) as [InkColor, InkColor][]);

export function CreateStroopTrials(count: number, random: () => number, practice = false): StroopTrial[] {
  const trials: StroopTrial[] = [];
  while (trials.length < count) {
    for (const [word, ink] of Shuffle(block, random)) trials.push({ word, ink, congruent: word === ink, practice });
  }
  return trials.slice(0, count);
}

export interface StroopPlan { responseWindowMs: number; rounds: number; practice: boolean }

export function CreateStroopSteps(plan: StroopPlan, random: () => number): TrialStep<StroopTrial>[] {
  const timing = (lead: TrialTiming['lead']): TrialTiming => ({ lead, exposureMs: null, windowMs: plan.responseWindowMs, endOnResponse: true, feedbackMs: 500, gapMs: 250 });
  const lead = [{ state: 'fixation', ms: 500 }, { state: 'blank', ms: 500 }];
  const practice = plan.practice ? CreateStroopTrials(practiceTrials, random, true) : [];
  const counted = CreateStroopTrials(plan.rounds, random);
  return [...practice.map(trial => ({ trial, timing: timing(lead) })),
    ...counted.map((trial, index) => ({ trial, timing: timing(index === 0 && practice.length ? [{ state: 'break', ms: breakMs }, ...lead] : lead) }))];
}
