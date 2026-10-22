import type { TrialStep, TrialTiming } from './trialRun';

export type Side = 'left' | 'right';
export interface FlankerTrial { target: Side; flanker: Side; congruent: boolean; practice: boolean }

export const practiceTrials = 12;
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

// The original four rows, shuffled in blocks so half the items have opposing flankers.
const block: [Side, Side][] = [['left', 'left'], ['left', 'right'], ['right', 'left'], ['right', 'right']];

export function CreateFlankerTrials(count: number, random: () => number, practice = false): FlankerTrial[] {
  const trials: FlankerTrial[] = [];
  while (trials.length < count) {
    for (const [target, flanker] of Shuffle(block, random)) trials.push({ target, flanker, congruent: target === flanker, practice });
  }
  return trials.slice(0, count);
}

export interface FlankerPlan { responseWindowMs: number; rounds: number; practice: boolean }

export function CreateFlankerSteps(plan: FlankerPlan, random: () => number): TrialStep<FlankerTrial>[] {
  const timing = (lead: TrialTiming['lead']): TrialTiming => ({ lead, exposureMs: null, windowMs: plan.responseWindowMs, endOnResponse: true, feedbackMs: 1000, gapMs: 500 });
  const lead = [{ state: 'fixation', ms: 500 }];
  const practice = plan.practice ? CreateFlankerTrials(practiceTrials, random, true) : [];
  const counted = CreateFlankerTrials(plan.rounds, random);
  return [...practice.map(trial => ({ trial, timing: timing(lead) })),
    ...counted.map((trial, index) => ({ trial, timing: timing(index === 0 && practice.length ? [{ state: 'break', ms: breakMs }, ...lead] : lead) }))];
}
