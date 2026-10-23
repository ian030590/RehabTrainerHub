import { RoundMs, SummarizeUfovSession, type UfovSession } from './logic/ufovSummary';

// Summary and round keys match the legacy score.json, so saved records stay comparable across versions.
export function BuildGameScore(session: UfovSession) {
  const totals = SummarizeUfovSession(session);
  return {
    summary: {
      trials: totals.trials,
      correct: totals.correct,
      thresholdMs: totals.thresholdMs,
      bestMs: totals.bestMs,
      invalidTiming: session.invalid_timing_attempt_count,
      timingAttempts: session.timing_attempts.length,
      aborted: session.aborted ? 1 : 0,
    },
    rounds: session.trials.map(trial => ({
      trial: trial.trialNumber,
      correct: trial.correct ? 1 : 0,
      subtest: trial.subtestId,
      axis: typeof trial.peripheralAxis === 'number' ? trial.peripheralAxis : null,
      exposureMs: RoundMs(trial.actualDurationMs),
      requestedMs: RoundMs(trial.plannedDurationMs),
      responseMs: Math.round(trial.responseTimeMs),
      syncValid: trial.syncValid ? 1 : 0,
      dropped: trial.droppedFrameCount,
      contrast: trial.contrastPercent,
      angle: trial.targetVisualAngleDeg,
    })),
  };
}
