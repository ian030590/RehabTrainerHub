/**
 * General math and random utilities.
 */

/** Shuffle an array in-place (Fisher-Yates) */
export function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/** Random integer in [min, max] inclusive */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Clamp value */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Generate random uppercase letter string */
export function generateRandomLetters(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Ease-out cubic */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Ease-in-out quad */
export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Generate scattered non-overlapping positions.
 * Rejection sampling with fallback.
 */
export function generateScatteredPositions(
  count: number,
  bounds: { x: number; y: number; w: number; h: number },
  minDist: number,
  maxRetries = 100
): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    let bestPos = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const px = bounds.x + Math.random() * bounds.w;
      const py = bounds.y + Math.random() * bounds.h;
      let overlap = false;
      for (const existing of positions) {
        const dx = px - existing.x;
        const dy = py - existing.y;
        if (dx * dx + dy * dy < minDist * minDist) {
          overlap = true;
          break;
        }
      }
      if (!overlap) {
        bestPos = { x: px, y: py };
        break;
      }
    }
    if (bestPos) {
      positions.push(bestPos);
    } else {
      positions.push({
        x: bounds.x + Math.random() * bounds.w,
        y: bounds.y + Math.random() * bounds.h,
      });
    }
  }
  return positions;
}
