// Settings this device remembers. Unlimited duration is stored as 0; an uploaded background image
// stays on the device only for the current visit, so it is remembered as the star background.
export interface DrawingSettings {
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  gameDurationSec: number;
  customDuration: boolean;
  customGameDurationSec: number;
  maxHp: number;
  speed: number;
  strictness: number;
  strokeWaitMs: number;
  backgroundMode: 'stars' | 'color';
  backgroundColor: string;
  soundEnabled: boolean;
}

export const defaultSettings: DrawingSettings = { difficulty: 'Beginner', gameDurationSec: 30, customDuration: false,
  customGameDurationSec: 120, maxHp: 3, speed: 5, strictness: 20, strokeWaitMs: 300,
  backgroundMode: 'stars', backgroundColor: '#005EB8', soundEnabled: true };

const IsWhole = (value: number, min: number, max: number, step = 1) => Number.isInteger(value) && value >= min && value <= max && (value - min) % step === 0;

export function ValidateSettings(settings: DrawingSettings): boolean {
  return ['Beginner', 'Intermediate', 'Advanced'].includes(settings.difficulty)
    && typeof settings.customDuration === 'boolean' && IsWhole(settings.customGameDurationSec, 1, 3600)
    && (settings.customDuration ? settings.gameDurationSec === settings.customGameDurationSec : [30, 60, 300, 0].includes(settings.gameDurationSec))
    && IsWhole(settings.maxHp, 1, 20) && IsWhole(settings.speed, 1, 20) && IsWhole(settings.strictness, 10, 90)
    && IsWhole(settings.strokeWaitMs, 100, 2000, 50) && ['stars', 'color'].includes(settings.backgroundMode)
    && /^#[0-9a-f]{6}$/i.test(settings.backgroundColor) && typeof settings.soundEnabled === 'boolean';
}
