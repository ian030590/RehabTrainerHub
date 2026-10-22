export type Difficulty = 'easy' | 'medium' | 'hard';
export interface DotsAndBoxesSettings { difficulty: Difficulty; soundEnabled: boolean }
export const defaultSettings: DotsAndBoxesSettings = { difficulty: 'medium', soundEnabled: true };
export const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];

export function ValidateSettings(settings: DotsAndBoxesSettings): boolean {
  return difficulties.includes(settings?.difficulty) && typeof settings.soundEnabled === 'boolean';
}
