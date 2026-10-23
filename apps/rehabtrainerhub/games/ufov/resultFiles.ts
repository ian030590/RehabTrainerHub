import { RoundMs, SummarizeUfovSession, ufovTrialColumns, type UfovSession, type UfovTrial } from './logic/ufovSummary';

export interface ResultFile { fileName: string; text: string }

// The container keeps at most 5000 points per trial and 4 MiB per file, so long mouse paths are thinned evenly.
const trajectoryPointBudget = 150_000;

function Cell(value: number | string | boolean | null | undefined) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'string') return value;
  return Number.isFinite(value) ? String(RoundMs(value)) : '';
}

function TrialFields(trial: UfovTrial) {
  const hasTarget = typeof trial.peripheralAxis === 'number';
  return {
    trial: trial.trialNumber,
    practice: trial.practice,
    activity: trial.subtestId,
    planned_ms: RoundMs(trial.plannedDurationMs),
    exposure_ms: RoundMs(trial.actualDurationMs),
    frames: trial.actualFrameCount,
    dropped_frames: trial.droppedFrameCount,
    refresh_hz: RoundMs(trial.refreshHz),
    sync_valid: trial.syncValid,
    contrast_percent: trial.contrastPercent,
    vehicle_angle_deg: trial.vehicleVisualAngleDeg,
    target_angle_deg: trial.targetVisualAngleDeg,
    central_target: trial.centralTarget,
    central_response: trial.centralResponse,
    central_correct: trial.centralResponse === trial.centralTarget,
    peripheral_axis: hasTarget ? trial.peripheralAxis! : null,
    peripheral_response: typeof trial.peripheralResponse === 'number' ? trial.peripheralResponse : null,
    peripheral_correct: hasTarget ? trial.peripheralResponse === trial.peripheralAxis : null,
    trial_correct: trial.correct,
    response_ms: Math.round(trial.responseTimeMs),
    trajectory_samples: trial.mouseTrajectory?.length ?? 0,
  } satisfies Record<typeof ufovTrialColumns[number], number | string | boolean | null>;
}

function Thin<T>(points: T[], limit: number) {
  if (points.length <= limit) return points;
  return Array.from({ length: limit }, (_, index) => points[Math.round(index * (points.length - 1) / (limit - 1))]);
}

const Coordinate = (value: number) => Math.max(-1e7, Math.min(1e7, Math.round(value)));

function Stamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

// Three files: one row per trial, one row per session metric, and the mouse paths as JSON.
// None of them carries a name or account; the user downloads them from the container's results page.
export function BuildResultFiles(session: UfovSession, date: Date): ResultFile[] {
  const prefix = `ufov-${Stamp(date)}`;
  const totals = SummarizeUfovSession(session);
  const rows = session.trials.map(TrialFields);
  const trials = [ufovTrialColumns.join(','), ...rows.map(row => ufovTrialColumns.map(column => Cell(row[column])).join(','))].join('\r\n');
  const metrics: [string, number | string | boolean | null, string][] = [
    ['activity', session.subtest_id, ''],
    ['mode', session.mode, ''],
    ['stop_condition', session.stop_condition, ''],
    ['configured_trials', session.configured_trial_count, 'count'],
    ['threshold_ms', totals.thresholdMs, 'ms'],
    ['fastest_correct_ms', totals.bestMs, 'ms'],
    ['trials', totals.trials, 'count'],
    ['correct_trials', totals.correct, 'count'],
    ['accuracy_percent', totals.accuracyPercent, 'percent'],
    ['central_accuracy_percent', totals.centralAccuracyPercent, 'percent'],
    ['peripheral_accuracy_percent', totals.peripheralAccuracyPercent, 'percent'],
    ['mean_response_ms', totals.meanResponseMs, 'ms'],
    ['practice_trials', totals.practiceTrials, 'count'],
    ['timing_attempts', session.timing_attempts.length, 'count'],
    ['invalid_timing_attempts', session.invalid_timing_attempt_count, 'count'],
    ['sync_pauses', session.synchronization_pause_count, 'count'],
    ['aborted', session.aborted, ''],
    ['refresh_hz', RoundMs(session.refresh_hz), 'hz'],
    ['frame_ms', RoundMs(session.refresh_ms), 'ms'],
    ['refresh_60hz_family', session.refresh_is_60hz_family, ''],
    ['screen_width_cm', session.screen_width_cm, 'cm'],
    ['screen_height_cm', session.screen_height_cm, 'cm'],
    ['viewing_distance_cm', session.viewing_distance_cm, 'cm'],
    ['target_angle_deg', session.target_visual_angle_deg, 'deg'],
    ['vehicle_angle_deg', session.vehicle_visual_angle_deg, 'deg'],
    ['contrast_percent', session.contrast_percent, 'percent'],
    ...totals.directions.flatMap(direction => [
      [`direction_${direction.axis}_trials`, direction.trials, 'count'],
      [`direction_${direction.axis}_correct`, direction.correct, 'count'],
      [`direction_${direction.axis}_accuracy_percent`, direction.accuracyPercent, 'percent'],
      [`direction_${direction.axis}_mean_response_ms`, direction.meanResponseMs, 'ms'],
    ] as [string, number | null, string][]),
  ];
  const summary = ['metric,value,unit', ...metrics.map(([metric, value, unit]) => `${metric},${Cell(value)},${unit}`)].join('\r\n');
  const limit = Math.min(5000, Math.max(2, Math.floor(trajectoryPointBudget / Math.max(1, rows.length))));
  const trajectory = JSON.stringify({
    schema: 'rehab-trainer.ufov-trajectory/v1',
    activity: session.subtest_id,
    trials: session.trials.map((trial, index) => ({
      ...rows[index],
      trajectory: Thin(trial.mouseTrajectory ?? [], limit).map(point => [Coordinate(point.t), Coordinate(point.x), Coordinate(point.y)]),
    })),
  });
  return [
    { fileName: `${prefix}-trials.csv`, text: trials },
    { fileName: `${prefix}-summary.csv`, text: summary },
    { fileName: `${prefix}-trajectory.json`, text: trajectory },
  ];
}
