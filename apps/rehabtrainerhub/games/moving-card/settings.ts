export interface MovingCardSettings {
  difficulty: 'easy' | 'medium' | 'hard';
  rounds: number;
  soundEnabled: boolean;
  optionCount: number;
  optionMoveIntervalMs: number;
  targetPhysicalSizeMm: number;
  optionPhysicalSizeMm: number;
  calibrationLengthMm: number;
}

export const defaultSettings: MovingCardSettings = { difficulty: 'medium', rounds: 10, soundEnabled: true,
  optionCount: 18, optionMoveIntervalMs: 800, targetPhysicalSizeMm: 15, optionPhysicalSizeMm: 10,
  calibrationLengthMm: 149 };

export const numericSettings = [
  { key: 'rounds', min: 5, max: 40, step: 5, zh: '回合數', en: 'Rounds' },
  { key: 'optionCount', min: 4, max: 40, step: 1, zh: '選項數量', en: 'Option count' },
  { key: 'optionMoveIntervalMs', min: 200, max: 5000, step: 100, zh: '移動間隔（毫秒）', en: 'Movement interval (ms)' },
  { key: 'targetPhysicalSizeMm', min: 2, max: 100, step: 1, zh: '目標大小（毫米）', en: 'Target size (mm)' },
  { key: 'optionPhysicalSizeMm', min: 2, max: 80, step: 1, zh: '選項大小（毫米）', en: 'Option size (mm)' },
] as const;

export function ValidateSettings(settings: MovingCardSettings): boolean {
  return ['easy', 'medium', 'hard'].includes(settings.difficulty) && typeof settings.soundEnabled === 'boolean'
    && Number.isFinite(settings.calibrationLengthMm) && settings.calibrationLengthMm >= 1 && settings.calibrationLengthMm <= 10000
    && numericSettings.every(({ key, min, max, step }) => Number.isInteger(settings[key])
      && settings[key] >= min && settings[key] <= max && (settings[key] - min) % step === 0);
}

// Retain the original 700px calibration formula; the game owns its calibration input.
export function PixelFromMillimeter(mm: number, calibrationLengthMm = 149): number {
  return mm * 700 / calibrationLengthMm;
}
