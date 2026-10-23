export interface TongueSettings {
  sensitivityPercent: number;
  durationSec: number;
  edgeChancePercent: number;
  growthRate: number;
  appleSpeed: number;
  spawnIntervalSec: number;
}

// The first three are the Hub form's fields; the last three were only in the original in-game panel.
export const defaultSettings: TongueSettings = {
  sensitivityPercent: 65, durationSec: 60, edgeChancePercent: 40, growthRate: 240, appleSpeed: 90, spawnIntervalSec: 2.2,
};
export const rangeSettings = [
  { key: 'sensitivityPercent', min: 45, max: 95, step: 5 },
  { key: 'durationSec', min: 30, max: 300, step: 15 },
  { key: 'edgeChancePercent', min: 0, max: 90, step: 5 },
  { key: 'growthRate', min: 80, max: 360, step: 20 },
  { key: 'appleSpeed', min: 60, max: 260, step: 10 },
  { key: 'spawnIntervalSec', min: 0.6, max: 3.5, step: 0.1 },
] as const;
export type RangeKey = typeof rangeSettings[number]['key'];

export function ValidateSettings(settings: TongueSettings) {
  return rangeSettings.every(({ key, min, max, step }) => {
    const value = settings[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min - 1e-9 || value > max + 1e-9) return false;
    const steps = (value - min) / step;
    return Math.abs(steps - Math.round(steps)) < 1e-6;
  });
}

export function ToPlayConfig(settings: TongueSettings) {
  return {
    sensitivity: settings.sensitivityPercent / 100, durationSec: settings.durationSec, edgeChance: settings.edgeChancePercent / 100,
    growthRate: settings.growthRate, appleSpeed: settings.appleSpeed, spawnIntervalSec: settings.spawnIntervalSec,
  };
}
export type PlayConfig = ReturnType<typeof ToPlayConfig>;
