export interface KeepTrackSettings { itemExposureMs: number; rounds: number; practice: boolean }

export const defaultSettings: KeepTrackSettings = { itemExposureMs: 1500, rounds: 9, practice: true };

export const rangeSettings = [
  { key: 'itemExposureMs', zh: '每個詞的顯示時間', en: 'Time per word', min: 500, max: 3000, step: 100, unitZh: '毫秒', unitEn: 'ms' },
  { key: 'rounds', zh: '正式組數', en: 'Counted blocks', min: 3, max: 9, step: 3, unitZh: '組', unitEn: '' },
] as const;

const InRange = (value: unknown, min: number, max: number, step: number) => typeof value === 'number' && Number.isInteger(value)
  && value >= min && value <= max && (value - min) % step === 0;

export function ValidateSettings(settings: KeepTrackSettings): boolean {
  return InRange(settings?.itemExposureMs, 500, 3000, 100) && InRange(settings.rounds, 3, 9, 3) && typeof settings.practice === 'boolean';
}

export const leadInMs = 1500;
export const practiceLoad = 3;
export const wordsPerBlock = 15;
// Reading the targets, answering and reading practice feedback have no time limit; these are typical times for the estimate.
const readTargetsMs = 3000;
const answerPerCategoryMs = 2000;
const practiceFeedbackMs = 3000;
const pauseMs = 500;

export function EstimatedSeconds(settings: KeepTrackSettings): number {
  const blocks = settings.rounds + (settings.practice ? 1 : 0);
  // Counted blocks hold 3, 4 and 5 targets equally often, so they average 4.
  const answers = settings.rounds * 4 + (settings.practice ? practiceLoad : 0);
  return Math.round((leadInMs + blocks * (readTargetsMs + pauseMs + wordsPerBlock * settings.itemExposureMs)
    + answers * answerPerCategoryMs + (settings.practice ? practiceFeedbackMs : 0)) / 1000);
}
