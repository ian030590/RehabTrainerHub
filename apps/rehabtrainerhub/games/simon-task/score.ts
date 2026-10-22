import { SummarizeSimon } from './logic/simonScore';
import type { SimonRow } from './logic/simonRun';

export function BuildGameScore(rows: SimonRow[]) {
  const rounds = rows.map(row => ({ trial: row.trial, shape: row.shape, side: row.side, congruent: Number(row.congruent),
    response: row.response, correct: Number(row.correct), rtMs: row.rtMs }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'simon-task', summary: { ...SummarizeSimon(rows) }, rounds };
}
