/**
 * Settings manager with localStorage persistence.
 * Also includes user (account) management and global constants.
 */

// ── Global Constants ──
import { getAuthUserNameFromToken } from '@rehab-trainer/ui/auth/authClient';
import { createUserStore } from '@rehab-trainer/ui/storage/userStore';
import type { OculomotorPattern, OculomotorTargetShape } from '../pages/training/oculomotor/types';

export const CARD_WIDTH_MM = 85.6;
export const CARD_HEIGHT_MM = 53.98;
export const DEFAULT_DISTANCE_CM = 60;
export const DEFAULT_CAL_BAR_LENGTH_MM = 149;
export const DEFAULT_GAMMA_VALUE = 2.0;
export const CAL_BAR_LENGTH_PX = 700;
export const APP_VERSION = '3.0.0';
export const STORAGE_PREFIX = 'vision_trainer_';
export const APP_SETTINGS_CHANGED_EVENT = 'vision-trainer-settings-changed';
export const DEFAULT_UI_FONT_SIZE_PX = 18;
export const MIN_UI_FONT_SIZE_PX = 14;
export const MAX_UI_FONT_SIZE_PX = 30;

export const DRIVING_DURATION_MIN_SEC = 80;
export const DRIVING_DURATION_MAX_SEC = 240;
export type DrivingControlMode = 'arrow' | 'wasd' | 'wheel';
export type UiTheme = 'light' | 'dark' | 'contrast';

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
  oculomotorDistractorCount: number;
  oculomotorTargetColor: string;
  oculomotorBackgroundColor: string;
  oculomotorTargetShape: OculomotorTargetShape;
  oculomotorCustomTargetImage: string;
  oculomotorTargetOpacity: number;
  oculomotorBackgroundImage: string;
  oculomotorAudio: string;
  oculomotorBounceJitter: number;
  preferentialLookingInputMode: 'keyboard' | 'webgazer';
  webGazerCalibrationAt: string;
  displayCalibrationAt: string;
  oculomotorEnableWebgazer: boolean;
  readingWPS: number;
  readingCrowding: number;
  readingContrast: number;
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

const META: { [K in keyof AppSettings]: SettingMeta<AppSettings[K]> } = {
  distanceInCM:           { dflt: DEFAULT_DISTANCE_CM,       min: 10,   max: 500 },
  calBarLengthInMM:       { dflt: DEFAULT_CAL_BAR_LENGTH_MM, min: 1,    max: 10000 },
  rulerLengthInMM:        { dflt: 0,    min: 0,    max: 10000 },
  gammaValue:             { dflt: DEFAULT_GAMMA_VALUE,  min: 0.8,  max: 4.0 },
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
  oculomotorDistractorCount: { dflt: 5, min: 0,    max: 12 },
  oculomotorTargetColor:   { dflt: '#FFFFFF' },
  oculomotorBackgroundColor: { dflt: '#000000' },
  oculomotorTargetShape:   { dflt: 'circle' },
  oculomotorCustomTargetImage: { dflt: '' },
  oculomotorTargetOpacity: { dflt: 1.0, min: 0.1, max: 1.0 },
  oculomotorBackgroundImage: { dflt: '' },
  oculomotorAudio: { dflt: '' },
  oculomotorBounceJitter: { dflt: 0, min: 0, max: 100 },
  preferentialLookingInputMode: { dflt: 'keyboard' },
  webGazerCalibrationAt: { dflt: '' },
  displayCalibrationAt: { dflt: '' },
  oculomotorEnableWebgazer: { dflt: false },
  readingWPS: { dflt: 4, min: 1, max: 20 },
  readingCrowding: { dflt: 1, min: 1, max: 5 },
  readingContrast: { dflt: 0.0, min: 0.0, max: 2.0 },
  readingStoryId: { dflt: 'en_story_01' },
  drivingDurationSec: { dflt: DRIVING_DURATION_MIN_SEC, min: DRIVING_DURATION_MIN_SEC, max: DRIVING_DURATION_MAX_SEC },
  drivingRedFlashEnabled: { dflt: true },
  drivingDifficulty: { dflt: 'beginner' },
  drivingControlMode: { dflt: 'arrow' },
  uiFontSizePx: { dflt: DEFAULT_UI_FONT_SIZE_PX, min: MIN_UI_FONT_SIZE_PX, max: MAX_UI_FONT_SIZE_PX },
  uiFontBold: { dflt: false },
  uiTheme: { dflt: 'light' },
};

function storageKey(name: string): string {
  return STORAGE_PREFIX + name;
}

export const ACTIVE_USER_CHANGED_EVENT = 'vision-trainer-active-user-changed';

function isUiTheme(value: string): value is UiTheme {
  return value === 'light' || value === 'dark' || value === 'contrast';
}

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  const raw = localStorage.getItem(storageKey(key));
  if (raw === null) return META[key].dflt;
  const meta = META[key];
  if (typeof meta.dflt === 'boolean') {
    return (raw === 'true') as AppSettings[K];
  }
  if (typeof meta.dflt === 'number') {
    const num = parseFloat(raw);
    if (isNaN(num)) return meta.dflt;
    if (meta.min !== undefined && num < meta.min) return meta.dflt;
    if (meta.max !== undefined && num > meta.max) return meta.dflt;
    return num as AppSettings[K];
  }
  if (key === 'uiTheme') {
    return (isUiTheme(raw) ? raw : meta.dflt) as AppSettings[K];
  }
  return raw as unknown as AppSettings[K];
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  localStorage.setItem(storageKey(key), String(value));
  window.dispatchEvent(new CustomEvent(APP_SETTINGS_CHANGED_EVENT, { detail: { key } }));
}

export function isDrivingControlMode(value: unknown): value is DrivingControlMode {
  return value === 'arrow' || value === 'wasd' || value === 'wheel';
}

export function isCalibrated(): boolean {
  return (
    getSetting('displayCalibrationAt') !== '' ||
    getSetting('distanceInCM') !== DEFAULT_DISTANCE_CM ||
    getSetting('calBarLengthInMM') !== DEFAULT_CAL_BAR_LENGTH_MM
  );
}

export function isAssessmentCalibrationAtDefaults(): boolean {
  return (
    getSetting('distanceInCM') === DEFAULT_DISTANCE_CM &&
    getSetting('calBarLengthInMM') === DEFAULT_CAL_BAR_LENGTH_MM &&
    getSetting('gammaValue') === DEFAULT_GAMMA_VALUE
  );
}

export function markDisplayCalibrated(): void {
  setSetting('displayCalibrationAt', new Date().toISOString());
}

export function clearDisplayCalibration(): void {
  setSetting('displayCalibrationAt', '');
}

export function resetAllSettings(): void {
  for (const key of Object.keys(META) as (keyof AppSettings)[]) {
    localStorage.removeItem(storageKey(key));
  }
  window.dispatchEvent(new CustomEvent(APP_SETTINGS_CHANGED_EVENT, { detail: { key: null } }));
}

export function getPixelsPerMM(): number {
  return CAL_BAR_LENGTH_PX / getSetting('calBarLengthInMM');
}

export function getMMPerPixel(): number {
  return getSetting('calBarLengthInMM') / CAL_BAR_LENGTH_PX;
}

// ── User Management (simple name-only) ──
export const userStore = createUserStore({
  activeUserChangedEvent: ACTIVE_USER_CHANGED_EVENT,
  storagePrefix: STORAGE_PREFIX,
});

export const addUser = userStore.addUser;
export const getActiveUser = () => getAuthUserNameFromToken() || userStore.getActiveUser();
export const getUsers = userStore.getUsers;
export const removeUser = userStore.removeUser;
export const setActiveUser = userStore.setActiveUser;
