export interface AntSettings { responseWindowMs: number; rounds: number; practice: boolean }

export const defaultSettings: AntSettings = { responseWindowMs: 1700, rounds: 144, practice: true };

export const rangeSettings = [
  { key: 'responseWindowMs', zh: '箭頭作答時間', en: 'Answer time per row', min: 500, max: 1800, step: 100, unitZh: '毫秒', unitEn: 'ms' },
  { key: 'rounds', zh: '正式題數', en: 'Counted items', min: 48, max: 144, step: 48, unitZh: '題', unitEn: '' },
] as const;

const InRange = (value: unknown, min: number, max: number, step: number) => typeof value === 'number' && Number.isInteger(value)
  && value >= min && value <= max && (value - min) % step === 0;

export function ValidateSettings(settings: AntSettings): boolean {
  return InRange(settings?.responseWindowMs, 500, 1800, 100) && InRange(settings.rounds, 48, 144, 48) && typeof settings.practice === 'boolean';
}

export const leadInMs = 1500;
export const practiceItems = 24;

// Every item fills 3.5 s and each part starts with a lead-in. Rests between parts wait for the player and are not counted.
export function EstimatedSeconds(settings: AntSettings): number {
  const parts = settings.rounds / 48 + (settings.practice ? 1 : 0);
  return Math.round((parts * leadInMs + ((settings.practice ? practiceItems : 0) + settings.rounds) * 3500) / 1000);
}
