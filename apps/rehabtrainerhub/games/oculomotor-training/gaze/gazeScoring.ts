export const gazeRecordColumns = [
  'sample_index', 'trial_time_ms', 'device_timestamp_us', 'delta_t_ms', 'instant_hz',
  'gaze_valid', 'gaze_x_px', 'gaze_y_px', 'stimulus_x_px', 'stimulus_y_px',
  'distance_error_px', 'distance_error_deg', 'is_within_threshold', 'phase', 'direction',
] as const;

export type GazeRecord = readonly [
  number, number, number | null, number, number | null,
  0 | 1, number | null, number | null, number, number,
  number | null, number | null, 0 | 1, string, string,
];

export interface GazePoint { x: number; y: number }

export function AngularDistanceDeg(
  gaze: GazePoint,
  target: GazePoint,
  cssPxPerCm: number,
  viewingDistanceCm: number,
  cssPxPerCmY = cssPxPerCm,
): number {
  const distanceCm = Math.hypot((gaze.x - target.x) / cssPxPerCm, (gaze.y - target.y) / cssPxPerCmY);
  return 2 * Math.atan(distanceCm / (2 * viewingDistanceCm)) * 180 / Math.PI;
}

export function ThresholdRadiusPx(
  thresholdDeg: number,
  cssPxPerCm: number,
  viewingDistanceCm: number,
): number {
  return 2 * viewingDistanceCm * Math.tan(thresholdDeg * Math.PI / 360) * cssPxPerCm;
}

export function ValidationThresholdDeg(
  pointSamples: readonly (readonly GazePoint[])[],
  targets: readonly GazePoint[],
  cssPxPerCm: number,
  viewingDistanceCm: number,
  cssPxPerCmY = cssPxPerCm,
): { meanErrorDeg: number; thresholdDeg: number; validPoints: number } | null {
  const errors = pointSamples.flatMap((samples, index) => {
    if (samples.length < 3 || !targets[index]) return [];
    const median = (values: number[]) => {
      values.sort((a, b) => a - b);
      return values[Math.floor(values.length / 2)];
    };
    const gaze = { x: median(samples.map((sample) => sample.x)), y: median(samples.map((sample) => sample.y)) };
    return [AngularDistanceDeg(gaze, targets[index], cssPxPerCm, viewingDistanceCm, cssPxPerCmY)];
  });
  if (targets.length !== 5 || pointSamples.length !== 5 || errors.length !== 5) return null;
  const meanErrorDeg = errors.reduce((sum, error) => sum + error, 0) / errors.length;
  return { meanErrorDeg, thresholdDeg: Math.max(0.5, meanErrorDeg * 2), validPoints: errors.length };
}

export function SummarizeGazeRecords(records: readonly GazeRecord[]) {
  let validMs = 0;
  let inThresholdMs = 0;
  let invalidMs = 0;
  for (const record of records) {
    // Long gaps (tab suspension, device loss) contain no observed gaze.
    const interval = record[3] > 0 && record[3] <= 100 ? record[3] : 0;
    if (record[5] === 0) invalidMs += interval;
    else if (record[13] !== 'saccade_latency') {
      validMs += interval;
      if (record[12] === 1) inThresholdMs += interval;
    }
  }
  return {
    validMs,
    inThresholdMs,
    invalidMs,
    accuracyPercent: validMs > 0 ? Math.round(inThresholdMs / validMs * 1000) / 10 : null,
  };
}
