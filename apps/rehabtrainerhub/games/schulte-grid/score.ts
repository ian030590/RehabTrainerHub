import { SummarizeSchulte, type SchulteRow } from './logic/schulteGrid';

export function BuildGameScore(rows: SchulteRow[], roundsPlanned: number) {
  const rounds = rows.map(row => ({ round: row.round, gridSize: row.gridSize, timeMs: row.timeMs, errors: row.errors, meanStepMs: row.meanStepMs }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'schulte-grid', summary: { ...SummarizeSchulte(rows, roundsPlanned) }, rounds };
}
