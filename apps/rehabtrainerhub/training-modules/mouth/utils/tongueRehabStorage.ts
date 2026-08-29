import { storagePrefix } from './settings';
import {
  tongueCatchConfigBounds,
  tongueCatchDefaults,
  type TongueCatchConfig,
} from '../tongue-catch/config';

export type TongueTrainingSettings = TongueCatchConfig;
export const tongueTrainingConfigBounds = tongueCatchConfigBounds;

const tongueSettingsVersion = 2;
const previousDefaults = {
  growthRate: 180,
  appleSpeed: 115,
  spawnIntervalSec: 1.6,
} as const;

export const defaultTongueSettings: TongueTrainingSettings = {
  ...tongueCatchDefaults,
};

export function GetTongueTrainingSettings(userId: string): TongueTrainingSettings {
  try {
    const raw = localStorage.getItem(SettingsKey(userId));
    if (!raw) return { ...defaultTongueSettings };
    const parsed = JSON.parse(raw) as Partial<TongueTrainingSettings> & { settingsVersion?: number };
    const shouldMigrateDefaults = (parsed.settingsVersion ?? 1) < tongueSettingsVersion;
    return {
      sensitivity: ClampNumber(parsed.sensitivity, tongueTrainingConfigBounds.sensitivity.min, tongueTrainingConfigBounds.sensitivity.max, defaultTongueSettings.sensitivity),
      growthRate: shouldMigrateDefaults && parsed.growthRate === previousDefaults.growthRate
        ? defaultTongueSettings.growthRate
        : ClampNumber(parsed.growthRate, tongueTrainingConfigBounds.growthRate.min, tongueTrainingConfigBounds.growthRate.max, defaultTongueSettings.growthRate),
      durationSec: ClampNumber(parsed.durationSec, tongueTrainingConfigBounds.durationSec.min, tongueTrainingConfigBounds.durationSec.max, defaultTongueSettings.durationSec),
      appleSpeed: shouldMigrateDefaults && parsed.appleSpeed === previousDefaults.appleSpeed
        ? defaultTongueSettings.appleSpeed
        : ClampNumber(parsed.appleSpeed, tongueTrainingConfigBounds.appleSpeed.min, tongueTrainingConfigBounds.appleSpeed.max, defaultTongueSettings.appleSpeed),
      spawnIntervalSec: shouldMigrateDefaults && parsed.spawnIntervalSec === previousDefaults.spawnIntervalSec
        ? defaultTongueSettings.spawnIntervalSec
        : ClampNumber(parsed.spawnIntervalSec, tongueTrainingConfigBounds.spawnIntervalSec.min, tongueTrainingConfigBounds.spawnIntervalSec.max, defaultTongueSettings.spawnIntervalSec),
      edgeChance: ClampNumber(parsed.edgeChance, tongueTrainingConfigBounds.edgeChance.min, tongueTrainingConfigBounds.edgeChance.max, defaultTongueSettings.edgeChance),
      cameraOpacity: ClampNumber(parsed.cameraOpacity, tongueTrainingConfigBounds.cameraOpacity.min, tongueTrainingConfigBounds.cameraOpacity.max, defaultTongueSettings.cameraOpacity),
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
