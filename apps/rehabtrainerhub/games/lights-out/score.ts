import { SummarizeLights, type LightsMatch } from './logic/lightsOut';

export function BuildGameScore(match: LightsMatch, durationMs: number) {
  const rounds = match.rows.map(row => ({ move: row.move, row: row.row, col: row.col, thinkMs: row.thinkMs, lightsOn: row.lightsOn }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'lights-out', summary: { ...SummarizeLights(match, durationMs) }, rounds };
}
