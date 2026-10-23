import type { SessionSummary } from './logic/everyBallResponse';

// Saved rounds hold numbers only, so each name is stored as its position in these lists.
export const ballCodes = ['basketball', 'soccer', 'tennis', 'beach'] as const;
export const actionCodes = ['none', 'clap', 'thigh'] as const;
export const outcomeCodes = ['hit', 'correct_reject', 'miss', 'false_alarm', 'wrong_action'] as const;
export const sourceCodes = ['', 'camera', 'microphone', 'keyboard', 'touch'] as const;
const code = (list: readonly string[], value: string) => Math.max(0, list.indexOf(value));

// Summary and the first five round keys match the original score.json, so earlier records still line up.
export function BuildGameScore(summary: SessionSummary) {
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'every-ball-response', summary: {
    trials: summary.total, correct: summary.correct, accuracy: summary.accuracy, misses: summary.misses,
    falseAlarms: summary.falseAlarms, wrongActions: summary.wrongActions, responseMs: summary.averageRtMs,
  }, rounds: summary.trials.map(trial => ({
    trial: trial.Trial_Number, level: trial.Level, correct: trial.Correct ? 1 : 0, responseMs: trial.Reaction_Time_ms, fixationMs: trial.Fixation_ms,
    ball: code(ballCodes, trial.Ball), expected: code(actionCodes, trial.Expected_Action), response: code(actionCodes, trial.Response_Action || 'none'),
    outcome: code(outcomeCodes, trial.Outcome), source: code(sourceCodes, trial.Response_Source),
  })) };
}
