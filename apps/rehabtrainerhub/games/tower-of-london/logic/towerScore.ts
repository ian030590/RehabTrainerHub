export interface TowerRow { trial: number; practice: boolean; problem: number | null; solved: boolean; moves: number; minimumMoves: number; problemMs: number; firstMoveMs: number | null }
export interface TowerSummary {
  trials: number; scored: number; correct: number; accuracy: number | null;
  perfect: number; extraMoves: number; meanSolveMs: number | null; planningMs: number | null; timeouts: number;
}

const Mean = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;

// Practice stays in the rows but not in the summary. Extra moves and solving time count solved problems only;
// planning time is the wait before the first ball is lifted.
export function SummarizeTower(allRows: TowerRow[]): TowerSummary {
  const rows = allRows.filter(row => !row.practice);
  const solved = rows.filter(row => row.solved);
  return {
    trials: rows.length,
    scored: rows.length,
    correct: solved.length,
    accuracy: rows.length ? Math.round(solved.length / rows.length * 1000) / 10 : null,
    perfect: solved.filter(row => row.moves === row.minimumMoves).length,
    extraMoves: solved.reduce((sum, row) => sum + row.moves - row.minimumMoves, 0),
    meanSolveMs: Mean(solved.map(row => row.problemMs)),
    planningMs: Mean(rows.filter(row => row.firstMoveMs !== null).map(row => row.firstMoveMs!)),
    timeouts: rows.length - solved.length,
  };
}
