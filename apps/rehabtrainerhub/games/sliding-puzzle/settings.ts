export type Difficulty = 'easy' | 'medium' | 'hard';
export interface SlidingPuzzleSettings { difficulty: Difficulty; timeLimitSec: number; soundEnabled: boolean }
export const defaultSettings: SlidingPuzzleSettings = { difficulty: 'medium', timeLimitSec: 0, soundEnabled: true };
export const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
// 0 means no limit.
export const timeLimits = [0, 60, 180, 300];

export function ValidateSettings(settings: SlidingPuzzleSettings): boolean {
  return difficulties.includes(settings?.difficulty) && timeLimits.includes(settings.timeLimitSec) && typeof settings.soundEnabled === 'boolean';
}
