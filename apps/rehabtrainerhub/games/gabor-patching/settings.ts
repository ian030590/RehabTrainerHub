export interface GaborSettings {
  difficulty: 'easy' | 'medium' | 'hard';
  durationSec: number;
  maxSpots: number;
  soundEnabled: boolean;
}

export const defaultSettings: GaborSettings = { difficulty: 'medium', durationSec: 60, maxSpots: 8, soundEnabled: true };
export const numericSettings = [
  { key: 'durationSec', zh: '刺激時間（秒）', en: 'Stimulus duration (s)', min: 30, max: 180, step: 15 },
  { key: 'maxSpots', zh: '最大刺激數', en: 'Maximum patches', min: 3, max: 20, step: 1 },
] as const;

export function ValidateSettings(settings: GaborSettings): boolean {
  return ['easy', 'medium', 'hard'].includes(settings.difficulty) && typeof settings.soundEnabled === 'boolean'
    && numericSettings.every(field => Number.isFinite(settings[field.key]) && settings[field.key] >= field.min
      && settings[field.key] <= field.max && (settings[field.key] - field.min) % field.step === 0);
}
