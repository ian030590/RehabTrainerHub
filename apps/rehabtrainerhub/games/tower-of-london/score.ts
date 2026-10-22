import { SummarizeTower, type TowerRow } from './logic/towerScore';

export function BuildGameScore(rows: TowerRow[], settings: { problemLimitMs: number }) {
  const rounds = rows.map(row => ({ trial: row.trial, practice: Number(row.practice), problem: row.problem, correct: Number(row.solved), problemMs: row.problemMs,
    moves: row.moves, minimumMoves: row.minimumMoves, firstMoveMs: row.firstMoveMs, setting: settings.problemLimitMs }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'tower-of-london', summary: { ...SummarizeTower(rows) }, rounds };
}
