import type { SessionSummary } from './logic/tongueCatch';
import type { PlayConfig } from './settings';

// Summary and round keys match the original score.json, so earlier records still line up; catchRate is new.
export function BuildGameScore(summary: SessionSummary, config: PlayConfig) {
  const finished = summary.score + summary.missed;
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'tongue-catch', summary: {
    duration: summary.durationSeconds, caught: summary.score, missed: summary.missed, holdSeconds: summary.averageHoldSeconds,
    threshold: config.sensitivity, catchRate: finished ? Math.round(summary.score / finished * 100) : null,
  }, rounds: summary.apples.map((apple, index) => ({ object: index + 1, caught: apple.caught ? 1 : 0, position: apple.horizontalPositionPercent })) };
}
