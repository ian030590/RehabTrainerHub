export interface SearchRow {
  trial: number; block: number; setSize: number; present: number; targetSide: number | null; targetQuadrant: number | null;
  response: number | null; correct: number; rtMs: number | null; timeLimitMs: number;
}

function Round(value: number) { return Math.round(value * 10) / 10; }
function Mean(values: number[]): number | null { return values.length ? Round(values.reduce((a, b) => a + b, 0) / values.length) : null; }
function CorrectMean(rows: readonly SearchRow[]) { return Mean(rows.filter(row => row.correct === 1 && row.rtMs !== null).map(row => row.rtMs!)); }

export function BlockStatistics(rows: readonly SearchRow[]) {
  const accuracy = rows.length ? Round(rows.filter(row => row.correct === 1).length / rows.length * 100) : null;
  return { accuracy, passed: accuracy !== null && accuracy >= 85, presentRtMs: CorrectMean(rows.filter(row => row.present === 1)),
    absentRtMs: CorrectMean(rows.filter(row => row.present === 0)), timeouts: rows.filter(row => row.response === null).length };
}

export function SummarizeSearch(rows: readonly SearchRow[], globalLevel: number) {
  const blocks = [8, 16, 24].map(setSize => ({ setSize, ...BlockStatistics(rows.filter(row => row.setSize === setSize)) }));
  const blocksPassed = blocks.filter(block => block.passed).length;
  const points = blocks.filter(block => block.presentRtMs !== null);
  let slope: number | null = null;
  if (points.length >= 2) {
    const meanX = points.reduce((sum, point) => sum + point.setSize, 0) / points.length;
    const meanY = points.reduce((sum, point) => sum + point.presentRtMs!, 0) / points.length;
    slope = Round(points.reduce((sum, point) => sum + (point.setSize - meanX) * (point.presentRtMs! - meanY), 0)
      / points.reduce((sum, point) => sum + (point.setSize - meanX) ** 2, 0));
  }
  return { level: globalLevel, passed: Number(blocksPassed >= 2), blocksPassed,
    accuracy8: blocks[0].accuracy, accuracy16: blocks[1].accuracy, accuracy24: blocks[2].accuracy,
    accuracy: BlockStatistics(rows).accuracy, presentRtMs: CorrectMean(rows.filter(row => row.present === 1)),
    absentRtMs: CorrectMean(rows.filter(row => row.present === 0)), slopeMsPerItem: slope,
    leftRtMs: CorrectMean(rows.filter(row => row.present === 1 && row.targetSide === 0)),
    rightRtMs: CorrectMean(rows.filter(row => row.present === 1 && row.targetSide === 1)) };
}
