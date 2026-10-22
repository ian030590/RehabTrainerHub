import type { TrialStep } from './trialRun';

export type Side = 'left' | 'right';
export type Condition = 'high' | 'low';
export const shapeNames = ['pentagon', 'hourglass', 'tear', 'square'] as const;
export interface StopSignalTrial { shape: number; target: Side; stop: boolean; practice: boolean; condition: Condition | null }
export interface StopSignalSegment { kind: 'practice-go' | 'practice-stop' | 'block'; block: number; condition: Condition | null; trials: StopSignalTrial[] }
export interface StopSignalPlan { keyMap: Side[]; segments: StopSignalSegment[] }
export interface StopSignalPlanSettings { responseWindowMs: number; rounds: number; practice: boolean }

export const blockLength = 50;
export const blocksPerCondition = 6;
export const initialStopDelayMs = 250;
export const practiceStopDelayMs = 250;
export const fixationMs = 500;
export const shapeMs = 850;
export const signalMs = 500;
export const practiceFeedbackMs = 750;

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

const Repeat = <T>(items: T[], times: number) => Array.from({ length: times }, () => items).flat();

// Every shape appears equally often; a block of 50 gives two different shapes one extra showing.
function Shapes(count: number, random: () => number) {
  const extra = Shuffle([0, 1, 2, 3], random).slice(0, count % 4);
  return Shuffle([...Repeat([0, 1, 2, 3], Math.floor(count / 4)), ...extra], random);
}

// Two of the four shapes go to each key; the split is drawn once per session.
export function CreateKeyMap(random: () => number): Side[] {
  return Shuffle<Side>(['left', 'left', 'right', 'right'], random);
}

export function CreateStopSignalPlan(settings: StopSignalPlanSettings, random: () => number, presetKeyMap?: Side[]): StopSignalPlan {
  const keyMap = presetKeyMap ?? CreateKeyMap(random);
  const Trials = (shapes: number[], stops: boolean[], practice: boolean, condition: Condition | null) =>
    shapes.map((shape, index) => ({ shape, target: keyMap[shape], stop: stops[index], practice, condition }));
  const segments: StopSignalSegment[] = [];
  if (settings.practice) {
    segments.push({ kind: 'practice-go', block: 0, condition: null, trials: Trials(Shapes(12, random), Array(12).fill(false), true, null) });
    const stops = Shuffle(Repeat([true, true, true, false, false, false, false, false, false, false], 2), random);
    segments.push({ kind: 'practice-stop', block: 0, condition: null, trials: Trials(Shapes(20, random), stops, true, null) });
  }
  const first: Condition = random() < .5 ? 'high' : 'low';
  const blocks = settings.rounds / blockLength;
  for (let index = 0; index < blocks; index++) {
    const condition: Condition = index < blocksPerCondition ? first : first === 'high' ? 'low' : 'high';
    const pattern = condition === 'high' ? [true, true, false, false, false] : [true, false, false, false, false];
    const stops = Shuffle(Repeat(pattern, blockLength / 5), random);
    segments.push({ kind: 'block', block: index + 1, condition, trials: Trials(Shapes(blockLength, random), stops, false, condition) });
  }
  return { keyMap, segments };
}

// After a successful stop the delay grows by 50 ms (stopping gets harder); after a missed stop it shrinks.
export function NextStopDelay(delayMs: number, stopped: boolean): number {
  if (stopped) return delayMs < 850 ? delayMs + 50 : delayMs;
  return delayMs > 0 ? delayMs - 50 : delayMs;
}

export function CreateStopSignalStep(trial: StopSignalTrial, delayMs: number, settings: { responseWindowMs: number }): TrialStep<StopSignalTrial> {
  return { trial, timing: {
    lead: [{ state: 'fixation', ms: fixationMs }], exposureMs: shapeMs, windowMs: settings.responseWindowMs, endOnResponse: false,
    feedbackMs: trial.practice ? practiceFeedbackMs : 0, gapMs: 0,
    signalMs: trial.stop ? (trial.practice ? practiceStopDelayMs : delayMs) : null, signalDurationMs: signalMs,
  } };
}
