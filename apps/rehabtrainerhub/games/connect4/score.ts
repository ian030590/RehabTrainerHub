import { SummarizeConnect4, type Connect4Match } from './logic/connect4';

export function BuildGameScore(match: Connect4Match, durationMs: number) {
  const rounds = match.rows.map(row => ({ move: row.move, col: row.col, height: row.height, thinkMs: row.thinkMs, invalidTaps: row.invalidTaps }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'connect4', summary: { ...SummarizeConnect4(match, durationMs) }, rounds };
}
