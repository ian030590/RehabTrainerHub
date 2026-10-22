import { SummarizeHex, type HexRow } from './logic/hexBoard';

export function BuildGameScore(rows: HexRow[], roundsPlanned: number) {
  const rounds = rows.map(row => ({ round: row.round, rings: row.rings, timeMs: row.timeMs, errors: row.errors,
    centerChecks: row.centerChecks, centerHits: row.centerHits, centerMissed: row.centerMissed }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'hex-schulte', summary: { ...SummarizeHex(rows, roundsPlanned) }, rounds };
}
