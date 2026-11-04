import type { SaccadeSettings } from '../settings';

export interface FieldSize { width: number; height: number; symbolPx: number }
export interface SearchItem { id: number; symbol: string; target: boolean; quadrant: number; x: number; y: number }
export interface SearchScreen extends FieldSize { target: string; symbolSizeDeg: number; items: SearchItem[] }

export function CreateRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

function Shuffle<T>(items: T[], random: () => number): T[] {
  for (let index = items.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

export function GenerateScreen(settings: SaccadeSettings, field: FieldSize, seed: number, screenIndex: number, previous: string | null): SearchScreen {
  const { width, height, symbolPx } = field;
  if (![width, height, symbolPx].every(value => Number.isFinite(value) && value > 0)) throw new Error('Insufficient screen space');
  const random = CreateRandom(seed);
  const digits = '0123456789'.split('').filter(value => value !== previous);
  const target = digits[Math.floor(random() * digits.length)];
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const distractors = (settings.distractors === 'mixed' ? '0123456789' + letters : letters).split('').filter(value => value !== target);
  const targets = Array.from({ length: 4 }, () => Math.floor(settings.targetsPerScreen / 4));
  const others = Array.from({ length: 4 }, () => Math.floor((settings.itemsPerScreen - settings.targetsPerScreen) / 4));
  for (let extra = 0; extra < settings.targetsPerScreen % 4; extra++) targets[(screenIndex + extra) % 4]++;
  for (let extra = 0; extra < (settings.itemsPerScreen - settings.targetsPerScreen) % 4; extra++) others[(screenIndex + settings.targetsPerScreen % 4 + extra) % 4]++;
  const margin = Math.max(symbolPx, 22);
  const spacing = Math.max(2 * symbolPx, 44);
  const items: SearchItem[] = [];
  // A shuffled jittered lattice preserves spacing even on crowded touch screens.
  const jitter = Math.min(3, symbolPx * .08), step = spacing + 2 * jitter;
  // An even, centred count per axis makes the quadrants mirror images, so left and right offer the same positions.
  const latticeLine = (length: number) => {
    const fit = Math.floor((length - 2 * (margin + jitter)) / step) + 1;
    const count = Math.max(0, fit - (fit % 2));
    const start = (length - (count - 1) * step) / 2;
    return Array.from({ length: count }, (_, index) => start + index * step);
  };
  const candidates: { x: number; y: number }[][] = [[], [], [], []];
  for (const y of latticeLine(height)) {
    for (const x of latticeLine(width)) {
      if (Math.hypot(x - width / 2, y - height / 2) < 3 * symbolPx + Math.SQRT2 * jitter) continue;
      const q = Number(x >= width / 2) + 2 * Number(y >= height / 2);
      candidates[q].push({ x, y });
    }
  }
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const positions = Shuffle(candidates[quadrant], random);
    const count = targets[quadrant] + others[quadrant];
    if (positions.length < count) throw new Error('Insufficient screen space for this symbol size and item count');
    const kinds = Shuffle([...Array<boolean>(targets[quadrant]).fill(true), ...Array<boolean>(others[quadrant]).fill(false)], random);
    for (let index = 0; index < count; index++) {
      const position = positions[index], isTarget = kinds[index];
      const x = position.x + (random() * 2 - 1) * jitter, y = position.y + (random() * 2 - 1) * jitter;
      // Keep jitter on its own side of the quadrant boundary.
      const safeX = quadrant % 2 ? Math.max(width / 2 + .01, x) : Math.min(width / 2 - .01, x);
      const safeY = quadrant >= 2 ? Math.max(height / 2 + .01, y) : Math.min(height / 2 - .01, y);
      items.push({ id: items.length, symbol: isTarget ? target : distractors[Math.floor(random() * distractors.length)], target: isTarget,
        quadrant, x: safeX / width, y: safeY / height });
    }
  }
  return { ...field, target, symbolSizeDeg: settings.symbolSizeDeg, items };
}
