export interface StopSignalSettings { responseWindowMs: number; rounds: number; practice: boolean; keyGuide: boolean }

export const defaultSettings: StopSignalSettings = { responseWindowMs: 1850, rounds: 600, practice: true, keyGuide: false };

export const rangeSettings = [
  { key: 'responseWindowMs', zh: '每個形狀的作答時間', en: 'Answer time per shape', min: 1000, max: 3000, step: 50, unitZh: '毫秒', unitEn: 'ms' },
  { key: 'rounds', zh: '正式形狀數', en: 'Counted shapes', min: 100, max: 600, step: 100, unitZh: '個', unitEn: '' },
] as const;

const InRange = (value: unknown, min: number, max: number, step: number) => typeof value === 'number' && Number.isInteger(value)
  && value >= min && value <= max && (value - min) % step === 0;

export function ValidateSettings(settings: StopSignalSettings): boolean {
  return InRange(settings?.responseWindowMs, 1000, 3000, 50) && InRange(settings.rounds, 100, 600, 100)
    && typeof settings.practice === 'boolean' && typeof settings.keyGuide === 'boolean';
}

export const leadInMs = 1500;
export const practiceItems = 32;

// Each part starts with a lead-in; every item is a 500 ms fixation plus the answer time, and practice adds feedback.
// Rests between parts wait for the player and are not counted.
export function EstimatedSeconds(settings: StopSignalSettings): number {
  const parts = settings.rounds / 50 + (settings.practice ? 2 : 0);
  const practice = settings.practice ? practiceItems * (500 + settings.responseWindowMs + 750) : 0;
  return Math.round((parts * leadInMs + practice + settings.rounds * (500 + settings.responseWindowMs)) / 1000);
}
