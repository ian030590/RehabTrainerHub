import { SummarizeHex, type HexMatch } from './logic/hex';

export function BuildGameScore(match: HexMatch, durationMs: number) {
  const rounds = match.rows.map(row => ({ move: row.move, row: row.row, col: row.col, thinkMs: row.thinkMs, invalidTaps: row.invalidTaps }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'hex', summary: { ...SummarizeHex(match, durationMs) }, rounds };
}
