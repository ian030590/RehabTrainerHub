export interface TowerSettings { problemLimitMs: number; practice: boolean }

export const defaultSettings: TowerSettings = { problemLimitMs: 20000, practice: true };

export const rangeSettings = [
  // Stored in ms like the original; shown in seconds.
  { key: 'problemLimitMs', zh: '每題時限', en: 'Time per problem', min: 10000, max: 60000, step: 5000, unitZh: '秒', unitEn: 's', scale: 1000 },
] as const;

export function ValidateSettings(settings: TowerSettings): boolean {
  const limit = settings?.problemLimitMs;
  return typeof limit === 'number' && Number.isInteger(limit) && limit >= 10000 && limit <= 60000 && (limit - 10000) % 5000 === 0
    && typeof settings.practice === 'boolean';
}

export const countedProblems = 12;
// Result shown for 2 s, then a 0.5 s pause.
export const afterProblemMs = 2500;

// Upper bound: every problem uses its full time. Pauses before each problem are not counted.
export function EstimatedSeconds(settings: TowerSettings): number {
  const count = countedProblems + (settings.practice ? 1 : 0);
  return Math.round(count * (settings.problemLimitMs + afterProblemMs) / 1000);
}
