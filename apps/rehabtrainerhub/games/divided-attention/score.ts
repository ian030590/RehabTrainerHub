import { SummarizeDivided, type DividedRow, type TrackingPercentages } from './logic/divided';

export function BuildGameScore(rows: DividedRow[], tracking: TrackingPercentages, durationSec: number) {
  const rounds = rows.map(row => ({ problem: row.problem, a: row.a, b: row.b, operation: row.operation, answer: row.answer,
    chosen: row.chosen, correct: Number(row.correct), rtMs: row.rtMs, trackingPercent: row.trackingPercent }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'divided-attention', summary: { ...SummarizeDivided(rows, tracking, durationSec) }, rounds };
}
