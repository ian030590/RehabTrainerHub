import type { FlightSummary } from './logic/flight';
import type { PlayConfig } from './settings';

// One row per ring: side 0 is left and 1 is right; offset is the distance from the ring centre in percent of its radius.
export function BuildGameScore(summary: FlightSummary, config: PlayConfig) {
  const total = summary.passed + summary.missed;
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'seagull-flight', summary: {
    duration: summary.durationSeconds, passed: summary.passed, missed: summary.missed,
    passRate: total ? Math.round(summary.passed / total * 100) : null, flaps: summary.flaps, crashed: summary.crashed,
    maxTurnDeg: summary.maxTurnDeg, maxNodDeg: summary.maxNodDeg, turnRangeDeg: config.turnRangeDeg, nodRangeDeg: config.nodRangeDeg,
  }, rounds: summary.rounds.map(ring => ({
    ring: ring.index + 1, passed: ring.passed ? 1 : 0, side: ring.side < 0 ? 0 : 1, headAngle: ring.headAngle,
    offset: Math.round(ring.offset * 100), altitude: Math.round(ring.altitude * 100),
  })) };
}
