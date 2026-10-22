export interface GoNoGoRow { trial: number; practice: boolean; noGo: boolean; color: number; responded: boolean; rtMs: number | null }

export interface GoNoGoSummary {
  trials: number; scored: number; correct: number; accuracy: number | null; meanResponseMs: number | null;
  goTrials: number; noGoTrials: number; omissionErrors: number; commissionErrors: number; meanGoRtMs: number | null; goRtSdMs: number | null;
}

const Mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const Round = (value: number | null, digits = 0) => value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits;

export function IsCorrect(row: Pick<GoNoGoRow, 'noGo' | 'responded'>) { return row.noGo ? !row.responded : row.responded; }

// Practice squares are saved as rows but left out of the summary. The mean answer time keeps the
// original definition (every press, wrong presses included); the go times use correct presses only.
export function SummarizeGoNoGo(allRows: GoNoGoRow[]): GoNoGoSummary {
  const rows = allRows.filter(row => !row.practice);
  const goRts = rows.filter(row => !row.noGo && row.rtMs !== null).map(row => row.rtMs!);
  const mean = Mean(goRts);
  const sd = goRts.length > 1 && mean !== null ? Math.sqrt(goRts.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (goRts.length - 1)) : null;
  const correct = rows.filter(IsCorrect).length;
  return {
    trials: rows.length,
    scored: rows.length,
    correct,
    accuracy: rows.length ? Round(correct / rows.length * 100, 1) : null,
    meanResponseMs: Round(Mean(rows.filter(row => row.rtMs !== null).map(row => row.rtMs!))),
    goTrials: rows.filter(row => !row.noGo).length,
    noGoTrials: rows.filter(row => row.noGo).length,
    omissionErrors: rows.filter(row => !row.noGo && !row.responded).length,
    commissionErrors: rows.filter(row => row.noGo && row.responded).length,
    meanGoRtMs: Round(mean),
    goRtSdMs: Round(sd),
  };
}
