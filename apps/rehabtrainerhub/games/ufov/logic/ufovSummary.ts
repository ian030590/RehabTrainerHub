import type { PeripheralAttentionFrameSyncMeasurement } from '../timing/peripheralAttentionTiming';
import { GetFastestCorrectStimulusDurationMs } from '../runtime/peripheralAttentionResults';

export type Vehicle = 'car' | 'truck';

export interface UfovTrial extends PeripheralAttentionFrameSyncMeasurement {
  subtestId: number;
  practice: boolean;
  trialNumber: number;
  durationFrames: number;
  displayFrameCount: number;
  plannedDurationMs: number;
  durationMs: number;
  refreshMs: number;
  refreshHz: number;
  refreshSampleCount: number;
  refreshStandardDeviationMs: number;
  syncRetryCount: number;
  centralTarget: Vehicle;
  centralResponse: Vehicle;
  peripheralAxis?: number;
  peripheralResponse?: number;
  correct: boolean;
  responseTimeMs: number;
  contrastPercent: number;
  targetVisualAngleDeg: number;
  vehicleVisualAngleDeg: number;
  mouseTrajectory?: { x: number; y: number; t: number }[];
}

export interface UfovTimingAttempt { syncValid: boolean; syncReason: string }

// Field names follow the legacy jsPsych trial data so earlier exports stay comparable.
export interface UfovSession {
  subtest_id: number;
  mode: string;
  configured_trial_count: number;
  target_axes: number[];
  stop_condition: string;
  contrast_percent: number;
  target_visual_angle_deg: number;
  vehicle_visual_angle_deg: number;
  screen_width_cm: number;
  screen_height_cm: number;
  viewing_distance_cm: number;
  refresh_ms: number;
  refresh_hz: number;
  refresh_is_60hz_family: boolean;
  refresh_device_kind: string;
  trials: UfovTrial[];
  timing_attempts: UfovTimingAttempt[];
  invalid_timing_attempt_count: number;
  synchronization_pause_count: number;
  results: { subtestId: number; thresholdMs: number; trialCount: number; aborted: boolean }[];
  aborted: boolean;
}

// The container checks this exact column list before it keeps a trials file.
export const ufovTrialColumns = ['trial', 'practice', 'activity', 'planned_ms', 'exposure_ms', 'frames',
  'dropped_frames', 'refresh_hz', 'sync_valid', 'contrast_percent', 'vehicle_angle_deg', 'target_angle_deg', 'central_target',
  'central_response', 'central_correct', 'peripheral_axis', 'peripheral_response', 'peripheral_correct', 'trial_correct',
  'response_ms', 'trajectory_samples'] as const;

export const RoundMs = (value: number) => Number(value.toFixed(2));
const Percent = (part: number, whole: number) => whole > 0 ? Math.round(part / whole * 100) : null;
const Mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export function SummarizeUfovSession(session: UfovSession) {
  const trials = session.trials;
  const correct = trials.filter(trial => trial.correct).length;
  const thresholdMs = session.results[0] ? RoundMs(session.results[0].thresholdMs) : 0;
  const withTarget = trials.filter(trial => typeof trial.peripheralAxis === 'number');
  const meanResponse = Mean(trials.map(trial => trial.responseTimeMs));
  return {
    trials: trials.length,
    correct,
    thresholdMs,
    bestMs: session.mode === 'formal' ? RoundMs(GetFastestCorrectStimulusDurationMs(trials, thresholdMs)) : thresholdMs,
    accuracyPercent: Percent(correct, trials.length),
    centralAccuracyPercent: Percent(trials.filter(trial => trial.centralResponse === trial.centralTarget).length, trials.length),
    peripheralAccuracyPercent: Percent(withTarget.filter(trial => trial.peripheralResponse === trial.peripheralAxis).length, withTarget.length),
    meanResponseMs: meanResponse === null ? null : Math.round(meanResponse),
    practiceTrials: trials.filter(trial => trial.practice).length,
    directions: [0, 1, 2, 3, 4, 5, 6, 7].map(axis => {
      const shown = trials.filter(trial => trial.peripheralAxis === axis);
      const hits = shown.filter(trial => trial.correct).length;
      const response = Mean(shown.map(trial => trial.responseTimeMs));
      const exposure = Mean(shown.map(trial => trial.actualDurationMs));
      return { axis, trials: shown.length, correct: hits, accuracyPercent: Percent(hits, shown.length),
        meanResponseMs: response === null ? null : Math.round(response), meanExposureMs: exposure === null ? null : RoundMs(exposure) };
    }),
  };
}
