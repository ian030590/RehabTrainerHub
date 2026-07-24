export type DevicePerformanceLevel = 'low' | 'standard';

export type DevicePerformanceReason =
  | 'limited-cpu'
  | 'limited-memory'
  | 'slow-animation-frames';

export interface DevicePerformanceInfo {
  level: DevicePerformanceLevel;
  reasons: DevicePerformanceReason[];
  hardwareConcurrency: number | null;
  deviceMemoryGb: number | null;
  averageFrameMs: number | null;
  approximateFps: number | null;
  sampleCount: number;
  measurementSkipped: boolean;
}

export interface DevicePerformanceMeasureOptions {
  sampleCount?: number;
}

const defaultSampleCount = 50;
const minimumSampleCount = 45;
const maximumSampleCount = 60;
const slowFrameThresholdMs = 25;

export async function MeasureDevicePerformance(
  options: DevicePerformanceMeasureOptions = {},
): Promise<DevicePerformanceInfo> {
  const navigatorInfo = ReadNavigatorPerformanceInfo();
  const targetSampleCount = ClampSampleCount(options.sampleCount);

  if (
    typeof window === 'undefined'
    || typeof document === 'undefined'
    || typeof window.requestAnimationFrame !== 'function'
    || document.visibilityState !== 'visible'
  ) {
    return CreatePerformanceInfo(navigatorInfo, [], true);
  }

  const frameMeasurement = await MeasureAnimationFrames(targetSampleCount);
  return CreatePerformanceInfo(
    navigatorInfo,
    frameMeasurement.samples,
    frameMeasurement.interrupted,
  );
}

function ReadNavigatorPerformanceInfo() {
  if (typeof navigator === 'undefined') {
    return {
      hardwareConcurrency: null,
      deviceMemoryGb: null,
    };
  }

  const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
  return {
    hardwareConcurrency: ToPositiveNumber(navigator.hardwareConcurrency),
    deviceMemoryGb: ToPositiveNumber(navigatorWithMemory.deviceMemory),
  };
}

function MeasureAnimationFrames(targetSampleCount: number) {
  return new Promise<{ samples: number[]; interrupted: boolean }>((resolve) => {
    const samples: number[] = [];
    let lastTimestamp = 0;
    let frameId = 0;
    let finished = false;

    const finish = (interrupted: boolean) => {
      if (finished) return;
      finished = true;
      if (frameId) window.cancelAnimationFrame(frameId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      resolve({ samples: interrupted ? [] : samples, interrupted });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') finish(true);
    };

    const tick = (timestamp: number) => {
      if (document.visibilityState !== 'visible') {
        finish(true);
        return;
      }

      if (lastTimestamp > 0) {
        const delta = timestamp - lastTimestamp;
        if (delta > 0 && delta < 250) samples.push(delta);
      }
      lastTimestamp = timestamp;

      if (samples.length >= targetSampleCount) {
        finish(false);
        return;
      }
      frameId = window.requestAnimationFrame(tick);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    frameId = window.requestAnimationFrame(tick);
  });
}

function CreatePerformanceInfo(
  navigatorInfo: {
    hardwareConcurrency: number | null;
    deviceMemoryGb: number | null;
  },
  rawSamples: number[],
  measurementSkipped: boolean,
): DevicePerformanceInfo {
  const samples = TrimFrameOutliers(rawSamples);
  const averageFrameMs = samples.length > 0
    ? samples.reduce((sum, value) => sum + value, 0) / samples.length
    : null;
  const reasons: DevicePerformanceReason[] = [];

  if (!measurementSkipped) {
    if (
      navigatorInfo.hardwareConcurrency !== null
      && navigatorInfo.hardwareConcurrency <= 2
    ) {
      reasons.push('limited-cpu');
    }
    if (navigatorInfo.deviceMemoryGb !== null && navigatorInfo.deviceMemoryGb <= 2) {
      reasons.push('limited-memory');
    }
    if (
      rawSamples.length >= minimumSampleCount
      && averageFrameMs !== null
      && averageFrameMs >= slowFrameThresholdMs
    ) {
      reasons.push('slow-animation-frames');
    }
  }

  return {
    level: reasons.length > 0 ? 'low' : 'standard',
    reasons,
    hardwareConcurrency: navigatorInfo.hardwareConcurrency,
    deviceMemoryGb: navigatorInfo.deviceMemoryGb,
    averageFrameMs,
    approximateFps: averageFrameMs ? 1000 / averageFrameMs : null,
    sampleCount: rawSamples.length,
    measurementSkipped,
  };
}

function ClampSampleCount(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return defaultSampleCount;
  return Math.min(maximumSampleCount, Math.max(minimumSampleCount, Math.round(value)));
}

function TrimFrameOutliers(values: number[]) {
  if (values.length < 10) return values;
  const sorted = [...values].sort((left, right) => left - right);
  const trimCount = Math.max(1, Math.floor(sorted.length * 0.1));
  return sorted.slice(trimCount, sorted.length - trimCount);
}

function ToPositiveNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null;
}
