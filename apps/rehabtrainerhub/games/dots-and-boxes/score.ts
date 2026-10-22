import { SummarizeDots, type DotsMatch } from './logic/dotsAndBoxes';

export function BuildGameScore(match: DotsMatch, durationMs: number) {
  const rounds = match.rows.map(row => ({ move: row.move, thinkMs: row.thinkMs, invalidTaps: row.invalidTaps, boxes: row.boxes }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'dots-and-boxes', summary: { ...SummarizeDots(match, durationMs) }, rounds };
}
