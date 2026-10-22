export type Difficulty = 'easy' | 'medium' | 'hard';
export interface WhackAMoleSettings { difficulty: Difficulty; durationSec: number; soundEnabled: boolean }
export const defaultSettings: WhackAMoleSettings = { difficulty: 'medium', durationSec: 60, soundEnabled: true };
export const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
export const durationRange = { min: 30, max: 300, step: 15 };

export function ValidateSettings(settings: WhackAMoleSettings): boolean {
  const { min, max, step } = durationRange;
  const duration = settings?.durationSec;
  return difficulties.includes(settings?.difficulty) && Number.isInteger(duration) && duration >= min && duration <= max && (duration - min) % step === 0
    && typeof settings.soundEnabled === 'boolean';
}
