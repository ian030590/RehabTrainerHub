/**
 * Acuity logic: conversions between stroke-pixels, LogMAR, decimal VA,
 * Snellen fraction, and the BestPEST 0–1 scale.
 *
 * Based on FrACT10's MiscSpace.j and FractControllerAcuity.j.
 */

import { PixelFromDegree, DegreeFromPixel } from '../../../utils/spatialUtils';

// ── LogMAR ↔ decimal VA ──

/** decimal VA → LogMAR */
export function LogMARFromDecVA(decVA: number): number {
  return -Math.log10(decVA);
}

/** LogMAR → decimal VA */
export function DecVAFromLogMAR(logMAR: number): number {
  return Math.pow(10, -logMAR);
}

// ── stroke pixels ↔ decimal VA ──

/** Given stroke size in pixels → decimal VA */
export function DecVAFromStrokePixels(px: number): number {
  return 1 / 60 / DegreeFromPixel(px);
}

/** decimal VA → stroke size in pixels */
export function StrokePixelsFromDecVA(decVA: number): number {
  return PixelFromDegree(1 / 60 / decVA);
}

// ── stroke pixels ↔ LogMAR ──

/** stroke pixels → LogMAR */
export function LogMARFromStrokePixels(px: number): number {
  return LogMARFromDecVA(DecVAFromStrokePixels(px));
}

/** LogMAR → stroke pixels */
export function StrokePixelsFromLogMAR(logMAR: number): number {
  return StrokePixelsFromDecVA(DecVAFromLogMAR(logMAR));
}

// ── Letter score ──

/** LogMAR → ETDRS letter score (85 − 50 × logMAR) */
export function LettersFromLogMAR(logMAR: number): number {
  return 85 - 50 * logMAR;
}

// ── Snellen fraction ──

/** Format a Snellen fraction string (e.g. "20/20") */
export function FormatSnellenFraction(decVA: number): string {
  // Use 20 as standard denominator base
  const testDistFeet = 20;
  const denominator = Math.round(testDistFeet / decVA);
  return `${testDistFeet}/${denominator}`;
}

// ── BestPEST ↔ device (stroke-px) mapping ──
// Exponential mapping: t=0 → strokeMin, t=1 → strokeMax
// stroke = c1 * exp(t * c2),  where c2 = ln(strokeMax/strokeMin), c1 = strokeMin

/**
 * Compute the min and max stroke sizes in pixels for the current screen.
 */
export function GetStrokeBounds(viewWidth: number, viewHeight: number): {
  strokeMin: number;
  strokeMax: number;
} {
  const strokeMin = 0.5; // half a pixel
  // leave margin around the largest optotype (5× stroke = optotype side)
  const strokeMax = Math.min(viewHeight, viewWidth) / (5 + 1);
  return { strokeMin, strokeMax };
}

/**
 * Convert BestPEST normalised value (0–1) to stroke size in pixels.
 * 0 → smallest (hardest), 1 → largest (easiest).
 */
export function StimDeviceFromThresholder(
  tPest: number,
  strokeMin: number,
  strokeMax: number,
): number {
  const c2 = -Math.log(strokeMin / strokeMax);
  const c1 = strokeMin;
  let val = c1 * Math.exp(tPest * c2);
  val = Math.max(strokeMin, Math.min(strokeMax, val));
  return val;
}

/**
 * Convert stroke size in pixels back to the 0–1 scale.
 */
export function StimThresholderFromDevice(
  d: number,
  strokeMin: number,
  strokeMax: number,
): number {
  const c2 = -Math.log(strokeMin / strokeMax);
  const c1 = strokeMin;
  return Math.log(d / c1) / c2;
}

// ── Starting-size logic (DIN 01.02.04.08) ──

/** Determine the starting logMAR. FrACT default = 1.0 */
export const startingLogMar = 1.0;

/**
 * Get default trial count for a given number of alternatives.
 */
export function DefaultTrialCount(nAlternatives: number): number {
  if (nAlternatives <= 4) return 24;
  if (nAlternatives <= 8) return 18;
  return 18; // 10-alternative letters
}
