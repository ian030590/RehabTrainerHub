// Motion, size, calibration, and color helpers aligned with FoveaFlow defaults.
import type {
  Arena,
  OculomotorBehavior,
  OculomotorPattern,
  OculomotorSpeedUnit,
} from './types';

interface SpeedProfile {
  kind: 'constant' | 'sine' | 'steps' | 'loopRamp';
  minMultiplier?: number;
  maxMultiplier?: number;
  periodSec?: number;
  multipliers?: readonly number[];
  intervalSec?: number;
  transitionSec?: number;
  fromMultiplier?: number;
  toMultiplier?: number;
  resetSec?: number;
}

const fullCircle = Math.PI * 2;

const speedProfiles: Record<OculomotorBehavior, SpeedProfile> = {
  constant: { kind: 'constant' },
  wavePattern: {
    kind: 'sine',
    minMultiplier: 0.45,
    maxMultiplier: 1.55,
    periodSec: 5.2,
  },
  surgePattern: {
    kind: 'steps',
    multipliers: [0.45, 1.65, 0.55, 1.5, 0.8],
    intervalSec: 0.65,
    transitionSec: 0.18,
  },
  alternatingPattern: {
    kind: 'steps',
    multipliers: [0.5, 1.5, 0.65, 1.35],
    intervalSec: 1.25,
    transitionSec: 0.28,
  },
  climbPattern: {
    kind: 'loopRamp',
    fromMultiplier: 0.45,
    toMultiplier: 1.65,
    periodSec: 5.8,
    resetSec: 1.2,
  },
  sizePulse: { kind: 'constant' },
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const smoothStepPrimitive = (value: number) => {
  const progress = clamp01(value);
  return progress ** 3 - progress ** 4 / 2;
};

const integrateStepBucket = (
  current: number,
  next: number,
  elapsedSec: number,
  intervalSec: number,
  transitionSec: number,
) => {
  if (transitionSec <= 0) return current * elapsedSec;
  const transitionStart = intervalSec - transitionSec;
  if (elapsedSec <= transitionStart) return current * elapsedSec;
  const transitionElapsedSec = elapsedSec - transitionStart;
  return current * elapsedSec
    + (next - current) * transitionSec
      * smoothStepPrimitive(transitionElapsedSec / transitionSec);
};

const integrateSteps = (profile: SpeedProfile, elapsedSec: number) => {
  const multipliers = profile.multipliers ?? [1];
  const intervalSec = Math.max(0.1, profile.intervalSec ?? 1);
  const transitionSec = Math.min(intervalSec, Math.max(0, profile.transitionSec ?? 0));
  const cycleSec = intervalSec * multipliers.length;
  const fullCycles = Math.floor(elapsedSec / cycleSec);
  const remainder = elapsedSec - fullCycles * cycleSec;
  let integral = 0;

  for (let index = 0; index < multipliers.length; index += 1) {
    integral += integrateStepBucket(
      multipliers[index] ?? 1,
      multipliers[(index + 1) % multipliers.length] ?? 1,
      intervalSec,
      intervalSec,
      transitionSec,
    );
  }
  integral *= fullCycles;

  const fullBuckets = Math.min(multipliers.length, Math.floor(remainder / intervalSec));
  for (let index = 0; index < fullBuckets; index += 1) {
    integral += integrateStepBucket(
      multipliers[index] ?? 1,
      multipliers[(index + 1) % multipliers.length] ?? 1,
      intervalSec,
      intervalSec,
      transitionSec,
    );
  }

  if (fullBuckets >= multipliers.length) return integral;
  return integral + integrateStepBucket(
    multipliers[fullBuckets] ?? 1,
    multipliers[(fullBuckets + 1) % multipliers.length] ?? 1,
    remainder - fullBuckets * intervalSec,
    intervalSec,
    transitionSec,
  );
};

const integrateLoopRampCycle = (profile: SpeedProfile, elapsedSec: number) => {
  const periodSec = Math.max(0.1, profile.periodSec ?? 1);
  const resetSec = Math.min(periodSec, Math.max(0, profile.resetSec ?? 0));
  const rampSec = Math.max(0.1, periodSec - resetSec);
  const from = profile.fromMultiplier ?? 1;
  const to = profile.toMultiplier ?? 1;
  const rampElapsed = Math.min(elapsedSec, rampSec);
  const rampIntegral = from * rampElapsed
    + (to - from) * rampSec * smoothStepPrimitive(rampElapsed / rampSec);
  if (elapsedSec <= rampSec || resetSec === 0) return rampIntegral;
  const resetElapsed = elapsedSec - rampSec;
  return rampIntegral + to * resetElapsed
    + (from - to) * resetSec * smoothStepPrimitive(resetElapsed / resetSec);
};

const integrateProfile = (profile: SpeedProfile, elapsedSec: number) => {
  if (profile.kind === 'constant') return elapsedSec;
  if (profile.kind === 'sine') {
    const periodSec = Math.max(0.1, profile.periodSec ?? 1);
    const minimum = profile.minMultiplier ?? 1;
    const maximum = profile.maxMultiplier ?? 1;
    const angularFrequency = fullCircle / periodSec;
    const midpoint = (minimum + maximum) / 2;
    const amplitude = (maximum - minimum) / 2;
    return midpoint * elapsedSec
      - (amplitude * Math.cos(angularFrequency * elapsedSec)) / angularFrequency
      + amplitude / angularFrequency;
  }
  if (profile.kind === 'steps') return integrateSteps(profile, elapsedSec);

  const periodSec = Math.max(0.1, profile.periodSec ?? 1);
  const fullCycles = Math.floor(elapsedSec / periodSec);
  const remainder = elapsedSec - fullCycles * periodSec;
  return fullCycles * integrateLoopRampCycle(profile, periodSec)
    + integrateLoopRampCycle(profile, remainder);
};

export function GetOculomotorTravelPx(
  behavior: OculomotorBehavior,
  elapsedSec: number,
  baseSpeedPxPerSec: number,
): number {
  return Math.max(0, baseSpeedPxPerSec)
    * integrateProfile(speedProfiles[behavior] ?? speedProfiles.constant, Math.max(0, elapsedSec));
}

export function GetOculomotorRadiusPx(
  behavior: OculomotorBehavior,
  elapsedSec: number,
  baseRadiusPx: number,
): number {
  if (behavior !== 'sizePulse') return Math.min(100, Math.max(1, baseRadiusPx));
  const wave = (Math.sin((Math.max(0, elapsedSec) / 3.2) * fullCircle) + 1) / 2;
  const multiplier = 0.7 + (1.4 - 0.7) * wave;
  return Math.min(100, Math.max(1, baseRadiusPx * multiplier));
}

export function ConvertOculomotorSpeedToPixels(
  value: number,
  unit: OculomotorSpeedUnit,
  arena: Arena,
  viewingDistanceCm: number,
  cssPxPerCm: number,
): number {
  const safeValue = Math.max(0, Number.isFinite(value) ? value : 0);
  if (unit === 'screen/s') return safeValue * Math.max(1, Math.min(arena.width, arena.height));
  if (unit === 'cm/s') return safeValue * cssPxPerCm;
  const radians = (safeValue * Math.PI) / 180;
  return 2 * viewingDistanceCm * Math.tan(radians / 2) * cssPxPerCm;
}

const reversiblePatterns = new Set<OculomotorPattern>([
  'circle',
  'ellipse',
  'oval',
  'figureEight',
  'wave',
  'perimeterLoop',
  'diamondLoop',
  'clover',
  'zigZag',
  'stairStep',
  'lissajous',
  'hourglass',
  'cornerTour',
]);

export const IsOculomotorPatternReversible = (pattern: OculomotorPattern) =>
  reversiblePatterns.has(pattern);

export function DarkenOculomotorColor(color: number, amount: number): number {
  const scale = Math.min(1, Math.max(0, amount));
  const red = Math.round(((color >> 16) & 0xff) * scale);
  const green = Math.round(((color >> 8) & 0xff) * scale);
  const blue = Math.round((color & 0xff) * scale);
  return (red << 16) | (green << 8) | blue;
}
