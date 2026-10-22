export interface BlinkSettings { trials: number; itemMs: number }

export const defaultSettings: BlinkSettings = { trials: 36, itemMs: 100 };

export const rangeSettings = [
  { key: 'trials', zh: '回數', en: 'Streams in the session', min: 24, max: 72, step: 12, unitZh: '回', unitEn: '' },
  { key: 'itemMs', zh: '每個字的顯示時間', en: 'Time per character', min: 80, max: 150, step: 10, unitZh: '毫秒', unitEn: 'ms' },
] as const;

const InRange = (value: unknown, min: number, max: number, step: number) => typeof value === 'number' && Number.isInteger(value)
  && value >= min && value <= max && (value - min) % step === 0;

export function ValidateSettings(settings: BlinkSettings): boolean {
  return InRange(settings?.trials, 24, 72, 12) && InRange(settings.itemMs, 80, 150, 10);
}

export const fixationMs = 800;
export const feedbackMs = 800;

// Allows about three seconds for the two answers in each stream of 20 characters.
export function EstimatedSeconds(settings: BlinkSettings): number {
  return Math.round(settings.trials * (fixationMs + 20 * settings.itemMs + 3000 + feedbackMs) / 1000);
}
