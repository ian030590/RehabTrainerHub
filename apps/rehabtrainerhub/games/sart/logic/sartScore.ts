import type { SartRow } from './sartRun';

export interface SartSummary {
  trials: number; noGoTrials: number; commissionErrors: number; omissionErrors: number;
  accuracyPercent: number | null; meanGoRtMs: number | null; goRtSdMs: number | null; rtCvPercent: number | null;
  preCommissionRtMs: number | null; preWithholdRtMs: number | null;
}

const Mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const Round = (value: number | null, digits = 0) => value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits;

export function IsCorrect(row: Pick<SartRow, 'noGo' | 'responded'>) { return row.noGo ? !row.responded : row.responded; }

// Mean press time over the four trials before each event; speeding up before a skip-digit
// press is the pattern this number is meant to show.
function PrecedingRt(rows: SartRow[], events: number[]) {
  const means = events.map(index => Mean(rows.slice(Math.max(0, index - 4), index)
    .filter(row => !row.noGo && row.rtMs !== null).map(row => row.rtMs!))).filter((value): value is number => value !== null);
  return Mean(means);
}

export function SummarizeSart(rows: SartRow[]): SartSummary {
  const goRts = rows.filter(row => !row.noGo && row.rtMs !== null).map(row => row.rtMs!);
  const mean = Mean(goRts);
  const sd = goRts.length > 1 && mean !== null ? Math.sqrt(goRts.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (goRts.length - 1)) : null;
  const indexes = (match: (row: SartRow) => boolean) => rows.flatMap((row, index) => match(row) ? [index] : []);
  return {
    trials: rows.length,
    noGoTrials: rows.filter(row => row.noGo).length,
    commissionErrors: rows.filter(row => row.noGo && row.responded).length,
    omissionErrors: rows.filter(row => !row.noGo && !row.responded).length,
    accuracyPercent: rows.length ? Round(rows.filter(IsCorrect).length / rows.length * 100, 1) : null,
    meanGoRtMs: Round(mean),
    goRtSdMs: Round(sd),
    rtCvPercent: sd !== null && mean ? Round(sd / mean * 100, 1) : null,
    preCommissionRtMs: Round(PrecedingRt(rows, indexes(row => row.noGo && row.responded))),
    preWithholdRtMs: Round(PrecedingRt(rows, indexes(row => row.noGo && !row.responded))),
  };
}
