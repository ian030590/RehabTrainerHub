export type TimingMode = 'mixed' | 'reproduce' | 'compare' | 'estimate';
export interface TimingSettings { mode: TimingMode; trials: number }

export const defaultSettings: TimingSettings = { mode: 'mixed', trials: 24 };

export const modes: TimingMode[] = ['mixed', 'reproduce', 'compare', 'estimate'];

const InRange = (value: unknown, min: number, max: number, step: number) => typeof value === 'number' && Number.isInteger(value)
  && value >= min && value <= max && (value - min) % step === 0;

export function ValidateSettings(settings: TimingSettings): boolean {
  return modes.includes(settings?.mode) && InRange(settings.trials, 12, 48, 6);
}
