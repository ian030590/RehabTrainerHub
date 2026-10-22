export type Difficulty = 'easy' | 'medium' | 'hard';
export type BoardSize = 'small' | 'medium' | 'large';
export interface MinesweeperSettings { difficulty: Difficulty; boardSize: BoardSize; soundEnabled: boolean }
export const defaultSettings: MinesweeperSettings = { difficulty: 'medium', boardSize: 'medium', soundEnabled: true };
export const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
export const boardSizeOptions: BoardSize[] = ['small', 'medium', 'large'];

export function ValidateSettings(settings: MinesweeperSettings): boolean {
  return difficulties.includes(settings?.difficulty) && boardSizeOptions.includes(settings.boardSize) && typeof settings.soundEnabled === 'boolean';
}
