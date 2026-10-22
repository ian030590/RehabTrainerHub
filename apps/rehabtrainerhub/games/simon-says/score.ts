import { SummarizeSimon, type SimonMatch } from './logic/simonSays';

export function BuildGameScore(match: SimonMatch, durationMs: number) {
  const rounds = match.trials.map(trial => ({ trial: trial.trial, length: trial.length, correct: trial.correct, correctTaps: trial.correctTaps, recallMs: trial.recallMs }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'simon-says', summary: { ...SummarizeSimon(match, durationMs) }, rounds };
}
