import type { Condition, Side } from './stopSignalTrials';

export interface StopSignalRow {
  trial: number; practice: boolean; shape: number; target: Side; response: Side | null; rtMs: number | null;
  stop: boolean; stopDelayMs: number | null; condition: Condition | null;
}
export interface StopSignalSummary {
  trials: number; scored: number; correct: number; accuracy: number | null; meanResponseMs: number | null; goTrials: number; stopTrials: number;
  omissionErrors: number; stopSuccessRate: number | null; meanGoRtMs: number | null; meanStopDelayMs: number | null; ssrtMs: number | null;
}
export type BlockTip = 'slow' | 'missed' | 'accuracy' | 'stop-more' | 'stop-less';

const Mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const Round = (value: number | null, digits = 0) => value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits;
function Median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function IsCorrect(row: Pick<StopSignalRow, 'stop' | 'response' | 'target'>) { return row.stop ? row.response === null : row.response === row.target; }

// Reminders follow the original block feedback: slow over 1000 ms, at least 10% missed, under 80% correct,
// and stopping outside 30% to 70% in this block or outside 45% to 55% on average across blocks.
export function BlockFeedback(rows: StopSignalRow[], earlierStopRates: number[]) {
  const go = rows.filter(row => !row.stop), stops = rows.filter(row => row.stop);
  const responded = go.filter(row => row.response !== null);
  const median = Median(responded.map(row => row.rtMs!));
  const goAccuracy = go.length ? go.filter(IsCorrect).length / go.length : null;
  const missed = go.length ? (go.length - responded.length) / go.length : 0;
  const stopRate = stops.length ? stops.filter(IsCorrect).length / stops.length : null;
  const tips: BlockTip[] = [];
  if (median !== null && median > 1000) tips.push('slow');
  if (missed >= .1) tips.push('missed');
  if (goAccuracy !== null && goAccuracy < .8) tips.push('accuracy');
  if (stopRate !== null) {
    const average = Mean([...earlierStopRates.map(rate => rate / 100), stopRate])!;
    if (stopRate < .3 || average < .45) tips.push('stop-more');
    else if (stopRate > .7 || average > .55) tips.push('stop-less');
  }
  return { medianGoRtMs: Round(median), goAccuracy: Round(goAccuracy === null ? null : goAccuracy * 100, 1), stopSuccess: Round(stopRate === null ? null : stopRate * 100, 1), tips };
}

// Integration method: go times sorted with missed presses set to the slowest time, then the time at the
// share of stop items that got a press, minus the mean stop delay. No estimate when that share is 0 or 1.
function Ssrt(go: StopSignalRow[], stops: StopSignalRow[]) {
  const times = go.filter(row => row.rtMs !== null).map(row => row.rtMs!);
  if (!times.length || !stops.length) return null;
  const slowest = Math.max(...times);
  const filled = go.map(row => row.rtMs ?? slowest).sort((a, b) => a - b);
  const pressed = stops.filter(row => row.response !== null).length / stops.length;
  if (pressed === 0 || pressed === 1) return null;
  const nth = Math.min(filled.length, Math.max(1, Math.ceil(pressed * filled.length)));
  return filled[nth - 1] - Mean(stops.map(row => row.stopDelayMs ?? 0))!;
}

// Practice items stay in the rows but not in the summary. The mean answer time keeps the original
// definition (every press, errors included); the go mean uses correct presses only.
export function SummarizeStopSignal(allRows: StopSignalRow[]): StopSignalSummary {
  const rows = allRows.filter(row => !row.practice);
  const go = rows.filter(row => !row.stop), stops = rows.filter(row => row.stop);
  const correct = rows.filter(IsCorrect).length;
  return {
    trials: rows.length,
    scored: rows.length,
    correct,
    accuracy: rows.length ? Round(correct / rows.length * 100, 1) : null,
    meanResponseMs: Round(Mean(rows.filter(row => row.rtMs !== null).map(row => row.rtMs!))),
    goTrials: go.length,
    stopTrials: stops.length,
    omissionErrors: go.filter(row => row.response === null).length,
    stopSuccessRate: stops.length ? Round(stops.filter(IsCorrect).length / stops.length * 100, 1) : null,
    meanGoRtMs: Round(Mean(go.filter(row => IsCorrect(row) && row.rtMs !== null).map(row => row.rtMs!))),
    meanStopDelayMs: Round(Mean(stops.map(row => row.stopDelayMs ?? 0))),
    ssrtMs: Round(Ssrt(go, stops)),
  };
}
