import { SummarizeMaze, type MazeMatch } from './logic/maze';

export function BuildGameScore(match: MazeMatch, durationMs: number) {
  const rounds = match.rows.map(row => ({ move: row.move, row: row.row, col: row.col, thinkMs: row.thinkMs, invalidTaps: row.invalidTaps, distanceLeft: row.distanceLeft }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'maze', summary: { ...SummarizeMaze(match, durationMs) }, rounds };
}
