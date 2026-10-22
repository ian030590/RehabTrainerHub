export interface StroopRow { trial: number; practice: boolean; congruent: boolean; word: number; ink: number; response: number | null; correct: boolean; rtMs: number | null }

export interface StroopSummary {
  trials: number; scored: number; correct: number; accuracy: number | null; meanResponseMs: number | null;
  congruentRtMs: number | null; incongruentRtMs: number | null; interferenceMs: number | null;
  congruentAccuracy: number | null; incongruentAccuracy: number | null; misses: number;
}

const Mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const Round = (value: number | null, digits = 0) => value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits;
const Percent = (part: number, whole: number) => whole ? Round(part / whole * 100, 1) : null;
const CorrectRts = (rows: StroopRow[]) => rows.filter(row => row.correct && row.rtMs !== null).map(row => row.rtMs!);

// Practice items are saved as rows but left out of the summary. The mean answer time keeps the
// original definition (every answered item, errors included); the condition times use correct answers.
export function SummarizeStroop(allRows: StroopRow[]): StroopSummary {
  const rows = allRows.filter(row => !row.practice);
  const congruent = rows.filter(row => row.congruent);
  const incongruent = rows.filter(row => !row.congruent);
  const congruentRt = Mean(CorrectRts(congruent));
  const incongruentRt = Mean(CorrectRts(incongruent));
  const correct = rows.filter(row => row.correct).length;
  return {
    trials: rows.length,
    scored: rows.length,
    correct,
    accuracy: Percent(correct, rows.length),
    meanResponseMs: Round(Mean(rows.filter(row => row.rtMs !== null).map(row => row.rtMs!))),
    congruentRtMs: Round(congruentRt),
    incongruentRtMs: Round(incongruentRt),
    interferenceMs: congruentRt !== null && incongruentRt !== null ? Round(incongruentRt - congruentRt) : null,
    congruentAccuracy: Percent(congruent.filter(row => row.correct).length, congruent.length),
    incongruentAccuracy: Percent(incongruent.filter(row => row.correct).length, incongruent.length),
    misses: rows.filter(row => row.response === null).length,
  };
}
