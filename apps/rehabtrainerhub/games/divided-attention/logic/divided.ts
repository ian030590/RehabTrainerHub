import type { MathLevel, Speed } from '../settings';

export interface Point { x: number; y: number }
export type Operation = '+' | '-' | '×';
export interface Problem { a: number; b: number; operation: Operation; answer: number; options: number[] }
export interface DividedRow {
  problem: number; a: number; b: number; operation: number; answer: number;
  chosen: number | null; correct: boolean; rtMs: number | null; trackingPercent: number | null;
}
export interface TrackingPercentages { overall: number | null; alone: number | null; duringMath: number | null }

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

const Round = (value: number | null, digits = 0) => value === null ? null : Math.round((value + Number.EPSILON) * 10 ** digits) / 10 ** digits;
const speedFactor: Record<Speed, number> = { slow: .6, medium: 1, fast: 1.5 };

// Two sine waves per axis with unrelated frequencies give a smooth path that does not repeat within a session.
export function CreatePath(seed: number, speed: Speed) {
  const random = CreateRandom(seed);
  const wave = () => ({ slow: { f: .45 + random() * .3, p: random() * Math.PI * 2 }, quick: { f: .85 + random() * .35, p: random() * Math.PI * 2 } });
  const x = wave(), y = wave();
  const factor = speedFactor[speed];
  const axis = (part: ReturnType<typeof wave>, time: number) =>
    .5 + .42 * (.6 * Math.sin(part.slow.f * time * factor + part.slow.p) + .4 * Math.sin(part.quick.f * time * factor + part.quick.p));
  return { at: (time: number): Point => ({ x: axis(x, time), y: axis(y, time) }) };
}

const Between = (random: () => number, min: number, max: number) => min + Math.floor(random() * (max - min + 1));
const operationCodes: Record<Operation, number> = { '+': 0, '-': 1, '×': 2 };

export function CreateProblem(level: MathLevel, random: () => number): Problem {
  let a: number, b: number, operation: Operation;
  const kind = Between(random, 0, level === 'easy' ? 1 : 2);
  if (level === 'easy') {
    operation = kind === 0 ? '+' : '-';
    a = Between(random, 2, 9);
    b = operation === '+' ? Between(random, 1, 9) : Between(random, 1, a - 1);
  } else if (kind === 2) {
    operation = '×'; a = Between(random, 2, 9); b = Between(random, 2, 9);
  } else {
    operation = kind === 0 ? '+' : '-'; a = Between(random, 12, 49); b = Between(random, 3, 9);
  }
  const answer = operation === '+' ? a + b : operation === '-' ? a - b : a * b;
  // Near misses make the options worth reading; a tens slip is a common error with two-digit sums.
  const offsets = [-2, -1, 1, 2, ...(level === 'harder' ? [-10, 10] : [])].filter(offset => answer + offset >= 0);
  const distractors: number[] = [];
  while (distractors.length < 2) {
    const value = answer + offsets[Between(random, 0, offsets.length - 1)];
    if (!distractors.includes(value)) distractors.push(value);
  }
  const options = [answer, ...distractors];
  for (let index = options.length - 1; index > 0; index--) {
    const swap = Between(random, 0, index);
    [options[index], options[swap]] = [options[swap], options[index]];
  }
  return { a, b, operation, answer, options };
}

// One sample per animation frame; the window marks where a sum appeared so its own stretch can be scored.
export class TrackingLog {
  private samples = { alone: 0, aloneOn: 0, math: 0, mathOn: 0 };
  private total = 0;
  private on = 0;
  add(onTarget: boolean, duringMath: boolean) {
    this.total++;
    if (onTarget) this.on++;
    if (duringMath) { this.samples.math++; if (onTarget) this.samples.mathOn++; } else { this.samples.alone++; if (onTarget) this.samples.aloneOn++; }
  }
  window() { return { total: this.total, on: this.on }; }
  percentSince(start: { total: number; on: number }) {
    const count = this.total - start.total;
    return count ? Round((this.on - start.on) / count * 100, 1) : null;
  }
  percentages(): TrackingPercentages {
    const percent = (on: number, count: number) => count ? Round(on / count * 100, 1) : null;
    return { overall: percent(this.on, this.total), alone: percent(this.samples.aloneOn, this.samples.alone), duringMath: percent(this.samples.mathOn, this.samples.math) };
  }
}

export function ScoreProblem(index: number, problem: Problem, chosen: number | null, rtMs: number | null, trackingPercent: number | null): DividedRow {
  return { problem: index, a: problem.a, b: problem.b, operation: operationCodes[problem.operation], answer: problem.answer,
    chosen, correct: chosen === problem.answer, rtMs: rtMs === null ? null : Math.round(rtMs), trackingPercent };
}

export function SummarizeDivided(rows: DividedRow[], tracking: TrackingPercentages, durationSec: number) {
  const answered = rows.filter(row => row.chosen !== null && row.rtMs !== null);
  const correct = rows.filter(row => row.correct).length;
  return {
    durationSec,
    trackingPercent: tracking.overall,
    trackingAlonePercent: tracking.alone,
    trackingDuringMathPercent: tracking.duringMath,
    trackingCostPercent: tracking.alone === null || tracking.duringMath === null ? null : Round(tracking.alone - tracking.duringMath, 1),
    problems: rows.length,
    correct,
    accuracyPercent: rows.length ? Round(correct / rows.length * 100, 1) : null,
    missed: rows.filter(row => row.chosen === null).length,
    meanRtMs: answered.length ? Math.round(answered.reduce((sum, row) => sum + row.rtMs!, 0) / answered.length) : null,
  };
}
