import type { TrialStep, TrialTiming } from './trialRun';
import { breakMs, cueMs, fixationMs, maskMs, practiceFeedbackMs, practiceItems } from '../settings';

export type Side = 'left' | 'right';
export type Direction = 'left' | 'up' | 'right';
// The square flashes on the cue side; the arrow appears on the other side.
export interface AntisaccadeTrial { cue: Side; side: Side; arrow: Direction; practice: boolean }

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

const block: [Side, Direction][] = (['left', 'right'] as const).flatMap(cue => (['left', 'up', 'right'] as const).map(arrow => [cue, arrow] as [Side, Direction]));

// Every block of six holds each square side with each arrow direction once.
export function CreateAntisaccadeTrials(count: number, random: () => number, practice = false): AntisaccadeTrial[] {
  const trials: AntisaccadeTrial[] = [];
  while (trials.length < count) {
    for (const [cue, arrow] of Shuffle(block, random)) trials.push({ cue, side: cue === 'left' ? 'right' : 'left', arrow, practice });
  }
  return trials.slice(0, count);
}

export interface AntisaccadePlan { exposureMs: number; rounds: number; practice: boolean }

export function CreateAntisaccadeSteps(plan: AntisaccadePlan, random: () => number): TrialStep<AntisaccadeTrial>[] {
  const lead: TrialTiming['lead'] = [{ state: 'fixation', ms: fixationMs }, { state: 'cue', ms: cueMs }];
  const timing = (practice: boolean, first: boolean): TrialTiming => ({ lead: first ? [{ state: 'break', ms: breakMs }, ...lead] : lead,
    exposureMs: plan.exposureMs, windowMs: plan.exposureMs + maskMs, endOnResponse: false, feedbackMs: practice ? practiceFeedbackMs : 0, gapMs: 0 });
  const practice = plan.practice ? CreateAntisaccadeTrials(practiceItems, random, true) : [];
  const counted = CreateAntisaccadeTrials(plan.rounds, random);
  return [...practice.map(trial => ({ trial, timing: timing(true, false) })),
    ...counted.map((trial, index) => ({ trial, timing: timing(false, index === 0 && practice.length > 0) }))];
}
