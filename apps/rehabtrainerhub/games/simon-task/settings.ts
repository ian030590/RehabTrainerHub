export interface SimonSettings { trials: number; responseMs: number; itiMs: number }

export const defaultSettings: SimonSettings = { trials: 80, responseMs: 2000, itiMs: 800 };

export const rangeSettings = [
  { key: 'trials', zh: '圖形總數', en: 'Shapes in the session', min: 40, max: 160, step: 20, unitZh: '個', unitEn: '' },
  { key: 'responseMs', zh: '作答時間上限', en: 'Time allowed to answer', min: 1000, max: 3000, step: 250, unitZh: '毫秒', unitEn: 'ms' },
  { key: 'itiMs', zh: '圖形間隔', en: 'Gap between shapes', min: 500, max: 1500, step: 100, unitZh: '毫秒', unitEn: 'ms' },
] as const;

const InRange = (value: unknown, min: number, max: number, step: number) => typeof value === 'number' && Number.isInteger(value)
  && value >= min && value <= max && (value - min) % step === 0;

export function ValidateSettings(settings: SimonSettings): boolean {
  return InRange(settings?.trials, 40, 160, 20) && InRange(settings.responseMs, 1000, 3000, 250) && InRange(settings.itiMs, 500, 1500, 100);
}

export const leadInMs = 1500;

// Assumes a typical answer of about 0.7 seconds per shape.
export function EstimatedSeconds(settings: SimonSettings): number {
  return Math.round(settings.trials * (settings.itiMs + 700) / 1000);
}
