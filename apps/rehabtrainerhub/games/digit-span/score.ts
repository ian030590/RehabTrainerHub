import { IsCorrect, SummarizeDigitSpan, type DigitSpanRow } from './logic/digitSpanScore';

export function BuildGameScore(rows: DigitSpanRow[], settings: { itemExposureMs: number }) {
  const rounds = rows.map(row => ({ trial: row.trial, practice: Number(row.practice), reverse: Number(row.reverse), load: row.load, entered: row.response.length,
    correct: Number(IsCorrect(row)), responseMs: row.rtMs, setting: settings.itemExposureMs }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'digit-span', summary: { ...SummarizeDigitSpan(rows) }, rounds };
}
