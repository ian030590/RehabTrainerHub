import { IsCorrect, SummarizeSart } from './logic/sartScore';
import type { SartRow } from './logic/sartRun';

export function BuildGameScore(rows: SartRow[]) {
  const rounds = rows.map(row => ({ trial: row.trial, digit: row.digit, noGo: Number(row.noGo), responded: Number(row.responded),
    correct: Number(IsCorrect(row)), rtMs: row.rtMs }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'sart', summary: { ...SummarizeSart(rows) }, rounds };
}
