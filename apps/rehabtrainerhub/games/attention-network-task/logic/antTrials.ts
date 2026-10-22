import type { TrialStep } from './trialRun';

export type Side = 'left' | 'right';
export type Cue = 'nocue' | 'center' | 'double' | 'spatial';
export type Location = 'up' | 'down';
export type FlankerType = 'neutral' | 'congruent' | 'incongruent';
export interface AntTrial { cue: Cue; location: Location; condition: FlankerType; target: Side; practice: boolean }
export interface AntSegment { kind: 'practice' | 'block'; block: number; trials: AntTrial[] }

export const cues: Cue[] = ['nocue', 'center', 'double', 'spatial'];
export const locations: Location[] = ['up', 'down'];
export const flankerTypes: FlankerType[] = ['neutral', 'congruent', 'incongruent'];
export const blockLength = 48;
export const trialMs = 3500;
export const practiceFeedbackMs = 1000;

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

// The 48 combinations in the original order: position, then cue, then left targets before right ones.
function AllCombinations(practice: boolean): AntTrial[] {
  return locations.flatMap(location => cues.flatMap(cue => (['left', 'right'] as Side[]).flatMap(target =>
    flankerTypes.map(condition => ({ cue, location, condition, target, practice })))));
}

// Practice keeps the original 24: no-cue and centre-cue rows above, double-cue rows below,
// and three spatial-cue rows above and three below, all with left targets.
export function CreateAntPlan(settings: { rounds: number; practice: boolean }, random: () => number): AntSegment[] {
  const segments: AntSegment[] = [];
  if (settings.practice) {
    const all = AllCombinations(true);
    const practice = [...all.slice(0, 12), ...all.slice(18, 21), ...all.slice(36, 45)];
    segments.push({ kind: 'practice', block: 0, trials: Shuffle(practice, random) });
  }
  for (let block = 1; block <= settings.rounds / blockLength; block++) segments.push({ kind: 'block', block, trials: Shuffle(AllCombinations(false), random) });
  return segments;
}

export function CreateAntStep(trial: AntTrial, settings: { responseWindowMs: number }, random: () => number): TrialStep<AntTrial> {
  return { trial, timing: {
    lead: [{ state: 'fixation', ms: 400 + Math.floor(random() * 1200) }, { state: 'cue', ms: 100 }, { state: 'fixation', ms: 400 }],
    exposureMs: settings.responseWindowMs, windowMs: settings.responseWindowMs, endOnResponse: true,
    feedbackMs: trial.practice ? practiceFeedbackMs : 0, gapMs: 0, trialMs,
  } };
}
