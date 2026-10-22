import type { TrialStep, TrialTiming } from './trialRun';

export type SquareColor = 'orange' | 'blue';
export interface GoNoGoTrial { noGo: boolean; practice: boolean }

export const practiceTrials = 10;
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

// As in the original, either color can be the press color for a session.
export function PickGoColor(random: () => number): SquareColor {
  return random() < .5 ? 'orange' : 'blue';
}

// Counted squares come in blocks of ten with one hold-back square; practice shows five of each.
export function CreateGoNoGoTrials(count: number, random: () => number, practice = false): GoNoGoTrial[] {
  const block = practice ? [...Array(5).fill(false), ...Array(5).fill(true)] : [true, ...Array(9).fill(false)];
  const trials: GoNoGoTrial[] = [];
  while (trials.length < count) for (const noGo of Shuffle(block, random)) trials.push({ noGo, practice });
  return trials.slice(0, count);
}

export interface GoNoGoPlan { exposureMs: number; rounds: number; practice: boolean }

// The answer window is the exposure plus 250 to 749 ms, the original jittered gap between squares.
export function CreateGoNoGoSteps(plan: GoNoGoPlan, random: () => number): TrialStep<GoNoGoTrial>[] {
  const windowMs = () => plan.exposureMs + 250 + Math.floor(random() * 500);
  const practice = plan.practice ? CreateGoNoGoTrials(practiceTrials, random, true) : [];
  const counted = CreateGoNoGoTrials(plan.rounds, random);
  const practiceTiming = (): TrialTiming => ({ lead: [], exposureMs: plan.exposureMs, windowMs: windowMs(), endOnResponse: true, feedbackMs: 1000, gapMs: 250 });
  const countedTiming = (first: boolean): TrialTiming => ({ lead: first && practice.length ? [{ state: 'break', ms: breakMs }] : [], exposureMs: plan.exposureMs,
    windowMs: windowMs(), endOnResponse: false, feedbackMs: 0, gapMs: 0 });
  return [...practice.map(trial => ({ trial, timing: practiceTiming() })), ...counted.map((trial, index) => ({ trial, timing: countedTiming(index === 0) }))];
}
