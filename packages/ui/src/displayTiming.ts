export type DisplayDeviceKind = 'desktop' | 'phone' | 'tablet' | 'unknown';

export interface DisplayRefreshInfo {
  refreshMs: number;
  refreshHz: number;
  sampleCount: number;
  standardDeviationMs: number;
  nearest60HzMultiple: number;
  is60HzFamily: boolean;
  deviceKind: DisplayDeviceKind;
  isMobileOrTablet: boolean;
}

export interface DisplayRefreshMeasureOptions {
  sampleCount?: number;
  minSampleMs?: number;
  maxSampleMs?: number;
}

const DEFAULT_REFRESH_MS = 1000 / 60;
const DEFAULT_SAMPLE_COUNT = 72;
const DEFAULT_MIN_SAMPLE_MS = 4;
const DEFAULT_MAX_SAMPLE_MS = 80;

export async function measureDisplayRefreshRate(
  options: DisplayRefreshMeasureOptions = {},
): Promise<DisplayRefreshInfo> {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return createRefreshInfo(DEFAULT_REFRESH_MS, [], detectDisplayDeviceKind());
  }

  const targetSamples = options.sampleCount ?? DEFAULT_SAMPLE_COUNT;
  const minSampleMs = options.minSampleMs ?? DEFAULT_MIN_SAMPLE_MS;
  const maxSampleMs = options.maxSampleMs ?? DEFAULT_MAX_SAMPLE_MS;
  const samples: number[] = [];
  let lastTimestamp = 0;

  await new Promise<void>((resolve) => {
    const tick = (timestamp: number) => {
      if (lastTimestamp > 0) {
        const delta = timestamp - lastTimestamp;
        if (delta >= minSampleMs && delta <= maxSampleMs) {
          samples.push(delta);
        }
      }

      lastTimestamp = timestamp;
      if (samples.length >= targetSamples) {
        resolve();
        return;
      }

      window.requestAnimationFrame(tick);
    };

    window.requestAnimationFrame(tick);
  });

  const usableSamples = trimOutliers(samples);
  const refreshMs = median(usableSamples) || DEFAULT_REFRESH_MS;
  return createRefreshInfo(refreshMs, usableSamples, detectDisplayDeviceKind());
}

export function detectDisplayDeviceKind(): DisplayDeviceKind {
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

export function is60HzRefreshFamily(refreshHz: number): boolean {
  if (!Number.isFinite(refreshHz) || refreshHz <= 0) return false;

  const nearest60HzMultiple = Math.max(1, Math.round(refreshHz / 60)) * 60;
  const toleranceHz = Math.max(1, nearest60HzMultiple * 0.015);
  return Math.abs(refreshHz - nearest60HzMultiple) <= toleranceHz;
}

function createRefreshInfo(
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
    standardDeviationMs: standardDeviation(samples, refreshMs),
    nearest60HzMultiple,
    is60HzFamily: is60HzRefreshFamily(refreshHz),
    deviceKind,
    isMobileOrTablet: deviceKind === 'phone' || deviceKind === 'tablet',
  };
}

function trimOutliers(values: number[]) {
  if (values.length < 8) return values;

  const sorted = [...values].sort((left, right) => left - right);
  const trimCount = Math.floor(sorted.length * 0.1);
  return sorted.slice(trimCount, sorted.length - trimCount);
}

function median(values: number[]) {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function standardDeviation(values: number[], average: number) {
  if (values.length === 0) return 0;

  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
