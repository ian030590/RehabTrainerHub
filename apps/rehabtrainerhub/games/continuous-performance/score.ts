import { IsCorrect, SummarizeCpt } from './logic/cptScore';
import type { CptRow } from './logic/cptRun';

export function BuildGameScore(rows: CptRow[]) {
  const rounds = rows.map(row => ({ trial: row.trial, letterCode: row.letterCode, kind: row.kind, target: Number(row.target),
    responded: Number(row.responded), correct: Number(IsCorrect(row)), rtMs: row.rtMs }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'continuous-performance', summary: { ...SummarizeCpt(rows) }, rounds };
}
