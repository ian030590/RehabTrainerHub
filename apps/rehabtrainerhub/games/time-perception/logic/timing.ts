import type { TimingSettings } from '../settings';

export type TimingTask = 'reproduce' | 'compare' | 'estimate';
export interface TimingTrial { task: TimingTask; targetMs: number; longer: boolean; standardFirst: boolean }
export interface TimingRow {
  trial: number; task: number; targetMs: number; comparisonMs: number | null; answerMs: number | null; errorMs: number | null; correct: boolean;
}
export interface TimingClock { now(): number; set(callback: () => void, ms: number): number; clear(timer: number): void }

export const reproduceTargets = [1000, 1500, 2000, 2500, 3000];
export const estimateTargets = [1000, 2000, 3000, 4000, 5000];
export const standardMs = 1000;
const taskCodes: Record<TimingTask, number> = { reproduce: 0, compare: 1, estimate: 2 };

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

function Cycle<T>(items: T[], count: number, random: () => number): T[] {
  const result: T[] = [];
  while (result.length < count) result.push(...Shuffle(items, random));
  return result.slice(0, count);
}

// Tasks run in blocks so each set of instructions holds for a stretch of trials.
export function CreateTimingPlan(settings: TimingSettings, random: () => number): TimingTrial[] {
  const tasks: TimingTask[] = settings.mode === 'mixed' ? ['reproduce', 'compare', 'estimate'] : [settings.mode];
  const perTask = settings.trials / tasks.length;
  return tasks.flatMap((task): TimingTrial[] => {
    if (task === 'compare') {
      const orders = Cycle([[true, true], [true, false], [false, true], [false, false]], perTask, random);
      return orders.map(([longer, standardFirst]) => ({ task, targetMs: standardMs, longer, standardFirst }));
    }
    return Cycle(task === 'reproduce' ? reproduceTargets : estimateTargets, perTask, random)
      .map(targetMs => ({ task, targetMs, longer: false, standardFirst: false }));
  });
}

// Two right in a row narrow the gap and one wrong widens it, settling near 71% right.
export class Staircase {
  differenceMs: number;
  reversals: number[] = [];
  private streak = 0;
  private direction: 'down' | 'up' | null = null;

  constructor(private options: { startMs: number; stepMs: number; minMs: number; maxMs: number }) {
    this.differenceMs = options.startMs;
  }

  record(correct: boolean) {
    if (correct && ++this.streak < 2) return;
    const direction = correct ? 'down' : 'up';
    if (this.direction && this.direction !== direction) this.reversals.push(this.differenceMs);
    this.direction = direction;
    this.streak = 0;
    const next = this.differenceMs + (correct ? -this.options.stepMs : this.options.stepMs);
    this.differenceMs = Math.min(this.options.maxMs, Math.max(this.options.minMs, next));
  }

  thresholdMs() {
    const recent = this.reversals.slice(-6);
    return recent.length ? Math.round(recent.reduce((sum, value) => sum + value, 0) / recent.length) : this.differenceMs;
  }
}

export function PresentDuration(ms: number, view: { show(): void; hide(): void }, clock: TimingClock, onDone: () => void) {
  let stopped = false;
  const timer = clock.set(() => { if (stopped) return; stopped = true; view.hide(); onDone(); }, ms);
  view.show();
  return () => { stopped = true; clock.clear(timer); };
}

// A reproduction within 15% of the target counts as close.
export function ScoreReproduce(trial: number, targetMs: number, producedMs: number): TimingRow {
  const errorMs = Math.round(producedMs - targetMs);
  return { trial, task: taskCodes.reproduce, targetMs, comparisonMs: null, answerMs: Math.round(producedMs), errorMs,
    correct: Math.abs(errorMs) <= targetMs * .15 };
}

export function ScoreCompare(trial: number, standard: number, comparisonMs: number, answer: 'longer' | 'shorter'): TimingRow {
  return { trial, task: taskCodes.compare, targetMs: standard, comparisonMs, answerMs: null, errorMs: null,
    correct: (comparisonMs > standard) === (answer === 'longer') };
}

export function ScoreEstimate(trial: number, targetMs: number, chosenMs: number): TimingRow {
  return { trial, task: taskCodes.estimate, targetMs, comparisonMs: null, answerMs: chosenMs, errorMs: chosenMs - targetMs, correct: chosenMs === targetMs };
}

const Mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
// The epsilon keeps halves such as 1.025 from rounding down through binary error.
const Round = (value: number | null, digits = 0) => value === null ? null : Math.round((value + Number.EPSILON) * 10 ** digits) / 10 ** digits;

export function SummarizeTiming(rows: TimingRow[], compareThresholdMs: number | null) {
  const of = (task: TimingTask) => rows.filter(row => row.task === taskCodes[task]);
  const reproduce = of('reproduce'), compare = of('compare'), estimate = of('estimate');
  const accuracy = (subset: TimingRow[]) => subset.length ? Round(subset.filter(row => row.correct).length / subset.length * 100, 1) : null;
  return {
    trials: rows.length,
    reproduceTrials: reproduce.length,
    reproduceErrorPercent: Round(Mean(reproduce.map(row => Math.abs(row.errorMs!) / row.targetMs * 100)), 1),
    reproduceRatio: Round(Mean(reproduce.map(row => row.answerMs! / row.targetMs)), 2),
    compareTrials: compare.length,
    compareAccuracyPercent: accuracy(compare),
    compareThresholdMs: compare.length ? compareThresholdMs : null,
    estimateTrials: estimate.length,
    estimateAccuracyPercent: accuracy(estimate),
    estimateMeanErrorMs: Round(Mean(estimate.map(row => row.errorMs!))),
  };
}
