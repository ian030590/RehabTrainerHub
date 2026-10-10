export interface MovingCardTrial {
  trial_type?: string;
  correct?: boolean;
  rt?: number | null;
  attempts?: number;
  wrong_attempts?: number;
  target?: string;
  response?: string;
}

export function BuildGameScore(results: MovingCardTrial[]) {
  const trials = results.filter(row => row.trial_type === 'pixi-moving-card');
  const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'moving-card',
    summary: { trials: trials.length, completed: trials.filter(row => row.correct === true).length },
    rounds: trials.map(row => ({ completed: row.correct === true ? 1 : 0,
      searchMs: numeric(row.rt), attempts: numeric(row.attempts), errors: numeric(row.wrong_attempts) })) };
}
