export type PeripheralAttentionFrameSyncReason =
  | 'synchronized'
  | 'refresh-measurement-unavailable'
  | 'unstable-refresh-measurement'
  | 'visibility-interrupted'
  | 'missing-frame-samples'
  | 'non-monotonic-frame-timestamps'
  | 'refresh-rate-shift'
  | 'dropped-frame'
  | 'excessive-frame-jitter';

export interface PeripheralAttentionFrameSyncInput {
  requestedFrameCount: number;
  refreshMs: number;
  refreshMeasured: boolean;
  refreshStandardDeviationMs: number;
  frameTimestamps: readonly number[];
  visibilityInterrupted?: boolean;
}

export interface PeripheralAttentionFrameSyncMeasurement {
  syncValid: boolean;
  syncReason: PeripheralAttentionFrameSyncReason;
  requestedFrameCount: number;
  actualFrameCount: number;
  estimatedDisplayFrameCount: number;
  droppedFrameCount: number;
  actualDurationMs: number;
  measuredFrameMs: number;
  measuredRefreshHz: number;
  frameJitterMs: number;
  maxFrameIntervalMs: number;
}

export type PeripheralAttentionSyncRecoveryAction = 'retry' | 'pause';

export const peripheralAttentionTrialRefreshOptions = {
  sampleCount: 12,
  minimumSampleCount: 8,
  timeoutMs: 1_200,
} as const;

export const peripheralAttentionSyncPolicy = {
  maxAutomaticRetries: 2,
  maximumRefreshDeviationRatio: 0.25,
  maximumFrameIntervalRatio: 1.75,
  maximumJitterRatio: 0.2,
  minimumJitterToleranceMs: 2.5,
} as const;

export function EvaluatePeripheralAttentionFrameSync(
  input: PeripheralAttentionFrameSyncInput,
): PeripheralAttentionFrameSyncMeasurement {
  const requestedFrameCount = Math.max(1, Math.round(input.requestedFrameCount));
  const refreshMs = Number(input.refreshMs);
  const timestamps = input.frameTimestamps.map(Number);
  const intervals = timestamps.slice(1).map((timestamp, index) => timestamp - timestamps[index]);
  const actualDurationMs = timestamps.length >= 2
    ? Math.max(0, timestamps[timestamps.length - 1] - timestamps[0])
    : 0;
  const measuredFrameMs = Median(intervals.filter((interval) => Number.isFinite(interval) && interval > 0));
  const measuredRefreshHz = measuredFrameMs > 0 ? 1000 / measuredFrameMs : 0;
  const frameJitterMs = StandardDeviation(intervals, measuredFrameMs);
  const maxFrameIntervalMs = intervals.length > 0 ? Math.max(...intervals) : 0;
  const estimatedDisplayFrameCount = Number.isFinite(refreshMs) && refreshMs > 0
    ? Math.max(0, Math.round(actualDurationMs / refreshMs))
    : 0;
  const droppedFrameCount = Math.max(0, estimatedDisplayFrameCount - requestedFrameCount);

  const base = {
    requestedFrameCount,
    actualFrameCount: intervals.length,
    estimatedDisplayFrameCount,
    droppedFrameCount,
    actualDurationMs,
    measuredFrameMs,
    measuredRefreshHz,
    frameJitterMs,
    maxFrameIntervalMs,
  };
  const invalid = (syncReason: Exclude<PeripheralAttentionFrameSyncReason, 'synchronized'>) => ({
    ...base,
    syncValid: false,
    syncReason,
  } as const);

  if (!input.refreshMeasured || !Number.isFinite(refreshMs) || refreshMs <= 0) {
    return invalid('refresh-measurement-unavailable');
  }
  if (input.visibilityInterrupted) return invalid('visibility-interrupted');
  if (timestamps.length !== requestedFrameCount + 1 || intervals.length !== requestedFrameCount) {
    return invalid('missing-frame-samples');
  }
  if (intervals.some((interval) => !Number.isFinite(interval) || interval <= 0)) {
    return invalid('non-monotonic-frame-timestamps');
  }

  const measurementJitterLimit = Math.max(
    peripheralAttentionSyncPolicy.minimumJitterToleranceMs,
    refreshMs * peripheralAttentionSyncPolicy.maximumJitterRatio,
  );
  if (
    !Number.isFinite(input.refreshStandardDeviationMs)
    || input.refreshStandardDeviationMs > measurementJitterLimit
  ) {
    return invalid('unstable-refresh-measurement');
  }

  const minimumMeasuredFrameMs = refreshMs * (1 - peripheralAttentionSyncPolicy.maximumRefreshDeviationRatio);
  const maximumMeasuredFrameMs = refreshMs * (1 + peripheralAttentionSyncPolicy.maximumRefreshDeviationRatio);
  if (measuredFrameMs < minimumMeasuredFrameMs || measuredFrameMs > maximumMeasuredFrameMs) {
    return invalid('refresh-rate-shift');
  }
  if (
    estimatedDisplayFrameCount !== requestedFrameCount
    || maxFrameIntervalMs > refreshMs * peripheralAttentionSyncPolicy.maximumFrameIntervalRatio
  ) {
    return invalid('dropped-frame');
  }
  if (frameJitterMs > measurementJitterLimit) return invalid('excessive-frame-jitter');

  return {
    ...base,
    syncValid: true,
    syncReason: 'synchronized',
  };
}

export function ShouldCountPeripheralAttentionTrial(mode: string, syncValid: boolean) {
  return mode !== 'formal' || syncValid;
}

export function GetPeripheralAttentionSyncRecoveryAction(
  consecutiveInvalidAttempts: number,
): PeripheralAttentionSyncRecoveryAction {
  return consecutiveInvalidAttempts <= peripheralAttentionSyncPolicy.maxAutomaticRetries
    ? 'retry'
    : 'pause';
}

function Median(values: readonly number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function StandardDeviation(values: readonly number[], average: number) {
  if (values.length === 0 || !Number.isFinite(average)) return 0;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
