export type Difficulty = 'easy' | 'medium' | 'hard';
export interface TicTacToeSettings { difficulty: Difficulty; soundEnabled: boolean }

export const defaultSettings: TicTacToeSettings = { difficulty: 'medium', soundEnabled: true };
export const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];

export function ValidateSettings(settings: TicTacToeSettings): boolean {
  return difficulties.includes(settings?.difficulty) && typeof settings.soundEnabled === 'boolean';
}
