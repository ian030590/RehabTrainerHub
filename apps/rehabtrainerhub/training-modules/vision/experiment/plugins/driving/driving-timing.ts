export interface FrameAlignedReactionTime {
  rtMs: number;
  rawRtMs: number;
  frameCount: number;
}

export interface ReactionTimeSummary {
  averageMs: number;
  medianMs: number;
}

export interface DrivingFixedStepResult {
  stepCount: number;
  nextAccumulatorMs: number;
  simulatedMs: number;
  droppedMs: number;
}

/** Keep input event timestamps on the current performance timeline. */
export function NormalizeDrivingInputTimestamp(
  value: number,
  now: number,
  maxAgeMs = 1_000,
) {
  const safeNow = Number.isFinite(now) ? Math.max(0, now) : 0;
  const safeMaxAge = Number.isFinite(maxAgeMs) ? Math.max(0, maxAgeMs) : 1_000;
  if (!Number.isFinite(value) || value <= 0) return safeNow;
  if (value > safeNow || safeNow - value > safeMaxAge) return safeNow;
  return value;
}

export function CalculateDrivingFixedSteps(
  accumulatorMs: number,
  frameDurationMs: number,
  fixedStepMs = 1000 / 120,
  maxCatchUpMs = 250,
): DrivingFixedStepResult {
  const safeAccumulator = Number.isFinite(accumulatorMs) ? Math.max(0, accumulatorMs) : 0;
  const safeFrameDuration = Number.isFinite(frameDurationMs) ? Math.max(0, frameDurationMs) : 0;
  const safeStep = Number.isFinite(fixedStepMs) && fixedStepMs > 0 ? fixedStepMs : 1000 / 120;
  const safeCatchUp = Number.isFinite(maxCatchUpMs) && maxCatchUpMs > 0 ? maxCatchUpMs : 250;
  const acceptedFrameDuration = Math.min(safeFrameDuration, safeCatchUp);
  const availableMs = safeAccumulator + acceptedFrameDuration;
  const stepCount = Math.floor((availableMs + 0.000001) / safeStep);
  const simulatedMs = stepCount * safeStep;
  return {
    stepCount,
    nextAccumulatorMs: Math.max(0, availableMs - simulatedMs),
    simulatedMs,
    droppedMs: Math.max(0, safeFrameDuration - acceptedFrameDuration),
  };
}

/** Estimate the vsync at which a render completed on the measured frame grid. */
export function CalculateEstimatedPresentationTime(
  frameTimestamp: number,
  renderCompletedAt: number,
  refreshMs: number,
) {
  if (!Number.isFinite(refreshMs) || refreshMs <= 0) return renderCompletedAt;
  const renderDuration = Math.max(0, renderCompletedAt - frameTimestamp);
  return frameTimestamp + Math.max(1, Math.ceil(renderDuration / refreshMs)) * refreshMs;
}

/** Convert two rAF timestamps to a duration on the measured display frame grid. */
export function CalculateFrameAlignedReactionTime(
  presentedAt: number,
  respondedAt: number,
  refreshMs: number,
): FrameAlignedReactionTime {
  const rawRtMs = Math.max(0, respondedAt - presentedAt);
  if (!Number.isFinite(refreshMs) || refreshMs <= 0) {
    return {
      rtMs: Math.round(rawRtMs),
      rawRtMs,
      frameCount: 0,
    };
  }

  const frameCount = rawRtMs > 0 ? Math.max(1, Math.round(rawRtMs / refreshMs)) : 0;
  return {
    rtMs: Math.round(frameCount * refreshMs),
    rawRtMs,
    frameCount,
  };
}

export function SummarizeReactionTimes(values: Array<number | null | undefined>): ReactionTimeSummary {
  const valid = values
    .filter((value): value is number => Number.isFinite(value))
    .sort((left, right) => left - right);
  if (valid.length === 0) return { averageMs: 0, medianMs: 0 };

  const averageMs = Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
  const middle = Math.floor(valid.length / 2);
  const medianMs = valid.length % 2 === 1
    ? valid[middle]
    : Math.round((valid[middle - 1] + valid[middle]) / 2);
  return { averageMs, medianMs };
}
