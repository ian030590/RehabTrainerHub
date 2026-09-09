export interface PeripheralAttentionStimulusDurationTrial {
  practice?: boolean;
  correct?: boolean;
  actualDurationMs?: unknown;
  durationMs?: unknown;
  plannedDurationMs?: unknown;
}

export interface PeripheralAttentionAdaptiveRunState {
  testTrial: number;
  reversals: readonly number[];
  refreshMs: number;
  limitStreak: number;
  failAtMaxStreak: number;
}

export const peripheralAttentionAdaptiveStop = {
  minTestTrials: 12,
  maxTestTrials: 60,
  minStableReversals: 6,
  stableReversalWindow: 6,
  failAtMaxStreakLimit: 2,
  stableLimitStreak: 3,
} as const;

export function GetFastestCorrectStimulusDurationMs(
  trials: readonly PeripheralAttentionStimulusDurationTrial[],
  fallbackMs = 0,
): number {
  const durations = trials
    .filter((trial) => !trial.practice && trial.correct)
    .map((trial) => GetTrialDurationMs(trial))
    .filter((duration): duration is number => duration !== null && Number.isFinite(duration) && duration > 0);

  return durations.length > 0 ? Math.min(...durations) : fallbackMs;
}

export function ShouldStopPeripheralAttentionAdaptiveRun(
  run: PeripheralAttentionAdaptiveRunState,
  maxTestTrials: number = peripheralAttentionAdaptiveStop.maxTestTrials,
) {
  const trialLimit = NormalizePositiveInteger(maxTestTrials, peripheralAttentionAdaptiveStop.maxTestTrials);
  return run.failAtMaxStreak >= peripheralAttentionAdaptiveStop.failAtMaxStreakLimit
    || run.testTrial >= trialLimit
    || HasStablePeripheralAttentionThreshold(run)
    || (
      run.testTrial >= peripheralAttentionAdaptiveStop.minTestTrials
      && run.limitStreak >= peripheralAttentionAdaptiveStop.stableLimitStreak
    );
}

export function EstimatePeripheralAttentionThresholdMs(
  run: PeripheralAttentionAdaptiveRunState,
  trials: readonly PeripheralAttentionStimulusDurationTrial[],
  fallbackMs: number,
) {
  if (run.limitStreak >= peripheralAttentionAdaptiveStop.stableLimitStreak) {
    const formalDurations = trials
      .filter((trial) => !trial.practice && trial.correct)
      .map((trial) => GetTrialDurationMs(trial))
      .filter((duration): duration is number => duration !== null && Number.isFinite(duration) && duration > 0);
    return formalDurations.length > 0 ? Math.min(...formalDurations) : fallbackMs;
  }

  if (run.reversals.length >= 4) {
    const recentReversals = run.reversals.slice(-peripheralAttentionAdaptiveStop.stableReversalWindow);
    return recentReversals.reduce((sum, value) => sum + value, 0) / recentReversals.length;
  }

  const formalDurations = trials
    .filter((trial) => !trial.practice)
    .map((trial) => GetTrialDurationMs(trial))
    .filter((duration): duration is number => duration !== null && Number.isFinite(duration) && duration > 0)
    .slice(-8);
  if (formalDurations.length === 0) return fallbackMs;
  return formalDurations.reduce((sum, value) => sum + value, 0) / formalDurations.length;
}

function HasStablePeripheralAttentionThreshold(run: PeripheralAttentionAdaptiveRunState) {
  if (run.testTrial < peripheralAttentionAdaptiveStop.minTestTrials) return false;
  if (run.reversals.length < peripheralAttentionAdaptiveStop.minStableReversals) return false;

  const recentReversals = run.reversals.slice(-peripheralAttentionAdaptiveStop.stableReversalWindow);
  const min = Math.min(...recentReversals);
  const max = Math.max(...recentReversals);
  const toleranceMs = Math.max(run.refreshMs * 3, 25);
  return max - min <= toleranceMs;
}

function NormalizePositiveInteger(value: number, fallback: number) {
  return Number.isFinite(value) ? Math.max(1, Math.round(value)) : fallback;
}

function GetTrialDurationMs(trial: PeripheralAttentionStimulusDurationTrial): number | null {
  const actual = Number(trial.actualDurationMs);
  if (Number.isFinite(actual) && actual > 0) return actual;

  const duration = Number(trial.durationMs);
  if (Number.isFinite(duration) && duration > 0) return duration;

  const planned = Number(trial.plannedDurationMs);
  return Number.isFinite(planned) && planned > 0 ? planned : null;
}
