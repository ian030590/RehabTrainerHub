// side: 0 left, 1 right. arrow and response: 0 left, 1 up, 2 right.
export interface AntisaccadeRow { trial: number; practice: boolean; side: number; arrow: number; response: number | null; correct: boolean; rtMs: number | null }

const Mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const Round = (value: number | null) => value === null ? null : Math.round(value);

// Practice items are saved as rows but left out of the summary. The mean answer time keeps the original
// definition (every answered item, errors included); the correct-answer time uses correct answers only.
export function SummarizeAntisaccade(allRows: AntisaccadeRow[]) {
  const rows = allRows.filter(row => !row.practice);
  const correct = rows.filter(row => row.correct).length;
  return {
    trials: rows.length,
    scored: rows.length,
    correct,
    accuracy: rows.length ? Math.round(correct / rows.length * 1000) / 10 : null,
    meanResponseMs: Round(Mean(rows.filter(row => row.rtMs !== null).map(row => row.rtMs!))),
    correctResponseMs: Round(Mean(rows.filter(row => row.correct && row.rtMs !== null).map(row => row.rtMs!))),
    wrong: rows.filter(row => row.response !== null && !row.correct).length,
    misses: rows.filter(row => row.response === null).length,
  };
}
