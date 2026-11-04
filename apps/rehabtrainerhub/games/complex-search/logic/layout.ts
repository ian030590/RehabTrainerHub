export interface SearchField { width: number; height: number; symbolPx: number; circleRadius: number }
export interface Position { x: number; y: number; quadrant: number }

export function LayoutItems(count: number, field: SearchField, random: () => number): Position[] {
  const { width, height, symbolPx, circleRadius } = field;
  const spacing = 1.8 * symbolPx;
  if (width <= 2 * symbolPx || height <= 2 * symbolPx) throw new Error('Search field is too small.');
  const positions: Position[] = [];
  const allowed = (x: number, y: number) => x >= symbolPx && x <= width - symbolPx && y >= symbolPx && y <= height - symbolPx
    && Math.hypot(x - width / 2, y - height / 2) >= circleRadius + symbolPx
    && positions.every(other => Math.hypot(x - other.x * width, y - other.y * height) >= spacing - 1e-8);
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    for (let item = 0; item < count / 4; item++) {
      let found = false;
      for (let attempt = 0; attempt < 160; attempt++) {
        const x = (quadrant % 2 ? width / 2 : symbolPx) + random() * (width / 2 - symbolPx);
        const y = (quadrant >= 2 ? height / 2 : symbolPx) + random() * (height / 2 - symbolPx);
        if (!allowed(x, y)) continue;
        positions.push({ x: x / width, y: y / height, quadrant }); found = true; break;
      }
      if (!found) return GridLayout(count, field, random);
    }
  }
  return positions;
}

function GridLayout(count: number, field: SearchField, random: () => number): Position[] {
  const { width, height, symbolPx, circleRadius } = field;
  // A common lattice preserves spacing across quadrant boundaries as well as inside them.
  const step = symbolPx * 1.9;
  const candidates: Position[][] = [[], [], [], []];
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    for (let x = symbolPx; x <= width / 2 - step / 2; x += step) for (let y = symbolPx; y <= height / 2 - step / 2; y += step) {
      const jitterX = Math.max(symbolPx, x + (random() - .5) * .1 * symbolPx);
      const jitterY = Math.max(symbolPx, y + (random() - .5) * .1 * symbolPx);
      const px = quadrant % 2 ? width - jitterX : jitterX, py = quadrant >= 2 ? height - jitterY : jitterY;
      if (Math.hypot(px - width / 2, py - height / 2) < circleRadius + symbolPx) continue;
      candidates[quadrant].push({ x: px / width, y: py / height, quadrant });
    }
  }
  if (candidates.some(cells => cells.length < count / 4)) {
    candidates.forEach(cells => { cells.length = 0; });
    // Staggered rows fit short laptop fields while preserving the same centre separation.
    let row = 0;
    for (let y = symbolPx; y <= height - symbolPx; y += step * Math.sqrt(3) / 2, row++) {
      for (let x = symbolPx + (row % 2) * step / 2; x <= width - symbolPx; x += step) {
        const px = Math.max(symbolPx, x + (random() - .5) * .05 * symbolPx);
        const py = Math.max(symbolPx, y + (random() - .5) * .05 * symbolPx);
        if (px > width - symbolPx || py > height - symbolPx || Math.hypot(px - width / 2, py - height / 2) < circleRadius + symbolPx) continue;
        const quadrant = (px >= width / 2 ? 1 : 0) + (py >= height / 2 ? 2 : 0);
        candidates[quadrant].push({ x: px / width, y: py / height, quadrant });
      }
    }
  }
  return candidates.flatMap(cells => {
    if (cells.length < count / 4) throw new Error('Search field is too small.');
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    return cells.slice(0, count / 4);
  });
}
