export type Speed = 'slow' | 'medium' | 'fast';
export type MathLevel = 'easy' | 'harder';
export interface DividedSettings { durationSec: number; speed: Speed; mathLevel: MathLevel }

export const defaultSettings: DividedSettings = { durationSec: 120, speed: 'medium', mathLevel: 'easy' };

export const speeds: Speed[] = ['slow', 'medium', 'fast'];
export const mathLevels: MathLevel[] = ['easy', 'harder'];

const InRange = (value: unknown, min: number, max: number, step: number) => typeof value === 'number' && Number.isInteger(value)
  && value >= min && value <= max && (value - min) % step === 0;

export function ValidateSettings(settings: DividedSettings): boolean {
  return InRange(settings?.durationSec, 60, 240, 30) && speeds.includes(settings.speed) && mathLevels.includes(settings.mathLevel);
}
