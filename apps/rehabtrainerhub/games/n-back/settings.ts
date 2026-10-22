export interface NBackSettings { exposureMs: number; rounds: number; practice: boolean }

export const defaultSettings: NBackSettings = { exposureMs: 500, rounds: 350, practice: true };

export const rangeSettings = [
  { key: 'exposureMs', zh: '字母顯示時間', en: 'Letter display time', min: 100, max: 1000, step: 100, unitZh: '毫秒', unitEn: 'ms' },
  { key: 'rounds', zh: '正式字母數', en: 'Counted letters', min: 50, max: 350, step: 50, unitZh: '個', unitEn: '' },
] as const;

const InRange = (value: unknown, min: number, max: number, step: number) => typeof value === 'number' && Number.isInteger(value)
  && value >= min && value <= max && (value - min) % step === 0;

export function ValidateSettings(settings: NBackSettings): boolean {
  return InRange(settings?.exposureMs, 100, 1000, 100) && InRange(settings.rounds, 50, 350, 50) && typeof settings.practice === 'boolean';
}

export const leadInMs = 1500;
export const practiceItems = 25;

// Upper bound: every letter waits the full 2 s window. Answering ends a letter early, and rests between blocks are not counted.
export function EstimatedSeconds(settings: NBackSettings): number {
  const parts = settings.rounds / 50 + (settings.practice ? 1 : 0);
  const practice = settings.practice ? practiceItems * 3000 : 0;
  return Math.round((parts * leadInMs + practice + settings.rounds * 2250) / 1000);
}
