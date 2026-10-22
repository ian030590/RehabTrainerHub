export interface KeepTrackRow { trial: number; practice: boolean; load: number; correctItems: number; requiredItems: number; rtMs: number }

const Percent = (part: number, whole: number) => whole ? Math.round(part / whole * 1000) / 10 : null;

// The practice block is saved as a row but left out of the summary. A block counts as correct only when every target is right.
export function SummarizeKeepTrack(allRows: KeepTrackRow[]) {
  const rows = allRows.filter(row => !row.practice);
  const correct = rows.filter(row => row.correctItems === row.requiredItems).length;
  const correctItems = rows.reduce((sum, row) => sum + row.correctItems, 0);
  const requiredItems = rows.reduce((sum, row) => sum + row.requiredItems, 0);
  return {
    trials: rows.length,
    scored: rows.length,
    correct,
    accuracy: Percent(correct, rows.length),
    meanResponseMs: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.rtMs, 0) / rows.length) : null,
    correctItems,
    requiredItems,
    itemAccuracy: Percent(correctItems, requiredItems),
  };
}
