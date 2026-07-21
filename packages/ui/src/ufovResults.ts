export interface UfovStimulusDurationTrial {
  practice?: boolean;
  correct?: boolean;
  actualDurationMs?: unknown;
  durationMs?: unknown;
  plannedDurationMs?: unknown;
}

export interface UfovDirectionTrial {
  practice?: boolean;
  peripheralAxis?: unknown;
  peripheralResponse?: unknown;
}

export interface UfovDirectionAccuracy {
  axis: number;
  correct: number;
  total: number;
  accuracyPercent: number;
}

export interface UfovAdaptiveRunState {
  testTrial: number;
  reversals: readonly number[];
  refreshMs: number;
  limitStreak: number;
  failAtMaxStreak: number;
}

export const ufovAdaptiveStop = {
  minTestTrials: 12,
  maxTestTrials: 60,
  minStableReversals: 6,
  stableReversalWindow: 6,
  failAtMaxStreakLimit: 2,
  stableLimitStreak: 3,
} as const;

export function GetFastestCorrectStimulusDurationMs(
  trials: readonly UfovStimulusDurationTrial[],
  fallbackMs = 0,
): number {
  const durations = trials
    .filter((trial) => !trial.practice && trial.correct)
    .map((trial) => GetTrialDurationMs(trial))
    .filter((duration): duration is number => duration !== null && Number.isFinite(duration) && duration > 0);

  return durations.length > 0 ? Math.min(...durations) : fallbackMs;
}

export function GetUfovDirectionAccuracy(
  trials: readonly UfovDirectionTrial[],
  axes: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7],
): UfovDirectionAccuracy[] {
  const stats = new Map<number, { correct: number; total: number }>(
    axes.map((axis) => [axis, { correct: 0, total: 0 }]),
  );

  trials.forEach((trial) => {
    if (trial.practice) return;
    const axis = Number(trial.peripheralAxis);
    if (!Number.isInteger(axis) || !stats.has(axis)) return;

    const current = stats.get(axis)!;
    current.total += 1;
    if (Number(trial.peripheralResponse) === axis) {
      current.correct += 1;
    }
  });

  return axes.map((axis) => {
    const stat = stats.get(axis) ?? { correct: 0, total: 0 };
    return {
      axis,
      correct: stat.correct,
      total: stat.total,
      accuracyPercent: stat.total > 0 ? Math.round((stat.correct / stat.total) * 1000) / 10 : 0,
    };
  });
}

export function ShouldStopUfovAdaptiveRun(
  run: UfovAdaptiveRunState,
  maxTestTrials: number = ufovAdaptiveStop.maxTestTrials,
) {
  const trialLimit = NormalizePositiveInteger(maxTestTrials, ufovAdaptiveStop.maxTestTrials);
  return run.failAtMaxStreak >= ufovAdaptiveStop.failAtMaxStreakLimit
    || run.testTrial >= trialLimit
    || HasStableUfovThreshold(run)
    || (
      run.testTrial >= ufovAdaptiveStop.minTestTrials
      && run.limitStreak >= ufovAdaptiveStop.stableLimitStreak
    );
}

export function EstimateUfovThresholdMs(
  reversals: readonly number[],
  trials: readonly UfovStimulusDurationTrial[],
  fallbackMs: number,
) {
  if (reversals.length >= 4) {
    const recentReversals = reversals.slice(-ufovAdaptiveStop.stableReversalWindow);
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

function HasStableUfovThreshold(run: UfovAdaptiveRunState) {
  if (run.testTrial < ufovAdaptiveStop.minTestTrials) return false;
  if (run.reversals.length < ufovAdaptiveStop.minStableReversals) return false;

  const recentReversals = run.reversals.slice(-ufovAdaptiveStop.stableReversalWindow);
  const min = Math.min(...recentReversals);
  const max = Math.max(...recentReversals);
  const toleranceMs = Math.max(run.refreshMs * 3, 25);
  return max - min <= toleranceMs;
}

function NormalizePositiveInteger(value: number, fallback: number) {
  return Number.isFinite(value) ? Math.max(1, Math.round(value)) : fallback;
}

function GetTrialDurationMs(trial: UfovStimulusDurationTrial): number | null {
  const actual = Number(trial.actualDurationMs);
  if (Number.isFinite(actual) && actual > 0) return actual;

  const duration = Number(trial.durationMs);
  if (Number.isFinite(duration) && duration > 0) return duration;

  const planned = Number(trial.plannedDurationMs);
  return Number.isFinite(planned) && planned > 0 ? planned : null;
}
