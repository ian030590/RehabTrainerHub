import { SummarizeTicTacToe, type TicTacToeMatch } from './logic/ticTacToe';

export function BuildGameScore(match: TicTacToeMatch, durationMs: number) {
  const rounds = match.rows.map(row => ({ move: row.move, row: row.row, col: row.col, thinkMs: row.thinkMs, invalidTaps: row.invalidTaps }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'tic-tac-toe', summary: { ...SummarizeTicTacToe(match, durationMs) }, rounds };
}
