import { SummarizePattern, type PatternRow } from './logic/patterns';

export function BuildGameScore(rows: PatternRow[]) {
  const rounds = rows.map(row => ({ trial: row.trial, load: row.load, change: row.change, saidChanged: Number(row.saidChanged), correct: Number(row.correct), rtMs: row.rtMs }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'pattern-memory', summary: { ...SummarizePattern(rows) }, rounds };
}
