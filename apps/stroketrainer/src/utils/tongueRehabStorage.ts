import { storagePrefix } from './settings';

const tongueSettingsVersion = 2;
const previousDefaults = {
  growthRate: 180,
  appleSpeed: 115,
  spawnIntervalSec: 1.6,
} as const;

export interface TongueTrainingSettings {
  sensitivity: number;
  growthRate: number;
  durationSec: number;
  appleSpeed: number;
  spawnIntervalSec: number;
  edgeChance: number;
  cameraOpacity: number;
}

export const defaultTongueSettings: TongueTrainingSettings = {
  sensitivity: 0.65,
  growthRate: 240,
  durationSec: 60,
  appleSpeed: 90,
  spawnIntervalSec: 2.2,
  edgeChance: 0.4,
  cameraOpacity: 0.78,
};

export function GetTongueTrainingSettings(userId: string): TongueTrainingSettings {
  try {
    const raw = localStorage.getItem(SettingsKey(userId));
    if (!raw) return { ...defaultTongueSettings };
    const parsed = JSON.parse(raw) as Partial<TongueTrainingSettings> & { settingsVersion?: number };
    const shouldMigrateDefaults = (parsed.settingsVersion ?? 1) < tongueSettingsVersion;
    return {
      sensitivity: ClampNumber(parsed.sensitivity, 0.45, 0.95, defaultTongueSettings.sensitivity),
      growthRate: shouldMigrateDefaults && parsed.growthRate === previousDefaults.growthRate
        ? defaultTongueSettings.growthRate
        : ClampNumber(parsed.growthRate, 80, 360, defaultTongueSettings.growthRate),
      durationSec: ClampNumber(parsed.durationSec, 30, 300, defaultTongueSettings.durationSec),
      appleSpeed: shouldMigrateDefaults && parsed.appleSpeed === previousDefaults.appleSpeed
        ? defaultTongueSettings.appleSpeed
        : ClampNumber(parsed.appleSpeed, 60, 260, defaultTongueSettings.appleSpeed),
      spawnIntervalSec: shouldMigrateDefaults && parsed.spawnIntervalSec === previousDefaults.spawnIntervalSec
        ? defaultTongueSettings.spawnIntervalSec
        : ClampNumber(parsed.spawnIntervalSec, 0.6, 3.5, defaultTongueSettings.spawnIntervalSec),
      edgeChance: ClampNumber(parsed.edgeChance, 0, 0.9, defaultTongueSettings.edgeChance),
      cameraOpacity: ClampNumber(parsed.cameraOpacity, 0.25, 1, defaultTongueSettings.cameraOpacity),
    };
  } catch {
    return { ...defaultTongueSettings };
  }
}

export function SaveTongueTrainingSettings(userId: string, settings: TongueTrainingSettings): void {
  localStorage.setItem(SettingsKey(userId), JSON.stringify({
    ...settings,
    settingsVersion: tongueSettingsVersion,
  }));
}

function SettingsKey(userId: string): string {
  return `${storagePrefix}tongue_settings_${encodeURIComponent(userId)}`;
}

function ClampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}
