export type HeadDistanceStatus = 'too-far' | 'too-close' | 'ready' | 'unavailable';

export type FaceLandmark =
  | readonly [x: number, y: number, z?: number]
  | { x: number; y: number; z?: number };

export interface Point2D {
  x: number;
  y: number;
}

export interface ImageDataLike {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

export interface WebGazerEyePatchLike {
  patch?: ImageDataLike | null;
  width?: number;
  height?: number;
}

export interface WebGazerEyeFeaturesLike {
  left?: WebGazerEyePatchLike | null;
  right?: WebGazerEyePatchLike | null;
}

export interface HeadDistanceOptions {
  tooFarBelowRatio?: number;
  tooCloseAboveRatio?: number;
}

export interface PupilEstimateOptions {
  darkThresholdRatio?: number;
  minimumContrast?: number;
  minimumComponentArea?: number;
}

export interface BlinkDetectorOptions {
  baselineSmoothing?: number;
  closeRatio?: number;
  reopenRatio?: number;
  minimumClosedMs?: number;
}

export interface BlinkDetectorState {
  baselineEyeAspectRatio: number | null;
  blinkCount: number;
  closedSinceMs: number | null;
  isClosed: boolean;
}

export interface BlinkDetectorUpdate {
  blinkEvent: 0 | 1;
  state: BlinkDetectorState;
}

export const oculomotorGazeSampleColumns = [
  't_ms',
  'gaze_x',
  'gaze_y',
  'target_x',
  'target_y',
  'distance_px',
  'pupil_size_px_estimate',
  'blink_event',
  'fixation_segment',
] as const;

export type OculomotorGazeSample = readonly [
  tMs: number,
  gazeX: number,
  gazeY: number,
  targetX: number,
  targetY: number,
  distancePx: number,
  pupilSizePxEstimate: number | null,
  blinkEvent: 0 | 1,
  fixationSegment: number,
];

export interface OculomotorGazeSummaryOptions {
  fixationRadiusPx: number;
  minimumFixationDurationMs?: number;
  maximumSampleGapMs?: number;
}

export interface OculomotorGazeSummary {
  aoiSampleCount: number;
  aoiScore: number | null;
  averagePupilSizePx: number | null;
  blinkCount: number;
  distanceStandardDeviationPx: number | null;
  gazeSampleCount: number;
  meanDistancePx: number | null;
  timeToFirstFixationMs: number | null;
}

const defaultTooFarRatio = 0.18;
const defaultTooCloseRatio = 0.48;
const defaultDarkThresholdRatio = 0.35;
const defaultMinimumContrast = 12;
const defaultMinimumComponentArea = 2;
const defaultBaselineSmoothing = 0.05;
const defaultCloseRatio = 0.55;
const defaultReopenRatio = 0.75;
const defaultMinimumClosedMs = 60;

function IsFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function Clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function ReadLandmark(
  landmarks: readonly FaceLandmark[] | null | undefined,
  index: number,
): Point2D | null {
  const landmark = landmarks?.[index];
  if (!landmark) return null;
  const x = 'x' in landmark ? landmark.x : landmark[0];
  const y = 'y' in landmark ? landmark.y : landmark[1];
  return IsFiniteNumber(x) && IsFiniteNumber(y) ? { x, y } : null;
}

function Distance(first: Point2D, second: Point2D): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

export function CalculateFaceWidthRatio(
  landmarks: readonly FaceLandmark[] | null | undefined,
  frameWidth: number,
): number | null {
  if (!IsFiniteNumber(frameWidth) || frameWidth <= 0) return null;
  const leftCheek = ReadLandmark(landmarks, 234);
  const rightCheek = ReadLandmark(landmarks, 454);
  if (!leftCheek || !rightCheek) return null;
  const cheekDistance = Distance(leftCheek, rightCheek);
  // Face-landmark runtimes can expose camera pixels or normalized 0..1
  // coordinates. Supporting both prevents distance guidance from permanently
  // locking the native jsPsych continue button.
  const usesNormalizedCoordinates = (
    Math.abs(leftCheek.x) <= 2
    && Math.abs(leftCheek.y) <= 2
    && Math.abs(rightCheek.x) <= 2
    && Math.abs(rightCheek.y) <= 2
  );
  const ratio = usesNormalizedCoordinates ? cheekDistance : cheekDistance / frameWidth;
  return IsFiniteNumber(ratio) && ratio > 0 ? ratio : null;
}

export function ClassifyHeadDistance(
  landmarks: readonly FaceLandmark[] | null | undefined,
  frameWidth: number,
  options: HeadDistanceOptions = {},
): HeadDistanceStatus {
  const ratio = CalculateFaceWidthRatio(landmarks, frameWidth);
  if (ratio === null) return 'unavailable';

  const tooFarBelowRatio = IsFiniteNumber(options.tooFarBelowRatio)
    ? options.tooFarBelowRatio
    : defaultTooFarRatio;
  const tooCloseAboveRatio = IsFiniteNumber(options.tooCloseAboveRatio)
    ? options.tooCloseAboveRatio
    : defaultTooCloseRatio;
  if (tooFarBelowRatio <= 0 || tooCloseAboveRatio <= tooFarBelowRatio) return 'unavailable';
  if (ratio < tooFarBelowRatio) return 'too-far';
  if (ratio > tooCloseAboveRatio) return 'too-close';
  return 'ready';
}

function CalculateSingleEyeAspectRatio(
  landmarks: readonly FaceLandmark[] | null | undefined,
  cornerIndexes: readonly [number, number],
  verticalIndexes: readonly [readonly [number, number], readonly [number, number]],
): number | null {
  const firstCorner = ReadLandmark(landmarks, cornerIndexes[0]);
  const secondCorner = ReadLandmark(landmarks, cornerIndexes[1]);
  const firstTop = ReadLandmark(landmarks, verticalIndexes[0][0]);
  const firstBottom = ReadLandmark(landmarks, verticalIndexes[0][1]);
  const secondTop = ReadLandmark(landmarks, verticalIndexes[1][0]);
  const secondBottom = ReadLandmark(landmarks, verticalIndexes[1][1]);
  if (!firstCorner || !secondCorner || !firstTop || !firstBottom || !secondTop || !secondBottom) {
    return null;
  }

  const eyeWidth = Distance(firstCorner, secondCorner);
  if (eyeWidth <= 0) return null;
  const ratio = (
    Distance(firstTop, firstBottom) + Distance(secondTop, secondBottom)
  ) / (2 * eyeWidth);
  return IsFiniteNumber(ratio) && ratio >= 0 ? ratio : null;
}

export function CalculateEyeAspectRatio(
  landmarks: readonly FaceLandmark[] | null | undefined,
): number | null {
  const ratios = [
    CalculateSingleEyeAspectRatio(landmarks, [33, 133], [[159, 145], [158, 153]]),
    CalculateSingleEyeAspectRatio(landmarks, [362, 263], [[386, 374], [385, 380]]),
  ].filter((ratio): ratio is number => ratio !== null);
  if (ratios.length === 0) return null;
  return ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
}

export function CreateBlinkDetectorState(): BlinkDetectorState {
  return {
    baselineEyeAspectRatio: null,
    blinkCount: 0,
    closedSinceMs: null,
    isClosed: false,
  };
}

export function UpdateBlinkDetector(
  state: BlinkDetectorState,
  eyeAspectRatio: number | null,
  timestampMs: number,
  options: BlinkDetectorOptions = {},
): BlinkDetectorUpdate {
  if (
    !IsFiniteNumber(eyeAspectRatio)
    || eyeAspectRatio <= 0
    || !IsFiniteNumber(timestampMs)
  ) {
    return { state: { ...state }, blinkEvent: 0 };
  }

  const smoothing = Clamp(
    IsFiniteNumber(options.baselineSmoothing)
      ? options.baselineSmoothing
      : defaultBaselineSmoothing,
    0,
    1,
  );
  const closeRatio = Clamp(
    IsFiniteNumber(options.closeRatio) ? options.closeRatio : defaultCloseRatio,
    0.05,
    0.95,
  );
  const reopenRatio = Clamp(
    IsFiniteNumber(options.reopenRatio) ? options.reopenRatio : defaultReopenRatio,
    closeRatio,
    1,
  );
  const minimumClosedMs = Math.max(
    0,
    IsFiniteNumber(options.minimumClosedMs)
      ? options.minimumClosedMs
      : defaultMinimumClosedMs,
  );
  const baseline = state.baselineEyeAspectRatio;

  if (baseline === null || !IsFiniteNumber(baseline) || baseline <= 0) {
    return {
      blinkEvent: 0,
      state: {
        ...state,
        baselineEyeAspectRatio: eyeAspectRatio,
      },
    };
  }

  if (!state.isClosed) {
    if (eyeAspectRatio <= baseline * closeRatio) {
      return {
        blinkEvent: 0,
        state: {
          ...state,
          closedSinceMs: timestampMs,
          isClosed: true,
        },
      };
    }
    return {
      blinkEvent: 0,
      state: {
        ...state,
        baselineEyeAspectRatio: baseline * (1 - smoothing) + eyeAspectRatio * smoothing,
      },
    };
  }

  if (eyeAspectRatio < baseline * reopenRatio) {
    return { state: { ...state }, blinkEvent: 0 };
  }

  const closedDurationMs = state.closedSinceMs === null
    ? 0
    : Math.max(0, timestampMs - state.closedSinceMs);
  const blinkEvent: 0 | 1 = closedDurationMs >= minimumClosedMs ? 1 : 0;
  return {
    blinkEvent,
    state: {
      ...state,
      baselineEyeAspectRatio: baseline * (1 - smoothing) + eyeAspectRatio * smoothing,
      blinkCount: state.blinkCount + blinkEvent,
      closedSinceMs: null,
      isClosed: false,
    },
  };
}

function EstimatePatchPupilDiameterPx(
  eye: WebGazerEyePatchLike | null | undefined,
  options: PupilEstimateOptions,
): number | null {
  const patch = eye?.patch;
  const width = Math.floor(patch?.width ?? eye?.width ?? 0);
  const height = Math.floor(patch?.height ?? eye?.height ?? 0);
  if (!patch || width < 3 || height < 3 || patch.data.length < width * height * 4) return null;

  const luminance = new Float64Array(width * height);
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < luminance.length; index += 1) {
    const dataIndex = index * 4;
    const alpha = Number(patch.data[dataIndex + 3]);
    if (!IsFiniteNumber(alpha) || alpha <= 0) {
      luminance[index] = Number.NaN;
      continue;
    }
    const red = Number(patch.data[dataIndex]);
    const green = Number(patch.data[dataIndex + 1]);
    const blue = Number(patch.data[dataIndex + 2]);
    if (!IsFiniteNumber(red) || !IsFiniteNumber(green) || !IsFiniteNumber(blue)) {
      luminance[index] = Number.NaN;
      continue;
    }
    const value = red * 0.299 + green * 0.587 + blue * 0.114;
    luminance[index] = value;
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }

  const minimumContrast = Math.max(
    0,
    IsFiniteNumber(options.minimumContrast)
      ? options.minimumContrast
      : defaultMinimumContrast,
  );
  if (!IsFiniteNumber(minimum) || !IsFiniteNumber(maximum) || maximum - minimum < minimumContrast) {
    return null;
  }

  const darkThresholdRatio = Clamp(
    IsFiniteNumber(options.darkThresholdRatio)
      ? options.darkThresholdRatio
      : defaultDarkThresholdRatio,
    0,
    1,
  );
  const threshold = minimum + (maximum - minimum) * darkThresholdRatio;
  const darkPixels = new Uint8Array(width * height);
  const marginX = width > 4 ? Math.max(1, Math.floor(width * 0.1)) : 0;
  const marginY = height > 4 ? Math.max(1, Math.floor(height * 0.1)) : 0;
  for (let y = marginY; y < height - marginY; y += 1) {
    for (let x = marginX; x < width - marginX; x += 1) {
      const index = y * width + x;
      if (IsFiniteNumber(luminance[index]) && luminance[index] <= threshold) {
        darkPixels[index] = 1;
      }
    }
  }

  const visited = new Uint8Array(width * height);
  const centerX = (width - 1) / 2;
  const centerY = (height - 1) / 2;
  let bestArea = 0;
  let bestCenterDistance = Number.POSITIVE_INFINITY;
  for (let start = 0; start < darkPixels.length; start += 1) {
    if (darkPixels[start] === 0 || visited[start] === 1) continue;
    const queue = [start];
    visited[start] = 1;
    let area = 0;
    let sumX = 0;
    let sumY = 0;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor];
      const x = index % width;
      const y = Math.floor(index / width);
      area += 1;
      sumX += x;
      sumY += y;
      const neighbors = [index - 1, index + 1, index - width, index + width];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= darkPixels.length) continue;
        const neighborX = neighbor % width;
        if (Math.abs(neighborX - x) > 1) continue;
        if (darkPixels[neighbor] === 0 || visited[neighbor] === 1) continue;
        visited[neighbor] = 1;
        queue.push(neighbor);
      }
    }

    const centerDistance = Math.hypot(sumX / area - centerX, sumY / area - centerY);
    if (area > bestArea || (area === bestArea && centerDistance < bestCenterDistance)) {
      bestArea = area;
      bestCenterDistance = centerDistance;
    }
  }

  const minimumComponentArea = Math.max(
    1,
    Math.floor(
      IsFiniteNumber(options.minimumComponentArea)
        ? options.minimumComponentArea
        : defaultMinimumComponentArea,
    ),
  );
  if (bestArea < minimumComponentArea) return null;
  return 2 * Math.sqrt(bestArea / Math.PI);
}

/**
 * Estimates pupil diameter from dark connected regions in WebGazer eye patches.
 * The result is an image-derived camera-pixel estimate, not a physical pupil measurement.
 */
export function EstimatePupilSizePx(
  eyeFeatures: WebGazerEyeFeaturesLike | null | undefined,
  options: PupilEstimateOptions = {},
): number | null {
  const estimates = [
    EstimatePatchPupilDiameterPx(eyeFeatures?.left, options),
    EstimatePatchPupilDiameterPx(eyeFeatures?.right, options),
  ].filter((estimate): estimate is number => estimate !== null);
  if (estimates.length === 0) return null;
  return estimates.reduce((sum, estimate) => sum + estimate, 0) / estimates.length;
}

export function CreateOculomotorGazeSample(
  timestampMs: number,
  gazePoint: Point2D,
  targetPoint: Point2D,
  pupilSizePxEstimate: number | null,
  blinkEvent: 0 | 1,
  fixationSegment = 0,
): OculomotorGazeSample {
  return [
    timestampMs,
    gazePoint.x,
    gazePoint.y,
    targetPoint.x,
    targetPoint.y,
    Distance(gazePoint, targetPoint),
    IsFiniteNumber(pupilSizePxEstimate) ? pupilSizePxEstimate : null,
    blinkEvent,
    IsFiniteNumber(fixationSegment) ? Math.max(0, Math.floor(fixationSegment)) : 0,
  ];
}

function CalculateTimeToFirstFixation(
  samples: readonly OculomotorGazeSample[],
  fixationRadiusPx: number,
  minimumFixationDurationMs: number,
  maximumSampleGapMs: number,
): number | null {
  let fixationStartMs: number | null = null;
  let previousTimestampMs: number | null = null;
  let previousSegment: number | null = null;
  for (const sample of samples) {
    const timestampMs = sample[0];
    const distancePx = sample[5];
    const fixationSegment = sample[8];
    if (!IsFiniteNumber(timestampMs) || !IsFiniteNumber(distancePx) || distancePx > fixationRadiusPx) {
      fixationStartMs = null;
      previousTimestampMs = null;
      previousSegment = IsFiniteNumber(fixationSegment) ? fixationSegment : null;
      continue;
    }
    if (
      fixationStartMs === null
      || previousTimestampMs === null
      || previousSegment === null
      || fixationSegment !== previousSegment
      || timestampMs < previousTimestampMs
      || timestampMs - previousTimestampMs > maximumSampleGapMs
    ) {
      fixationStartMs = timestampMs;
    }
    previousTimestampMs = timestampMs;
    previousSegment = fixationSegment;
    if (timestampMs - fixationStartMs >= minimumFixationDurationMs) return fixationStartMs;
  }
  return null;
}

export function SummarizeOculomotorGazeSamples(
  samples: readonly OculomotorGazeSample[],
  options: OculomotorGazeSummaryOptions,
): OculomotorGazeSummary {
  const fixationRadiusPx = Math.max(
    0,
    IsFiniteNumber(options.fixationRadiusPx) ? options.fixationRadiusPx : 0,
  );
  const minimumFixationDurationMs = Math.max(
    0,
    IsFiniteNumber(options.minimumFixationDurationMs)
      ? options.minimumFixationDurationMs
      : 100,
  );
  const maximumSampleGapMs = Math.max(
    minimumFixationDurationMs,
    IsFiniteNumber(options.maximumSampleGapMs) ? options.maximumSampleGapMs : 250,
  );
  const validSamples = samples.filter((sample) => (
    IsFiniteNumber(sample[0])
    && IsFiniteNumber(sample[1])
    && IsFiniteNumber(sample[2])
    && IsFiniteNumber(sample[3])
    && IsFiniteNumber(sample[4])
    && IsFiniteNumber(sample[5])
  ));
  const distances = validSamples.map((sample) => sample[5]);
  const gazeSampleCount = distances.length;
  const meanDistancePx = gazeSampleCount > 0
    ? distances.reduce((sum, distance) => sum + distance, 0) / gazeSampleCount
    : null;
  const distanceStandardDeviationPx = meanDistancePx === null
    ? null
    : Math.sqrt(
      distances.reduce((sum, distance) => sum + (distance - meanDistancePx) ** 2, 0)
      / gazeSampleCount,
    );
  const pupilSizes = validSamples
    .map((sample) => sample[6])
    .filter((size): size is number => IsFiniteNumber(size) && size >= 0);
  const aoiSampleCount = distances.filter((distance) => distance <= fixationRadiusPx).length;

  return {
    aoiSampleCount,
    aoiScore: gazeSampleCount > 0 ? Math.round((aoiSampleCount / gazeSampleCount) * 100) : null,
    averagePupilSizePx: pupilSizes.length > 0
      ? pupilSizes.reduce((sum, size) => sum + size, 0) / pupilSizes.length
      : null,
    blinkCount: validSamples.reduce((sum, sample) => sum + (sample[7] === 1 ? 1 : 0), 0),
    distanceStandardDeviationPx,
    gazeSampleCount,
    meanDistancePx,
    timeToFirstFixationMs: CalculateTimeToFirstFixation(
      validSamples,
      fixationRadiusPx,
      minimumFixationDurationMs,
      maximumSampleGapMs,
    ),
  };
}
