export interface SpatialSpanSettings { itemExposureMs: number; rounds: number; boardSize: number; practice: boolean }

export const defaultSettings: SpatialSpanSettings = { itemExposureMs: 1000, rounds: 28, boardSize: 5, practice: true };

export const boardSizes = [3, 4, 5] as const;

export const rangeSettings = [
  { key: 'itemExposureMs', zh: '每個方格亮起時間', en: 'Time per square', min: 250, max: 2000, step: 250, unitZh: '毫秒', unitEn: 'ms' },
  { key: 'rounds', zh: '正式題數', en: 'Counted sequences', min: 16, max: 28, step: 2, unitZh: '題', unitEn: '' },
] as const;

const InRange = (value: unknown, min: number, max: number, step: number) => typeof value === 'number' && Number.isInteger(value)
  && value >= min && value <= max && (value - min) % step === 0;

export function ValidateSettings(settings: SpatialSpanSettings): boolean {
  return InRange(settings?.itemExposureMs, 250, 2000, 250) && InRange(settings.rounds, 16, 28, 2)
    && boardSizes.includes(settings.boardSize as typeof boardSizes[number]) && typeof settings.practice === 'boolean';
}

export const practiceItems = 2;

// Each sequence: 3 s for its length, a pause and the empty board, the squares, about 1 s per square to tap, then feedback and a pause.
// Counted sequences assume 5 squares and practice uses 3, so this is an estimate.
export function EstimatedSeconds(settings: SpatialSpanSettings): number {
  const sequence = (squares: number) => 4500 + squares * (settings.itemExposureMs + 1000);
  return Math.round((settings.rounds * sequence(5) + (settings.practice ? practiceItems * sequence(3) : 0)) / 1000);
}
