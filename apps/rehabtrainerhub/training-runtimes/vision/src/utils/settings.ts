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
import type {
  OculomotorBehavior,
  OculomotorLetterWeight,
  OculomotorPattern,
  OculomotorSpeedUnit,
  OculomotorTargetShape,
} from '@rehab-trainer/hub-modules/vision/pages/training/oculomotor/types';

export { defaultUiFontSizePx, maxUiFontSizePx, minUiFontSizePx };
export type { UiTheme };

export const cardWidthMm = 85.6;
export const cardHeightMm = 53.98;
export const defaultDistanceCm = 60;
export const defaultCalBarLengthMm = 149;
export const defaultGammaValue = 2.0;
export const calBarLengthPx = 700;
export const appVersion = '3.0.0';
const runtimeStorageNamespace = CreateRuntimeStorageNamespace('vision');
export const storagePrefix = runtimeStorageNamespace.storagePrefix;
export const appSettingsChangedEvent = runtimeStorageNamespace.settingsChangedEvent;
export const drivingDurationMinSec = 80;
export const drivingDurationMaxSec = 240;
export type DrivingControlMode = 'arrow' | 'wasd' | 'wheel' | 'touch';
export type DrivingRenderQualityLevel = 'low' | 'medium' | 'high';

// ── Settings ──
export interface AppSettings {
  distanceInCM: number;
  calBarLengthInMM: number;
  rulerLengthInMM: number;
  gammaValue: number;
  crowdingType: number;
  crowdingDistanceType: number;
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
  oculomotorPattern: OculomotorPattern;
  oculomotorDurationSec: number;
  oculomotorSpeedDegPerSec: number;
  oculomotorTargetSizeMm: number;
  oculomotorBehavior: OculomotorBehavior;
  oculomotorSpeedUnit: OculomotorSpeedUnit;
  oculomotorSpeedValue: number;
  oculomotorTargetRadiusPx: number;
  oculomotorTargetCount: number;
  oculomotorDistractorCount: number;
  oculomotorDistractorBrightness: number;
  oculomotorTargetColor: string;
  oculomotorBackgroundColor: string;
  oculomotorTargetShape: OculomotorTargetShape;
  oculomotorCustomTargetImage: string;
  oculomotorTargetOpacity: number;
  oculomotorBackgroundImage: string;
  oculomotorAudio: string;
  oculomotorBounceJitter: number;
  oculomotorMotionDirection: 1 | -1;
  oculomotorShowTrail: boolean;
  oculomotorLetterEnabled: boolean;
  oculomotorLetterColor: string;
  oculomotorLetterWeight: OculomotorLetterWeight;
  oculomotorLetterScale: number;
  oculomotorLilacChaserScale: number;
  oculomotorLilacChaserColor: string;
  oculomotorViewingDistanceCm: number;
  oculomotorCssPxPerCm: number;
  preferentialLookingInputMode: 'keyboard' | 'webgazer';
  webGazerCalibrationAt: string;
  displayCalibrationAt: string;
  oculomotorEnableWebgazer: boolean;
  oculomotorShowGazepoint: boolean;
  readingWPS: number;
  readingCrowding: number;
  readingContrast: number;
  readingStoryId: string;
  drivingDurationSec: number;
  drivingRedFlashEnabled: boolean;
  drivingDifficulty: 'beginner' | 'intermediate' | 'advanced';
  drivingControlMode: DrivingControlMode;
  drivingWheelCalibration: string;
  drivingRenderQuality: DrivingRenderQualityLevel;
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
  gammaValue:             { dflt: defaultGammaValue,  min: 0.8,  max: 4.0 },
  crowdingType:           { dflt: 0,    min: 0,    max: 6 },
  crowdingDistanceType:   { dflt: 0,    min: 0,    max: 3 },
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
  oculomotorBehavior: { dflt: 'constant' },
  oculomotorSpeedUnit: { dflt: 'deg/s' },
  oculomotorSpeedValue: { dflt: 20, min: 0.01, max: 143 },
  oculomotorTargetRadiusPx: { dflt: 35, min: 4, max: 100 },
  oculomotorTargetCount: { dflt: 1, min: 1, max: 6 },
  oculomotorDistractorCount: { dflt: 5, min: 0, max: 10 },
  oculomotorDistractorBrightness: { dflt: 0.7, min: 0.35, max: 1 },
  oculomotorTargetColor:   { dflt: '#76d900' },
  oculomotorBackgroundColor: { dflt: '#000000' },
  oculomotorTargetShape:   { dflt: 'circle' },
  oculomotorCustomTargetImage: { dflt: '' },
  oculomotorTargetOpacity: { dflt: 1.0, min: 0, max: 1.0 },
  oculomotorBackgroundImage: { dflt: '' },
  oculomotorAudio: { dflt: '' },
  oculomotorBounceJitter: { dflt: 0, min: 0, max: 100 },
  oculomotorMotionDirection: { dflt: 1 },
  oculomotorShowTrail: { dflt: false },
  oculomotorLetterEnabled: { dflt: false },
  oculomotorLetterColor: { dflt: '#000000' },
  oculomotorLetterWeight: { dflt: 600 },
  oculomotorLetterScale: { dflt: 0.5, min: 0.45, max: 1.2 },
  oculomotorLilacChaserScale: { dflt: 1, min: 0.75, max: 1.25 },
  oculomotorLilacChaserColor: { dflt: '#ff00fe' },
  oculomotorViewingDistanceCm: { dflt: 60, min: 20, max: 120 },
  oculomotorCssPxPerCm: { dflt: 37.8, min: 10, max: 120 },
  preferentialLookingInputMode: { dflt: 'keyboard' },
  webGazerCalibrationAt: { dflt: '' },
  displayCalibrationAt: { dflt: '' },
  oculomotorEnableWebgazer: { dflt: false },
  oculomotorShowGazepoint: { dflt: false },
  readingWPS: { dflt: 4, min: 1, max: 20 },
  readingCrowding: { dflt: 1, min: 1, max: 5 },
  readingContrast: { dflt: 0.0, min: 0.0, max: 2.0 },
  readingStoryId: { dflt: 'en_story_01' },
  drivingDurationSec: { dflt: drivingDurationMinSec, min: drivingDurationMinSec, max: drivingDurationMaxSec },
  drivingRedFlashEnabled: { dflt: true },
  drivingDifficulty: { dflt: 'beginner' },
  drivingControlMode: { dflt: 'arrow' },
  drivingWheelCalibration: { dflt: '' },
  drivingRenderQuality: { dflt: 'high' },
  uiFontSizePx: { dflt: defaultUiFontSizePx, min: minUiFontSizePx, max: maxUiFontSizePx },
  uiFontBold: { dflt: false },
  uiTheme: { dflt: 'light' },
};

function StorageKey(name: string): string {
  return storagePrefix + name;
}

export const activeUserChangedEvent = runtimeStorageNamespace.activeUserChangedEvent;

const legacyVisionStoragePrefixes = ['vision_trainer_', 'vision-trainer-'] as const;
MigrateLegacyLocalStorageNamespace({
  canonicalPrefix: storagePrefix,
  legacyPrefixes: legacyVisionStoragePrefixes,
  suffixRenames: {
    hart_decoder_dock: 'hart.decoderDock',
  },
  mergeJsonArraySuffixes: ['users', 'training_records_v1'],
  mergeJsonObjectSuffixes: ['training_high_scores_v1'],
});

export function GetSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  const raw = localStorage.getItem(StorageKey(key));
  if (raw === null) return appSettingsMeta[key].dflt;
  const settingMeta = appSettingsMeta[key];
  if (typeof settingMeta.dflt === 'boolean') {
    return (raw === 'true') as AppSettings[K];
  }
  if (typeof settingMeta.dflt === 'number') {
    const num = parseFloat(raw);
    if (isNaN(num)) return settingMeta.dflt;
    if (settingMeta.min !== undefined && num < settingMeta.min) return settingMeta.dflt;
    if (settingMeta.max !== undefined && num > settingMeta.max) return settingMeta.dflt;
    return num as AppSettings[K];
  }
  if (key === 'uiTheme') {
    return (IsUiTheme(raw) ? raw : settingMeta.dflt) as AppSettings[K];
  }
  if (key === 'drivingRenderQuality') {
    return (IsDrivingRenderQualityLevel(raw) ? raw : settingMeta.dflt) as AppSettings[K];
  }
  if (key === 'drivingControlMode') {
    return (IsDrivingControlMode(raw) ? raw : settingMeta.dflt) as AppSettings[K];
  }
  return raw as unknown as AppSettings[K];
}

export function SetSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  localStorage.setItem(StorageKey(key), String(value));
  window.dispatchEvent(new CustomEvent(appSettingsChangedEvent, { detail: { key } }));
}

export function IsDrivingControlMode(value: unknown): value is DrivingControlMode {
  return value === 'arrow' || value === 'wasd' || value === 'wheel' || value === 'touch';
}

export function IsDrivingRenderQualityLevel(value: unknown): value is DrivingRenderQualityLevel {
  return value === 'low' || value === 'medium' || value === 'high';
}

export function IsCalibrated(): boolean {
  return (
    GetSetting('displayCalibrationAt') !== '' ||
    GetSetting('distanceInCM') !== defaultDistanceCm ||
    GetSetting('calBarLengthInMM') !== defaultCalBarLengthMm
  );
}

export function IsAssessmentCalibrationAtDefaults(): boolean {
  return (
    GetSetting('distanceInCM') === defaultDistanceCm &&
    GetSetting('calBarLengthInMM') === defaultCalBarLengthMm &&
    GetSetting('gammaValue') === defaultGammaValue
  );
}

export function MarkDisplayCalibrated(): void {
  SetSetting('displayCalibrationAt', new Date().toISOString());
}

export function ClearDisplayCalibration(): void {
  SetSetting('displayCalibrationAt', '');
}

export function ResetAllSettings(): void {
  for (const key of Object.keys(appSettingsMeta) as (keyof AppSettings)[]) {
    localStorage.removeItem(StorageKey(key));
  }
  window.dispatchEvent(new CustomEvent(appSettingsChangedEvent, { detail: { key: null } }));
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
