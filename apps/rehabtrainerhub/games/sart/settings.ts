export interface SartSettings { trials: number; noGoDigit: number; digitMs: number; maskMs: number }

export const defaultSettings: SartSettings = { trials: 135, noGoDigit: 3, digitMs: 250, maskMs: 900 };

export const rangeSettings = [
  { key: 'trials', zh: '數字總數', en: 'Digits in the session', min: 45, max: 225, step: 45, unitZh: '個', unitEn: '' },
  { key: 'digitMs', zh: '數字顯示時間', en: 'Digit display time', min: 150, max: 400, step: 50, unitZh: '毫秒', unitEn: 'ms' },
  { key: 'maskMs', zh: '遮罩時間', en: 'Mask time', min: 600, max: 1500, step: 100, unitZh: '毫秒', unitEn: 'ms' },
] as const;

const InRange = (value: unknown, min: number, max: number, step: number) => typeof value === 'number' && Number.isInteger(value)
  && value >= min && value <= max && (value - min) % step === 0;

export function ValidateSettings(settings: SartSettings): boolean {
  return InRange(settings?.trials, 45, 225, 45) && InRange(settings.noGoDigit, 1, 9, 1)
    && InRange(settings.digitMs, 150, 400, 50) && InRange(settings.maskMs, 600, 1500, 100);
}

export const leadInMs = 2000;

export function EstimatedSeconds(settings: SartSettings): number {
  return Math.round(settings.trials * (settings.digitMs + settings.maskMs) / 1000);
}
