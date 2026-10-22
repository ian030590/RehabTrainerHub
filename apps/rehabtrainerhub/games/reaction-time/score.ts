import { SummarizeReaction } from './logic/reactionScore';
import type { ReactionRow } from './logic/reactionTrials';

export function BuildGameScore(rows: ReactionRow[], durationSec: number) {
  const rounds = rows.map(row => ({ trial: row.trial, falseStart: Number(row.falseStart), responseMs: row.responseMs, earlyMs: row.earlyMs, waitMs: row.waitMs }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'reaction-time', summary: { ...SummarizeReaction(rows, durationSec) }, rounds };
}
