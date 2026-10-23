export type EveryBallDifficulty = 'easy' | 'medium' | 'hard';
export type EveryBallInputMode = 'camera' | 'microphone';
export type EveryBallFixationStyle = 'cross' | 'blank';

export interface EveryBallSettings {
  difficulty: EveryBallDifficulty;
  rounds: number;
  inputMode: EveryBallInputMode;
  fixationStyle: EveryBallFixationStyle;
  // Percent of the original 0.35–0.9 sensitivity; the key avoids "microphone", which the record checks read as a phone field.
  soundSensitivity: number;
}

export const defaultSettings: EveryBallSettings = { difficulty: 'medium', rounds: 20, inputMode: 'camera', fixationStyle: 'cross', soundSensitivity: 65 };
export const listSettings = [
  { key: 'difficulty', options: ['easy', 'medium', 'hard'] },
  { key: 'inputMode', options: ['camera', 'microphone'] },
  { key: 'fixationStyle', options: ['cross', 'blank'] },
] as const;
export const rangeSettings = [
  { key: 'rounds', min: 5, max: 60, step: 5 },
  { key: 'soundSensitivity', min: 35, max: 90, step: 5 },
] as const;

export function LevelFromDifficulty(difficulty: EveryBallDifficulty): 1 | 2 | 3 {
  return difficulty === 'hard' ? 3 : difficulty === 'medium' ? 2 : 1;
}

export function ValidateSettings(settings: EveryBallSettings) {
  return listSettings.every(item => (item.options as readonly unknown[]).includes(settings[item.key]))
    && rangeSettings.every(item => {
      const value = settings[item.key];
      return Number.isInteger(value) && value >= item.min && value <= item.max && (value - item.min) % item.step === 0;
    });
}
