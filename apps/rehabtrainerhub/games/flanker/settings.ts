export type FlankerStimulus = 'arrows' | 'letters';
export interface FlankerSettings { responseWindowMs: number; rounds: number; practice: boolean; stimulus: FlankerStimulus }

export const defaultSettings: FlankerSettings = { responseWindowMs: 1500, rounds: 100, practice: true, stimulus: 'arrows' };

export const rangeSettings = [
  { key: 'responseWindowMs', zh: '作答時間上限', en: 'Time allowed to answer', min: 500, max: 3000, step: 100, unitZh: '毫秒', unitEn: 'ms' },
  { key: 'rounds', zh: '正式題數', en: 'Counted items', min: 20, max: 100, step: 20, unitZh: '題', unitEn: '' },
] as const;

const InRange = (value: unknown, min: number, max: number, step: number) => typeof value === 'number' && Number.isInteger(value)
  && value >= min && value <= max && (value - min) % step === 0;

export function ValidateSettings(settings: FlankerSettings): boolean {
  return InRange(settings?.responseWindowMs, 500, 3000, 100) && InRange(settings.rounds, 20, 100, 20)
    && typeof settings.practice === 'boolean' && ['arrows', 'letters'].includes(settings.stimulus);
}

export const leadInMs = 1500;
export const practiceItems = 12;

// Each item: 0.5 s cross, about 0.6 s to answer, 1 s feedback and a 0.5 s gap.
export function EstimatedSeconds(settings: FlankerSettings): number {
  const items = settings.rounds + (settings.practice ? practiceItems : 0);
  return Math.round((leadInMs + items * 2600 + (settings.practice ? 3000 : 0)) / 1000);
}
