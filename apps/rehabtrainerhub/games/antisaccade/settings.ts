export interface AntisaccadeSettings { exposureMs: number; rounds: number; practice: boolean }

export const defaultSettings: AntisaccadeSettings = { exposureMs: 150, rounds: 90, practice: true };

export const rangeSettings = [
  { key: 'exposureMs', zh: '箭頭出現時間', en: 'Arrow time', min: 50, max: 300, step: 25, unitZh: '毫秒', unitEn: 'ms' },
  { key: 'rounds', zh: '正式題數', en: 'Counted items', min: 30, max: 90, step: 30, unitZh: '題', unitEn: '' },
] as const;

const InRange = (value: unknown, min: number, max: number, step: number) => typeof value === 'number' && Number.isInteger(value)
  && value >= min && value <= max && (value - min) % step === 0;

export function ValidateSettings(settings: AntisaccadeSettings): boolean {
  return InRange(settings?.exposureMs, 50, 300, 25) && InRange(settings.rounds, 30, 90, 30) && typeof settings.practice === 'boolean';
}

export const leadInMs = 1500;
export const practiceItems = 22;
export const fixationMs = 500;
export const cueMs = 225;
export const maskMs = 1000;
export const practiceFeedbackMs = 800;
export const breakMs = 3000;

// Each item: the cross, the square, the arrow and the mask; practice items add feedback, then a break before the counted items.
export function EstimatedSeconds(settings: AntisaccadeSettings): number {
  const items = settings.rounds + (settings.practice ? practiceItems : 0);
  const practice = settings.practice ? practiceItems * practiceFeedbackMs + breakMs : 0;
  return Math.round((leadInMs + items * (fixationMs + cueMs + settings.exposureMs + maskMs) + practice) / 1000);
}
