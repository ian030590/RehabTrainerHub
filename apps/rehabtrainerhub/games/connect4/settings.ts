export type Difficulty = 'easy' | 'medium' | 'hard';
export interface Connect4Settings { difficulty: Difficulty; soundEnabled: boolean }
export const defaultSettings: Connect4Settings = { difficulty: 'medium', soundEnabled: true };
export const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];

export function ValidateSettings(settings: Connect4Settings): boolean {
  return difficulties.includes(settings?.difficulty) && typeof settings.soundEnabled === 'boolean';
}
