export interface PlusMinusSettings { itemsPerList: number; practice: boolean }

export const defaultSettings: PlusMinusSettings = { itemsPerList: 30, practice: true };

export const rangeSettings = [
  { key: 'itemsPerList', zh: '每段數字數', en: 'Numbers per list', min: 6, max: 30, step: 6, unitZh: '個', unitEn: '' },
] as const;

const InRange = (value: unknown, min: number, max: number, step: number) => typeof value === 'number' && Number.isInteger(value)
  && value >= min && value <= max && (value - min) % step === 0;

export function ValidateSettings(settings: PlusMinusSettings): boolean {
  return InRange(settings?.itemsPerList, 6, 30, 6) && typeof settings.practice === 'boolean';
}

export const leadInMs = 1500;
export const practiceCount = 15;
export const practiceFeedbackMs = 600;
// Reading a rule and typing answers have no time limit; these are typical times for the estimate.
const ruleMs = 4000;
const itemMs = 3000;
const copyMs = 2500;

export function EstimatedSeconds(settings: PlusMinusSettings): number {
  const practice = settings.practice ? ruleMs + practiceCount * (copyMs + practiceFeedbackMs) : 0;
  return Math.round((leadInMs + practice + 3 * (ruleMs + settings.itemsPerList * itemMs)) / 1000);
}
