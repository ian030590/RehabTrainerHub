import { CorrectAnswer, type Answer, type NumberLetterTrial } from './numberLetterTrials';

export interface NumberLetterRow extends Omit<NumberLetterTrial, 'practice'> { trial: number; practice: boolean; response: Answer | null; rtMs: number | null }
export interface NumberLetterSummary {
  trials: number; scored: number; correct: number; accuracy: number | null; meanResponseMs: number | null; misses: number;
  singleAccuracy: number | null; mixedAccuracy: number | null; singleMeanMs: number | null; switchMeanMs: number | null; repeatMeanMs: number | null; switchCostMs: number | null;
}

const Mean = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
const Percent = (part: number, whole: number) => whole ? Math.round(part / whole * 1000) / 10 : null;

export function IsCorrect(row: Pick<NumberLetterRow, 'letter' | 'number' | 'position' | 'response'>) { return row.response === CorrectAnswer(row); }

// Practice stays in the rows but not in the summary. The mean answer time counts every answer, as in the original;
// the single, switch and repeat means use correct answers only. The first turning item is neither a switch nor a repeat.
export function SummarizeNumberLetter(allRows: NumberLetterRow[]): NumberLetterSummary {
  const rows = allRows.filter(row => !row.practice);
  const single = rows.filter(row => row.condition !== 2), mixed = rows.filter(row => row.condition === 2);
  const correctTimes = (items: NumberLetterRow[]) => Mean(items.filter(row => IsCorrect(row) && row.rtMs !== null).map(row => row.rtMs!));
  const switchMeanMs = correctTimes(mixed.filter(row => row.switched === true));
  const repeatMeanMs = correctTimes(mixed.filter(row => row.switched === false));
  return {
    trials: rows.length,
    scored: rows.length,
    correct: rows.filter(IsCorrect).length,
    accuracy: Percent(rows.filter(IsCorrect).length, rows.length),
    meanResponseMs: Mean(rows.filter(row => row.rtMs !== null).map(row => row.rtMs!)),
    misses: rows.filter(row => row.response === null).length,
    singleAccuracy: Percent(single.filter(IsCorrect).length, single.length),
    mixedAccuracy: Percent(mixed.filter(IsCorrect).length, mixed.length),
    singleMeanMs: correctTimes(single),
    switchMeanMs,
    repeatMeanMs,
    switchCostMs: switchMeanMs === null || repeatMeanMs === null ? null : switchMeanMs - repeatMeanMs,
  };
}
