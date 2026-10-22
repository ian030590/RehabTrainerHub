export interface NumberLetterSettings { responseWindowMs: number; rounds: number; practice: boolean }

export const defaultSettings: NumberLetterSettings = { responseWindowMs: 0, rounds: 192, practice: true };

export const rangeSettings = [
  { key: 'responseWindowMs', zh: '作答時限', en: 'Answer time limit', min: 0, max: 5000, step: 250, unitZh: '毫秒', unitEn: 'ms' },
  { key: 'rounds', zh: '正式作答數', en: 'Counted items', min: 96, max: 192, step: 32, unitZh: '題', unitEn: '' },
] as const;

const InRange = (value: unknown, min: number, max: number, step: number) => typeof value === 'number' && Number.isInteger(value)
  && value >= min && value <= max && (value - min) % step === 0;

export function ValidateSettings(settings: NumberLetterSettings): boolean {
  return InRange(settings?.responseWindowMs, 0, 5000, 250) && InRange(settings.rounds, 96, 192, 32) && typeof settings.practice === 'boolean';
}

export const leadInMs = 1500;
export const practiceItems = 12;
// Typical answer time used for the estimate when there is no time limit.
const typicalAnswerMs = 1500;

// With a time limit this is an upper bound; without one it assumes a typical answer time. Rests are not counted.
export function EstimatedSeconds(settings: NumberLetterSettings): number {
  const answer = (settings.responseWindowMs || typicalAnswerMs) + 150;
  const parts = 3 + (settings.practice ? 1 : 0);
  const practice = settings.practice ? practiceItems * (answer + 1000) : 0;
  return Math.round((parts * leadInMs + practice + settings.rounds * answer) / 1000);
}
