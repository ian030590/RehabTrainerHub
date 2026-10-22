export interface GoNoGoSettings { exposureMs: number; rounds: number; practice: boolean }

export const defaultSettings: GoNoGoSettings = { exposureMs: 750, rounds: 350, practice: true };

export const rangeSettings = [
  { key: 'exposureMs', zh: '色塊顯示時間', en: 'Square display time', min: 250, max: 1000, step: 50, unitZh: '毫秒', unitEn: 'ms' },
  { key: 'rounds', zh: '正式色塊數', en: 'Counted squares', min: 50, max: 350, step: 50, unitZh: '個', unitEn: '' },
] as const;

const InRange = (value: unknown, min: number, max: number, step: number) => typeof value === 'number' && Number.isInteger(value)
  && value >= min && value <= max && (value - min) % step === 0;

export function ValidateSettings(settings: GoNoGoSettings): boolean {
  return InRange(settings?.exposureMs, 250, 1000, 50) && InRange(settings.rounds, 50, 350, 50) && typeof settings.practice === 'boolean';
}

export const leadInMs = 1500;
export const practiceItems = 10;

// A counted square averages its display time plus 500 ms; a practice item adds feedback and a pause.
export function EstimatedSeconds(settings: GoNoGoSettings): number {
  const practice = settings.practice ? practiceItems * (settings.exposureMs + 1750) + 3000 : 0;
  return Math.round((leadInMs + practice + settings.rounds * (settings.exposureMs + 500)) / 1000);
}
