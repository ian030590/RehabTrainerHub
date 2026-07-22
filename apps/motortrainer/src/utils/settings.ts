/**
 * Settings manager with localStorage persistence.
 * Also includes user (account) management and global constants.
 */

// ── Global Constants ──
import { GetAuthUserNameFromToken } from '@rehab-trainer/ui/auth/authClient';
import { CreateUserStore } from '@rehab-trainer/ui/storage/userStore';

export const cardWidthMm = 85.6;
export const cardHeightMm = 53.98;
export const defaultDistanceCm = 60;
export const defaultCalBarLengthMm = 149;
export const calBarLengthPx = 700;
export const storagePrefix = 'motor_trainer_';
export const defaultUiFontSizePx = 18;
export const minUiFontSizePx = 14;
export const maxUiFontSizePx = 30;


export const drivingDurationMinSec = 80;
export const drivingDurationMaxSec = 240;
export type DrivingControlMode = 'arrow' | 'wasd' | 'wheel';
export type UiTheme = 'light' | 'dark' | 'contrast';

// ── Settings ──
export interface AppSettings {
  distanceInCM: number;
  calBarLengthInMM: number;
  rulerLengthInMM: number;
  totalRounds: number;
  optionCount: number;
  optionMoveIntervalMs: number;
  targetPhysicalSizeMm: number;
  optionPhysicalSizeMm: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  soundVolume: number;
  auditoryFeedbackEnabled: boolean;
  downloadDirectory: string;
  oculomotorMode: 'pursuit' | 'reaction-jumps' | 'multi-object' | 'lilac-chaser';
  oculomotorPattern: string;
  oculomotorDurationSec: number;
  oculomotorSpeedDegPerSec: number;
  oculomotorTargetSizeMm: number;
  oculomotorDistractorCount: number;
  oculomotorTargetColor: string;
  oculomotorBackgroundColor: string;
  oculomotorTargetShape: string;
  oculomotorCustomTargetImage: string;
  oculomotorTargetOpacity: number;
  oculomotorBackgroundImage: string;
  oculomotorAudio: string;
  oculomotorBounceJitter: number;
  displayCalibrationAt: string;
  readingWPS: number;
  readingStoryId: string;
  drivingDurationSec: number;
  drivingRedFlashEnabled: boolean;
  drivingDifficulty: 'beginner' | 'intermediate' | 'advanced';
  drivingControlMode: DrivingControlMode;
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
  totalRounds:            { dflt: 5,    min: 1,    max: 100 },
  optionCount:            { dflt: 18,   min: 4,    max: 40 },
  optionMoveIntervalMs:   { dflt: 800,  min: 200,  max: 5000 },
  targetPhysicalSizeMm:   { dflt: 15,   min: 2,    max: 100 },
  optionPhysicalSizeMm:   { dflt: 10,   min: 2,    max: 80 },
  difficulty:             { dflt: 'beginner' },
  soundVolume:            { dflt: 50,   min: 0,    max: 100 },
  auditoryFeedbackEnabled:{ dflt: true },
  downloadDirectory:      { dflt: '' },
  oculomotorMode:         { dflt: 'pursuit' },
  oculomotorPattern:      { dflt: 'randomWalk' },
  oculomotorDurationSec:  { dflt: 60,   min: 15,   max: 300 },
  oculomotorSpeedDegPerSec: { dflt: 10, min: 2,    max: 80 },
  oculomotorTargetSizeMm: { dflt: 10,   min: 2,    max: 50 },
  oculomotorDistractorCount: { dflt: 5, min: 0,    max: 12 },
  oculomotorTargetColor:   { dflt: '#FFFFFF' },
  oculomotorBackgroundColor: { dflt: '#000000' },
  oculomotorTargetShape:   { dflt: 'circle' },
  oculomotorCustomTargetImage: { dflt: '' },
  oculomotorTargetOpacity: { dflt: 1.0, min: 0.1, max: 1.0 },
  oculomotorBackgroundImage: { dflt: '' },
  oculomotorAudio: { dflt: '' },
  oculomotorBounceJitter: { dflt: 0, min: 0, max: 100 },
  displayCalibrationAt: { dflt: '' },
  readingWPS: { dflt: 4, min: 1, max: 20 },
  readingStoryId: { dflt: 'en_story_01' },
  drivingDurationSec: { dflt: drivingDurationMinSec, min: drivingDurationMinSec, max: drivingDurationMaxSec },
  drivingRedFlashEnabled: { dflt: true },
  drivingDifficulty: { dflt: 'beginner' },
  drivingControlMode: { dflt: 'arrow' },
  uiFontSizePx: { dflt: defaultUiFontSizePx, min: minUiFontSizePx, max: maxUiFontSizePx },
  uiFontBold: { dflt: false },
  uiTheme: { dflt: 'light' },
};

function StorageKey(name: string): string {
  return storagePrefix + name;
}

export const activeUserChangedEvent = 'motor-trainer-active-user-changed';
export const settingsChangedEvent = 'motor-trainer-settings-changed';

const settingCache: Partial<AppSettings> = {};

function IsUiTheme(value: string): value is UiTheme {
  return value === 'light' || value === 'dark' || value === 'contrast';
}

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
