import type { SimonRow } from './simonRun';

export interface SimonSummary {
  trials: number; correct: number; accuracyPercent: number | null; misses: number;
  congruentRtMs: number | null; incongruentRtMs: number | null; simonEffectMs: number | null;
  congruentAccuracyPercent: number | null; incongruentAccuracyPercent: number | null; meanRtMs: number | null; rtSdMs: number | null;
}

const Mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const Round = (value: number | null, digits = 0) => value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits;
const Percent = (part: number, whole: number) => whole ? Round(part / whole * 100, 1) : null;
const CorrectRts = (rows: SimonRow[]) => rows.filter(row => row.correct && row.rtMs !== null).map(row => row.rtMs!);

// Response times use correct answers only, the usual way the side effect is reported.
export function SummarizeSimon(rows: SimonRow[]): SimonSummary {
  const congruent = rows.filter(row => row.congruent);
  const incongruent = rows.filter(row => !row.congruent);
  const congruentRt = Mean(CorrectRts(congruent));
  const incongruentRt = Mean(CorrectRts(incongruent));
  const rts = CorrectRts(rows);
  const mean = Mean(rts);
  const sd = rts.length > 1 && mean !== null ? Math.sqrt(rts.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (rts.length - 1)) : null;
  const correct = rows.filter(row => row.correct).length;
  return {
    trials: rows.length,
    correct,
    accuracyPercent: Percent(correct, rows.length),
    misses: rows.filter(row => row.response === null).length,
    congruentRtMs: Round(congruentRt),
    incongruentRtMs: Round(incongruentRt),
    simonEffectMs: congruentRt !== null && incongruentRt !== null ? Round(incongruentRt - congruentRt) : null,
    congruentAccuracyPercent: Percent(congruent.filter(row => row.correct).length, congruent.length),
    incongruentAccuracyPercent: Percent(incongruent.filter(row => row.correct).length, incongruent.length),
    meanRtMs: Round(mean),
    rtSdMs: Round(sd),
  };
}
