export interface PlusMinusRow { trial: number; question: number; practice: boolean; condition: number; number: number; response: number | null; correct: boolean; rtMs: number }

const Mean = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;

// Copy practice is saved as rows but left out of the summary. Times include wrong answers, as the original list times did.
// The alternating cost compares the alternating list with the average of the two single-rule lists.
export function SummarizePlusMinus(allRows: PlusMinusRow[]) {
  const rows = allRows.filter(row => !row.practice);
  const correct = rows.filter(row => row.correct).length;
  const listMs = (condition: number) => Mean(rows.filter(row => row.condition === condition).map(row => row.rtMs));
  const addMs = listMs(0), subtractMs = listMs(1), alternateMs = listMs(2);
  return {
    trials: rows.length,
    scored: rows.length,
    correct,
    accuracy: rows.length ? Math.round(correct / rows.length * 1000) / 10 : null,
    meanResponseMs: Mean(rows.map(row => row.rtMs)),
    addMs,
    subtractMs,
    alternateMs,
    switchCostMs: addMs === null || subtractMs === null || alternateMs === null ? null : Math.round(alternateMs - (addMs + subtractMs) / 2),
  };
}
