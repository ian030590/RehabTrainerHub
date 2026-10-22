export type SchulteOrder = 'ascending' | 'descending';
export interface SchulteSettings { gridSize: number; rounds: number; order: SchulteOrder; markFound: boolean }

export const defaultSettings: SchulteSettings = { gridSize: 5, rounds: 3, order: 'ascending', markFound: true };

export const rangeSettings = [
  { key: 'gridSize', zh: '方格大小', en: 'Grid size', min: 3, max: 7, step: 1 },
  { key: 'rounds', zh: '回合數', en: 'Rounds', min: 1, max: 10, step: 1 },
] as const;

const InRange = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

export function ValidateSettings(settings: SchulteSettings): boolean {
  return InRange(settings?.gridSize, 3, 7) && InRange(settings.rounds, 1, 10)
    && (settings.order === 'ascending' || settings.order === 'descending') && typeof settings.markFound === 'boolean';
}
