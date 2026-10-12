import { GenerateScatteredPositions } from './gameUtils';

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function GetMovingCardSearchBounds(width: number, height: number, insets: SafeAreaInsets) {
  const y = Math.max(height * 0.18, insets.top + 72);
  return { x: insets.left + width * 0.03, y,
    w: Math.max(1, width - insets.left - insets.right - width * 0.03 * 2),
    h: Math.max(1, height - insets.bottom - Math.max(height * 0.05, 64) - y) };
}

export function CreateMovingCardOptionLayout(count: number, bounds: { x: number; y: number; w: number; h: number }, isCircle: boolean) {
  const columns = 5;
  const rows = Math.max(4, Math.ceil((count + 1) / columns));
  const cellWidth = bounds.w / columns, cellHeight = bounds.h / rows;
  const diameter = Math.min(cellWidth * 0.8, cellHeight * 0.8, Math.sqrt(bounds.w * bounds.h / count) * 0.85);
  const width = isCircle ? diameter : cellWidth * 0.8;
  const height = isCircle ? diameter : cellHeight * 0.8;
  const minDistance = Math.max(width, height) * 1.1;
  const positions = isCircle
    ? GenerateScatteredPositions(count, { x: bounds.x + width / 2, y: bounds.y + height / 2,
      w: Math.max(1, bounds.w - width), h: Math.max(1, bounds.h - height) }, minDistance)
    : Array.from({ length: rows * columns }, (_, index) => ({
      x: bounds.x + (index % columns) * cellWidth + cellWidth * 0.1 + width / 2,
      y: bounds.y + Math.floor(index / columns) * cellHeight + cellHeight * 0.1 + height / 2,
    }));
  return { width, height, minDistance, positions };
}

export function ChooseMovingCardRotation(position: { x: number; y: number }, positions: { x: number; y: number }[],
  assignedRotations: number[], width: number, height: number): number {
  let bestRotation = 0;
  let maxScore = -1;
  for (let candidate = 0; candidate < 12; candidate++) {
    const rotation = (Math.random() - 0.5) * Math.PI;
    let score = Math.PI * 10;
    for (let index = 0; index < assignedRotations.length; index++) {
      const distance = Math.hypot(position.x - positions[index].x, position.y - positions[index].y);
      const threshold = Math.min(width, height) * 0.3;
      if (distance < threshold) {
        const weight = 1 - distance / threshold;
        score = Math.min(score, Math.abs(rotation - assignedRotations[index]) / (weight + 0.01));
      }
    }
    if (score > maxScore) { maxScore = score; bestRotation = rotation; }
  }
  return bestRotation;
}
