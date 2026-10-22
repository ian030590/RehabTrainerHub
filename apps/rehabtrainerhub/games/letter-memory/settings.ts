export interface LetterMemorySettings { itemExposureMs: number; rounds: number; practice: boolean }

export const defaultSettings: LetterMemorySettings = { itemExposureMs: 2000, rounds: 12, practice: true };

export const rangeSettings = [
  { key: 'itemExposureMs', zh: '每個字母的顯示時間', en: 'Time per letter', min: 500, max: 3000, step: 100, unitZh: '毫秒', unitEn: 'ms' },
  { key: 'rounds', zh: '正式題數', en: 'Counted sequences', min: 3, max: 12, step: 3, unitZh: '題', unitEn: '' },
] as const;

const InRange = (value: unknown, min: number, max: number, step: number) => typeof value === 'number' && Number.isInteger(value)
  && value >= min && value <= max && (value - min) % step === 0;

export function ValidateSettings(settings: LetterMemorySettings): boolean {
  return InRange(settings?.itemExposureMs, 500, 3000, 100) && InRange(settings.rounds, 3, 12, 3) && typeof settings.practice === 'boolean';
}

export const leadInMs = 1500;
export const practiceFeedbackMs = 2000;
// Pressing start and typing have no time limit; these are typical times for the estimate.
const startMs = 2000;
const answerMs = 6000;
const pauseMs = 500;
const meanLength = 8;
const practiceLetters = 5 + 7;

export function EstimatedSeconds(settings: LetterMemorySettings): number {
  const counted = settings.rounds * (startMs + pauseMs + meanLength * settings.itemExposureMs + answerMs);
  const practice = settings.practice ? 2 * (startMs + pauseMs + answerMs + practiceFeedbackMs) + practiceLetters * settings.itemExposureMs : 0;
  return Math.round((leadInMs + counted + practice) / 1000);
}
