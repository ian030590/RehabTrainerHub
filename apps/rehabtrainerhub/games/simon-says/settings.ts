export type Difficulty = 'easy' | 'medium' | 'hard';
export interface SimonSaysSettings { difficulty: Difficulty; lives: number; soundEnabled: boolean }
export const defaultSettings: SimonSaysSettings = { difficulty: 'medium', lives: 3, soundEnabled: true };
export const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
export const livesOptions = [1, 3, 5];

export function ValidateSettings(settings: SimonSaysSettings): boolean {
  return difficulties.includes(settings?.difficulty) && livesOptions.includes(settings.lives) && typeof settings.soundEnabled === 'boolean';
}
