import { IsRecallCorrect } from './spatialSpanTrials';

export interface SpatialSpanRow { trial: number; practice: boolean; reverse: boolean; load: number; sequence: number[]; response: number[]; rtMs: number | null }
export interface SpatialSpanSummary {
  trials: number; scored: number; correct: number; accuracy: number | null; meanResponseMs: number | null;
  forwardSpan: number | null; reverseSpan: number | null; forwardAccuracy: number | null; reverseAccuracy: number | null;
}

const Percent = (part: number, whole: number) => whole ? Math.round(part / whole * 1000) / 10 : null;

export function IsCorrect(row: Pick<SpatialSpanRow, 'sequence' | 'response' | 'reverse'>) { return IsRecallCorrect(row.sequence, row.response, row.reverse); }

// Practice stays in the rows but not in the summary. A direction's span is its longest correctly recalled sequence.
export function SummarizeSpatialSpan(allRows: SpatialSpanRow[]): SpatialSpanSummary {
  const rows = allRows.filter(row => !row.practice);
  const times = rows.filter(row => row.rtMs !== null).map(row => row.rtMs!);
  const direction = (reverse: boolean) => {
    const items = rows.filter(row => row.reverse === reverse), correct = items.filter(IsCorrect);
    return { span: correct.length ? Math.max(...correct.map(row => row.load)) : null, accuracy: Percent(correct.length, items.length) };
  };
  const forward = direction(false), reverse = direction(true);
  return {
    trials: rows.length,
    scored: rows.length,
    correct: rows.filter(IsCorrect).length,
    accuracy: Percent(rows.filter(IsCorrect).length, rows.length),
    meanResponseMs: times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : null,
    forwardSpan: forward.span,
    reverseSpan: reverse.span,
    forwardAccuracy: forward.accuracy,
    reverseAccuracy: reverse.accuracy,
  };
}
