export interface DrivingTrial {
  trial_type?: string;
  response?: string;
  driving_events?: Record<string, unknown>[];
  [key: string]: unknown;
}
const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const flag = (value: unknown) => typeof value === 'boolean' ? Number(value) : null;

export function BuildGameScore(results: DrivingTrial[]) {
  const result = results.find(row => row.trial_type === 'three-driving-rehab');
  return {
    schema: 'rehab-trainer.game-score/v1', gameId: 'driving-rehab',
    summary: {
      durationMs: numeric(result?.duration_ms), meanRt: numeric(result?.average_rt), medianRt: numeric(result?.median_rt),
      events: numeric(result?.valid_event_count), responses: numeric(result?.reaction_event_count),
      collisions: numeric(result?.collisions), deviations: numeric(result?.lane_deviations), fps: numeric(result?.average_fps),
      avoided: numeric(result?.successful_avoidance_count), rounds: numeric(result?.event_count),
    },
    rounds: (result?.driving_events ?? []).map(event => ({
      rt: numeric(event.rt_ms), avoided: flag(event.avoidance_success), responded: flag(event.valid),
      collision: flag(event.collision), distance: numeric(event.distance_m), otherCollision: flag(event.other_vehicle_collision),
    })),
  };
}
