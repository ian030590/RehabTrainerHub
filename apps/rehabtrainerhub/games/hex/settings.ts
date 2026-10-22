export type Difficulty = 'easy' | 'medium' | 'hard';
export interface HexSettings { difficulty: Difficulty; soundEnabled: boolean }
export const defaultSettings: HexSettings = { difficulty: 'medium', soundEnabled: true };
export const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];

export function ValidateSettings(settings: HexSettings): boolean {
  return difficulties.includes(settings?.difficulty) && typeof settings.soundEnabled === 'boolean';
}
