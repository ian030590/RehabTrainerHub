import { SummarizeSliding, type SlidingMatch } from './logic/slidingPuzzle';

export function BuildGameScore(match: SlidingMatch, durationMs: number) {
  const rounds = match.rows.map(row => ({ move: row.move, tile: row.tile, thinkMs: row.thinkMs, invalidTaps: row.invalidTaps, misplaced: row.misplaced }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'sliding-puzzle', summary: { ...SummarizeSliding(match, durationMs) }, rounds };
}
