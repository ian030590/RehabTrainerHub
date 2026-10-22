export interface DigitSpanSettings { itemExposureMs: number; rounds: number; practice: boolean }

export const defaultSettings: DigitSpanSettings = { itemExposureMs: 800, rounds: 28, practice: true };

export const rangeSettings = [
  { key: 'itemExposureMs', zh: '每個數字顯示時間', en: 'Time per digit', min: 200, max: 1600, step: 100, unitZh: '毫秒', unitEn: 'ms' },
  { key: 'rounds', zh: '正式題數', en: 'Counted sequences', min: 16, max: 28, step: 2, unitZh: '題', unitEn: '' },
] as const;

const InRange = (value: unknown, min: number, max: number, step: number) => typeof value === 'number' && Number.isInteger(value)
  && value >= min && value <= max && (value - min) % step === 0;

export function ValidateSettings(settings: DigitSpanSettings): boolean {
  return InRange(settings?.itemExposureMs, 200, 1600, 100) && InRange(settings.rounds, 16, 28, 2) && typeof settings.practice === 'boolean';
}

export const practiceItems = 2;

// Each sequence: 2 s for its length and a blank, the digits, about 1 s per digit to type, then feedback and a pause.
// Counted sequences assume 5 digits and practice uses 3, so this is an estimate.
export function EstimatedSeconds(settings: DigitSpanSettings): number {
  const sequence = (digits: number) => 3500 + digits * (settings.itemExposureMs + 200 + 1000);
  return Math.round((settings.rounds * sequence(5) + (settings.practice ? practiceItems * sequence(3) : 0)) / 1000);
}
