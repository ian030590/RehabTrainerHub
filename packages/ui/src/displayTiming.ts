export type DisplayDeviceKind = 'desktop' | 'phone' | 'tablet' | 'unknown';

export interface DisplayRefreshInfo {
  refreshMs: number;
  refreshHz: number;
  sampleCount: number;
  measured: boolean;
  isFallback: boolean;
  standardDeviationMs: number;
  nearest60HzMultiple: number;
  is60HzFamily: boolean;
  deviceKind: DisplayDeviceKind;
  isMobileOrTablet: boolean;
}

export interface DisplayRefreshMeasureOptions {
  sampleCount?: number;
  minimumSampleCount?: number;
  minSampleMs?: number;
  maxSampleMs?: number;
  timeoutMs?: number;
}

const defaultRefreshMs = 1000 / 60;
const defaultSampleCount = 72;
const defaultMinSampleMs = 1;
const defaultMaxSampleMs = 80;
const defaultTimeoutMs = 3_500;
const defaultMinimumSampleCount = 8;

export async function MeasureDisplayRefreshRate(
  options: DisplayRefreshMeasureOptions = {},
): Promise<DisplayRefreshInfo> {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return CreateRefreshInfo(defaultRefreshMs, [], DetectDisplayDeviceKind());
  }

  const targetSamples = Math.max(1, Math.floor(options.sampleCount ?? defaultSampleCount));
  const minimumSampleCount = Math.min(
    targetSamples,
    Math.max(1, Math.floor(options.minimumSampleCount ?? defaultMinimumSampleCount)),
  );
  const minSampleMs = options.minSampleMs ?? defaultMinSampleMs;
  const maxSampleMs = options.maxSampleMs ?? defaultMaxSampleMs;
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  const samples: number[] = [];
  let lastTimestamp = 0;

  await new Promise<void>((resolve) => {
    let finished = false;
    let frameId = 0;
    let sampleTimeoutId = 0;
    let watchdogTimeoutId = 0;

    const scheduleFrame = () => {
      if (finished || frameId) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      frameId = window.requestAnimationFrame(tick);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (frameId) window.cancelAnimationFrame(frameId);
        if (sampleTimeoutId) window.clearTimeout(sampleTimeoutId);
        frameId = 0;
        sampleTimeoutId = 0;
        lastTimestamp = 0;
        return;
      }
      scheduleFrame();
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      if (frameId) window.cancelAnimationFrame(frameId);
      if (sampleTimeoutId) window.clearTimeout(sampleTimeoutId);
      if (watchdogTimeoutId) window.clearTimeout(watchdogTimeoutId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      resolve();
    };

    const tick = (timestamp: number) => {
      if (finished) return;
      frameId = 0;
      if (!sampleTimeoutId) {
        sampleTimeoutId = window.setTimeout(finish, Math.max(250, timeoutMs));
      }
      if (lastTimestamp > 0) {
        const delta = timestamp - lastTimestamp;
        if (delta >= minSampleMs && delta <= maxSampleMs) {
          samples.push(delta);
        }
      }

      lastTimestamp = timestamp;
      if (samples.length >= targetSamples) {
        finish();
        return;
      }

      scheduleFrame();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    scheduleFrame();
    watchdogTimeoutId = window.setTimeout(finish, Math.max(30_000, timeoutMs * 10));
  });

  const usableSamples = TrimOutliers(samples);
  const reliableSamples = usableSamples.length >= minimumSampleCount ? usableSamples : [];
  const refreshMs = Median(reliableSamples) || defaultRefreshMs;
  return CreateRefreshInfo(refreshMs, reliableSamples, DetectDisplayDeviceKind());
}

export function DetectDisplayDeviceKind(): DisplayDeviceKind {
  if (typeof navigator === 'undefined') return 'unknown';

  const userAgent = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const hasTouch = navigator.maxTouchPoints > 1;
  const isIpadLike = platform === 'MacIntel' && hasTouch;
  const coarsePointer = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: coarse)').matches;
  const shortSide = typeof window !== 'undefined' && window.screen
    ? Math.min(window.screen.width, window.screen.height)
    : 0;
  const longSide = typeof window !== 'undefined' && window.screen
    ? Math.max(window.screen.width, window.screen.height)
    : 0;

  if (/iPad|Tablet|PlayBook|Silk/i.test(userAgent) || isIpadLike) return 'tablet';
  if (/Mobi|Android|iPhone|iPod|Windows Phone/i.test(userAgent)) return 'phone';
  if (hasTouch && coarsePointer && shortSide > 0 && shortSide <= 1024 && longSide <= 1400) return 'tablet';
  return 'desktop';
}

export function Is60HzRefreshFamily(refreshHz: number): boolean {
  if (!Number.isFinite(refreshHz) || refreshHz <= 0) return false;

  const nearest60HzMultiple = Math.max(1, Math.round(refreshHz / 60)) * 60;
  const toleranceHz = Math.max(1, nearest60HzMultiple * 0.015);
  return Math.abs(refreshHz - nearest60HzMultiple) <= toleranceHz;
}

function CreateRefreshInfo(
  refreshMs: number,
  samples: number[],
  deviceKind: DisplayDeviceKind,
): DisplayRefreshInfo {
  const refreshHz = 1000 / refreshMs;
  const nearest60HzMultiple = Math.max(1, Math.round(refreshHz / 60)) * 60;

  return {
    refreshMs,
    refreshHz,
    sampleCount: samples.length,
    measured: samples.length > 0,
    isFallback: samples.length === 0,
    standardDeviationMs: StandardDeviation(samples, refreshMs),
    nearest60HzMultiple,
    is60HzFamily: Is60HzRefreshFamily(refreshHz),
    deviceKind,
    isMobileOrTablet: deviceKind === 'phone' || deviceKind === 'tablet',
  };
}

function TrimOutliers(values: number[]) {
  if (values.length < 8) return values;

  const sorted = [...values].sort((left, right) => left - right);
  const trimCount = Math.floor(sorted.length * 0.1);
  return sorted.slice(trimCount, sorted.length - trimCount);
}

function Median(values: number[]) {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function StandardDeviation(values: number[], average: number) {
  if (values.length === 0) return 0;

  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
