import { SummarizeTiming, type TimingRow } from './logic/timing';

export function BuildGameScore(rows: TimingRow[], compareThresholdMs: number | null) {
  const rounds = rows.map(row => ({ trial: row.trial, task: row.task, targetMs: row.targetMs, comparisonMs: row.comparisonMs, answerMs: row.answerMs,
    errorMs: row.errorMs, correct: Number(row.correct) }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'time-perception', summary: { ...SummarizeTiming(rows, compareThresholdMs) }, rounds };
}
