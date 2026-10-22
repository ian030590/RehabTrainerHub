import type { Answer, NBackTrial } from './nBackTrials';

export interface NBackRow extends Omit<NBackTrial, 'practice'> { trial: number; practice: boolean; response: Answer | null; rtMs: number | null }
export interface NBackSummary {
  trials: number; scored: number; correct: number; accuracy: number | null; meanResponseMs: number | null; misses: number;
  hitRate: number | null; falseAlarmRate: number | null; load0Accuracy: number | null; load1Accuracy: number | null; load2Accuracy: number | null; load3Accuracy: number | null;
}

const Mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const Percent = (part: number, whole: number) => whole ? Math.round(part / whole * 1000) / 10 : null;

export function IsCorrect(row: Pick<NBackRow, 'match' | 'response'>) { return row.response === (row.match ? 'same' : 'different'); }

// Practice stays in the rows but not in the summary. Hit rate is "same" on match letters; false alarms are "same" on the others.
export function SummarizeNBack(allRows: NBackRow[]): NBackSummary {
  const rows = allRows.filter(row => !row.practice);
  const matches = rows.filter(row => row.match), others = rows.filter(row => !row.match);
  const loadAccuracy = (load: number) => { const items = rows.filter(row => row.load === load); return Percent(items.filter(IsCorrect).length, items.length); };
  const mean = Mean(rows.filter(row => row.rtMs !== null).map(row => row.rtMs!));
  return {
    trials: rows.length,
    scored: rows.length,
    correct: rows.filter(IsCorrect).length,
    accuracy: Percent(rows.filter(IsCorrect).length, rows.length),
    meanResponseMs: mean === null ? null : Math.round(mean),
    misses: rows.filter(row => row.response === null).length,
    hitRate: Percent(matches.filter(row => row.response === 'same').length, matches.length),
    falseAlarmRate: Percent(others.filter(row => row.response === 'same').length, others.length),
    load0Accuracy: loadAccuracy(0), load1Accuracy: loadAccuracy(1), load2Accuracy: loadAccuracy(2), load3Accuracy: loadAccuracy(3),
  };
}
