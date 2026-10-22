import type { AntTrial, Side } from './antTrials';

export interface AntRow extends Omit<AntTrial, 'practice'> { trial: number; practice: boolean; response: Side | null; rtMs: number | null }
export interface AntSummary {
  trials: number; scored: number; correct: number; accuracy: number | null; meanResponseMs: number | null; misses: number;
  meanCorrectRtMs: number | null; alertingMs: number | null; orientingMs: number | null; conflictMs: number | null;
}

const Mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const Round = (value: number | null, digits = 0) => value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits;
const Difference = (a: number | null, b: number | null) => a === null || b === null ? null : a - b;

export function IsCorrect(row: Pick<AntRow, 'response' | 'target'>) { return row.response === row.target; }

// Practice stays in the rows but not in the summary. The mean answer time keeps the original definition (errors included).
// Alerting is no cue minus double cue, orienting is centre cue minus spatial cue, and conflict is incongruent minus
// congruent flankers, each from the mean time of correct answers.
export function SummarizeAnt(allRows: AntRow[]): AntSummary {
  const rows = allRows.filter(row => !row.practice);
  const correctRows = rows.filter(row => IsCorrect(row) && row.rtMs !== null);
  const meanWhere = (test: (row: AntRow) => boolean) => Mean(correctRows.filter(test).map(row => row.rtMs!));
  return {
    trials: rows.length,
    scored: rows.length,
    correct: rows.filter(IsCorrect).length,
    accuracy: rows.length ? Round(rows.filter(IsCorrect).length / rows.length * 100, 1) : null,
    meanResponseMs: Round(Mean(rows.filter(row => row.rtMs !== null).map(row => row.rtMs!))),
    misses: rows.filter(row => row.response === null).length,
    meanCorrectRtMs: Round(Mean(correctRows.map(row => row.rtMs!))),
    alertingMs: Round(Difference(meanWhere(row => row.cue === 'nocue'), meanWhere(row => row.cue === 'double'))),
    orientingMs: Round(Difference(meanWhere(row => row.cue === 'center'), meanWhere(row => row.cue === 'spatial'))),
    conflictMs: Round(Difference(meanWhere(row => row.condition === 'incongruent'), meanWhere(row => row.condition === 'congruent'))),
  };
}
