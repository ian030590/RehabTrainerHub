export const lags = [1, 2, 3, 4, 6, 8] as const;
export const streamLength = 20;
export const answerDigits = [2, 3, 4, 5, 6, 7, 8, 9];
// B, G, I, O, Q, S and Z are left out because they look like digits in a fast stream.
const letters = 'ACDEFHJKLMNPRTUVWXY'.split('');

export interface BlinkTrial { lag: number; t1: number; t2: number; t1Index: number; items: string[] }
export interface BlinkRow {
  trial: number; lag: number; t1Position: number; t1: number; t2: number;
  t1Response: number; t2Response: number; t1Correct: boolean; t2Correct: boolean;
}
export interface StreamClock { now(): number; set(callback: () => void, ms: number): number; clear(timer: number): void }
export interface StreamView { show(item: string, index: number): void; blank(): void }

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

// The first digit sits at positions 5 to 8, leaving at least four letters after the second digit at the longest lag.
export function CreateBlinkTrials(count: number, random: () => number): BlinkTrial[] {
  const plannedLags = Shuffle(Array.from({ length: count }, (_, index) => lags[index % lags.length]), random);
  return plannedLags.map(lag => {
    const [t1, t2] = Shuffle(answerDigits, random);
    const t1Index = 4 + Math.floor(random() * 4);
    const items: string[] = [];
    for (let index = 0; index < streamLength; index++) {
      if (index === t1Index) { items.push(String(t1)); continue; }
      if (index === t1Index + lag) { items.push(String(t2)); continue; }
      const choices = letters.filter(letter => letter !== items[index - 1]);
      items.push(choices[Math.floor(random() * choices.length)]);
    }
    return { lag, t1, t2, t1Index, items };
  });
}

// Every onset is scheduled from the stream start, so timer lateness does not build up across items.
export function PlayStream(items: string[], itemMs: number, view: StreamView, clock: StreamClock, onEnd: () => void) {
  const timers = new Set<number>();
  let stopped = false;
  const schedule = (callback: () => void, delay: number) => {
    const timer = clock.set(() => { timers.delete(timer); if (!stopped) callback(); }, delay);
    timers.add(timer);
  };
  items.forEach((item, index) => schedule(() => view.show(item, index), index * itemMs));
  schedule(() => { view.blank(); stopped = true; onEnd(); }, items.length * itemMs);
  return () => {
    stopped = true;
    for (const timer of timers) clock.clear(timer);
    timers.clear();
  };
}

export function ScoreBlinkTrial(trial: BlinkTrial, number: number, t1Response: number, t2Response: number): BlinkRow {
  return { trial: number, lag: trial.lag, t1Position: trial.t1Index + 1, t1: trial.t1, t2: trial.t2, t1Response, t2Response,
    t1Correct: t1Response === trial.t1, t2Correct: t2Response === trial.t2 };
}

const Percent = (part: number, whole: number) => whole ? Math.round(part / whole * 1000) / 10 : null;

// Second-digit accuracy counts only streams where the first digit was right, the usual measure of the blink.
export function SummarizeBlink(rows: BlinkRow[]) {
  const t1Right = rows.filter(row => row.t1Correct);
  const lagPercent = (lag: number) => {
    const subset = t1Right.filter(row => row.lag === lag);
    return Percent(subset.filter(row => row.t2Correct).length, subset.length);
  };
  const [lag1, lag2, lag3, lag4, lag6, lag8] = lags.map(lagPercent);
  const shortLags = [lag2, lag3, lag4].filter((value): value is number => value !== null);
  return {
    trials: rows.length,
    t1AccuracyPercent: Percent(t1Right.length, rows.length),
    t2GivenT1Percent: Percent(t1Right.filter(row => row.t2Correct).length, t1Right.length),
    lag1Percent: lag1, lag2Percent: lag2, lag3Percent: lag3, lag4Percent: lag4, lag6Percent: lag6, lag8Percent: lag8,
    blinkDepthPercent: lag8 !== null && shortLags.length ? Math.round((lag8 - Math.min(...shortLags)) * 10) / 10 : null,
  };
}
