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

export function getFastestCorrectStimulusDurationMs(
  trials: readonly UfovStimulusDurationTrial[],
  fallbackMs = 0,
): number {
  const durations = trials
    .filter((trial) => !trial.practice && trial.correct)
    .map((trial) => getTrialDurationMs(trial))
    .filter((duration): duration is number => duration !== null && Number.isFinite(duration) && duration > 0);

  return durations.length > 0 ? Math.min(...durations) : fallbackMs;
}

export function getUfovDirectionAccuracy(
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

function getTrialDurationMs(trial: UfovStimulusDurationTrial): number | null {
  const actual = Number(trial.actualDurationMs);
  if (Number.isFinite(actual) && actual > 0) return actual;

  const duration = Number(trial.durationMs);
  if (Number.isFinite(duration) && duration > 0) return duration;

  const planned = Number(trial.plannedDurationMs);
  return Number.isFinite(planned) && planned > 0 ? planned : null;
}
