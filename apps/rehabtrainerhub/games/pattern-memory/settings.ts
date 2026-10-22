export interface PatternSettings { trials: number; studyMs: number; startLoad: number; adaptive: boolean }

export const defaultSettings: PatternSettings = { trials: 30, studyMs: 1500, startLoad: 3, adaptive: true };

const InRange = (value: unknown, min: number, max: number, step: number) => typeof value === 'number' && Number.isInteger(value)
  && value >= min && value <= max && (value - min) % step === 0;

export function ValidateSettings(settings: PatternSettings): boolean {
  return InRange(settings?.trials, 20, 60, 5) && InRange(settings.studyMs, 500, 3000, 250) && InRange(settings.startLoad, 2, 6, 1)
    && typeof settings.adaptive === 'boolean';
}
