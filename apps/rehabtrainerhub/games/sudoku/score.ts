import { SummarizeNumberGrid, type NumberGridMatch } from './logic/numberGrid';

export function BuildGameScore(match: NumberGridMatch, durationMs: number) {
  const rounds = match.rows.map(row => ({ move: row.move, row: row.row, col: row.col, value: row.value, thinkMs: row.thinkMs, blanksLeft: row.blanksLeft }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'sudoku', summary: { ...SummarizeNumberGrid(match, durationMs) }, rounds };
}
