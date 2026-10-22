export interface PatternItem { cell: number; color: number; shape: number }
// change: 0 none, 1 colour, 2 shape, 3 position.
export interface PatternTrial { load: number; change: number; study: PatternItem[]; test: PatternItem[] }
export interface PatternRow { trial: number; load: number; change: number; saidChanged: boolean; correct: boolean; rtMs: number }

export const minLoad = 2, maxLoad = 8;

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
function Shuffle<T>(items: T[], random: () => number) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}
const range = (count: number) => Array.from({ length: count }, (_, index) => index);

// Every shape on a board has its own colour and shape pair, so a changed feature is never hidden by a twin.
export function CreatePatternTrial(load: number, random: () => number): PatternTrial {
  const cells = Shuffle(range(9), random).slice(0, load);
  const pairs = Shuffle(range(16), random).slice(0, load);
  const study = cells.map((cell, index) => ({ cell, color: pairs[index] % 4, shape: Math.floor(pairs[index] / 4) }));
  const test = study.map(item => ({ ...item }));
  if (random() < .5) return { load, change: 0, study, test };
  const used = new Set(study.map(item => item.color * 10 + item.shape));
  for (const change of Shuffle([1, 2, 3], random)) {
    for (const index of Shuffle(range(load), random)) {
      const item = test[index];
      const options = change === 3 ? range(9).filter(cell => !cells.includes(cell))
        : range(4).filter(value => change === 1 ? value !== item.color && !used.has(value * 10 + item.shape) : value !== item.shape && !used.has(item.color * 10 + value));
      if (!options.length) continue;
      const value = options[Math.floor(random() * options.length)];
      test[index] = change === 1 ? { ...item, color: value } : change === 2 ? { ...item, shape: value } : { ...item, cell: value };
      return { load, change, study, test };
    }
  }
  return { load, change: 0, study, test };
}

// Two right answers in a row add a shape; any miss removes one.
export class LoadStaircase {
  load: number;
  maxLoad: number;
  private streak = 0;
  constructor(start: number, private adaptive: boolean) { this.load = start; this.maxLoad = start; }
  record(correct: boolean) {
    if (!this.adaptive) return;
    if (!correct) { this.load = Math.max(minLoad, this.load - 1); this.streak = 0; return; }
    if (++this.streak < 2) return;
    this.streak = 0;
    this.load = Math.min(maxLoad, this.load + 1);
    this.maxLoad = Math.max(this.maxLoad, this.load);
  }
}

export function ScorePatternTrial(index: number, trial: PatternTrial, saidChanged: boolean, rtMs: number): PatternRow {
  return { trial: index, load: trial.load, change: trial.change, saidChanged, correct: saidChanged === (trial.change !== 0), rtMs: Math.round(rtMs) };
}

// Cowan's K uses the mean board size because the adaptive size moves between trials.
export function SummarizePattern(rows: PatternRow[]) {
  const changed = rows.filter(row => row.change !== 0), same = rows.filter(row => row.change === 0);
  const hitRate = changed.length ? changed.filter(row => row.saidChanged).length / changed.length : null;
  const falseAlarmRate = same.length ? same.filter(row => row.saidChanged).length / same.length : null;
  const meanLoad = rows.length ? rows.reduce((sum, row) => sum + row.load, 0) / rows.length : null;
  const correct = rows.filter(row => row.correct).length;
  return {
    trials: rows.length,
    correct,
    accuracyPercent: rows.length ? Round(correct / rows.length * 100, 1) : null,
    hitRatePercent: hitRate === null ? null : Round(hitRate * 100, 1),
    falseAlarmRatePercent: falseAlarmRate === null ? null : Round(falseAlarmRate * 100, 1),
    cowanK: hitRate === null || falseAlarmRate === null || meanLoad === null ? null : Round(meanLoad * (hitRate - falseAlarmRate), 1),
    maxLoad: rows.length ? Math.max(...rows.map(row => row.load)) : null,
    finalLoad: rows.at(-1)?.load ?? null,
    meanLoad: Round(meanLoad, 1),
    meanRtMs: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.rtMs, 0) / rows.length) : null,
  };
}
