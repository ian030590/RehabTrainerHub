import { SummarizeWhack, type WhackMatch } from './logic/whackAMole';

export function BuildGameScore(match: WhackMatch, durationMs: number) {
  const rounds = match.rows.map(row => ({ trial: row.trial, outcome: row.outcome, responseMs: row.responseMs, targetIndex: row.targetIndex, tappedIndex: row.tappedIndex }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'whack-a-mole', summary: { ...SummarizeWhack(match, durationMs) }, rounds };
}
