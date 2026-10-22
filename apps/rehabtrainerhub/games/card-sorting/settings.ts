export interface SortingSettings { runLength: number; categories: number; maxCards: number }

export const defaultSettings: SortingSettings = { runLength: 6, categories: 6, maxCards: 72 };

export const rangeSettings = [
  { key: 'runLength', zh: '連續答對幾張後換規則', en: 'Correct sorts in a row before the rule changes', min: 6, max: 10, step: 1, unitZh: '張', unitEn: '' },
  { key: 'categories', zh: '要完成的規則數', en: 'Rules to complete', min: 3, max: 6, step: 1, unitZh: '個', unitEn: '' },
  { key: 'maxCards', zh: '卡片上限', en: 'Most cards used', min: 48, max: 96, step: 24, unitZh: '張', unitEn: '' },
] as const;

const InRange = (value: unknown, min: number, max: number, step: number) => typeof value === 'number' && Number.isInteger(value)
  && value >= min && value <= max && (value - min) % step === 0;

export function ValidateSettings(settings: SortingSettings): boolean {
  return InRange(settings?.runLength, 6, 10, 1) && InRange(settings.categories, 3, 6, 1) && InRange(settings.maxCards, 48, 96, 24);
}
