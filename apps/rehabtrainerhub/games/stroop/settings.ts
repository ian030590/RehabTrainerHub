export interface StroopSettings { responseWindowMs: number; rounds: number; practice: boolean }

export const defaultSettings: StroopSettings = { responseWindowMs: 1500, rounds: 96, practice: true };

export const rangeSettings = [
  { key: 'responseWindowMs', zh: '作答時間上限', en: 'Time allowed to answer', min: 500, max: 3000, step: 100, unitZh: '毫秒', unitEn: 'ms' },
  { key: 'rounds', zh: '正式題數', en: 'Counted items', min: 12, max: 96, step: 12, unitZh: '題', unitEn: '' },
] as const;

const InRange = (value: unknown, min: number, max: number, step: number) => typeof value === 'number' && Number.isInteger(value)
  && value >= min && value <= max && (value - min) % step === 0;

export function ValidateSettings(settings: StroopSettings): boolean {
  return InRange(settings?.responseWindowMs, 500, 3000, 100) && InRange(settings.rounds, 12, 96, 12) && typeof settings.practice === 'boolean';
}

export const leadInMs = 1500;
export const practiceItems = 24;

// Each item: 0.5 s cross, 0.5 s blank, about 0.7 s to answer, 0.5 s feedback and a 0.25 s gap.
export function EstimatedSeconds(settings: StroopSettings): number {
  const items = settings.rounds + (settings.practice ? practiceItems : 0);
  return Math.round((leadInMs + items * 2450 + (settings.practice ? 3000 : 0)) / 1000);
}
