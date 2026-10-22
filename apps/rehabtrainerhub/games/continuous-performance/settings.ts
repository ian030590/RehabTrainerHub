export type CptVariant = 'x' | 'ax';
export interface CptSettings { variant: CptVariant; trials: number; targetPercent: number; letterMs: number; isiMs: number }

export const defaultSettings: CptSettings = { variant: 'x', trials: 150, targetPercent: 20, letterMs: 200, isiMs: 1000 };

export const rangeSettings = [
  { key: 'trials', zh: '字母總數', en: 'Letters in the session', min: 100, max: 400, step: 50, unitZh: '個', unitEn: '' },
  { key: 'targetPercent', zh: '目標比例', en: 'Share of targets', min: 10, max: 30, step: 5, unitZh: '%', unitEn: '%' },
  { key: 'letterMs', zh: '字母顯示時間', en: 'Letter display time', min: 100, max: 500, step: 50, unitZh: '毫秒', unitEn: 'ms' },
  { key: 'isiMs', zh: '字母間隔', en: 'Gap between letters', min: 800, max: 2000, step: 100, unitZh: '毫秒', unitEn: 'ms' },
] as const;

const InRange = (value: unknown, min: number, max: number, step: number) => typeof value === 'number' && Number.isInteger(value)
  && value >= min && value <= max && (value - min) % step === 0;

export function ValidateSettings(settings: CptSettings): boolean {
  return (settings?.variant === 'x' || settings?.variant === 'ax') && InRange(settings.trials, 100, 400, 50)
    && InRange(settings.targetPercent, 10, 30, 5) && InRange(settings.letterMs, 100, 500, 50) && InRange(settings.isiMs, 800, 2000, 100);
}

export const leadInMs = 2000;

export function EstimatedSeconds(settings: CptSettings): number {
  return Math.round(settings.trials * (settings.letterMs + settings.isiMs) / 1000);
}
