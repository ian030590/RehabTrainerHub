export interface HexSettings { rings: number; rounds: number; centerChecks: boolean }

export const defaultSettings: HexSettings = { rings: 2, rounds: 3, centerChecks: true };

export const rangeSettings = [
  { key: 'rings', zh: '圈數', en: 'Rings', min: 2, max: 3, step: 1 },
  { key: 'rounds', zh: '回合數', en: 'Rounds', min: 1, max: 5, step: 1 },
] as const;

const InRange = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

export function ValidateSettings(settings: HexSettings): boolean {
  return InRange(settings?.rings, 2, 3) && InRange(settings.rounds, 1, 5) && typeof settings.centerChecks === 'boolean';
}

// Centre checks wait 4 to 8 seconds between flashes and stay up for 1.5 seconds.
export const centerCheckTiming = { minGapMs: 4000, maxGapMs: 8000, windowMs: 1500 };
