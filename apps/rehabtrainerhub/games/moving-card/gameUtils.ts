export function ShuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function GenerateRandomLetters(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function GenerateScatteredPositions(
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
