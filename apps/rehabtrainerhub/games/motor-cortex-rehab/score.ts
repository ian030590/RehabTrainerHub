import type { SessionRecord } from './types';

const numeric = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
export function BuildGameScore(result: SessionRecord) {
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'motor-cortex-rehab', summary: {
    duration: numeric(result.Duration_Seconds), reps: numeric(result.Successful_Reps), interrupted: numeric(result.Interrupted_Holds),
    timeInTarget: numeric(result.Accuracy_Percent), tracking: numeric(result.Hand_Visible_Percent), bestHold: numeric(result.Best_Hold_Seconds), level: numeric(result.Adaptive_Level),
  }, rounds: result.Event_Records.map(event => ({
    event: numeric(event.Event_Number), outcome: event.Result === 'success' ? 1 : 0,
    atSeconds: numeric(event.Time_Seconds), holdSeconds: numeric(event.Hold_Seconds),
    targetSize: numeric(event.Target_Size_Px), level: numeric(event.Adaptive_Level), accuracy: numeric(event.Accuracy_Percent),
  })) };
}
