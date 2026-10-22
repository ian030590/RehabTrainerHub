import { SummarizeMines, type MineField } from './logic/minesweeper';

export function BuildGameScore(field: MineField, durationMs: number) {
  const rounds = field.rows.map(row => ({ move: row.move, action: row.action, row: row.row, col: row.col, thinkMs: row.thinkMs, opened: row.opened, safeLeft: row.safeLeft }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'minesweeper', summary: { ...SummarizeMines(field, durationMs) }, rounds };
}
