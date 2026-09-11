/**
 * Settings manager with localStorage persistence.
 * Also includes user (account) management and global constants.
 */

// ── Global Constants ──
import { GetAuthUserNameFromToken } from '@rehab-trainer/ui/auth/authClient';
import {
  defaultUiFontSizePx,
  IsUiTheme,
  maxUiFontSizePx,
  minUiFontSizePx,
} from '@rehab-trainer/ui/settings/displaySettings';
import type { UiTheme } from '@rehab-trainer/ui/settings/displaySettings';
import { CreateUserStore } from '@rehab-trainer/ui/storage/userStore';
import {
  CreateRuntimeStorageNamespace,
  MigrateLegacyLocalStorageNamespace,
} from '@rehab-trainer/ui/storage/runtimeNamespace';

export { defaultUiFontSizePx, maxUiFontSizePx, minUiFontSizePx };
export type { UiTheme };

export const cardWidthMm = 85.6;
export const cardHeightMm = 53.98;
export const defaultDistanceCm = 60;
export const defaultCalBarLengthMm = 149;
export const calBarLengthPx = 700;
const runtimeStorageNamespace = CreateRuntimeStorageNamespace('motor');
export const storagePrefix = runtimeStorageNamespace.storagePrefix;

// ── Settings ──
export interface AppSettings {
  distanceInCM: number;
  calBarLengthInMM: number;
  rulerLengthInMM: number;
  soundVolume: number;
  auditoryFeedbackEnabled: boolean;
  downloadDirectory: string;
  displayCalibrationAt: string;
  uiFontSizePx: number;
  uiFontBold: boolean;
  uiTheme: UiTheme;
}

interface SettingMeta<T> {
  dflt: T;
  min?: number;
  max?: number;
}

const appSettingsMeta: { [K in keyof AppSettings]: SettingMeta<AppSettings[K]> } = {
  distanceInCM:           { dflt: defaultDistanceCm,       min: 10,   max: 500 },
  calBarLengthInMM:       { dflt: defaultCalBarLengthMm, min: 1,    max: 10000 },
  rulerLengthInMM:        { dflt: 0,    min: 0,    max: 10000 },
  soundVolume:            { dflt: 50,   min: 0,    max: 100 },
  auditoryFeedbackEnabled:{ dflt: true },
  downloadDirectory:      { dflt: '' },
  displayCalibrationAt: { dflt: '' },
  uiFontSizePx: { dflt: defaultUiFontSizePx, min: minUiFontSizePx, max: maxUiFontSizePx },
  uiFontBold: { dflt: false },
  uiTheme: { dflt: 'light' },
};

function StorageKey(name: string): string {
  return storagePrefix + name;
}

export const activeUserChangedEvent = runtimeStorageNamespace.activeUserChangedEvent;
export const settingsChangedEvent = runtimeStorageNamespace.settingsChangedEvent;
export const appSettingsChangedEvent = settingsChangedEvent;

const legacyMotorStoragePrefixes = ['motor_trainer_', 'motor-trainer-'] as const;
MigrateLegacyLocalStorageNamespace({
  canonicalPrefix: storagePrefix,
  legacyPrefixes: legacyMotorStoragePrefixes,
  mergeJsonArraySuffixes: ['users', 'training_records_v1'],
});

const settingCache: Partial<AppSettings> = {};

export function GetSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  if (Object.prototype.hasOwnProperty.call(settingCache, key)) {
    return settingCache[key] as AppSettings[K];
  }

  const raw = localStorage.getItem(StorageKey(key));
  if (raw === null) {
    settingCache[key] = appSettingsMeta[key].dflt;
    return appSettingsMeta[key].dflt;
  }

  const settingMeta = appSettingsMeta[key];
  if (typeof settingMeta.dflt === 'boolean') {
    const value = (raw === 'true') as AppSettings[K];
    settingCache[key] = value;
    return value;
  }
  if (typeof settingMeta.dflt === 'number') {
    const num = parseFloat(raw);
    if (isNaN(num) || (settingMeta.min !== undefined && num < settingMeta.min) || (settingMeta.max !== undefined && num > settingMeta.max)) {
      settingCache[key] = settingMeta.dflt;
      return settingMeta.dflt;
    }
    settingCache[key] = num as AppSettings[K];
    return settingCache[key] as AppSettings[K];
  }
  if (key === 'uiTheme') {
    const value = (IsUiTheme(raw) ? raw : settingMeta.dflt) as AppSettings[K];
    settingCache[key] = value;
    return value;
  }
  settingCache[key] = raw as unknown as AppSettings[K];
  return settingCache[key] as AppSettings[K];
}

export function SetSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  settingCache[key] = value;
  localStorage.setItem(StorageKey(key), String(value));
  window.dispatchEvent(new CustomEvent(settingsChangedEvent, {
    detail: { key, value },
  }));
}

export function IsCalibrated(): boolean {
  return (
    GetSetting('displayCalibrationAt') !== '' ||
    GetSetting('distanceInCM') !== defaultDistanceCm ||
    GetSetting('calBarLengthInMM') !== defaultCalBarLengthMm
  );
}

export function MarkDisplayCalibrated(): void {
  SetSetting('displayCalibrationAt', new Date().toISOString());
}

export function ClearDisplayCalibration(): void {
  SetSetting('displayCalibrationAt', '');
}

export function GetPixelsPerMM(): number {
  return calBarLengthPx / GetSetting('calBarLengthInMM');
}

export function GetMMPerPixel(): number {
  return GetSetting('calBarLengthInMM') / calBarLengthPx;
}

// ── User Management (simple name-only) ──
export const userStore = CreateUserStore({
  activeUserChangedEvent: activeUserChangedEvent,
  storagePrefix: storagePrefix,
});

export const addUser = userStore.addUser;
export const getActiveUser = () => GetAuthUserNameFromToken() || userStore.getActiveUser();
export const getUsers = userStore.getUsers;
export const removeUser = userStore.removeUser;
export const setActiveUser = userStore.setActiveUser;
